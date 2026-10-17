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

// Speaker-role vocabulary (moved here from server/src/llm/role-vocabulary.ts in
// POC_M4 — the client needs it for the confirmed-role Autocomplete). It is the
// default prompt vocabulary for role SUGGESTIONS only; the user always confirms
// or edits (free text allowed) before anything is applied (AGENTS.md: nothing
// LLM-suggested is auto-applied). Generic legal-domain terminology — no
// case-identifying details (privacy rule).
export const ROLE_VOCABULARY: readonly string[] = [
  'Съдия',
  'Прокурор',
  'Адвокат',
  'Ищец',
  'Ответник',
  'Свидетел',
  'Вещо лице',
  'Секретар',
];

// Bulgarian display names for the session status badge (list + detail pages).
export const SESSION_STATUS_DISPLAY_NAMES: Readonly<Record<SessionStatus, string>> = {
  uploaded: 'Качен',
  importing: 'Импортиране',
  transcribing: 'Транскрибиране',
  cleaning: 'Изчистване',
  roles: 'Разпознаване на роли',
  ready: 'Готов',
  failed: 'Неуспешен',
};

// --- API contracts (POC_M3) ---

// GET /api/sessions — the home screen list.
export interface SessionListItem {
  id: string;
  title: string;
  referenceNumber: string | null;
  durationSec: number | null;
  status: SessionStatus;
  createdAt: string;
}

export interface SessionListResponse {
  sessions: SessionListItem[];
}

// GET /api/sessions/:id — everything the detail page needs in one payload
// (blocks are always needed with the detail view, so no separate endpoint).
export interface SessionDetailResponse {
  session: Session;
  speakers: Speaker[];
  blocks: TranscriptBlock[];
  audioUrl: string; // '/api/sessions/<id>/audio' — Range-streamed from the job dir
}

// Identifies one LLM cleanup run — the provenance written to the block's
// cleaned_* columns (and the settings of a regenerate / re-clean request).
export interface CleanedRun {
  model: string;
  style: PerBlockCleanupStyleId;
  temperature: number;
}

// PATCH /api/blocks/:id — both text layers are editable (POC_M3); POC_M4 adds
// speaker reassignment and the regenerate-apply path. Manual text edits
// deliberately do NOT touch the cleaned_* provenance columns UNLESS cleanedRun
// is passed (the apply step of preview-then-apply regenerate — the new text
// comes from that exact LLM run, so the provenance is accurate).
export interface BlockUpdateRequest {
  verbatimText?: string;
  cleanedText?: string;
  speakerId?: string; // reassign to another speaker OF THE SAME SESSION
  cleanedRun?: CleanedRun; // requires cleanedText — 400 otherwise
}

export interface BlockUpdateResponse {
  block: TranscriptBlock;
}

// POST /api/blocks/:id/regenerate — preview-then-apply (POC_M4): returns the
// candidate cleaned text and persists NOTHING. The apply step is a PATCH with
// cleanedText + cleanedRun.
export type BlockRegenerateRequest = CleanedRun;

export interface BlockRegenerateResponse {
  candidateText: string;
  run: CleanedRun;
}

// POST /api/blocks/:id/merge — merge this block into the PREVIOUS one (by
// orderIndex). The kept block gets the union time range, per-layer text
// concatenation, the earlier block's speaker, and provenance only when both
// sides match exactly. Ids are not renumbered — the removed id leaves a gap.
export interface BlockMergeResponse {
  block: TranscriptBlock; // the kept (earlier) block, updated
  removedBlockId: string;
}

// PATCH /api/speakers/:id — rename and/or role confirmation (POC_M4). Both are
// explicit user actions: confirmedRole is the only role field the UI treats as
// final; suggestions stay proposals.
export interface SpeakerUpdateRequest {
  label?: string;
  confirmedRole?: string;
}

export interface SpeakerUpdateResponse {
  speaker: Speaker;
}

// POST /api/sessions/:id/reclean — session-wide re-clean with chosen settings
// (POC_M4). One batch per call; the client loops until remaining === 0 (UI
// blocks with a progress count meanwhile). 'start' marks ALL blocks pending
// first — manual edits to cleanedText are lost (the UI confirms this).
export interface SessionRecleanRequest extends CleanedRun {
  mode: 'start' | 'continue';
}

export interface SessionRecleanResponse {
  cleanedBlocks: TranscriptBlock[]; // the batch cleaned by THIS call
  total: number;
  remaining: number; // 0 = done
}

// POST /api/sessions/:id/artifacts — generate a session-level artifact
// (summary / key-facts) from the cleaned transcript (POC_M4).
export interface SessionArtifactRequest {
  kind: 'summary' | 'key-facts';
  model: string;
  temperature: number;
}

export interface SessionArtifactResponse {
  session: Session; // summaryText / keyFactsText updated
}

// Error shape shared by all API routes.
export interface ApiErrorResponse {
  error: string;
}

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
