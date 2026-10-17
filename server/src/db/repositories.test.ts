import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Session, Speaker, TranscriptBlock } from 'shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type AppDatabase, openDatabase } from './database';
import { BlocksRepo, SessionsRepo, SpeakersRepo, makeBlockId, makeSpeakerId } from './repositories';

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

const SPEAKERS: Speaker[] = [
  {
    id: makeSpeakerId('job-1', 0),
    sessionId: 'job-1',
    speakerIndex: 0,
    label: 'Speaker 0',
    suggestedRole: null,
    roleReasoning: null,
    confirmedRole: null,
  },
  {
    id: makeSpeakerId('job-1', 1),
    sessionId: 'job-1',
    speakerIndex: 1,
    label: 'Speaker 1',
    suggestedRole: null,
    roleReasoning: null,
    confirmedRole: null,
  },
];

const BLOCKS: TranscriptBlock[] = [
  {
    id: makeBlockId('job-1', 0),
    sessionId: 'job-1',
    speakerId: makeSpeakerId('job-1', 0),
    orderIndex: 0,
    startSec: 0,
    endSec: 9.5,
    verbatimText: 'а',
    cleanedText: null,
    cleanedModel: null,
    cleanedStyle: null,
    cleanedTemperature: null,
  },
  {
    id: makeBlockId('job-1', 1),
    sessionId: 'job-1',
    speakerId: makeSpeakerId('job-1', 1),
    orderIndex: 1,
    startSec: 10,
    endSec: 14.5,
    verbatimText: 'б',
    cleanedText: null,
    cleanedModel: null,
    cleanedStyle: null,
    cleanedTemperature: null,
  },
];

