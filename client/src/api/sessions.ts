import type {
  BlockMergeResponse,
  BlockRegenerateRequest,
  BlockRegenerateResponse,
  BlockUpdateRequest,
  BlockUpdateResponse,
  SessionArtifactRequest,
  SessionArtifactResponse,
  SessionDetailResponse,
  SessionListResponse,
  SessionRecleanRequest,
  SessionRecleanResponse,
  SpeakerUpdateRequest,
  SpeakerUpdateResponse,
} from 'shared';
import { getJson, patchJson, postJson } from './client';

export function fetchSessions(): Promise<SessionListResponse> {
  return getJson<SessionListResponse>('/api/sessions');
}

export function fetchSessionDetail(sessionId: string): Promise<SessionDetailResponse> {
  return getJson<SessionDetailResponse>(`/api/sessions/${encodeURIComponent(sessionId)}`);
}

export function updateBlock(blockId: string, update: BlockUpdateRequest): Promise<BlockUpdateResponse> {
  return patchJson<BlockUpdateResponse>(`/api/blocks/${encodeURIComponent(blockId)}`, update);
}

// Preview-then-apply regenerate (POC_M4): the candidate is NOT persisted —
// apply is an updateBlock call with cleanedText + cleanedRun.
export function regenerateBlock(
  blockId: string,
  run: BlockRegenerateRequest,
): Promise<BlockRegenerateResponse> {
  return postJson<BlockRegenerateResponse>(`/api/blocks/${encodeURIComponent(blockId)}/regenerate`, run);
}

export function mergeBlock(blockId: string): Promise<BlockMergeResponse> {
  return postJson<BlockMergeResponse>(`/api/blocks/${encodeURIComponent(blockId)}/merge`);
}

export function updateSpeaker(
  speakerId: string,
  update: SpeakerUpdateRequest,
): Promise<SpeakerUpdateResponse> {
  return patchJson<SpeakerUpdateResponse>(`/api/speakers/${encodeURIComponent(speakerId)}`, update);
}

// Session-wide re-clean (POC_M4): ONE batch per call — the caller loops until
// remaining === 0 (and must stop on a no-progress response: cleanedBlocks
// empty while remaining > 0 means the model keeps omitting those blocks).
export function recleanSessionBatch(
  sessionId: string,
  request: SessionRecleanRequest,
): Promise<SessionRecleanResponse> {
  return postJson<SessionRecleanResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/reclean`, request);
}

export function generateSessionArtifact(
  sessionId: string,
  request: SessionArtifactRequest,
): Promise<SessionArtifactResponse> {
  return postJson<SessionArtifactResponse>(
    `/api/sessions/${encodeURIComponent(sessionId)}/artifacts`,
    request,
  );
}
