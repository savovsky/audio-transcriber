// Display formatting helpers (pure functions, Bulgarian locale).
import type { Speaker } from 'shared';

// The display caption everywhere a block references its speaker (POC_M4,
// decision 5): the confirmed role wins, the diarization label is the fallback.
export function speakerDisplayName(speaker: Speaker | undefined, fallback: string): string {
  if (!speaker) return fallback;
  return speaker.confirmedRole ?? speaker.label;
}

// 'h:mm:ss' for durations ≥ 1h, else 'm:ss' — block timestamps and durations.
export function formatTime(totalSec: number | null): string {
  if (totalSec === null) return '—';
  const total = Math.max(0, Math.round(totalSec));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('bg-BG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
