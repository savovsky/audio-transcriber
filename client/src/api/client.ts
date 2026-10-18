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

// Startup race: Vite opens the browser before tsx watch has the server up, so
// the first fetch on page load can hit a dead proxy. Retry transient failures
// (network TypeError, or the proxy's 5xx while the server boots); real HTTP
// answers (4xx, valid error bodies) are returned/thrown immediately.
function isRetryable(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return error instanceof Error && /^HTTP 5\d\d/.test(error.message);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { attempts?: number; delayMs?: number },
): Promise<T> {
  const { attempts = 20, delayMs = 500 } = options ?? {};
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
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

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}
