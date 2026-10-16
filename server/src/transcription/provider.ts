import type { TranscriptUtterance } from 'shared';

// The swappable-engine boundary (architecture doc §dependency rule).
// The pipeline talks to this interface only; providers never import routes
// or each other. v1: deepgram.ts. Fallbacks (Speechmatics, ElevenLabs) and
// the self-hosted WhisperX sidecar plug in behind the same contract.
export interface TranscriptionProvider {
  readonly id: string; // e.g. 'deepgram/nova-3'
  readonly language: string; // BCP-47-ish, e.g. 'bg'

  // Transcribes one audio chunk. Returned timestamps are RELATIVE to the
  // chunk's own start; the pipeline shifts them by the chunk offset.
  transcribeChunk(chunkPath: string): Promise<TranscriptUtterance[]>;
}
