import type { FastifyInstance, FastifyReply } from 'fastify';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { ApiErrorResponse, SessionDetailResponse, SessionListResponse } from 'shared';
import type { AppDatabase } from '../db/database';
import { BlocksRepo, SessionsRepo, SpeakersRepo } from '../db/repositories';

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
}

export function registerSessionRoutes(app: FastifyInstance, ctx: SessionRoutesContext): void {
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
