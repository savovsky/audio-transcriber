import type { FastifyInstance, FastifyReply } from 'fastify';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import {
  type ApiErrorResponse,
  PER_BLOCK_CLEANUP_STYLE_IDS,
  type PerBlockCleanupStyleId,
  type SessionArtifactRequest,
  type SessionArtifactResponse,
  type SessionDetailResponse,
  type SessionListResponse,
  type SessionRecleanRequest,
  type SessionRecleanResponse,
} from 'shared';
import type { AppDatabase } from '../db/database';
import { BlocksRepo, SessionsRepo, SpeakersRepo } from '../db/repositories';
import type { LlmClient } from '../llm/openrouter';
import { generateSessionArtifact, recleanSessionBatch } from '../pipeline/process';

// Session routes: list, detail (one payload for the whole detail page), and
// audio streaming from the job dir. Routes talk to repositories only
// (dependency rule: routes → pipeline → providers; db is infrastructure).

function notFound(reply: FastifyReply, message: string): ApiErrorResponse {
  void reply.code(404);
  return { error: message };
}

export interface SessionRoutesContext {
  db: AppDatabase;
  dataDir: string;
  llm: LlmClient | null; // null → LLM routes answer 503 (no OpenRouter key)
}

function isPerBlockStyleId(value: unknown): value is PerBlockCleanupStyleId {
  return typeof value === 'string' && (PER_BLOCK_CLEANUP_STYLE_IDS as readonly string[]).includes(value);
}

export function registerSessionRoutes(app: FastifyInstance, ctx: SessionRoutesContext): void {
  registerSessionReadRoutes(app, ctx);
  registerSessionLlmRoutes(app, ctx);
}

// Read side: list, detail, audio streaming (POC_M3).
function registerSessionReadRoutes(app: FastifyInstance, ctx: SessionRoutesContext): void {
  const { db, dataDir } = ctx;
  const sessions = new SessionsRepo(db);
  const speakers = new SpeakersRepo(db);
  const blocks = new BlocksRepo(db);

  app.get('/api/sessions', (): SessionListResponse => {
    return {
      sessions: sessions.list().map(({ id, title, referenceNumber, durationSec, status, createdAt }) => ({
        id,
        title,
        referenceNumber,
        durationSec,
        status,
        createdAt,
      })),
    };
  });

  app.get<{ Params: { id: string } }>(
    '/api/sessions/:id',
    (request, reply): SessionDetailResponse | ApiErrorResponse => {
      const session = sessions.get(request.params.id);
      if (!session) return notFound(reply, 'Session not found');
      return {
        session,
        speakers: speakers.listBySession(session.id),
        blocks: blocks.listBySession(session.id),
        audioUrl: `/api/sessions/${encodeURIComponent(session.id)}/audio`,
      };
    },
  );

  // Audio playback sync: streams the source MP3 from data/jobs/<id>/ with HTTP
  // Range support so the client can seek to any block offset.
  app.get<{ Params: { id: string } }>('/api/sessions/:id/audio', async (request, reply) => {
    const session = sessions.get(request.params.id);
    if (!session) return notFound(reply, 'Session not found');

    // Path-traversal guard: the resolved audio path must stay inside the
    // session's own job dir (audioFileName comes from the imported export).
    const jobDir = path.resolve(dataDir, 'jobs', session.id);
    const audioPath = path.resolve(jobDir, session.audioFileName);
    if (audioPath !== jobDir && !audioPath.startsWith(jobDir + path.sep)) {
      return reply.code(400).send({ error: 'Invalid audio path' } satisfies ApiErrorResponse);
    }

    let size: number;
    try {
      size = (await stat(audioPath)).size;
    } catch {
      return notFound(reply, 'Audio file not found');
    }

    // Note: the audio/mpeg + Accept-Ranges headers are set only on the streaming
    // branches — error replies are JSON.
    const range = request.headers.range;
    const match = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (start >= size || start > end) {
        return reply
          .code(416)
          .header('Content-Range', `bytes */${size}`)
          .send({ error: 'Range not satisfiable' } satisfies ApiErrorResponse);
      }
      return reply
        .code(206)
        .header('Content-Type', 'audio/mpeg')
        .header('Accept-Ranges', 'bytes')
        .header('Content-Range', `bytes ${start}-${end}/${size}`)
        .header('Content-Length', end - start + 1)
        .send(createReadStream(audioPath, { start, end }));
    }

    return reply
      .header('Content-Type', 'audio/mpeg')
      .header('Accept-Ranges', 'bytes')
      .header('Content-Length', size)
      .send(createReadStream(audioPath));
  });
}