describe('repositories', () => {
  let tmp: string;
  let db: AppDatabase;
  let sessions: SessionsRepo;
  let speakers: SpeakersRepo;
  let blocks: BlocksRepo;

  beforeAll(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'db-test-'));
    db = await openDatabase(tmp);
    sessions = new SessionsRepo(db);
    speakers = new SpeakersRepo(db);
    blocks = new BlocksRepo(db);
    sessions.upsert(SESSION);
    speakers.upsertMany(SPEAKERS);
    blocks.insertMany(BLOCKS);
  });

  afterAll(async () => {
    db.close();
    await rm(tmp, { recursive: true, force: true });
  });

  it('creates app.db in the data dir', async () => {
    const { stat } = await import('node:fs/promises');
    await expect(stat(path.join(tmp, 'app.db'))).resolves.toBeTruthy();
  });

  it('deterministic ids', () => {
    expect(makeSpeakerId('job-1', 2)).toBe('job-1/s2');
    expect(makeBlockId('job-1', 7)).toBe('job-1/b00007');
  });

  it('session round-trip and status update', () => {
    expect(sessions.get('job-1')).toEqual(SESSION);
    sessions.setStatus('job-1', 'cleaning');
    expect(sessions.get('job-1')?.status).toBe('cleaning');
    sessions.setStatus('job-1', 'ready');
  });

  it('session-level summary / key-facts artifacts', () => {
    sessions.setSummaryText('job-1', 'резюме текст');
    sessions.setKeyFactsText('job-1', '- факт');
    const s = sessions.get('job-1');
    expect(s?.summaryText).toBe('резюме текст');
    expect(s?.keyFactsText).toBe('- факт');
  });

  it('speakers list + role suggestion lifecycle (suggestion stays a proposal)', () => {
    expect(speakers.listBySession('job-1')).toHaveLength(2);
    expect(speakers.listPendingRoleSuggestion('job-1')).toHaveLength(2);

    speakers.setRoleSuggestion(makeSpeakerId('job-1', 0), {
      suggestedRole: 'Водещ',
      roleReasoning: 'доминира в разговора',
    });
    expect(speakers.listPendingRoleSuggestion('job-1')).toHaveLength(1);

    const s = speakers.listBySession('job-1')[0];
    expect(s.suggestedRole).toBe('Водещ');
    expect(s.confirmedRole).toBeNull(); // suggestion is never auto-confirmed

    speakers.confirmRole(s.id, 'Участник');
    speakers.rename(s.id, 'Г-н Иванов');
    const updated = speakers.listBySession('job-1')[0];
    expect(updated.confirmedRole).toBe('Участник');
    expect(updated.label).toBe('Г-н Иванов');
  });

  it('blocks: pending-cleanup is the resume set, setCleaned clears it', () => {
    expect(blocks.listPendingCleanup('job-1')).toHaveLength(2);
    blocks.setCleaned(makeBlockId('job-1', 0), {
      cleanedText: 'а — изчистено',
      cleanedModel: 'google/gemini-2.5-flash',
      cleanedStyle: 'clean-verbatim',
      cleanedTemperature: 0.2,
    });
    const pending = blocks.listPendingCleanup('job-1');
    expect(pending).toHaveLength(1);
    expect(pending[0].orderIndex).toBe(1);

    const cleaned = blocks.listBySession('job-1')[0];
    expect(cleaned.cleanedText).toBe('а — изчистено');
    expect(cleaned.cleanedModel).toBe('google/gemini-2.5-flash');
    expect(cleaned.cleanedStyle).toBe('clean-verbatim');
    expect(cleaned.cleanedTemperature).toBe(0.2);
  });

  it('re-import upserts verbatim but never wipes cleaned text', () => {
    blocks.insertMany([{ ...BLOCKS[0], verbatimText: 'а — коригирано при повторен импорт' }, BLOCKS[1]]);
    const all = blocks.listBySession('job-1');
    expect(all[0].verbatimText).toBe('а — коригирано при повторен импорт');
    expect(all[0].cleanedText).toBe('а — изчистено'); // preserved
  });

  it('block speaker reassignment + verbatim edit', () => {
    blocks.setSpeaker(makeBlockId('job-1', 1), makeSpeakerId('job-1', 0));
    blocks.updateVerbatimText(makeBlockId('job-1', 1), 'б — ръчна редакция');
    const b = blocks.listBySession('job-1')[1];
    expect(b.speakerId).toBe(makeSpeakerId('job-1', 0));
    expect(b.verbatimText).toBe('б — ръчна редакция');
  });

  it('markCleanupPending nulls cleaned text + provenance for the session', () => {
    blocks.setCleaned(makeBlockId('job-1', 0), {
      cleanedText: 'а — изчистено',
      cleanedModel: 'google/gemini-2.5-flash',
      cleanedStyle: 'clean-verbatim',
      cleanedTemperature: 0.2,
    });
    blocks.markCleanupPending('job-1');
    const all = blocks.listBySession('job-1');
    expect(all.every((b) => b.cleanedText === null)).toBe(true);
    expect(all.every((b) => b.cleanedModel === null && b.cleanedStyle === null)).toBe(true);
    expect(blocks.listPendingCleanup('job-1')).toHaveLength(2);
  });

  it('mergeWithPrevious: union range, per-layer concat, provenance on exact match', () => {
    const run = {
      cleanedModel: 'google/gemini-2.5-flash',
      cleanedStyle: 'clean-verbatim' as const,
      cleanedTemperature: 0.2,
    };
    blocks.setCleaned(makeBlockId('job-1', 0), { cleanedText: 'а чисто', ...run });
    blocks.setCleaned(makeBlockId('job-1', 1), { cleanedText: 'б чисто', ...run });

    const result = blocks.mergeWithPrevious(makeBlockId('job-1', 1));
    expect(result?.removedId).toBe(makeBlockId('job-1', 1));
    const kept = result?.kept;
    expect(kept?.id).toBe(makeBlockId('job-1', 0));
    expect(kept?.startSec).toBe(0);
    expect(kept?.endSec).toBe(14.5); // union of both ranges
    expect(kept?.verbatimText).toContain('а');
    expect(kept?.cleanedText).toBe('а чисто б чисто');
    expect(kept?.cleanedModel).toBe('google/gemini-2.5-flash'); // provenance kept on match
    expect(blocks.listBySession('job-1')).toHaveLength(1);
  });

  it('mergeWithPrevious: provenance nulled on mismatch, cleaned null if either side null', () => {
    // mismatch case (block 1 was removed by the previous test's merge — re-insert)
    blocks.insertMany(BLOCKS);
    blocks.setCleaned(makeBlockId('job-1', 0), {
      cleanedText: 'а чисто',
      cleanedModel: 'google/gemini-2.5-flash',
      cleanedStyle: 'clean-verbatim',
      cleanedTemperature: 0.2,
    });
    blocks.setCleaned(makeBlockId('job-1', 1), {
      cleanedText: 'б чисто',
      cleanedModel: 'openai/gpt-4o-mini',
      cleanedStyle: 'formal-style',
      cleanedTemperature: 0.7,
    });
    const merged = blocks.mergeWithPrevious(makeBlockId('job-1', 1));
    expect(merged?.kept.cleanedText).toBe('а чисто б чисто');
    expect(merged?.kept.cleanedModel).toBeNull();
    expect(merged?.kept.cleanedStyle).toBeNull();
    expect(merged?.kept.cleanedTemperature).toBeNull();

    // either-side-null case (block 1 was re-created by the previous merge's
    // removal — re-insert a fresh block after the kept one)
    blocks.insertMany([{ ...BLOCKS[1], verbatimText: 'в', cleanedText: null }]);
    const merged2 = blocks.mergeWithPrevious(makeBlockId('job-1', 1));
    expect(merged2?.kept.cleanedText).toBeNull();
    expect(merged2?.kept.cleanedModel).toBeNull();
  });

  it('mergeWithPrevious: keeps the earlier speaker; null on first block / unknown id', () => {
    blocks.insertMany(BLOCKS);
    blocks.setSpeaker(makeBlockId('job-1', 0), makeSpeakerId('job-1', 0));
    blocks.setSpeaker(makeBlockId('job-1', 1), makeSpeakerId('job-1', 1));
    const merged = blocks.mergeWithPrevious(makeBlockId('job-1', 1));
    expect(merged?.kept.speakerId).toBe(makeSpeakerId('job-1', 0)); // earlier block's speaker

    expect(blocks.mergeWithPrevious(makeBlockId('job-1', 0))).toBeNull(); // now the first block
    expect(blocks.mergeWithPrevious('job-1/b99999')).toBeNull(); // unknown id
  });
});
