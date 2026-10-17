import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import type { CleanedRun, SessionDetailResponse, Speaker } from 'shared';
import { fetchSessionDetail } from '../api/sessions';
import ArtifactCard from '../components/ArtifactCard';
import DetailBody from '../components/DetailBody';
import DetailHeader from '../components/DetailHeader';
import RecleanConfirmDialog from '../components/RecleanConfirmDialog';
import { useBlockPlayback } from '../components/useBlockPlayback';
import { useDetailActions } from '../components/useDetailActions';
import { DEFAULT_LLM_RUN } from '../llmRun';

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerbatimShown, setIsVerbatimShown] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [llmRun, setLlmRun] = useState<CleanedRun>(DEFAULT_LLM_RUN);
  const { audioRef, activeBlockId, isPlaying, toggleBlock } = useBlockPlayback();
  const actions = useDetailActions({ detail, setDetail, llmRun });

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

  if (error || !detail) {
    return (
      <Container maxWidth='md'>
        <Box sx={{ py: error ? 4 : 8, display: 'flex', justifyContent: 'center' }}>
          {error ? (
            <Alert severity='error'>Грешка при зареждане на сесията: {error}</Alert>
          ) : (
            <CircularProgress />
          )}
        </Box>
      </Container>
    );
  }

  const { session } = detail;
  const artifacts = [
    { kind: 'summary', title: 'Резюме', text: session.summaryText },
    { kind: 'key-facts', title: 'Ключови факти', text: session.keyFactsText },
  ] as const;

  return (
    <Container maxWidth='lg'>
      <Box sx={{ py: 3 }}>
        <DetailHeader
          session={session}
          blockCount={detail.blocks.length}
          llmRun={llmRun}
          recleanProgress={actions.recleanProgress}
          isVerbatimShown={isVerbatimShown}
          isPanelOpen={isPanelOpen}
          onLlmRunChange={setLlmRun}
          onRecleanRequest={() => actions.setIsConfirmRecleanOpen(true)}
          onVerbatimToggle={setIsVerbatimShown}
          onPanelToggle={() => setIsPanelOpen((open) => !open)}
        />

        {actions.actionError && (
          <Alert severity='error' onClose={() => actions.setActionError(null)} sx={{ mb: 1 }}>
            {actions.actionError}
          </Alert>
        )}

        <Stack spacing={1} sx={{ mb: 2 }}>
          {artifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.kind}
              title={artifact.title}
              text={artifact.text}
              isGenerating={actions.generatingKind === artifact.kind}
              isDisabled={actions.isRecleaning}
              onGenerate={() => void actions.handleGenerateArtifact(artifact.kind)}
            />
          ))}
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {/* The single page-level audio element — block buttons seek + play segments. */}
        <audio ref={audioRef} src={detail.audioUrl} preload='metadata' style={{ display: 'none' }} />

        <DetailBody
          detail={detail}
          speakerById={speakerById}
          isVerbatimShown={isVerbatimShown}
          isPanelOpen={isPanelOpen}
          isRecleaning={actions.isRecleaning}
          activeBlockId={activeBlockId}
          isPlaying={isPlaying}
          onTogglePlay={toggleBlock}
          onSave={actions.handleSaveBlock}
          onRegenerate={actions.handleRegenerate}
          onMerge={actions.handleMerge}
          onUpdateSpeaker={actions.handleUpdateSpeaker}
        />
      </Box>

      <RecleanConfirmDialog
        isOpen={actions.isConfirmRecleanOpen}
        onCancel={() => actions.setIsConfirmRecleanOpen(false)}
        onConfirm={() => void actions.handleRecleanAll()}
      />
    </Container>
  );
}
