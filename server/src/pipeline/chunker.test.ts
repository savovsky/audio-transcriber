import { describe, expect, it } from 'vitest';
import { chunkFileName, parseFfmpegDuration, planChunks } from './chunker';

describe('parseFfmpegDuration', () => {
  it('parses the Duration line from ffmpeg -i stderr', () => {
    const stderr = [
      "Input #0, mp3, from 'recording.mp3':",
      '  Metadata:',
      '    encoder         : Lavf58.20.100',
      '  Duration: 01:23:45.67, start: 0.025056, bitrate: 128 kb/s',
    ].join('\n');
    expect(parseFfmpegDuration(stderr)).toBeCloseTo(1 * 3600 + 23 * 60 + 45.67);
  });

  it('returns null when no Duration line is present', () => {
    expect(parseFfmpegDuration('some other ffmpeg output')).toBeNull();
  });
});

describe('planChunks', () => {
  it('splits into 15-minute chunks with absolute offsets', () => {
    const plan = planChunks(40 * 60, 15 * 60);
    expect(plan).toHaveLength(3);
    expect(plan[0]).toMatchObject({ index: 0, startSec: 0, durationSec: 900 });
    expect(plan[1]).toMatchObject({ index: 1, startSec: 900, durationSec: 900 });
    expect(plan[2]).toMatchObject({ index: 2, startSec: 1800, durationSec: 600 });
  });

  it('short recording -> exactly one chunk', () => {
    const plan = planChunks(300, 900);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ startSec: 0, durationSec: 300 });
  });

  it('non-positive input -> no chunks', () => {
    expect(planChunks(0, 900)).toHaveLength(0);
    expect(planChunks(100, 0)).toHaveLength(0);
  });
});

describe('chunkFileName', () => {
  it('zero-pads the index', () => {
    expect(chunkFileName(0)).toBe('chunk-000.mp3');
    expect(chunkFileName(12)).toBe('chunk-012.mp3');
  });
});
