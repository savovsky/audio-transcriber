// Plain-HTTP OpenRouter client (no SDK). The pipeline depends on the LlmClient
// interface, not on this class — the model/provider stays swappable.
// Security: the API key arrives via config (--env-file) and is NEVER logged;
// error messages carry status + truncated body only.

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface ChatOptions {
  model: string;
  temperature: number;
  messages: ChatMessage[];
}

// The pipeline-facing contract (fakeable in tests).
export interface LlmClient {
  chat(options: ChatOptions): Promise<string>;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_RETRIES = 2; // retries AFTER the first attempt, on 429/5xx/network errors
const BACKOFF_BASE_MS = 500;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenRouterClient implements LlmClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://openrouter.ai/api/v1') {
    if (!apiKey)
      throw new Error('OPENROUTER_API_KEY is not configured (check .env and the --env-file flag).');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async chat(options: ChatOptions): Promise<string> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= DEFAULT_RETRIES; attempt++) {
      if (attempt > 0) await sleep(BACKOFF_BASE_MS * 3 ** (attempt - 1)); // 500ms, 1500ms
      try {
        return await this.request(options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (!isRetryable(lastError)) break;
      }
    }
    throw lastError ?? new Error('OpenRouter request failed.');
  }

  private async request(options: ChatOptions): Promise<string> {
    // Manual AbortController (not AbortSignal.timeout): the timer is cleared in
    // `finally`, so no dangling handle is left when the process exits on error —
    // AbortSignal.timeout raced libuv handle teardown on Windows (UV_HANDLE_CLOSING
    // assertion) when the CLI failed fast.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          temperature: options.temperature,
          messages: options.messages,
        }),
      });
    } catch (error) {
      // The manual abort surfaces as AbortError — treat it as a (retryable) timeout.
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`OpenRouter request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
        (timeoutError as RetryableError).retryable = true;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      const error = new Error(`OpenRouter HTTP ${response.status}: ${body}`);
      if (response.status === 429 || response.status >= 500) (error as RetryableError).retryable = true;
      throw error;
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      throw new Error(`OpenRouter returned no content: ${JSON.stringify(data).slice(0, 300)}`);
    }
    return content;
  }
}

interface RetryableError extends Error {
  retryable?: boolean;
}

function isRetryable(error: Error): boolean {
  // Network/timeout errors are retryable; HTTP only when marked (429/5xx).
  return (
    (error as RetryableError).retryable === true ||
    error.name === 'TimeoutError' ||
    error.name === 'TypeError'
  );
}
