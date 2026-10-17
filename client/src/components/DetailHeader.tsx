import { Link as RouterLink } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PeopleIcon from '@mui/icons-material/People';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import type { CleanedRun, Session } from 'shared';
import { formatDateTime, formatTime } from '../format';
import LlmControls from './LlmControls';
import SessionStatusChip from './SessionStatusChip';

export interface DetailHeaderProps {
  session: Session;
  blockCount: number;
  llmRun: CleanedRun;
  recleanProgress: { done: number; total: number } | null;
  isVerbatimShown: boolean;
  isPanelOpen: boolean;
  onLlmRunChange: (run: CleanedRun) => void;
  onRecleanRequest: () => void;
  onVerbatimToggle: (shown: boolean) => void;
  onPanelToggle: () => void;
}

// Session detail header: title + meta, the session-default LLM knobs with the
// re-clean-all action (+ blocking progress), verbatim toggle, speaker-panel toggle.
export default function DetailHeader(props: DetailHeaderProps) {
  const { session, blockCount, llmRun, recleanProgress, isVerbatimShown, isPanelOpen } = props;
  const { onLlmRunChange, onRecleanRequest, onVerbatimToggle, onPanelToggle } = props;
  const isRecleaning = recleanProgress !== null;

  return (
    <>
      <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 2 }}>
        <IconButton component={RouterLink} to='/' aria-label='Назад към списъка'>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant='h5' component='h1' sx={{ flexGrow: 1 }}>
          {session.title}
        </Typography>
        <IconButton
          onClick={onPanelToggle}
          color={isPanelOpen ? 'primary' : 'default'}
          aria-label='Панел с говорители'
          title='Панел с говорители'
        >
          <PeopleIcon />
        </IconButton>
        <SessionStatusChip status={session.status} />
      </Stack>

      <Stack direction='row' spacing={2} alignItems='center' flexWrap='wrap' useFlexGap sx={{ mb: 1 }}>
        {session.referenceNumber && (
          <Typography variant='body2' color='text.secondary'>
            Реф. № {session.referenceNumber}
          </Typography>
        )}
        <Typography variant='body2' color='text.secondary'>
          {formatDateTime(session.createdAt)}
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          Продължителност: {formatTime(session.durationSec)}
        </Typography>
      </Stack>

      <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap sx={{ mb: 1 }}>
        <LlmControls value={llmRun} isDisabled={isRecleaning} onChange={onLlmRunChange} />
        <Button
          variant='outlined'
          size='small'
          onClick={onRecleanRequest}
          disabled={isRecleaning || blockCount === 0}
        >
          Преизчисти всички блокове
        </Button>
        {recleanProgress && (
          <Stack direction='row' spacing={1} alignItems='center'>
            <CircularProgress size={16} />
            <Typography variant='body2' color='text.secondary'>
              Изчистване {recleanProgress.done}/{recleanProgress.total}…
            </Typography>
          </Stack>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <FormControlLabel
          control={<Switch checked={isVerbatimShown} onChange={(_, checked) => onVerbatimToggle(checked)} />}
          label='Дословен текст'
        />
      </Stack>
    </>
  );
}
