import type { FastifyInstance } from 'fastify';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BlockUpdateResponse, Session, Speaker, TranscriptBlock } from 'shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import type { AppConfig } from '../config';
import { type AppDatabase, openDatabase } from '../db/database';
import { BlocksRepo, SessionsRepo, SpeakersRepo, makeBlockId, makeSpeakerId } from '../db/repositories';

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
  suggestedRole: null,
  roleReasoning: null,
  confirmedRole: null,
};

function makeBlock(orderIndex: number, cleaned: boolean): TranscriptBlock {
  return {
    id: makeBlockId('job-1', orderIndex),
    sessionId: 'job-1',
    speakerId: SPEAKER.id,
    orderIndex,
    startSec: orderIndex * 10,
    endSec: orderIndex * 10 + 9.5,
    verbatimText: `дословно ${orderIndex}`,
    cleanedText: cleaned ? `изчистено ${orderIndex}` : null,
    cleanedModel: cleaned ? 'google/gemini-2.5-flash' : null,
    cleanedStyle: cleaned ? 'clean-verbatim' : null,
    cleanedTemperature: cleaned ? 0.2 : null,
  };
}

describe('block routes', () => {
  let tmp: string;
  let db: AppDatabase;
  let app: FastifyInstance;

  beforeAll(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'blocks-routes-test-'));
    db = await openDatabase(tmp);
    new SessionsRepo(db).upsert(SESSION);
    new SpeakersRepo(db).upsertMany([SPEAKER]);
    new BlocksRepo(db).insertMany([makeBlock(0, true), makeBlock(1, false)]);
    const config: AppConfig = { port: 0, elevenlabsApiKey: null, openrouterApiKey: null, dataDir: tmp };
    app = buildApp(config, db);
  });

  afterAll(async () => {
    await app.close();
    db.close();
    await rm(tmp, { recursive: true, force: true });
  });

  it('PATCH updates verbatimText only', async () => {
    const id = makeBlockId('job-1', 0);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/blocks/${encodeURIComponent(id)}`,
      payload: { verbatimText: 'редактирано' },
    });
    expect(res.statusCode).toBe(200);
    const { block } = res.json<BlockUpdateResponse>();
    expect(block.verbatimText).toBe('редактирано');
    expect(block.cleanedText).toBe('изчистено 0');
  });

  it('PATCH updates cleanedText only, preserving the cleaned_* provenance', async () => {
    const id = makeBlockId('job-1', 0);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/blocks/${encodeURIComponent(id)}`,
      payload: { cleanedText: 'ръчно редактирано' },
    });
    expect(res.statusCode).toBe(200);
    const { block } = res.json<BlockUpdateResponse>();
    expect(block.cleanedText).toBe('ръчно редактирано');
    expect(block.cleanedModel).toBe('google/gemini-2.5-flash');
    expect(block.cleanedStyle).toBe('clean-verbatim');
    expect(block.cleanedTemperature).toBe(0.2);
  });

  it('PATCH can fill a NULL cleanedText', async () => {
    const id = makeBlockId('job-1', 1);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/blocks/${encodeURIComponent(id)}`,
      payload: { cleanedText: 'първо изчистване' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<BlockUpdateResponse>().block.cleanedText).toBe('първо изчистване');
  });

  it('PATCH rejects an empty body with 400', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/blocks/${encodeURIComponent(makeBlockId('job-1', 0))}`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('PATCH rejects an empty verbatimText with 400', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/blocks/${encodeURIComponent(makeBlockId('job-1', 0))}`,
      payload: { verbatimText: '   ' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PATCH returns 404 for an unknown block', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/blocks/${encodeURIComponent('job-1/b99999')}`,
      payload: { verbatimText: 'x' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Block not found' });
  });
});
