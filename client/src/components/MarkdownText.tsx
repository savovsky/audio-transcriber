import ReactMarkdown, { type Components } from 'react-markdown';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// Renders the LLM's Markdown artifacts (summary / key-facts) with MUI styling —
// real bold, real (nested) bullet lists — instead of literal ** and * markers.
// POC_M5 note: the .docx export must map the SAME Markdown structure to Word
// formatting (bold runs, bullet lists) so the export matches the UI.

const markdownComponents: Components = {
  p: ({ children }) => (
    <Typography variant='body2' sx={{ mb: 1 }}>
      {children}
    </Typography>
  ),
  h1: ({ children }) => <Typography variant='subtitle1'>{children}</Typography>,
  h2: ({ children }) => <Typography variant='subtitle1'>{children}</Typography>,
  h3: ({ children }) => <Typography variant='subtitle2'>{children}</Typography>,
  h4: ({ children }) => <Typography variant='subtitle2'>{children}</Typography>,
  ul: ({ children }) => (
    <Box component='ul' sx={{ pl: 2.5, my: 0.5 }}>
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box component='ol' sx={{ pl: 2.5, my: 0.5 }}>
      {children}
    </Box>
  ),
  li: ({ children }) => (
    <Box component='li' sx={{ typography: 'body2', mb: 0.5 }}>
      {children}
    </Box>
  ),
};

export interface MarkdownTextProps {
  text: string;
}

export default function MarkdownText({ text }: MarkdownTextProps) {
  return <ReactMarkdown components={markdownComponents}>{text}</ReactMarkdown>;
}
