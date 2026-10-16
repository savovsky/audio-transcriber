import type { AppConfig } from '../config';
import { DeepgramProvider } from './deepgram';
import type { TranscriptionProvider } from './provider';

// Provider factory — the single place that picks the transcription engine.
// Fallbacks (Speechmatics, ElevenLabs) get added here behind the interface.
export function createTranscriptionProvider(config: AppConfig): TranscriptionProvider {
  if (!config.deepgramApiKey) {
    throw new Error('DEEPGRAM_API_KEY is not configured (check .env and the --env-file flag).');
  }
  return new DeepgramProvider(config.deepgramApiKey);
}

export type { TranscriptionProvider } from './provider';
