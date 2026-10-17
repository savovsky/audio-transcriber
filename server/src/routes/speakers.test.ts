import type { FastifyInstance } from 'fastify';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Session, Speaker, SpeakerUpdateResponse } from 'shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import type { AppConfig } from '../config';
import { type AppDatabase, openDatabase } from '../db/database';
import { SessionsRepo, SpeakersRepo, makeSpeakerId } from '../db/repositories';

const SESSION: Session = {
  id: 'job-1',
  title: 'job-1',
  referenceNumber: null,
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
  roleReasoning: 'води заседанието',
  confirmedRole: null,
};

describe('speaker routes', () => {
  let tmp: string;
  let db: AppDatabase;
  let app: FastifyInstance;
  const url = `/api/speakers/${encodeURIComponent(SPEAKER.id)}`;

  beforeAll(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'speakers-routes-test-'));
    db = await openDatabase(tmp);
    new SessionsRepo(db).upsert(SESSION);
    new SpeakersRepo(db).upsertMany([SPEAKER]);
    const config: AppConfig = { port: 0, elevenlabsApiKey: null, openrouterApiKey: null, dataDir: tmp };
    app = buildApp(config, { db });
  });

  afterAll(async () => {
    await app.close();
    db.close();
    await rm(tmp, { recursive: true, force: true });
  });

  it('PATCH renames the speaker', async () => {
    const res = await app.inject({ method: 'PATCH', url, payload: { label: 'Председател' } });
    expect(res.statusCode).toBe(200);
    const { speaker } = res.json<SpeakerUpdateResponse>();
    expect(speaker.label).toBe('Председател');
    expect(speaker.suggestedRole).toBe('Съдия'); // untouched
    expect(speaker.confirmedRole).toBeNull();
  });

  it('PATCH confirms a role (explicit user action; suggestion stays as proposed)', async () => {
    const res = await app.inject({ method: 'PATCH', url, payload: { confirmedRole: 'Съдия' } });
    expect(res.statusCode).toBe(200);
    const { speaker } = res.json<SpeakerUpdateResponse>();
    expect(speaker.confirmedRole).toBe('Съдия');
    expect(speaker.suggestedRole).toBe('Съдия');
  });

  it('PATCH accepts a free-text role outside the vocabulary', async () => {
    const res = await app.inject({ method: 'PATCH', url, payload: { confirmedRole: 'Дежурен' } });
    expect(res.statusCode).toBe(200);
    expect(res.json<SpeakerUpdateResponse>().speaker.confirmedRole).toBe('Дежурен');
  });

  it('PATCH rejects empty body / blank values with 400', async () => {
    const empty = await app.inject({ method: 'PATCH', url, payload: {} });
    expect(empty.statusCode).toBe(400);
    const blankLabel = await app.inject({ method: 'PATCH', url, payload: { label: '  ' } });
    expect(blankLabel.statusCode).toBe(400);
    const blankRole = await app.inject({ method: 'PATCH', url, payload: { confirmedRole: '' } });
    expect(blankRole.statusCode).toBe(400);
  });

  it('PATCH returns 404 for an unknown speaker', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/speakers/${encodeURIComponent('job-1/s99')}`,
      payload: { label: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });
});
