import { useEffect, useRef, useState } from 'react';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { BlockUpdateRequest, Speaker, TranscriptBlock } from 'shared';
import { formatTime } from '../format';

const SAVED_FLASH_MS = 1500;

interface EditableTextProps {
  value: string;
  italic: boolean;
  onSave: (text: string) => Promise<void>;
}

// One editable text layer. Auto-saves on blur when changed; Escape reverts to
// the last saved value (POC_M3 plan, decision 8). No prop→state sync effect:
// the only writer is this component's own save (single-user app), and after a
// save the prop value equals the draft anyway.
function EditableText({ value, italic, onSave }: EditableTextProps) {
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

interface BlockHeaderProps {
  block: TranscriptBlock;
  speaker: Speaker | undefined;
  isActive: boolean;
  isPlaying: boolean;
  didJustSave: boolean;
  onTogglePlay: () => void;
}

function roleChip(speaker: Speaker | undefined): React.ReactNode {
  if (!speaker) return null;
  if (speaker.confirmedRole) {
    return <Chip size='small' color='primary' variant='outlined' label={speaker.confirmedRole} />;
  }
  if (speaker.suggestedRole) {
    return <Chip size='small' variant='outlined' label={`предложение: ${speaker.suggestedRole}`} />;
  }
  return null;
}

function BlockHeader({ block, speaker, isActive, isPlaying, didJustSave, onTogglePlay }: BlockHeaderProps) {
  return (
    <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 0.5 }}>
      <IconButton
        size='small'
        onClick={onTogglePlay}
        color={isActive ? 'primary' : 'default'}
        aria-label={isActive && isPlaying ? 'Пауза' : 'Пусни откъса'}
      >
        {isActive && isPlaying ? <PauseIcon fontSize='small' /> : <PlayArrowIcon fontSize='small' />}
      </IconButton>
      <Typography variant='caption' color='text.secondary'>
        {formatTime(block.startSec)} – {formatTime(block.endSec)}
      </Typography>
      <Chip size='small' label={speaker?.label ?? `Говорител ${block.speakerId}`} />
      {roleChip(speaker)}
      {didJustSave && (
        <Typography variant='caption' color='success.main'>
          запазено
        </Typography>
      )}
    </Stack>
  );
}

export interface TranscriptBlockProps {
  block: TranscriptBlock;
  speaker: Speaker | undefined;
  isVerbatimShown: boolean;
  isActive: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSave: (blockId: string, update: BlockUpdateRequest) => Promise<void>;
}

export default function TranscriptBlockView(props: TranscriptBlockProps) {
  const { block, speaker, isVerbatimShown, isActive, isPlaying, onTogglePlay, onSave } = props;
  const [didJustSave, setDidJustSave] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const handleSave = async (update: BlockUpdateRequest) => {
    await onSave(block.id, update);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setDidJustSave(true);
    flashTimerRef.current = setTimeout(() => setDidJustSave(false), SAVED_FLASH_MS);
  };

  const isVerbatimVisible = isVerbatimShown || block.cleanedText === null;

  return (
    <Paper
      variant='outlined'
      sx={{
        p: 1.5,
        borderColor: isActive ? 'primary.main' : undefined,
        borderWidth: isActive ? 2 : 1,
        bgcolor: isActive ? 'action.selected' : undefined,
      }}
    >
      <BlockHeader
        block={block}
        speaker={speaker}
        isActive={isActive}
        isPlaying={isPlaying}
        didJustSave={didJustSave}
        onTogglePlay={onTogglePlay}
      />

      {block.cleanedText !== null ? (
        <EditableText
          italic={false}
          value={block.cleanedText}
          onSave={(cleanedText) => handleSave({ cleanedText })}
        />
      ) : (
        <Box sx={{ px: 1 }}>
          <Typography variant='caption' color='warning.main'>
            изчаква изчистване
          </Typography>
        </Box>
      )}

      {isVerbatimVisible && (
        <EditableText
          italic
          value={block.verbatimText}
          onSave={(verbatimText) => handleSave({ verbatimText })}
        />
      )}
    </Paper>
  );
}
