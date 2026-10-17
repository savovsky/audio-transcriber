import { describe, expect, it } from 'vitest';
import {
  CLEANUP_STYLE_DISPLAY_NAMES,
  CLEANUP_STYLE_IDS,
  LLM_MODEL_IDS,
  LLM_TEMPERATURE_OPTIONS,
  PER_BLOCK_CLEANUP_STYLE_IDS,
  ROLE_VOCABULARY,
  SESSION_STATUS_DISPLAY_NAMES,
} from './index';
import type { SessionStatus } from './index';

describe('shared constants', () => {
  it('defines the 5 cleanup-style presets', () => {
    expect(CLEANUP_STYLE_IDS).toHaveLength(5);
    expect(CLEANUP_STYLE_IDS[0]).toBe('clean-verbatim');
  });

  it('splits per-block styles from session-level ones', () => {
    expect(PER_BLOCK_CLEANUP_STYLE_IDS).toEqual(['clean-verbatim', 'light-clean', 'formal-style']);
  });

  it('has a Bulgarian display name for every style', () => {
    for (const id of CLEANUP_STYLE_IDS) {
      expect(CLEANUP_STYLE_DISPLAY_NAMES[id]).toBeTruthy();
    }
  });

  it('defines 3 LLM model options, gemini flash first (the default)', () => {
    expect(LLM_MODEL_IDS).toHaveLength(3);
    expect(LLM_MODEL_IDS[0]).toBe('google/gemini-2.5-flash');
  });

  it('defines discrete temperature options including both defaults', () => {
    expect(LLM_TEMPERATURE_OPTIONS).toContain(0.2);
    expect(LLM_TEMPERATURE_OPTIONS).toContain(0.3);
  });

  it('defines the agreed legal-domain role vocabulary', () => {
    expect(ROLE_VOCABULARY).toContain('Съдия');
    expect(ROLE_VOCABULARY).toContain('Свидетел');
    expect(ROLE_VOCABULARY.length).toBeGreaterThanOrEqual(6);
  });

  it('has a Bulgarian display name for every session status', () => {
    const statuses: SessionStatus[] = [
      'uploaded',
      'importing',
      'transcribing',
      'cleaning',
      'roles',
      'ready',
      'failed',
    ];
    for (const status of statuses) {
      expect(SESSION_STATUS_DISPLAY_NAMES[status]).toBeTruthy();
    }
    expect(Object.keys(SESSION_STATUS_DISPLAY_NAMES)).toHaveLength(statuses.length);
  });
});
