import type { Speaker, TranscriptBlock } from 'shared';
import type { LlmClient } from './openrouter';
import { ROLE_VOCABULARY } from './role-vocabulary';

// Speaker-role SUGGESTIONS (proposals only — never auto-applied; the user
// confirms or edits before anything is final). One LLM call per speaker:
// speakers are few (2-4 typical), cost is trivial, and per-speaker calls keep
// the resume set naturally granular (suggested_role IS NULL).

export interface RoleSuggestion {
  suggestedRole: string;
  roleReasoning: string;
}

export interface RoleSuggestionOptions {
  model: string;
  temperature: number;
}

export interface RoleSuggestionRequest extends RoleSuggestionOptions {
  speaker: Speaker;
  blocks: TranscriptBlock[];
}

const SAMPLE_SIZE = 10; // longest utterances per speaker
const MAX_SAMPLE_CHARS = 4000;

// Picks the speaker's longest utterances; each is preceded by the previous
// block's text when it belongs to someone else (dialogue context).
export function buildRoleSample(speaker: Speaker, blocks: TranscriptBlock[]): string {
  const own = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.speakerId === speaker.id)
    .sort((a, b) => b.block.verbatimText.length - a.block.verbatimText.length)
    .slice(0, SAMPLE_SIZE)
    .sort((a, b) => a.index - b.index); // chronological for readability

  const lines: string[] = [];
  let chars = 0;
  for (const { block, index } of own) {
    const previous = index > 0 ? blocks[index - 1] : null;
    const context =
      previous && previous.speakerId !== speaker.id ? `[друг говорител]: ${previous.verbatimText}\n` : '';
    const chunk = `${context}[${speaker.label}]: ${block.verbatimText}`;
    if (chars + chunk.length > MAX_SAMPLE_CHARS) break;
    lines.push(chunk);
    chars += chunk.length;
  }
  return lines.join('\n\n');
}

function buildSystemPrompt(): string {
  return `Ти си анализатор на български стенограми от автоматично разпознаване на реч с разделени говорители.
Задачата ти е да предложиш най-вероятната роля на даден говорител в разговора.
Предпочитай роля от следния речник: ${ROLE_VOCABULARY.join(', ')}.
Ако никоя не пасва, предложи своя кратка роля на български.
Отговори САМО с JSON обект в този формат: {"role": "...", "reasoning": "..."}
— role: ролята; reasoning: едно-две изречения обосновка на български, цитираща характерното му поведение в репликите.`;
}

// Tolerant parse: models sometimes wrap JSON in prose or code fences.
export function parseRoleResponse(response: string): RoleSuggestion {
  const match = /\{[^{}]*"role"[^{}]*\}/s.exec(response);
  if (!match) throw new Error('Role suggestion: no JSON object in the model response.');
  const parsed = JSON.parse(match[0]) as { role?: unknown; reasoning?: unknown };
  if (typeof parsed.role !== 'string' || parsed.role.trim() === '') {
    throw new Error('Role suggestion: missing "role" in the model response.');
  }
  return {
    suggestedRole: parsed.role.trim(),
    roleReasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : '',
  };
}

export async function suggestSpeakerRole(
  client: LlmClient,
  request: RoleSuggestionRequest,
): Promise<RoleSuggestion> {
  const sample = buildRoleSample(request.speaker, request.blocks);
  if (!sample) return { suggestedRole: 'Неизвестна роля', roleReasoning: 'Говорителят няма реплики.' };
  const response = await client.chat({
    model: request.model,
    temperature: request.temperature,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: `Ето извадка от репликите на ${request.speaker.label}:\n\n${sample}` },
    ],
  });
  return parseRoleResponse(response);
}
