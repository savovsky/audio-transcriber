// Server error messages are English (code convention); the UI is Bulgarian-only.
// Maps known API error messages to user-facing Bulgarian text.
export function toUserMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('OpenRouter API key')) return 'LLM услугата не е конфигурирана.';
  return message;
}
