import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { type BlockRegenerateResponse, CLEANUP_STYLE_DISPLAY_NAMES } from 'shared';

export interface CandidatePreviewProps {
  candidate: BlockRegenerateResponse;
  isApplying: boolean;
  onApply: () => void;
  onDiscard: () => void;
}

// Stacked old-vs-new preview (POC_M4, decision 9): the candidate under the
// current text, provenance line, explicit apply/discard — no word-level diff.
export default function CandidatePreview({
  candidate,
  isApplying,
  onApply,
  onDiscard,
}: CandidatePreviewProps) {
  const { run } = candidate;
  return (
    <Paper variant='outlined' sx={{ p: 1, mt: 1, borderColor: 'primary.main', bgcolor: 'action.hover' }}>
      <Typography variant='caption' color='primary' sx={{ display: 'block', mb: 0.5 }}>
        Нов вариант ({run.model} · {CLEANUP_STYLE_DISPLAY_NAMES[run.style]} · t={run.temperature})
      </Typography>
      <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
        {candidate.candidateText}
      </Typography>
      <Stack direction='row' spacing={1} justifyContent='flex-end'>
        <Button size='small' onClick={onDiscard} disabled={isApplying}>
          Отказ
        </Button>
        <Button
          size='small'
          variant='contained'
          onClick={onApply}
          disabled={isApplying}
          startIcon={isApplying ? <CircularProgress size={14} /> : undefined}
        >
          Приложи
        </Button>
      </Stack>
    </Paper>
  );
}
