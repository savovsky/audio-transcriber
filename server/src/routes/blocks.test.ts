import type { FastifyInstance } from 'fastify';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type {
  BlockMergeResponse,
  BlockRegenerateResponse,
  BlockUpdateResponse,
  Session,
  Speaker,
  TranscriptBlock,
} from 'shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import type { AppConfig } from '../config';
import { type AppDatabase, openDatabase } from '../db/database';
import { BlocksRepo, SessionsRepo, SpeakersRepo, makeBlockId, makeSpeakerId } from '../db/repositories';
import type { LlmClient } from '../llm/openrouter';

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

const SPEAKER_2: Speaker = { ...SPEAKER, id: makeSpeakerId('job-1', 1), speakerIndex: 1, label: 'Speaker 1' };

// Belongs to a different session — the cross-session reassignment guard.
const SPEAKER_OTHER: Speaker = {
  ...SPEAKER,
  id: makeSpeakerId('job-2', 0),
  sessionId: 'job-2',
};

// Echo fake: returns the user message, so cleanup candidates parse back to the
// block's verbatim text.
const FAKE_LLM: LlmClient = {
  chat: (options) => Promise.resolve(options.messages[1].content),
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
    // SPEAKER_OTHER's session — needed for the speakers FK.
    new SessionsRepo(db).upsert({ ...SESSION, id: 'job-2', title: 'job-2' });
    new SpeakersRepo(db).upsertMany([SPEAKER, SPEAKER_2, SPEAKER_OTHER]);
    new BlocksRepo(db).insertMany([makeBlock(0, true), makeBlock(1, false)]);
    const config: AppConfig = { port: 0, elevenlabsApiKey: null, openrouterApiKey: null, dataDir: tmp };
    app = buildApp(config, { db, llm: FAKE_LLM });
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

  it('PATCH reassigns the speaker (same session only)', async () => {
    const id = makeBlockId('job-1', 0);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/blocks/${encodeURIComponent(id)}`,
      payload: { speakerId: SPEAKER_2.id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<BlockUpdateResponse>().block.speakerId).toBe(SPEAKER_2.id);
  });

  it('PATCH speaker reassignment rejects unknown / cross-session speakers', async () => {
    const id = encodeURIComponent(makeBlockId('job-1', 0));
    const unknown = await app.inject({
      method: 'PATCH',
      url: `/api/blocks/${id}`,
      payload: { speakerId: 'job-1/s99' },
    });
    expect(unknown.statusCode).toBe(404);
    const cross = await app.inject({
      method: 'PATCH',
      url: `/api/blocks/${id}`,
      payload: { speakerId: SPEAKER_OTHER.id },
    });
    expect(cross.statusCode).toBe(400);
  });

  it('PATCH cleanedRun requires cleanedText, and then sets the provenance', async () => {
    const id = encodeURIComponent(makeBlockId('job-1', 1));
    const missing = await app.inject({
      method: 'PATCH',
      url: `/api/blocks/${id}`,
      payload: { cleanedRun: { style: 'formal-style', model: 'openai/gpt-4o-mini', temperature: 0.7 } },
    });
    expect(missing.statusCode).toBe(400);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/blocks/${id}`,
      payload: {
        cleanedText: 'от кандидат',
        cleanedRun: { style: 'formal-style', model: 'openai/gpt-4o-mini', temperature: 0.7 },
      },
    });
    expect(res.statusCode).toBe(200);
    const { block } = res.json<BlockUpdateResponse>();
    expect(block.cleanedText).toBe('от кандидат');
    expect(block.cleanedModel).toBe('openai/gpt-4o-mini');
    expect(block.cleanedStyle).toBe('formal-style');
    expect(block.cleanedTemperature).toBe(0.7);
  });

  it('POST regenerate returns a candidate and persists nothing', async () => {
    const id = encodeURIComponent(makeBlockId('job-1', 0));
    const res = await app.inject({
      method: 'POST',
      url: `/api/blocks/${id}/regenerate`,
      payload: { style: 'light-clean', model: 'openai/gpt-4o-mini', temperature: 0.4 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<BlockRegenerateResponse>();
    expect(body.candidateText).toBe('редактирано'); // echo fake → the current verbatim
    expect(body.run).toEqual({ style: 'light-clean', model: 'openai/gpt-4o-mini', temperature: 0.4 });
    // DB untouched: the earlier PATCH assertions still hold.
    expect(new BlocksRepo(db).get(makeBlockId('job-1', 0))?.cleanedText).toBe('ръчно редактирано');
  });

  it('POST regenerate validates input (400 bad style, 404 unknown block)', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: `/api/blocks/${encodeURIComponent(makeBlockId('job-1', 0))}/regenerate`,
      payload: { style: 'summary', model: 'm', temperature: 0.2 },
    });
    expect(bad.statusCode).toBe(400);
    const missing = await app.inject({
      method: 'POST',
      url: `/api/blocks/${encodeURIComponent('job-1/b99999')}/regenerate`,
      payload: { style: 'light-clean', model: 'm', temperature: 0.2 },
    });
    expect(missing.statusCode).toBe(404);
  });

  it('POST merge folds block 1 into block 0 (union range, concat, nulled provenance)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/blocks/${encodeURIComponent(makeBlockId('job-1', 1))}/merge`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<BlockMergeResponse>();
    expect(body.removedBlockId).toBe(makeBlockId('job-1', 1));
    expect(body.block.id).toBe(makeBlockId('job-1', 0));
    expect(body.block.startSec).toBe(0);
    expect(body.block.endSec).toBe(19.5);
    expect(body.block.verbatimText).toBe('редактирано дословно 1');
    expect(body.block.cleanedText).toBe('ръчно редактирано от кандидат');
    expect(body.block.cleanedModel).toBeNull(); // different runs → provenance dropped
    expect(body.block.speakerId).toBe(SPEAKER_2.id); // earlier block's (reassigned) speaker
    expect(new BlocksRepo(db).listBySession('job-1')).toHaveLength(1);
  });

  it('POST merge: 400 on the first block, 404 on unknown', async () => {
    const first = await app.inject({
      method: 'POST',
      url: `/api/blocks/${encodeURIComponent(makeBlockId('job-1', 0))}/merge`,
    });
    expect(first.statusCode).toBe(400);
    const missing = await app.inject({
      method: 'POST',
      url: `/api/blocks/${encodeURIComponent('job-1/b99999')}/merge`,
    });
    expect(missing.statusCode).toBe(404);
  });
});
