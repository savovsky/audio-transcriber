import type { FastifyInstance } from 'fastify';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type {
  Session,
  SessionArtifactResponse,
  SessionDetailResponse,
  SessionListResponse,
  SessionRecleanResponse,
  Speaker,
  TranscriptBlock,
} from 'shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import type { AppConfig } from '../config';
import { type AppDatabase, openDatabase } from '../db/database';
import { BlocksRepo, SessionsRepo, SpeakersRepo, makeBlockId, makeSpeakerId } from '../db/repositories';
import type { LlmClient } from '../llm/openrouter';

// Echo fake for the LLM routes: cleanup requests (marker protocol) echo back so
// candidates parse to the verbatim text; anything else returns a canned artifact.
const FAKE_LLM: LlmClient = {
  chat: (options) => {
    const user = options.messages[1].content;
    return Promise.resolve(user.includes('<<<BLOCK') ? user : 'АРТЕФАКТ');
  },
};

const SESSION: Session = {
  id: 'job-1',
  title: 'job-1',
  referenceNumber: '1362/2025',
  audioFileName: 'recording.mp3',
  durationSec: 18,
  status: 'ready',
  summaryText: null,
  keyFactsText: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const SPEAKER: Speaker = {
  id: makeSpeakerId('job-1', 0),
  sessionId: 'job-1',
  speakerIndex: 0,
  label: 'Speaker 0',
  suggestedRole: 'Съдия',
  roleReasoning: 'test',
  confirmedRole: null,
};

const BLOCK: TranscriptBlock = {
  id: makeBlockId('job-1', 0),
  sessionId: 'job-1',
  speakerId: SPEAKER.id,
  orderIndex: 0,
  startSec: 0,
  endSec: 9.5,
  verbatimText: 'а',
  cleanedText: 'А.',
  cleanedModel: 'google/gemini-2.5-flash',
  cleanedStyle: 'clean-verbatim',
  cleanedTemperature: 0.2,
};

// 2000 bytes of recognizable content so range responses can be verified.
const AUDIO_BYTES = Buffer.from(Array.from({ length: 2000 }, (_, i) => i % 256));

describe('session routes', () => {
  let tmp: string;
  let db: AppDatabase;
  let app: FastifyInstance;

  beforeAll(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'routes-test-'));
    await mkdir(path.join(tmp, 'jobs', SESSION.id), { recursive: true });
    await writeFile(path.join(tmp, 'jobs', SESSION.id, SESSION.audioFileName), AUDIO_BYTES);

    db = await openDatabase(tmp);
    new SessionsRepo(db).upsert(SESSION);
    // Session whose audio file is missing from the job dir.
    new SessionsRepo(db).upsert({ ...SESSION, id: 'job-no-audio', title: 'job-no-audio' });
    // Session whose audioFileName tries to escape the job dir.
    new SessionsRepo(db).upsert({
      ...SESSION,
      id: 'job-evil',
      title: 'job-evil',
      audioFileName: '../outside.mp3',
    });
    new SpeakersRepo(db).upsertMany([SPEAKER]);
    new BlocksRepo(db).insertMany([BLOCK]);

    const config: AppConfig = { port: 0, elevenlabsApiKey: null, openrouterApiKey: null, dataDir: tmp };
    app = buildApp(config, { db });
  });

  afterAll(async () => {
    await app.close();
    db.close();
    await rm(tmp, { recursive: true, force: true });
  });

  it('GET /api/sessions lists sessions newest-first', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sessions' });
    expect(res.statusCode).toBe(200);
    const body = res.json<SessionListResponse>();
    expect(body.sessions.length).toBe(3);
    expect(body.sessions[0]).toMatchObject({ id: SESSION.id, referenceNumber: '1362/2025', status: 'ready' });
  });

  it('GET /api/sessions/:id returns session + speakers + blocks + audioUrl in one payload', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sessions/job-1' });
    expect(res.statusCode).toBe(200);
    const body = res.json<SessionDetailResponse>();
    expect(body.session.id).toBe('job-1');
    expect(body.speakers).toHaveLength(1);
    expect(body.speakers[0].suggestedRole).toBe('Съдия');
    expect(body.blocks).toHaveLength(1);
    expect(body.blocks[0].verbatimText).toBe('а');
    expect(body.audioUrl).toBe('/api/sessions/job-1/audio');
  });

  it('GET /api/sessions/:id returns 404 for an unknown session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sessions/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Session not found' });
  });

  it('GET /api/sessions/:id/audio streams the full file with Accept-Ranges', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sessions/job-1/audio' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('audio/mpeg');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-length']).toBe('2000');
    expect(res.rawPayload.equals(AUDIO_BYTES)).toBe(true);
  });

  it('GET audio honors a Range request with 206 partial content', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions/job-1/audio',
      headers: { range: 'bytes=10-19' },
    });
    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 10-19/2000');
    expect(res.headers['content-length']).toBe('10');
    expect(res.rawPayload.equals(AUDIO_BYTES.subarray(10, 20))).toBe(true);
  });

  it('GET audio clamps an open-ended Range to the file size', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions/job-1/audio',
      headers: { range: 'bytes=1990-' },
    });
    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 1990-1999/2000');
    expect(res.rawPayload).toHaveLength(10);
  });

  it('GET audio rejects an unsatisfiable Range with 416', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions/job-1/audio',
      headers: { range: 'bytes=5000-' },
    });
    expect(res.statusCode).toBe(416);
    expect(res.headers['content-range']).toBe('bytes */2000');
  });

  it('GET audio returns 404 when the file is missing from the job dir', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sessions/job-no-audio/audio' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Audio file not found' });
  });

  it('GET audio blocks path traversal outside the job dir', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sessions/job-evil/audio' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Invalid audio path' });
  });

  it('LLM routes answer 503 when no OpenRouter client is configured', async () => {
    const reclean = await app.inject({
      method: 'POST',
      url: '/api/sessions/job-1/reclean',
      payload: { style: 'light-clean', model: 'm', temperature: 0.2, mode: 'start' },
    });
    expect(reclean.statusCode).toBe(503);
    const artifacts = await app.inject({
      method: 'POST',
      url: '/api/sessions/job-1/artifacts',
      payload: { kind: 'summary', model: 'm', temperature: 0.2 },
    });
    expect(artifacts.statusCode).toBe(503);
  });
});

