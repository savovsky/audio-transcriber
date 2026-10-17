import { type CleanedRun, DEFAULT_CLEANUP_TEMPERATURE, LLM_MODEL_IDS } from 'shared';

// Session-default LLM knobs for the header bar and the regenerate popover
// fallback (POC_M4, decision 10: component state only, resets on reload).
export const DEFAULT_LLM_RUN: CleanedRun = {
  style: 'clean-verbatim',
  model: LLM_MODEL_IDS[0],
  temperature: DEFAULT_CLEANUP_TEMPERATURE,
};
