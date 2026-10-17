import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import {
  CLEANUP_STYLE_DISPLAY_NAMES,
  type CleanedRun,
  LLM_MODEL_IDS,
  LLM_TEMPERATURE_OPTIONS,
  PER_BLOCK_CLEANUP_STYLE_IDS,
  type PerBlockCleanupStyleId,
} from 'shared';

// The three LLM knobs (style / model / temperature), rendered from the shared
// constants. Reused in the session header bar (session defaults) and in the
// per-block regenerate popover (pre-filled from the block's provenance).

export interface LlmControlsProps {
  value: CleanedRun;
  isDisabled?: boolean;
  onChange: (run: CleanedRun) => void;
}

export default function LlmControls({ value, isDisabled, onChange }: LlmControlsProps) {
  return (
    <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
      <TextField
        select
        size='small'
        label='Стил'
        value={value.style}
        disabled={isDisabled}
        onChange={(event) => onChange({ ...value, style: event.target.value as PerBlockCleanupStyleId })}
        sx={{ minWidth: 180 }}
      >
        {PER_BLOCK_CLEANUP_STYLE_IDS.map((id) => (
          <MenuItem key={id} value={id}>
            {CLEANUP_STYLE_DISPLAY_NAMES[id]}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size='small'
        label='Модел'
        value={value.model}
        disabled={isDisabled}
        onChange={(event) => onChange({ ...value, model: event.target.value })}
        sx={{ minWidth: 220 }}
      >
        {LLM_MODEL_IDS.map((id) => (
          <MenuItem key={id} value={id}>
            {id}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size='small'
        label='Температура'
        value={String(value.temperature)}
        disabled={isDisabled}
        onChange={(event) => onChange({ ...value, temperature: Number(event.target.value) })}
        sx={{ minWidth: 110 }}
      >
        {LLM_TEMPERATURE_OPTIONS.map((option) => (
          <MenuItem key={option} value={String(option)}>
            {option.toFixed(1)}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
