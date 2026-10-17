import type { Speaker, TranscriptBlock } from 'shared';
import { describe, expect, it } from 'vitest';
import type { LlmClient } from './openrouter';
import { ROLE_VOCABULARY } from './role-vocabulary';
import { buildRoleSample, parseRoleResponse, suggestSpeakerRole } from './roles';

const SPEAKER: Speaker = {
  id: 'job/s0',
  sessionId: 'job',
  speakerIndex: 0,
  label: 'Speaker 0',
  suggestedRole: null,
  roleReasoning: null,
  confirmedRole: null,
};

function block(orderIndex: number, speaker: { speakerId: string; text: string }): TranscriptBlock {
  const { speakerId, text } = speaker;
  return {
    id: `job/b${String(orderIndex).padStart(5, '0')}`,
    sessionId: 'job',
    speakerId,
    orderIndex,
    startSec: orderIndex * 10,
    endSec: orderIndex * 10 + 9,
    verbatimText: text,
    cleanedText: null,
    cleanedModel: null,
    cleanedStyle: null,
    cleanedTemperature: null,
  };
}

describe('ROLE_VOCABULARY', () => {
  it('is the agreed legal-domain default list', () => {
    expect(ROLE_VOCABULARY).toContain('Съдия');
    expect(ROLE_VOCABULARY).toContain('Свидетел');
    expect(ROLE_VOCABULARY.length).toBeGreaterThanOrEqual(6);
  });
});

describe('buildRoleSample', () => {
  const blocks = [
    block(0, { speakerId: 'job/s0', text: 'кратка реплика' }),
    block(1, { speakerId: 'job/s1', text: 'въпрос от другия говорител' }),
    block(2, { speakerId: 'job/s0', text: 'дълъг отговор с много съдържание и детайли' }),
    block(3, { speakerId: 'job/s0', text: 'още една реплика' }),
  ];

  it('samples only the speaker’s own blocks, longest first, chronological output', () => {
    const sample = buildRoleSample(SPEAKER, blocks);
    expect(sample).toContain('дълъг отговор');
    expect(sample).toContain('кратка реплика');
    expect(sample).not.toContain('[Speaker 1]');
  });

  it('includes the previous block as dialogue context when from another speaker', () => {
    const sample = buildRoleSample(SPEAKER, blocks);
    expect(sample).toContain('[друг говорител]: въпрос от другия говорител');
  });

  it('returns empty string when the speaker has no blocks', () => {
    expect(buildRoleSample({ ...SPEAKER, id: 'job/s9' }, blocks)).toBe('');
  });
});

describe('parseRoleResponse', () => {
  it('parses clean JSON', () => {
    expect(parseRoleResponse('{"role": "Съдия", "reasoning": "води заседанието"}')).toEqual({
      suggestedRole: 'Съдия',
      roleReasoning: 'води заседанието',
    });
  });

  it('tolerates code fences and prose around the JSON', () => {
    const response =
      'Ето предложението:\n```json\n{"role": "Свидетел", "reasoning": "отговаря на въпроси"}\n```';
    expect(parseRoleResponse(response).suggestedRole).toBe('Свидетел');
  });

  it('defaults missing reasoning to empty string', () => {
    expect(parseRoleResponse('{"role": "Адвокат"}').roleReasoning).toBe('');
  });

  it('throws on missing JSON or missing role', () => {
    expect(() => parseRoleResponse('нямам json')).toThrow(/no JSON/);
    expect(() => parseRoleResponse('{"reasoning": "..."}')).toThrow(/no JSON|missing "role"/);
  });
});

describe('suggestSpeakerRole', () => {
  it('sends the sample and parses the suggestion', async () => {
    let userContent = '';
    const fakeClient: LlmClient = {
      chat: (options) => {
        userContent = options.messages[1].content;
        return Promise.resolve('{"role": "Вещо лице", "reasoning": "дълги експертни обяснения"}');
      },
    };
    const blocks = [
      block(0, { speakerId: 'job/s0', text: 'обяснявам подробно' }),
      block(1, { speakerId: 'job/s1', text: 'въпрос' }),
    ];
    const suggestion = await suggestSpeakerRole(fakeClient, {
      speaker: SPEAKER,
      blocks,
      model: 'm',
      temperature: 0.3,
    });
    expect(suggestion.suggestedRole).toBe('Вещо лице');
    expect(userContent).toContain('обяснявам подробно');
    expect(userContent).toContain('Speaker 0');
  });

  it('returns an explicit unknown-role when the speaker has no lines', async () => {
    const fakeClient: LlmClient = { chat: () => Promise.resolve('{"role": "x"}') };
    const suggestion = await suggestSpeakerRole(fakeClient, {
      speaker: SPEAKER,
      blocks: [],
      model: 'm',
      temperature: 0.3,
    });
    expect(suggestion.suggestedRole).toBe('Неизвестна роля');
  });
});
