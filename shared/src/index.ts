// Domain types shared between server and client.
// Data-model-first rule (AGENTS.md): these are defined BEFORE the server/client
// code that consumes them. Placeholder shapes for the scaffold — POC_M1/POC_M2
// extend them as the pipeline and the DB schema land.

export type SessionStatus = 'uploaded' | 'transcribing' | 'cleaning' | 'roles' | 'ready' | 'failed';

export interface Session {
  id: string;
  title: string;
  referenceNumber: string | null;
  audioFileName: string;
  durationSec: number | null;
  status: SessionStatus;
  createdAt: string;
}

export interface Speaker {
  id: string;
  sessionId: string;
  label: string;
  suggestedRole: string | null;
  roleReasoning: string | null;
  confirmedRole: string | null;
}

export interface TranscriptBlock {
  id: string;
  sessionId: string;
  speakerId: string;
  orderIndex: number;
  startSec: number;
  endSec: number;
  verbatimText: string;
  cleanedText: string | null;
}

// The 5 cleanup-style presets (architecture doc §pipeline). Bulgarian display
// names are finalized in POC_M2 together with the prompt texts.
export type CleanupStyleId = 'clean-verbatim' | 'light-clean' | 'formal-style' | 'summary' | 'key-facts';

export const CLEANUP_STYLE_IDS: readonly CleanupStyleId[] = [
  'clean-verbatim',
  'light-clean',
  'formal-style',
  'summary',
  'key-facts',
];

// OpenRouter model dropdown — first entry is the default.
export type LlmModelId = 'google/gemini-2.0-flash-001' | 'openai/gpt-4o-mini' | 'anthropic/claude-3.5-haiku';

export const LLM_MODEL_IDS: readonly LlmModelId[] = [
  'google/gemini-2.0-flash-001',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-haiku',
];

// API contracts
export interface HealthResponse {
  status: 'ok';
  service: string;
  keysConfigured: {
    deepgram: boolean;
    openrouter: boolean;
  };
  timestamp: string;
}
