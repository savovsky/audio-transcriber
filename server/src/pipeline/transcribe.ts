import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChunkTranscription, TranscriptChunk, TranscriptUtterance, TranscriptionResult } from 'shared';
import type { TranscriptionProvider } from '../transcription/provider';
import { DEFAULT_CHUNK_LENGTH_SEC, chunkAudio } from './chunker';

export interface TranscriptionJob {
  jobId: string;
  jobDir: string;
  chunks: TranscriptChunk[];
}

export interface RunTranscriptionOptions {
  dataDir: string;
  provider: TranscriptionProvider;
  jobId?: string; // reuse an existing job dir to resume from cached chunks
  chunkLengthSec?: number;
  onProgress?: (message: string) => void;
}

// --- pure helpers (unit-tested) ---

export function shiftUtterances(utterances: TranscriptUtterance[], offsetSec: number): TranscriptUtterance[] {
  return utterances.map((u) => ({ ...u, startSec: u.startSec + offsetSec, endSec: u.endSec + offsetSec }));
}

export function mergeChunkTranscriptions(chunks: ChunkTranscription[]): TranscriptUtterance[] {
  return chunks.flatMap((c) => c.utterances).sort((a, b) => a.startSec - b.startSec);
}

export function formatTimestamp(totalSec: number): string {
  const sec = Math.floor(totalSec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

// Human-readable dump for the POC_M1 quality gate (kept under data/, gitignored).
export function formatTranscript(result: TranscriptionResult): string {
  const lines = result.utterances.map(
    (u) => `[${formatTimestamp(u.startSec)}] Speaker ${u.speakerIndex}: ${u.text}`,
  );
  return [`provider: ${result.provider}`, `language: ${result.language}`, '', ...lines, ''].join('\n');
}

// --- IO / orchestration ---

export function makeJobId(inputPath: string): string {
  const base = path
    .basename(inputPath, path.extname(inputPath))
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${base || 'recording'}-${stamp}`;
}

function chunkResultPath(jobDir: string, chunkIndex: number): string {
  return path.join(jobDir, `chunk-${String(chunkIndex).padStart(3, '0')}.json`);
}

async function loadCachedChunk(jobDir: string, chunkIndex: number): Promise<ChunkTranscription | null> {
  try {
    const raw = await readFile(chunkResultPath(jobDir, chunkIndex), 'utf8');
    return JSON.parse(raw) as ChunkTranscription;
  } catch {
    return null; // missing or corrupt cache — transcribe fresh
  }
}

export async function runTranscription(
  inputPath: string,
  options: RunTranscriptionOptions,
): Promise<TranscriptionResult> {
  const { dataDir, provider, chunkLengthSec = DEFAULT_CHUNK_LENGTH_SEC } = options;
  const log = options.onProgress ?? (() => {});

  const jobId = options.jobId ?? makeJobId(inputPath);
  const jobDir = path.join(dataDir, 'jobs', jobId);
  await mkdir(jobDir, { recursive: true });

  const chunks = await chunkAudio(inputPath, { jobDir, chunkLengthSec });
  log(`job ${jobId}: ${chunks.length} chunk(s) of ~${Math.round(chunkLengthSec / 60)} min`);

  const results: ChunkTranscription[] = [];
  for (const chunk of chunks) {
    const cached = await loadCachedChunk(jobDir, chunk.index);
    if (cached) {
      log(`chunk ${chunk.index + 1}/${chunks.length}: cache hit`);
      results.push(cached);
      continue;
    }
    log(`chunk ${chunk.index + 1}/${chunks.length}: transcribing...`);
    const relative = await provider.transcribeChunk(path.join(jobDir, 'chunks', chunk.fileName));
    const transcription: ChunkTranscription = {
      chunkIndex: chunk.index,
      chunkStartSec: chunk.startSec,
      utterances: shiftUtterances(relative, chunk.startSec),
    };
    await writeFile(chunkResultPath(jobDir, chunk.index), JSON.stringify(transcription, null, 2), 'utf8');
    log(`chunk ${chunk.index + 1}/${chunks.length}: ${transcription.utterances.length} utterances (cached)`);
    results.push(transcription);
  }

  const result: TranscriptionResult = {
    provider: provider.id,
    language: provider.language,
    utterances: mergeChunkTranscriptions(results),
  };

  await writeFile(path.join(jobDir, 'transcript.json'), JSON.stringify(result, null, 2), 'utf8');
  await writeFile(path.join(jobDir, 'transcript.txt'), formatTranscript(result), 'utf8');
  log(`done: ${result.utterances.length} utterances -> ${jobDir}`);

  return result;
}
