import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranscriptBlock } from 'shared';

export interface BlockPlayback {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  activeBlockId: string | null;
  isPlaying: boolean;
  toggleBlock: (block: TranscriptBlock) => void;
}

// Audio-block sync playback: ONE page-level <audio> element (owned by the
// caller via audioRef); a block's play button seeks to startSec, plays, and
// auto-pauses at endSec (POC_M3 plan, decision 3).
export function useBlockPlayback(): BlockPlayback {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Refs so the timeupdate listener (attached once) sees current values.
  const activeBlockRef = useRef<TranscriptBlock | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const block = activeBlockRef.current;
      if (block && audio.currentTime >= block.endSec) {
        audio.pause();
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const toggleBlock = useCallback((block: TranscriptBlock) => {
    const audio = audioRef.current;
    if (!audio) return;

    const isActive = activeBlockRef.current?.id === block.id;
    if (isActive && !audio.paused) {
      audio.pause();
      return;
    }
    // Resume mid-segment only if the cursor is still inside the block;
    // otherwise (re)start from the block's beginning.
    const isInsideBlock = isActive && audio.currentTime >= block.startSec && audio.currentTime < block.endSec;
    if (!isInsideBlock) {
      audio.currentTime = block.startSec;
    }
    activeBlockRef.current = block;
    setActiveBlockId(block.id);
    void audio.play();
  }, []);

  return { audioRef, activeBlockId, isPlaying, toggleBlock };
}
