import { useState } from 'react';
import TextField from '@mui/material/TextField';

export interface EditableTextProps {
  value: string;
  italic: boolean;
  isDisabled?: boolean;
  onSave: (text: string) => Promise<void>;
}

// One editable text layer. Auto-saves on blur when changed; Escape reverts to
// the last saved value (POC_M3 plan, decision 8). No prop→state sync effect:
// the only writer is this component's own save (single-user app), and after a
// save the prop value equals the draft anyway.
export default function EditableText({ value, italic, isDisabled, onSave }: EditableTextProps) {
  const [draft, setDraft] = useState(value);
  const [hasSaveError, setHasSaveError] = useState(false);

  const handleBlur = () => {
    const text = draft.trim();
    if (text === value || text === '') return;
    setHasSaveError(false);
    onSave(text).catch(() => {
      setHasSaveError(true);
      setDraft(value);
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setDraft(value);
      (event.target as HTMLElement).blur();
    }
  };

  return (
    <TextField
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      error={hasSaveError}
      disabled={isDisabled}
      helperText={hasSaveError ? 'Грешка при запис — промяната е отказана' : undefined}
      multiline
      fullWidth
      variant='standard'
      slotProps={{
        input: {
          disableUnderline: true,
          sx: italic ? { fontStyle: 'italic', color: 'text.secondary', fontSize: '0.9rem' } : undefined,
        },
      }}
      sx={{ px: 1, borderRadius: 1, '&:focus-within': { bgcolor: 'action.hover' } }}
    />
  );
}
