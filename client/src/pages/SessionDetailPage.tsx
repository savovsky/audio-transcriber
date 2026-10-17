import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import type { BlockUpdateRequest, SessionDetailResponse, Speaker } from 'shared';
import { fetchSessionDetail, updateBlock } from '../api/sessions';
import SessionStatusChip from '../components/SessionStatusChip';
import TranscriptBlockView from '../components/TranscriptBlock';
import { useBlockPlayback } from '../components/useBlockPlayback';
import { formatDateTime, formatTime } from '../format';

function speakerLegendLabel(speaker: Speaker): string {
  if (speaker.confirmedRole) return `${speaker.label} — ${speaker.confirmedRole}`;
  if (speaker.suggestedRole) return `${speaker.label} — предложение: ${speaker.suggestedRole}`;
  return speaker.label;
}

interface DetailHeaderProps {
  detail: SessionDetailResponse;
  isVerbatimShown: boolean;
  onVerbatimToggle: (shown: boolean) => void;
}

function DetailHeader({ detail, isVerbatimShown, onVerbatimToggle }: DetailHeaderProps) {
  const { session, speakers } = detail;
  return (
    <>
      <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 2 }}>
        <IconButton component={RouterLink} to='/' aria-label='Назад към списъка'>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant='h5' component='h1' sx={{ flexGrow: 1 }}>
          {session.title}
        </Typography>
        <SessionStatusChip status={session.status} />
      </Stack>

      <Stack direction='row' spacing={2} alignItems='center' flexWrap='wrap' sx={{ mb: 1 }}>
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

      <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' sx={{ mb: 1 }}>
        {speakers.map((speaker) => (
          <Chip key={speaker.id} size='small' variant='outlined' label={speakerLegendLabel(speaker)} />
        ))}
      </Stack>

      <Stack direction='row' justifyContent='flex-end'>
        <FormControlLabel
          control={<Switch checked={isVerbatimShown} onChange={(_, checked) => onVerbatimToggle(checked)} />}
          label='Дословен текст'
        />
      </Stack>

      <Divider sx={{ mb: 2 }} />
    </>
  );
}

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerbatimShown, setIsVerbatimShown] = useState(true);
  const { audioRef, activeBlockId, isPlaying, toggleBlock } = useBlockPlayback();

  useEffect(() => {
    if (!sessionId) return;
    fetchSessionDetail(sessionId)
      .then(setDetail)
      .catch((err: Error) => setError(err.message));
  }, [sessionId]);

  const speakerById = useMemo(() => {
    const map = new Map<string, Speaker>();
    for (const speaker of detail?.speakers ?? []) map.set(speaker.id, speaker);
    return map;
  }, [detail]);

  const handleSave = async (blockId: string, update: BlockUpdateRequest) => {
    const { block } = await updateBlock(blockId, update);
    setDetail((prev) => prev && { ...prev, blocks: prev.blocks.map((b) => (b.id === block.id ? block : b)) });
  };

  if (error) {
    return (
      <Container maxWidth='md'>
        <Box sx={{ py: 4 }}>
          <Alert severity='error'>Грешка при зареждане на сесията: {error}</Alert>
        </Box>
      </Container>
    );
  }

  if (!detail) {
    return (
      <Container maxWidth='md'>
        <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth='md'>
      <Box sx={{ py: 3 }}>
        <DetailHeader
          detail={detail}
          isVerbatimShown={isVerbatimShown}
          onVerbatimToggle={setIsVerbatimShown}
        />

        {/* The single page-level audio element — block buttons seek + play segments. */}
        <audio ref={audioRef} src={detail.audioUrl} preload='metadata' style={{ display: 'none' }} />

        <Stack spacing={1.5}>
          {detail.blocks.map((block) => (
            <TranscriptBlockView
              key={block.id}
              block={block}
              speaker={speakerById.get(block.speakerId)}
              isVerbatimShown={isVerbatimShown}
              isActive={activeBlockId === block.id}
              isPlaying={isPlaying}
              onTogglePlay={() => toggleBlock(block)}
              onSave={handleSave}
            />
          ))}
        </Stack>
      </Box>
    </Container>
  );
}
