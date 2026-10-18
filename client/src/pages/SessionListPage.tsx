import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { HealthResponse, SessionListItem } from 'shared';
import { withRetry } from '../api/client';
import { fetchHealth } from '../api/health';
import { fetchSessions } from '../api/sessions';
import SessionStatusChip from '../components/SessionStatusChip';
import { formatDateTime, formatTime } from '../format';

export default function SessionListPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  // withRetry: the browser opens before tsx watch has the server listening —
  // retry the initial loads instead of showing a dead error state on startup.
  useEffect(() => {
    withRetry(fetchSessions)
      .then((body) => setSessions(body.sessions))
      .catch((err: Error) => setError(err.message));
    withRetry(fetchHealth)
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <Container maxWidth='lg'>
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
          <Typography variant='h4' component='h1' sx={{ flexGrow: 1 }}>
            Аудио Транскрибер
          </Typography>
          <Chip
            label={health ? 'Сървър: свързан' : 'Сървър: недостъпен'}
            color={health ? 'success' : 'error'}
            size='small'
          />
        </Box>

        {error && <Alert severity='error'>Грешка при зареждане на сесиите: {error}</Alert>}

        {!error && !sessions && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {sessions && sessions.length === 0 && (
          <Alert severity='info'>
            Няма записани сесии. Импортирайте ElevenLabs експорт през CLI: npm run import -w server --
            &lt;export.json&gt; [--audio …]
          </Alert>
        )}

        {sessions && sessions.length > 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Име</TableCell>
                  <TableCell>Реф. №</TableCell>
                  <TableCell>Дата</TableCell>
                  <TableCell>Продължителност</TableCell>
                  <TableCell>Статус</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow
                    key={session.id}
                    hover
                    onClick={() => void navigate(`/sessions/${encodeURIComponent(session.id)}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{session.title}</TableCell>
                    <TableCell>{session.referenceNumber ?? '—'}</TableCell>
                    <TableCell>{formatDateTime(session.createdAt)}</TableCell>
                    <TableCell>{formatTime(session.durationSec)}</TableCell>
                    <TableCell>
                      <SessionStatusChip status={session.status} size='small' />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Container>
  );
}
