import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import MarkdownText from './MarkdownText';

export interface ArtifactCardProps {
  title: string;
  text: string | null;
  isGenerating: boolean;
  isDisabled?: boolean;
  onGenerate: () => void;
}

// Session-level artifact (summary / key-facts): stored text, or a generate
// button that uses the header dropdowns' model/temperature (POC_M4, decision 7).
export default function ArtifactCard({
  title,
  text,
  isGenerating,
  isDisabled,
  onGenerate,
}: ArtifactCardProps) {
  return (
    <Paper variant='outlined' sx={{ p: 1.5 }}>
      <Stack direction='row' alignItems='center' spacing={1}>
        <Typography variant='subtitle2' sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {!text && (
          <Button
            size='small'
            variant='outlined'
            onClick={onGenerate}
            disabled={isDisabled || isGenerating}
            startIcon={isGenerating ? <CircularProgress size={14} /> : undefined}
          >
            Генерирай
          </Button>
        )}
      </Stack>
      {text && (
        <Box sx={{ mt: 0.5 }}>
          <MarkdownText text={text} />
        </Box>
      )}
    </Paper>
  );
}
