import { describe, expect, it } from 'vitest';
import { CLEANUP_STYLE_IDS, LLM_MODEL_IDS } from './index';

describe('shared constants', () => {
  it('defines the 5 cleanup-style presets', () => {
    expect(CLEANUP_STYLE_IDS).toHaveLength(5);
    expect(CLEANUP_STYLE_IDS[0]).toBe('clean-verbatim');
  });

  it('defines 3 LLM model options, gemini flash first (the default)', () => {
    expect(LLM_MODEL_IDS).toHaveLength(3);
    expect(LLM_MODEL_IDS[0]).toBe('google/gemini-2.0-flash-001');
  });
});
