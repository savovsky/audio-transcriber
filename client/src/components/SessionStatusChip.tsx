import Chip from '@mui/material/Chip';
import { SESSION_STATUS_DISPLAY_NAMES } from 'shared';
import type { SessionStatus } from 'shared';

type ChipColor = 'success' | 'error' | 'default';

function colorFor(status: SessionStatus): ChipColor {
  if (status === 'ready') return 'success';
  if (status === 'failed') return 'error';
  return 'default';
}

export default function SessionStatusChip({
  status,
  size,
}: {
  status: SessionStatus;
  size?: 'small' | 'medium';
}) {
  return <Chip size={size} label={SESSION_STATUS_DISPLAY_NAMES[status]} color={colorFor(status)} />;
}
