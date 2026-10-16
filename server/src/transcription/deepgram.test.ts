import type { ListenV1Response } from '@deepgram/sdk';
import { describe, expect, it } from 'vitest';
import { mapDeepgramResponse } from './deepgram';

// Minimal shape of a diarized Deepgram prerecorded response (utterances mode).
function fixture(utterances: unknown): ListenV1Response {
  return { results: { utterances } } as unknown as ListenV1Response;
}

describe('mapDeepgramResponse', () => {
  it('maps diarized utterances to the shared contract', () => {
    const response = fixture([
      { speaker: 0, start: 0.5, end: 4.2, transcript: ' Здравейте, колеги. ' },
      { speaker: 1, start: 4.6, end: 9.0, transcript: 'Добър ден.' },
    ]);
    expect(mapDeepgramResponse(response)).toEqual([
      { speakerIndex: 0, startSec: 0.5, endSec: 4.2, text: 'Здравейте, колеги.' },
      { speakerIndex: 1, startSec: 4.6, endSec: 9.0, text: 'Добър ден.' },
    ]);
  });

  it('defaults a missing speaker label to 0', () => {
    const response = fixture([{ start: 0, end: 1, transcript: 'без етикет' }]);
    expect(mapDeepgramResponse(response)[0]?.speakerIndex).toBe(0);
  });

  it('throws when the response has no utterances', () => {
    expect(() => mapDeepgramResponse(fixture(undefined))).toThrow(/no utterances/i);
    expect(() => mapDeepgramResponse(fixture([]))).toThrow(/no utterances/i);
  });
});
