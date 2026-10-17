// Transcription provider contract — the swappable-engine boundary.
// No API provider is wired yet: POC_M2 imports ElevenLabs web-exports offline
// (see elevenlabs-import.ts); the ElevenLabs API provider plugs in here later.
export type { TranscriptionProvider } from './provider';
