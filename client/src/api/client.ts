import type { ApiErrorResponse } from 'shared';

// Thin typed fetch wrapper — the only place the client talks HTTP. Components
// stay dumb (architecture rule): they call these helpers and render.

async function toApiError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return new Error(body.error || `HTTP ${response.status}`);
  } catch {
    return new Error(`HTTP ${response.status}`);
  }
}

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}
