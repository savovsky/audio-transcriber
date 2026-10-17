// Domain types shared between server and client.
// Data-model-first rule (AGENTS.md): these are defined BEFORE the server/client
// code that consumes them.

export type SessionStatus =
  | 'uploaded'
  | 'importing' // ElevenLabs web-export import (the offline transcription source)
  | 'transcribing' // future ElevenLabs API provider
  | 'cleaning'
  | 'roles'
  | 'ready'
  | 'failed';

export interface Session {
  id: string; // === jobId (data/jobs/<id>/), one identifier everywhere
  title: string;
  referenceNumber: string | null;
  audioFileName: string;
  durationSec: number | null;
  status: SessionStatus;
  // Session-level LLM artifacts (the 'summary' / 'key-facts' presets are NOT
  // per-block styles — they describe the whole transcript).
  summaryText: string | null;
  keyFactsText: string | null;
  createdAt: string;
}

export interface Speaker {
  id: string; // deterministic: `${sessionId}/s${speakerIndex}`
  sessionId: string;
  speakerIndex: number; // diarization label (0-based)
  label: string; // display name, e.g. 'Speaker 0' — user-renamable later
  // Role suggestions are PROPOSALS (AGENTS.md): never auto-applied. The user
  // confirms or edits; `confirmedRole` is the only field the UI treats as final.
  suggestedRole: string | null;
  roleReasoning: string | null;
  confirmedRole: string | null;
}

export interface TranscriptBlock {
  id: string; // deterministic: `${sessionId}/b${orderIndex padded to 5}`
  sessionId: string;
  speakerId: string;
  orderIndex: number;
  startSec: number; // absolute offset within the source recording
  endSec: number;
  verbatimText: string; // includes inline […] audio-event tags from the engine
  cleanedText: string | null; // NULL = pending cleanup (also the resume marker)
  // Provenance of the cleanup that produced `cleanedText` — lets the user
  // regenerate the same block with different settings and compare results.
  cleanedModel: string | null;
  cleanedStyle: PerBlockCleanupStyleId | null;
  cleanedTemperature: number | null;
}

// --- Transcription provider contract (POC_M1) ---
// The swappable-engine boundary (architecture doc §dependency rule): every
// transcription provider returns these shapes; the pipeline merges per-chunk
// results into one diarized transcript with absolute timestamps.

export interface TranscriptUtterance {
  speakerIndex: number; // diarization label (0-based, consistent across chunks)
  startSec: number; // absolute offset within the source recording
  endSec: number;
  text: string;
}

export interface TranscriptChunk {
  index: number;
  fileName: string;
  startSec: number; // offset of this chunk within the source recording
  durationSec: number;
}

export interface ChunkTranscription {
  chunkIndex: number;
  chunkStartSec: number;
  utterances: TranscriptUtterance[]; // timestamps already absolute
}

export interface TranscriptionResult {
  provider: string; // e.g. 'elevenlabs/web-export'
  language: string;
  utterances: TranscriptUtterance[]; // merged across chunks, sorted by startSec
}

// --- Cleanup presets (POC_M2) ---
// The first three are PER-BLOCK styles (produce TranscriptBlock.cleanedText).
// 'summary' and 'key-facts' are SESSION-LEVEL artifacts (Session.summaryText /
// Session.keyFactsText) generated on demand from the cleaned transcript.
export type CleanupStyleId = 'clean-verbatim' | 'light-clean' | 'formal-style' | 'summary' | 'key-facts';

export const CLEANUP_STYLE_IDS: readonly CleanupStyleId[] = [
  'clean-verbatim',
  'light-clean',
  'formal-style',
  'summary',
  'key-facts',
];

export type PerBlockCleanupStyleId = Exclude<CleanupStyleId, 'summary' | 'key-facts'>;

export const PER_BLOCK_CLEANUP_STYLE_IDS: readonly PerBlockCleanupStyleId[] = [
  'clean-verbatim',
  'light-clean',
  'formal-style',
];

// Bulgarian display names for the UI dropdown (prompt texts live server-side
// in server/src/llm/cleanup-presets.ts — the client never sees them).
export const CLEANUP_STYLE_DISPLAY_NAMES: Readonly<Record<CleanupStyleId, string>> = {
  'clean-verbatim': 'Дословен (изчистен)',
  'light-clean': 'Леко редактиран',
  'formal-style': 'Официален стил',
  summary: 'Резюме',
  'key-facts': 'Ключови факти',
};

// --- LLM options (POC_M2) ---
// Model dropdown — first entry is the default.
// Verified against the live OpenRouter catalog (GET /api/v1/models) in POC_M2:
// gemini-2.0-flash-001 and claude-3.5-haiku are retired; these are the current ids.
export type LlmModelId = 'google/gemini-2.5-flash' | 'openai/gpt-4o-mini' | 'anthropic/claude-haiku-4.5';

export const LLM_MODEL_IDS: readonly LlmModelId[] = [
  'google/gemini-2.5-flash',
  'openai/gpt-4o-mini',
  'anthropic/claude-haiku-4.5',
];

// Temperature dropdown (discrete options so results are comparable across runs).
export const LLM_TEMPERATURE_OPTIONS: readonly number[] = [0.0, 0.2, 0.3, 0.4, 0.7, 1.0];

export const DEFAULT_CLEANUP_TEMPERATURE = 0.2;
export const DEFAULT_ROLES_TEMPERATURE = 0.3;

// API contracts
export interface HealthResponse {
  status: 'ok';
  service: string;
  keysConfigured: {
    elevenlabs: boolean;
    openrouter: boolean;
  };
  timestamp: string;
}
