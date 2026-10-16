import { DeepgramClient } from '@deepgram/sdk';
import type { ListenV1Response } from '@deepgram/sdk';
import { readFile } from 'node:fs/promises';
import type { TranscriptUtterance } from 'shared';
import type { TranscriptionProvider } from './provider';

export const DEEPGRAM_MODEL = 'nova-3';
export const DEEPGRAM_LANGUAGE = 'bg';

// Pure mapper (unit-tested): Deepgram's diarized utterances -> shared contract.
// Timestamps stay relative to the audio that was sent (i.e. the chunk).
export function mapDeepgramResponse(response: ListenV1Response): TranscriptUtterance[] {
  const utterances = (response.results.utterances ?? [])
    .filter((u) => u.transcript && u.start !== undefined && u.end !== undefined)
    .map((u) => ({
      speakerIndex: u.speaker ?? 0,
      startSec: u.start as number,
      endSec: u.end as number,
      text: (u.transcript as string).trim(),
    }));
  if (utterances.length === 0) {
    throw new Error('Deepgram response contained no utterances (diarization/utterances missing?).');
  }
  return utterances;
}

export class DeepgramProvider implements TranscriptionProvider {
  readonly id = `deepgram/${DEEPGRAM_MODEL}`;
  readonly language = DEEPGRAM_LANGUAGE;

  private readonly client: DeepgramClient;

  constructor(apiKey: string) {
    this.client = new DeepgramClient({ apiKey });
  }

  async transcribeChunk(chunkPath: string): Promise<TranscriptUtterance[]> {
    const audio = await readFile(chunkPath);
    const response = await this.client.listen.v1.media.transcribeFile(audio, {
      model: 'nova-3',
      language: DEEPGRAM_LANGUAGE,
      diarize: true,
      utterances: true,
      smart_format: true,
      punctuate: true,
    });
    // ListenV1AcceptedResponse only occurs with a callback URL, which we never set.
    if (!('results' in response)) {
      throw new Error('Unexpected Deepgram response shape (no results).');
    }
    return mapDeepgramResponse(response);
  }
}
