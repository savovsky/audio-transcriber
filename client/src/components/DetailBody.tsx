import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type {
  BlockRegenerateResponse,
  BlockUpdateRequest,
  CleanedRun,
  SessionDetailResponse,
  Speaker,
  SpeakerUpdateRequest,
  TranscriptBlock,
} from 'shared';
import SpeakerPanel from './SpeakerPanel';
import TranscriptBlockView from './TranscriptBlock';

export interface DetailBodyProps {
  detail: SessionDetailResponse;
  speakerById: Map<string, Speaker>;
  isVerbatimShown: boolean;
  isPanelOpen: boolean;
  isRecleaning: boolean;
  activeBlockId: string | null;
  isPlaying: boolean;
  onTogglePlay: (block: TranscriptBlock) => void;
  onSave: (blockId: string, update: BlockUpdateRequest) => Promise<void>;
  onRegenerate: (blockId: string, run: CleanedRun) => Promise<BlockRegenerateResponse>;
  onMerge: (blockId: string) => Promise<void>;
  onUpdateSpeaker: (speakerId: string, update: SpeakerUpdateRequest) => Promise<void>;
}

// The transcript column + the toggleable speaker panel (POC_M4, decision 4).
export default function DetailBody(props: DetailBodyProps) {
  const { detail, speakerById, isVerbatimShown, isPanelOpen, isRecleaning, activeBlockId, isPlaying } = props;
  const { onTogglePlay, onSave, onRegenerate, onMerge, onUpdateSpeaker } = props;
  const { speakers, blocks } = detail;

  return (
    <Stack direction='row' spacing={2} alignItems='flex-start'>
      <Stack spacing={1.5} sx={{ flexGrow: 1, minWidth: 0 }}>
        {blocks.map((block, index) => (
          <TranscriptBlockView
            key={block.id}
            block={block}
            speaker={speakerById.get(block.speakerId)}
            speakers={speakers}
            isVerbatimShown={isVerbatimShown}
            isActive={activeBlockId === block.id}
            isPlaying={isPlaying}
            isFirst={index === 0}
            isDisabled={isRecleaning}
            onTogglePlay={() => onTogglePlay(block)}
            onSave={onSave}
            onRegenerate={onRegenerate}
            onMerge={onMerge}
          />
        ))}
      </Stack>
      {isPanelOpen && (
        <Box sx={{ width: 320, flexShrink: 0 }}>
          <SpeakerPanel speakers={speakers} isDisabled={isRecleaning} onUpdate={onUpdateSpeaker} />
        </Box>
      )}
    </Stack>
  );
}
