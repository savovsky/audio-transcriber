import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TranscriptionResult } from 'shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  IMPORT_PROVIDER_ID,
  parseElevenLabsExport,
  parseSpeakerIndex,
  runElevenLabsImport,
} from './elevenlabs-import';

// Synthetic fixture — generic text only, never real transcript content (privacy rule).
const FIXTURE = {
  language_code: 'bul',
  segments: [
    {
      text: 'Втори сегмент, подреден по време.',
      start_time: 10,
      end_time: 14.5,
      speaker: { id: 'speaker_1', name: 'Speaker 1' },
      words: [{ text: 'Втори', start_time: 10, end_time: 10.4 }],
    },
    {
      text: '[шум] Първи сегмент с аудио събитие.',
      start_time: 0,
      end_time: 9.5,
      speaker: { id: 'speaker_0', name: 'Speaker 0' },
      words: [{ text: '[шум]', start_time: 0, end_time: 1 }],
    },
    {
      text: 'Отговор на втория говорител.',
      start_time: 15,
      end_time: 18,
      speaker: { id: 'speaker_1', name: 'Speaker 1' },
      words: [],
    },
  ],
};

describe('parseSpeakerIndex', () => {
  it('parses standard speaker ids', () => {
    expect(parseSpeakerIndex('speaker_0')).toBe(0);
    expect(parseSpeakerIndex('speaker_12')).toBe(12);
  });

  it('returns null for non-standard ids', () => {
    expect(parseSpeakerIndex('SPEAKER_1')).toBeNull();
    expect(parseSpeakerIndex('anna')).toBeNull();
  });
});

describe('parseElevenLabsExport', () => {
  it('parses segments into utterances sorted by start time', () => {
    const result = parseElevenLabsExport(FIXTURE);
    expect(result.provider).toBe(IMPORT_PROVIDER_ID);
    expect(result.language).toBe('bul');
    expect(result.utterances.map((u) => u.startSec)).toEqual([0, 10, 15]);
  });

  it('maps speaker_N ids to numeric indices', () => {
    const result = parseElevenLabsExport(FIXTURE);
    expect(result.utterances.map((u) => u.speakerIndex)).toEqual([0, 1, 1]);
  });

  it('keeps audio-event tags inline in the text', () => {
    const result = parseElevenLabsExport(FIXTURE);
    expect(result.utterances[0].text).toContain('[шум]');
  });

  it('ignores the words[] arrays (utterance-level contract)', () => {
    const result = parseElevenLabsExport(FIXTURE);
    expect(result.utterances[0]).not.toHaveProperty('words');
  });

  it('falls back to first-appearance indices for non-standard speaker ids', () => {
    const result = parseElevenLabsExport({
      segments: [
        { text: 'а', start_time: 0, end_time: 1, speaker: { id: 'zed' } },
        { text: 'б', start_time: 1, end_time: 2, speaker: { id: 'anna' } },
        { text: 'в', start_time: 2, end_time: 3, speaker: { id: 'zed' } },
      ],
    });
    expect(result.utterances.map((u) => u.speakerIndex)).toEqual([0, 1, 0]);
  });

  it('rejects a shape without a segments array', () => {
    expect(() => parseElevenLabsExport({ nope: true })).toThrow(/segments/);
  });

  it('rejects segments with missing fields', () => {
    expect(() => parseElevenLabsExport({ segments: [{ text: 5 }] })).toThrow(/Segment 0/);
  });
});

describe('runElevenLabsImport', () => {
  let tmp: string;

  beforeAll(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'import-test-'));
  });

  afterAll(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('produces the same data/jobs/<jobId>/ structure as the transcribe pipeline', async () => {
    const exportPath = path.join(tmp, 'sample-export.json');
    const audioPath = path.join(tmp, 'recording.mp3');
    await writeFile(exportPath, JSON.stringify(FIXTURE), 'utf8');
    await writeFile(audioPath, 'fake-audio-bytes', 'utf8');

    const { jobId, jobDir, result } = await runElevenLabsImport(exportPath, {
      dataDir: tmp,
      audioPath,
      jobId: 'test-job',
    });

    expect(jobId).toBe('test-job');
    expect(jobDir).toBe(path.join(tmp, 'jobs', 'test-job'));
    expect(result.utterances).toHaveLength(3);

    // transcript.json round-trips through the shared contract
    const json = JSON.parse(
      await readFile(path.join(jobDir, 'transcript.json'), 'utf8'),
    ) as TranscriptionResult;
    expect(json.provider).toBe(IMPORT_PROVIDER_ID);
    expect(json.utterances).toHaveLength(3);

    // transcript.txt matches the POC_M1 human-readable shape
    const txt = await readFile(path.join(jobDir, 'transcript.txt'), 'utf8');
    expect(txt).toContain(`provider: ${IMPORT_PROVIDER_ID}`);
    expect(txt).toContain('[00:00:00] Speaker 0:');

    // raw export + audio are kept in the job dir
    const rawCopy = await readFile(path.join(jobDir, 'sample-export.json'), 'utf8');
    expect((JSON.parse(rawCopy) as typeof FIXTURE).segments).toHaveLength(3);
    const audioCopy = await readFile(path.join(jobDir, 'recording.mp3'), 'utf8');
    expect(audioCopy).toBe('fake-audio-bytes');
  });

  it('derives the job id from the export filename when --job is not given', async () => {
    const exportPath = path.join(tmp, 'my_recording 01.json');
    await writeFile(exportPath, JSON.stringify(FIXTURE), 'utf8');

    const { jobId } = await runElevenLabsImport(exportPath, { dataDir: tmp });
    expect(jobId).toMatch(/^my_recording-01-\d{4}-\d{2}-\d{2}T/);
  });
});