// LLM side (POC_M4): re-clean + artifacts. 503 when no OpenRouter key.
function registerSessionLlmRoutes(app: FastifyInstance, ctx: SessionRoutesContext): void {
  const { db, llm } = ctx;
  const sessions = new SessionsRepo(db);

  // Session-wide re-clean (POC_M4): ONE batch per call; the client loops until
  // remaining === 0 (blocking UI with a progress count). 'start' marks ALL
  // blocks pending first — manual cleaned-text edits are lost (UI confirms).
  app.post<{ Params: { id: string }; Body: Partial<SessionRecleanRequest> }>(
    '/api/sessions/:id/reclean',
    async (request, reply): Promise<SessionRecleanResponse | ApiErrorResponse> => {
      if (!llm) {
        void reply.code(503);
        return { error: 'OpenRouter API key is not configured' };
      }
      const session = sessions.get(request.params.id);
      if (!session) return notFound(reply, 'Session not found');
      const body = request.body ?? {};
      if (!isPerBlockStyleId(body.style)) {
        void reply.code(400);
        return { error: `style must be one of: ${PER_BLOCK_CLEANUP_STYLE_IDS.join(', ')}` };
      }
      if (typeof body.model !== 'string' || body.model.trim() === '') {
        void reply.code(400);
        return { error: 'model must be a non-empty string' };
      }
      if (typeof body.temperature !== 'number' || !Number.isFinite(body.temperature)) {
        void reply.code(400);
        return { error: 'temperature must be a finite number' };
      }
      if (body.mode !== 'start' && body.mode !== 'continue') {
        void reply.code(400);
        return { error: "mode must be 'start' or 'continue'" };
      }
      return recleanSessionBatch({
        db,
        llm,
        sessionId: session.id,
        run: { style: body.style, model: body.model, temperature: body.temperature },
        mode: body.mode,
      });
    },
  );

  // Session-level artifacts (POC_M4): generate summary / key-facts from the
  // cleaned transcript; stored on the session row.
  app.post<{ Params: { id: string }; Body: Partial<SessionArtifactRequest> }>(
    '/api/sessions/:id/artifacts',
    async (request, reply): Promise<SessionArtifactResponse | ApiErrorResponse> => {
      if (!llm) {
        void reply.code(503);
        return { error: 'OpenRouter API key is not configured' };
      }
      const session = sessions.get(request.params.id);
      if (!session) return notFound(reply, 'Session not found');
      const body = request.body ?? {};
      if (body.kind !== 'summary' && body.kind !== 'key-facts') {
        void reply.code(400);
        return { error: "kind must be 'summary' or 'key-facts'" };
      }
      if (typeof body.model !== 'string' || body.model.trim() === '') {
        void reply.code(400);
        return { error: 'model must be a non-empty string' };
      }
      if (typeof body.temperature !== 'number' || !Number.isFinite(body.temperature)) {
        void reply.code(400);
        return { error: 'temperature must be a finite number' };
      }
      await generateSessionArtifact({
        db,
        llm,
        sessionId: session.id,
        kind: body.kind,
        model: body.model,
        temperature: body.temperature,
      });
      return { session: sessions.get(session.id)! };
    },
  );
}
