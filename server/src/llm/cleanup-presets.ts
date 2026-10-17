import type { CleanupStyleId } from 'shared';
import { CLEANUP_STYLE_DISPLAY_NAMES, PER_BLOCK_CLEANUP_STYLE_IDS } from 'shared';

// The 5 cleanup-style presets. Display names live in shared/ (the UI dropdown
// renders them); the PROMPT TEXTS are server-only — the client never sees them.
// Prompts are written in Bulgarian: they operate on Bulgarian transcripts and
// keep the model in-language.

export type CleanupScope = 'per-block' | 'session';

export interface CleanupPreset {
  id: CleanupStyleId;
  displayName: string;
  scope: CleanupScope;
  systemPrompt: string;
}

// Shared context for the per-block styles (batched cleanup protocol — see cleanup.ts).
const BATCH_PROTOCOL = `
Входът е поредица от стенограмни блокове, всеки започващ с маркер <<<BLOCK N>>>.
Върни ВСИЧКИ блокове в същия ред, всеки с неговия маркер <<<BLOCK N>>> непроменен.
Не добавяй коментари, заглавия или нови блокове. Не сливай и не разделяй блокове.
Етикетите за аудио събития в квадратни скоби (напр. [шум], [кашлица]) запази непроменени на мястото им.`;

export const CLEANUP_PRESETS: Readonly<Record<CleanupStyleId, CleanupPreset>> = {
  'clean-verbatim': {
    id: 'clean-verbatim',
    displayName: CLEANUP_STYLE_DISPLAY_NAMES['clean-verbatim'],
    scope: 'per-block',
    systemPrompt: `Ти си редактор на български стенограми от автоматично разпознаване на реч.
Запази съдържанието максимално дословно — всяко изречение и смисълът остават непокътнати.
Премахни само: запълващи звуки (ъъ, аа, мм), заеквания и повторения при фалшив старт, както и
очевидни грешки на разпознаването, когато правилната дума е недвусмислена от контекста.
Не префразирай, не обобщавай, не добавяй нищо от себе си.${BATCH_PROTOCOL}`,
  },
  'light-clean': {
    id: 'light-clean',
    displayName: CLEANUP_STYLE_DISPLAY_NAMES['light-clean'],
    scope: 'per-block',
    systemPrompt: `Ти си редактор на български стенограми от автоматично разпознаване на реч.
Освежи текста леко: поправи правопис, пунктуация и очевидни граматични грешки; премахни
запълващи звуци и фалшиви стартове; изглади разговорни обороти до естествена книжовна форма.
Смисълът, редът и лицето на говорене остават непокътнати. Не обобщавай и не добавяй.${BATCH_PROTOCOL}`,
  },
  'formal-style': {
    id: 'formal-style',
    displayName: CLEANUP_STYLE_DISPLAY_NAMES['formal-style'],
    scope: 'per-block',
    systemPrompt: `Ти си редактор на български стенограми от автоматично разпознаване на реч.
Пренапиши текста в официален книжовен български език, подходящ за протокол или служебен документ.
Запази всички факти, имена, числа, дати и лицето на говорене. Премахни запълващи звуци,
повторения и разговорни обороти. Не добавяй информация и не обобщавай.${BATCH_PROTOCOL}`,
  },
  summary: {
    id: 'summary',
    displayName: CLEANUP_STYLE_DISPLAY_NAMES.summary,
    scope: 'session',
    systemPrompt: `Ти си анализатор на български стенограми от аудио записи.
Обобщи стенограмата на български език в няколко абзаца: основни теми, кой каква позиция изразява,
взети решения и следващи стъпки, ако има такива. Бъди точен и фактологичен — без измислици.`,
  },
  'key-facts': {
    id: 'key-facts',
    displayName: CLEANUP_STYLE_DISPLAY_NAMES['key-facts'],
    scope: 'session',
    systemPrompt: `Ти си анализатор на български стенограми от аудио записи.
Извади ключовите факти от стенограмата в маркиран списък на български език:
имена, дати, числа, констатации, решения и поети ангажименти. Само факти от текста — без измислици.`,
  },
};

export function isPerBlockStyle(id: CleanupStyleId): boolean {
  return (PER_BLOCK_CLEANUP_STYLE_IDS as readonly string[]).includes(id);
}

export function getPreset(id: CleanupStyleId): CleanupPreset {
  return CLEANUP_PRESETS[id];
}
