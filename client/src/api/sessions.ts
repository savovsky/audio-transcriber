import type {
  BlockUpdateRequest,
  BlockUpdateResponse,
  SessionDetailResponse,
  SessionListResponse,
} from 'shared';
import { getJson, patchJson } from './client';

export function fetchSessions(): Promise<SessionListResponse> {
  return getJson<SessionListResponse>('/api/sessions');
}

export function fetchSessionDetail(sessionId: string): Promise<SessionDetailResponse> {
  return getJson<SessionDetailResponse>(`/api/sessions/${encodeURIComponent(sessionId)}`);
}

export function updateBlock(blockId: string, update: BlockUpdateRequest): Promise<BlockUpdateResponse> {
  return patchJson<BlockUpdateResponse>(`/api/blocks/${encodeURIComponent(blockId)}`, update);
}
