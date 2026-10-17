import type { TranscriptUtterance } from 'shared';

// The swappable-engine boundary (architecture doc §dependency rule).
// The pipeline talks to this interface only; providers never import routes
// or each other. No API provider is wired yet (POC_M2 imports ElevenLabs
// web-exports offline — see elevenlabs-import.ts); the ElevenLabs API provider
// and any fallbacks plug in behind this contract.
export interface TranscriptionProvider {
  readonly id: string; // e.g. 'elevenlabs/scribe-v2'
  readonly language: string; // BCP-47-ish, e.g. 'bg'

  // Transcribes one audio chunk. Returned timestamps are RELATIVE to the
  // chunk's own start; the pipeline shifts them by the chunk offset.
  transcribeChunk(chunkPath: string): Promise<TranscriptUtterance[]>;
}
