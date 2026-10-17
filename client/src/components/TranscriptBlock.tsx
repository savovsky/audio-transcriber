import { useEffect, useRef, useState } from 'react';
import MergeIcon from '@mui/icons-material/ArrowUpward';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type {
  BlockRegenerateResponse,
  BlockUpdateRequest,
  CleanedRun,
  Speaker,
  TranscriptBlock,
} from 'shared';
import { formatTime, speakerDisplayName } from '../format';
import CandidatePreview from './CandidatePreview';
import EditableText from './EditableText';
import RegeneratePopover from './RegeneratePopover';

const SAVED_FLASH_MS = 1500;

interface BlockHeaderProps {
  block: TranscriptBlock;
  speaker: Speaker | undefined;
  speakers: Speaker[];
  isActive: boolean;
  isPlaying: boolean;
  isFirst: boolean;
  isDisabled?: boolean;
  didJustSave: boolean;
  onTogglePlay: () => void;
  onSave: (update: BlockUpdateRequest) => Promise<void>;
  onRegenerate: (blockId: string, run: CleanedRun) => Promise<BlockRegenerateResponse>;
  onCandidate: (candidate: BlockRegenerateResponse) => void;
  onMerge: () => void;
}

function BlockHeader(props: BlockHeaderProps) {
  const { block, speaker, speakers, isActive, isPlaying, isFirst, isDisabled, didJustSave } = props;
  const { onTogglePlay, onSave, onRegenerate, onCandidate, onMerge } = props;
  return (
    <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap sx={{ mb: 0.5 }}>
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
      <Chip size='small' label={speakerDisplayName(speaker, `Говорител ${block.speakerId}`)} />
      {!speaker?.confirmedRole && speaker?.suggestedRole && (
        <Chip size='small' variant='outlined' label={`предложение: ${speaker.suggestedRole}`} />
      )}
      <TextField
        select
        size='small'
        variant='standard'
        value={block.speakerId}
        disabled={isDisabled}
        onChange={(event) => void onSave({ speakerId: event.target.value })}
        slotProps={{ input: { disableUnderline: true } }}
        sx={{ minWidth: 130 }}
        aria-label='Прехвърли към говорител'
      >
        {speakers.map((s) => (
          <MenuItem key={s.id} value={s.id}>
            {speakerDisplayName(s, s.label)}
          </MenuItem>
        ))}
      </TextField>
      <Box sx={{ flexGrow: 1 }} />
      {didJustSave && (
        <Typography variant='caption' color='success.main'>
          запазено
        </Typography>
      )}
      <IconButton
        size='small'
        onClick={onMerge}
        disabled={isDisabled || isFirst}
        aria-label='Обедини с предишния блок'
        title='Обедини с предишния блок'
      >
        <MergeIcon fontSize='small' />
      </IconButton>
      <RegeneratePopover
        block={block}
        isDisabled={isDisabled}
        onGenerate={onRegenerate}
        onCandidate={onCandidate}
      />
    </Stack>
  );
}

export interface TranscriptBlockProps {
  block: TranscriptBlock;
  speaker: Speaker | undefined;
  speakers: Speaker[]; // the session's speakers — for the reassign dropdown
  isVerbatimShown: boolean;
  isActive: boolean;
  isPlaying: boolean;
  isFirst: boolean; // first block has nothing to merge into
  isDisabled?: boolean; // session-wide re-clean running
  onTogglePlay: () => void;
  onSave: (blockId: string, update: BlockUpdateRequest) => Promise<void>;
  onRegenerate: (blockId: string, run: CleanedRun) => Promise<BlockRegenerateResponse>;
  onMerge: (blockId: string) => Promise<void>;
}

export default function TranscriptBlockView(props: TranscriptBlockProps) {
  const { block, speaker, speakers, isVerbatimShown, isActive, isPlaying, isFirst, isDisabled } = props;
  const { onTogglePlay, onSave, onRegenerate, onMerge } = props;
  const [didJustSave, setDidJustSave] = useState(false);
  const [candidate, setCandidate] = useState<BlockRegenerateResponse | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup the flash timer on unmount.
  useEffect(() => () => void (flashTimerRef.current && clearTimeout(flashTimerRef.current)), []);

  const flashSaved = () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setDidJustSave(true);
    flashTimerRef.current = setTimeout(() => setDidJustSave(false), SAVED_FLASH_MS);
  };

  const handleSave = async (update: BlockUpdateRequest) => {
    await onSave(block.id, update);
    flashSaved();
  };

  const handleApplyCandidate = async () => {
    if (!candidate) return;
    setIsApplying(true);
    try {
      await onSave(block.id, { cleanedText: candidate.candidateText, cleanedRun: candidate.run });
      setCandidate(null);
      flashSaved();
    } finally {
      setIsApplying(false);
    }
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
        {...{ block, speaker, speakers, isActive, isPlaying, isFirst, isDisabled, didJustSave }}
        onTogglePlay={onTogglePlay}
        onSave={handleSave}
        onRegenerate={onRegenerate}
        onCandidate={setCandidate}
        onMerge={() => void onMerge(block.id)}
      />

      {block.cleanedText !== null ? (
        // key = the saved text: external changes (merge, re-clean, regenerate
        // apply) REMOUNT the field so the fresh text is shown — EditableText
        // intentionally has no prop→state sync (M3 design).
        <EditableText
          key={block.cleanedText}
          italic={false}
          value={block.cleanedText}
          isDisabled={isDisabled}
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
          key={block.verbatimText}
          italic
          value={block.verbatimText}
          isDisabled={isDisabled}
          onSave={(verbatimText) => handleSave({ verbatimText })}
        />
      )}

      {candidate && (
        <CandidatePreview
          candidate={candidate}
          isApplying={isApplying}
          onApply={() => void handleApplyCandidate()}
          onDiscard={() => setCandidate(null)}
        />
      )}
    </Paper>
  );
}
