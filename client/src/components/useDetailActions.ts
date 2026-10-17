import { useState } from 'react';
import type {
  BlockRegenerateResponse,
  BlockUpdateRequest,
  CleanedRun,
  SessionArtifactRequest,
  SessionDetailResponse,
  SpeakerUpdateRequest,
  TranscriptBlock,
} from 'shared';
import { toUserMessage } from '../api/errors';
import {
  generateSessionArtifact,
  mergeBlock,
  recleanSessionBatch,
  regenerateBlock,
  updateBlock,
  updateSpeaker,
} from '../api/sessions';

type SetDetail = React.Dispatch<React.SetStateAction<SessionDetailResponse | null>>;

// All mutating actions of the session detail page (POC_M3 saves + the POC_M4
// editing workflow). Components stay dumb; this hook owns the API calls and the
// detail-state updates. Errors surface via actionError (Bulgarian user text).
export interface DetailActionsInput {
  detail: SessionDetailResponse | null;
  setDetail: SetDetail;
  llmRun: CleanedRun;
}

export function useDetailActions(input: DetailActionsInput) {
  const { detail, setDetail, llmRun } = input;
  const [actionError, setActionError] = useState<string | null>(null);
  const [recleanProgress, setRecleanProgress] = useState<{ done: number; total: number } | null>(null);
  const [isConfirmRecleanOpen, setIsConfirmRecleanOpen] = useState(false);
  const [generatingKind, setGeneratingKind] = useState<SessionArtifactRequest['kind'] | null>(null);

  const replaceBlocks = (updated: TranscriptBlock[]) => {
    const byId = new Map(updated.map((b) => [b.id, b]));
    setDetail((prev) => prev && { ...prev, blocks: prev.blocks.map((b) => byId.get(b.id) ?? b) });
  };

  const handleSaveBlock = async (blockId: string, update: BlockUpdateRequest) => {
    const { block } = await updateBlock(blockId, update);
    replaceBlocks([block]);
  };

  const handleRegenerate = (blockId: string, run: CleanedRun): Promise<BlockRegenerateResponse> =>
    regenerateBlock(blockId, run);

  const handleMerge = async (blockId: string) => {
    try {
      const { block, removedBlockId } = await mergeBlock(blockId);
      setDetail(
        (prev) =>
          prev && {
            ...prev,
            blocks: prev.blocks
              .filter((b) => b.id !== removedBlockId)
              .map((b) => (b.id === block.id ? block : b)),
          },
      );
    } catch (err) {
      setActionError(toUserMessage(err));
    }
  };

  const handleUpdateSpeaker = async (speakerId: string, update: SpeakerUpdateRequest) => {
    try {
      const { speaker } = await updateSpeaker(speakerId, update);
      setDetail(
        (prev) =>
          prev && { ...prev, speakers: prev.speakers.map((s) => (s.id === speaker.id ? speaker : s)) },
      );
    } catch (err) {
      setActionError(toUserMessage(err));
      throw err; // the panel reverts its draft on rejection
    }
  };

  // Session-wide re-clean (blocking UI + progress count, decision 11): 'start'
  // marks all blocks pending, then the loop cleans one batch per request.
  // Stops on a no-progress response — the model keeps omitting those blocks.
  const handleRecleanAll = async () => {
    if (!detail) return;
    setIsConfirmRecleanOpen(false);
    setActionError(null);
    setRecleanProgress({ done: 0, total: detail.blocks.length });
    try {
      let mode: 'start' | 'continue' = 'start';
      for (;;) {
        const result = await recleanSessionBatch(detail.session.id, { ...llmRun, mode });
        replaceBlocks(result.cleanedBlocks);
        setRecleanProgress({ done: result.total - result.remaining, total: result.total });
        if (result.remaining === 0) break;
        if (result.cleanedBlocks.length === 0) {
          throw new Error('Моделът не върна резултат за част от блоковете — опитайте отново.');
        }
        mode = 'continue';
      }
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setRecleanProgress(null);
    }
  };

  const handleGenerateArtifact = async (kind: SessionArtifactRequest['kind']) => {
    if (!detail) return;
    setGeneratingKind(kind);
    setActionError(null);
    try {
      const { session } = await generateSessionArtifact(detail.session.id, {
        kind,
        model: llmRun.model,
        temperature: llmRun.temperature,
      });
      setDetail((prev) => prev && { ...prev, session });
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setGeneratingKind(null);
    }
  };

  return {
    actionError,
    setActionError,
    recleanProgress,
    isRecleaning: recleanProgress !== null,
    isConfirmRecleanOpen,
    setIsConfirmRecleanOpen,
    generatingKind,
    handleSaveBlock,
    handleRegenerate,
    handleMerge,
    handleUpdateSpeaker,
    handleRecleanAll,
    handleGenerateArtifact,
  };
}
