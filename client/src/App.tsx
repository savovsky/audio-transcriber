import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { HealthResponse } from 'shared';
import { fetchHealth } from './api/health';

function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHasError(true));
  }, []);

  return (
    <Container maxWidth='sm'>
      <Box sx={{ py: 8 }}>
        <Typography variant='h3' component='h1' gutterBottom>
          Аудио Транскрибер
        </Typography>
        <Typography variant='body1' color='text.secondary' gutterBottom>
          Скелетът работи — клиент, сървър и споделени типове са свързани.
        </Typography>
        <Stack direction='row' spacing={1} sx={{ mt: 3 }}>
          {hasError && <Chip label='Сървър: недостъпен' color='error' />}
          {!hasError && !health && <Chip label='Сървър: проверка…' color='default' />}
          {health && <Chip label='Сървър: свързан' color='success' />}
          {health && (
            <Chip
              label={health.keysConfigured.deepgram ? 'Deepgram ключ: зададен' : 'Deepgram ключ: липсва'}
              color={health.keysConfigured.deepgram ? 'success' : 'warning'}
              variant='outlined'
            />
          )}
          {health && (
            <Chip
              label={
                health.keysConfigured.openrouter ? 'OpenRouter ключ: зададен' : 'OpenRouter ключ: липсва'
              }
              color={health.keysConfigured.openrouter ? 'success' : 'warning'}
              variant='outlined'
            />
          )}
        </Stack>
      </Box>
    </Container>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path='/' element={<HomePage />} />
    </Routes>
  );
}
