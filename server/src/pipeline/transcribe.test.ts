import type { TranscriptUtterance, TranscriptionResult } from 'shared';
import { describe, expect, it } from 'vitest';
import {
  formatTimestamp,
  formatTranscript,
  makeJobId,
  mergeChunkTranscriptions,
  shiftUtterances,
} from './transcribe';

const utt = (init: { speaker: number; span: [number, number]; text?: string }): TranscriptUtterance => ({
  speakerIndex: init.speaker,
  startSec: init.span[0],
  endSec: init.span[1],
  text: init.text ?? 'текст',
});

describe('shiftUtterances', () => {
  it('shifts chunk-relative timestamps to absolute', () => {
    const shifted = shiftUtterances(
      [utt({ speaker: 0, span: [10, 20] }), utt({ speaker: 1, span: [25, 30] })],
      900,
    );
    expect(shifted[0]).toMatchObject({ startSec: 910, endSec: 920 });
    expect(shifted[1]).toMatchObject({ startSec: 925, endSec: 930 });
  });
});

describe('mergeChunkTranscriptions', () => {
  it('flattens chunks and sorts by absolute start', () => {
    const merged = mergeChunkTranscriptions([
      { chunkIndex: 1, chunkStartSec: 900, utterances: [utt({ speaker: 1, span: [905, 910] })] },
      {
        chunkIndex: 0,
        chunkStartSec: 0,
        utterances: [utt({ speaker: 0, span: [5, 10] }), utt({ speaker: 0, span: [20, 25] })],
      },
    ]);
    expect(merged.map((u) => u.startSec)).toEqual([5, 20, 905]);
  });
});

describe('formatTimestamp', () => {
  it('formats h:mm:ss', () => {
    expect(formatTimestamp(0)).toBe('00:00:00');
    expect(formatTimestamp(3723.7)).toBe('01:02:03');
  });
});

describe('formatTranscript', () => {
  it('renders the readable diarized dump', () => {
    const result: TranscriptionResult = {
      provider: 'deepgram/nova-3',
      language: 'bg',
      utterances: [
        utt({ speaker: 0, span: [5, 9], text: 'здравейте' }),
        utt({ speaker: 1, span: [65, 70], text: 'добър ден' }),
      ],
    };
    const text = formatTranscript(result);
    expect(text).toContain('provider: deepgram/nova-3');
    expect(text).toContain('[00:00:05] Speaker 0: здравейте');
    expect(text).toContain('[00:01:05] Speaker 1: добър ден');
  });
});

describe('makeJobId', () => {
  it('sanitizes the file name and appends a timestamp', () => {
    expect(makeJobId('/tmp/460_2026.mp3')).toMatch(/^460_2026-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
  });

  it('strips non-ASCII characters (Bulgarian file names)', () => {
    expect(makeJobId('C:\\audio\\до 1362_2025.mp3')).toMatch(/^1362_2025-/);
  });

  it('falls back to "recording" when nothing survives sanitizing', () => {
    expect(makeJobId('/tmp/ГД.mp3')).toMatch(/^recording-/);
  });
});