// LLM-backed session routes get their own app instance (same db) with the fake.
describe('session LLM routes (fake LLM)', () => {
  let tmp: string;
  let db: AppDatabase;
  let app: FastifyInstance;

  beforeAll(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'session-llm-routes-test-'));
    db = await openDatabase(tmp);
    new SessionsRepo(db).upsert(SESSION);
    new SpeakersRepo(db).upsertMany([SPEAKER]);
    new BlocksRepo(db).insertMany([BLOCK]);
    const config: AppConfig = { port: 0, elevenlabsApiKey: null, openrouterApiKey: null, dataDir: tmp };
    app = buildApp(config, { db, llm: FAKE_LLM });
  });

  afterAll(async () => {
    await app.close();
    db.close();
    await rm(tmp, { recursive: true, force: true });
  });

  it('POST reclean start marks all blocks pending and cleans the first batch', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions/job-1/reclean',
      payload: { style: 'formal-style', model: 'openai/gpt-4o-mini', temperature: 0.7, mode: 'start' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<SessionRecleanResponse>();
    expect(body.total).toBe(1);
    expect(body.remaining).toBe(0);
    expect(body.cleanedBlocks).toHaveLength(1);
    expect(body.cleanedBlocks[0].cleanedText).toBe('а'); // echo fake → verbatim
    expect(body.cleanedBlocks[0].cleanedModel).toBe('openai/gpt-4o-mini');
    expect(body.cleanedBlocks[0].cleanedStyle).toBe('formal-style');
    expect(body.cleanedBlocks[0].cleanedTemperature).toBe(0.7);
  });

  it('POST reclean continue is a no-op when nothing is pending', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions/job-1/reclean',
      payload: { style: 'formal-style', model: 'openai/gpt-4o-mini', temperature: 0.7, mode: 'continue' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<SessionRecleanResponse>();
    expect(body.cleanedBlocks).toHaveLength(0);
    expect(body.remaining).toBe(0);
  });

  it('POST reclean validates input and unknown sessions', async () => {
    const badStyle = await app.inject({
      method: 'POST',
      url: '/api/sessions/job-1/reclean',
      payload: { style: 'summary', model: 'm', temperature: 0.2, mode: 'start' },
    });
    expect(badStyle.statusCode).toBe(400);
    const badMode = await app.inject({
      method: 'POST',
      url: '/api/sessions/job-1/reclean',
      payload: { style: 'light-clean', model: 'm', temperature: 0.2, mode: 'restart' },
    });
    expect(badMode.statusCode).toBe(400);
    const missing = await app.inject({
      method: 'POST',
      url: '/api/sessions/nope/reclean',
      payload: { style: 'light-clean', model: 'm', temperature: 0.2, mode: 'start' },
    });
    expect(missing.statusCode).toBe(404);
  });

  it('POST artifacts generates summary and key-facts onto the session row', async () => {
    const summary = await app.inject({
      method: 'POST',
      url: '/api/sessions/job-1/artifacts',
      payload: { kind: 'summary', model: 'google/gemini-2.5-flash', temperature: 0.2 },
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json<SessionArtifactResponse>().session.summaryText).toBe('АРТЕФАКТ');

    const keyFacts = await app.inject({
      method: 'POST',
      url: '/api/sessions/job-1/artifacts',
      payload: { kind: 'key-facts', model: 'google/gemini-2.5-flash', temperature: 0.2 },
    });
    expect(keyFacts.statusCode).toBe(200);
    expect(keyFacts.json<SessionArtifactResponse>().session.keyFactsText).toBe('АРТЕФАКТ');
  });

  it('POST artifacts validates input and unknown sessions', async () => {
    const badKind = await app.inject({
      method: 'POST',
      url: '/api/sessions/job-1/artifacts',
      payload: { kind: 'light-clean', model: 'm', temperature: 0.2 },
    });
    expect(badKind.statusCode).toBe(400);
    const missing = await app.inject({
      method: 'POST',
      url: '/api/sessions/nope/artifacts',
      payload: { kind: 'summary', model: 'm', temperature: 0.2 },
    });
    expect(missing.statusCode).toBe(404);
  });
});
