import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { TranscriptChunk } from 'shared';

const execFileAsync = promisify(execFile);

export const DEFAULT_CHUNK_LENGTH_SEC = 15 * 60; // ~15 minutes, per architecture doc

function ffmpegBin(): string {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static did not resolve a binary for this platform.');
  }
  return ffmpegPath;
}

// --- pure helpers (unit-tested) ---

// `ffmpeg -i file` prints "Duration: 00:12:34.56, ..." to stderr and exits 1.
export function parseFfmpegDuration(stderr: string): number | null {
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function planChunks(durationSec: number, chunkLengthSec: number): TranscriptChunk[] {
  if (durationSec <= 0 || chunkLengthSec <= 0) return [];
  const chunks: TranscriptChunk[] = [];
  for (let start = 0; start < durationSec; start += chunkLengthSec) {
    const index = chunks.length;
    chunks.push({
      index,
      fileName: chunkFileName(index),
      startSec: start,
      durationSec: Math.min(chunkLengthSec, durationSec - start),
    });
  }
  return chunks;
}

export function chunkFileName(index: number): string {
  return `chunk-${String(index).padStart(3, '0')}.mp3`;
}

// --- IO ---

export async function probeDurationSec(inputPath: string): Promise<number> {
  try {
    const { stderr } = await execFileAsync(ffmpegBin(), ['-hide_banner', '-i', inputPath]);
    const duration = parseFfmpegDuration(stderr);
    if (duration !== null) return duration;
  } catch (error: unknown) {
    // ffmpeg exits non-zero when given no output target — the duration is still on stderr.
    const stderr = (error as { stderr?: string }).stderr;
    const duration = stderr ? parseFfmpegDuration(stderr) : null;
    if (duration !== null) return duration;
    throw new Error(`Failed to probe audio duration: ${inputPath}`, { cause: error });
  }
  throw new Error(`Could not parse duration from ffmpeg output for: ${inputPath}`);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export interface ChunkAudioOptions {
  jobDir: string;
  chunkLengthSec?: number;
}

// Splits the source into ~chunkLengthSec MP3 chunks inside jobDir/chunks/.
// Already-existing chunk files are kept (per-chunk cache — a re-run resumes).
export async function chunkAudio(inputPath: string, options: ChunkAudioOptions): Promise<TranscriptChunk[]> {
  const { jobDir, chunkLengthSec = DEFAULT_CHUNK_LENGTH_SEC } = options;
  const chunksDir = path.join(jobDir, 'chunks');
  await mkdir(chunksDir, { recursive: true });

  const durationSec = await probeDurationSec(inputPath);
  const plan = planChunks(durationSec, chunkLengthSec);
  if (plan.length === 0) {
    throw new Error(`Audio has no positive duration: ${inputPath}`);
  }

  for (const chunk of plan) {
    const outPath = path.join(chunksDir, chunk.fileName);
    if (await fileExists(outPath)) continue; // cache hit
    await execFileAsync(ffmpegBin(), [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-ss',
      String(chunk.startSec),
      '-t',
      String(chunk.durationSec),
      '-i',
      inputPath,
      '-c',
      'copy',
      outPath,
    ]);
  }

  return plan;
}
