import { useState } from 'react';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { BlockRegenerateResponse, CleanedRun, TranscriptBlock } from 'shared';
import { DEFAULT_LLM_RUN } from '../llmRun';
import LlmControls from './LlmControls';

export interface RegeneratePopoverProps {
  block: TranscriptBlock;
  isDisabled?: boolean;
  onGenerate: (blockId: string, run: CleanedRun) => Promise<BlockRegenerateResponse>;
  onCandidate: (candidate: BlockRegenerateResponse) => void;
}

// The ↻ button + popover with the three LLM knobs, pre-filled from the block's
// cleaned_* provenance (or the defaults when never cleaned). Preview-then-apply:
// the candidate is handed back via onCandidate, nothing is persisted here.
export default function RegeneratePopover({
  block,
  isDisabled,
  onGenerate,
  onCandidate,
}: RegeneratePopoverProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [run, setRun] = useState<CleanedRun>({
    style: block.cleanedStyle ?? DEFAULT_LLM_RUN.style,
    model: block.cleanedModel ?? DEFAULT_LLM_RUN.model,
    temperature: block.cleanedTemperature ?? DEFAULT_LLM_RUN.temperature,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setHasError(false);
    onGenerate(block.id, run)
      .then((candidate) => {
        setAnchorEl(null);
        onCandidate(candidate);
      })
      .catch(() => setHasError(true))
      .finally(() => setIsGenerating(false));
  };

  return (
    <>
      <IconButton
        size='small'
        onClick={(event) => setAnchorEl(event.currentTarget)}
        disabled={isDisabled}
        aria-label='Генерирай наново'
        title='Генерирай наново'
      >
        <AutorenewIcon fontSize='small' />
      </IconButton>
      <Popover
        open={anchorEl !== null}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Stack spacing={1.5} sx={{ p: 2, maxWidth: 560 }}>
          <LlmControls value={run} isDisabled={isGenerating} onChange={setRun} />
          <Stack direction='row' spacing={1} alignItems='center' justifyContent='flex-end'>
            {hasError && (
              <Typography variant='caption' color='error'>
                Грешка при генериране
              </Typography>
            )}
            <Button
              variant='contained'
              size='small'
              onClick={handleGenerate}
              disabled={isGenerating}
              startIcon={isGenerating ? <CircularProgress size={14} /> : undefined}
            >
              Генерирай
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
}
