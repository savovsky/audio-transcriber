import type { HealthResponse } from 'shared';
import { getJson } from './client';

export function fetchHealth(): Promise<HealthResponse> {
  return getJson<HealthResponse>('/api/health');
}
