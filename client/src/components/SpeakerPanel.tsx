import { useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ROLE_VOCABULARY, type Speaker, type SpeakerUpdateRequest } from 'shared';

// Speaker panel (POC_M4): rename (applies globally), the role SUGGESTION shown
// as a proposal with its reasoning, and the confirmed role as a freeSolo
// Autocomplete over the shared ROLE_VOCABULARY. Nothing is auto-applied —
// confirmed_role changes only via the explicit «Потвърди» button.

export interface SpeakerPanelProps {
  speakers: Speaker[];
  isDisabled?: boolean;
  onUpdate: (speakerId: string, update: SpeakerUpdateRequest) => Promise<void>;
}

interface RenameFieldProps {
  label: string;
  isDisabled?: boolean;
  onSave: (label: string) => Promise<void>;
}

// Blur-save rename field (same UX as the block text layers: save on blur when
// changed, Escape reverts).
function RenameField({ label, isDisabled, onSave }: RenameFieldProps) {
  const [draft, setDraft] = useState(label);
  const [hasSaveError, setHasSaveError] = useState(false);

  const handleBlur = () => {
    const text = draft.trim();
    if (text === label || text === '') return;
    setHasSaveError(false);
    onSave(text).catch(() => {
      setHasSaveError(true);
      setDraft(label);
    });
  };

  return (
    <TextField
      label='Име'
      size='small'
      fullWidth
      value={draft}
      disabled={isDisabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setDraft(label);
          (event.target as HTMLElement).blur();
        }
      }}
      error={hasSaveError}
      helperText={hasSaveError ? 'Грешка при запис — промяната е отказана' : undefined}
    />
  );
}

interface RoleConfirmProps {
  speaker: Speaker;
  isDisabled?: boolean;
  onConfirm: (role: string) => Promise<void>;
}

function RoleConfirm({ speaker, isDisabled, onConfirm }: RoleConfirmProps) {
  const confirmed = speaker.confirmedRole ?? '';
  const [draft, setDraft] = useState(confirmed);
  const [hasSaveError, setHasSaveError] = useState(false);
  const isUnchanged = draft.trim() === confirmed;

  const handleConfirm = () => {
    const role = draft.trim();
    if (role === '' || role === confirmed) return;
    setHasSaveError(false);
    onConfirm(role).catch(() => setHasSaveError(true));
  };

  return (
    <Stack direction='row' spacing={1} alignItems='flex-start'>
      <Autocomplete
        freeSolo
        size='small'
        fullWidth
        options={[...ROLE_VOCABULARY]}
        value={draft}
        disabled={isDisabled}
        onChange={(_, value) => setDraft(value ?? '')}
        onInputChange={(_, value) => setDraft(value)}
        renderInput={(params) => (
          <TextField
            {...params}
            label='Потвърдена роля'
            error={hasSaveError}
            helperText={hasSaveError ? 'Грешка при запис' : undefined}
          />
        )}
      />
      <Button
        variant='contained'
        size='small'
        disabled={isDisabled || isUnchanged || draft.trim() === ''}
        onClick={handleConfirm}
        sx={{ mt: 0.5, whiteSpace: 'nowrap' }}
      >
        Потвърди
      </Button>
    </Stack>
  );
}

export default function SpeakerPanel({ speakers, isDisabled, onUpdate }: SpeakerPanelProps) {
  return (
    <Stack spacing={2}>
      {speakers.map((speaker) => (
        <Paper key={speaker.id} variant='outlined' sx={{ p: 1.5 }}>
          <Stack spacing={1.5}>
            <RenameField
              label={speaker.label}
              isDisabled={isDisabled}
              onSave={(label) => onUpdate(speaker.id, { label })}
            />

            {speaker.suggestedRole ? (
              <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 0 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Предложение: {speaker.suggestedRole}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {speaker.roleReasoning ?? 'Без обосновка.'}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ) : (
              <Typography variant='body2' color='text.secondary'>
                Няма предложение за роля.
              </Typography>
            )}

            <RoleConfirm
              speaker={speaker}
              isDisabled={isDisabled}
              onConfirm={(confirmedRole) => onUpdate(speaker.id, { confirmedRole })}
            />
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
