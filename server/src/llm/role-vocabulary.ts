// Configurable speaker-role vocabulary for the LLM role SUGGESTIONS.
// Edit this list freely — it is the default prompt vocabulary only; the model
// may also propose a role outside it, and the user always confirms or edits
// before anything is applied (AGENTS.md: nothing LLM-suggested is auto-applied).
// Generic legal-domain terminology — no case-identifying details (privacy rule).
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
