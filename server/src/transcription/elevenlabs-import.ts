import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TranscriptUtterance, TranscriptionResult } from 'shared';
import { formatTranscript, makeJobId } from '../pipeline/transcribe';

// ElevenLabs Scribe WEB-EXPORT import adapter (POC_M2 offline strategy).
// The web demo's JSON export is the offline transcription source until the
// ElevenLabs API subscription lands; the future API provider plugs in behind
// transcription/provider.ts and produces the same TranscriptionResult contract.
//
// Web-export shape (observed):
//   {
//     "language_code": "bul",
//     "segments": [
//       { "text": "...", "start_time": 0, "end_time": 30.42,
//         "speaker": { "id": "speaker_0", "name": "Speaker 0" },
//         "words": [ { "text": "...", "start_time": 0, "end_time": 0.4 }, ... ] }
//     ]
//   }
// - segment timestamps are already ABSOLUTE (single file, no chunking)
// - audio events are inline bracketed text (e.g. "[шумолене на хартия]") — kept as-is
// - words[] word-level timings are IGNORED by the contract (utterance-level is
//   enough for block playback); the raw export file is kept in the job dir.

export const IMPORT_PROVIDER_ID = 'elevenlabs/web-export';

interface RawExportSpeaker {
  id?: unknown;
  name?: unknown;
}

interface RawExportSegment {
  text?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  speaker?: RawExportSpeaker;
}

interface RawExport {
  language_code?: unknown;
  segments?: unknown;
}

// --- pure helpers (unit-tested) ---

// 'speaker_12' -> 12. Returns null for anything unparseable.
export function parseSpeakerIndex(speakerId: string): number | null {
  const match = /^speaker_(\d+)$/.exec(speakerId);
  return match ? Number(match[1]) : null;
}

export function parseElevenLabsExport(raw: unknown): TranscriptionResult {
  const data = raw as RawExport;
  if (data === null || typeof data !== 'object' || !Array.isArray(data.segments)) {
    throw new Error('Not an ElevenLabs web-export: expected an object with a "segments" array.');
  }

  const utterances: TranscriptUtterance[] = [];
  // Fallback for non-standard speaker ids: first-appearance order.
  const fallbackIndices = new Map<string, number>();

  for (const [i, segment] of (data.segments as RawExportSegment[]).entries()) {
    const { text, start_time: startTime, end_time: endTime, speaker } = segment;
    if (typeof text !== 'string' || typeof startTime !== 'number' || typeof endTime !== 'number') {
      throw new Error(`Segment ${i}: expected text (string), start_time and end_time (numbers).`);
    }
    const speakerId = typeof speaker?.id === 'string' ? speaker.id : 'speaker_?';
    let speakerIndex = parseSpeakerIndex(speakerId);
    if (speakerIndex === null) {
      speakerIndex = fallbackIndices.get(speakerId) ?? fallbackIndices.size;
      fallbackIndices.set(speakerId, speakerIndex);
    }
    // Audio-event tags stay inline in the text — valuable on covert audio.
    utterances.push({ speakerIndex, startSec: startTime, endSec: endTime, text });
  }

  utterances.sort((a, b) => a.startSec - b.startSec);

  return {
    provider: IMPORT_PROVIDER_ID,
    language: typeof data.language_code === 'string' ? data.language_code : 'unknown',
    utterances,
  };
}

// --- IO / orchestration ---

export interface RunImportOptions {
  dataDir: string;
  jobId?: string; // reuse an existing job dir (re-import / resume)
  audioPath?: string; // recording to copy into the job dir for playback sync
  onProgress?: (message: string) => void;
}

export interface ImportJob {
  jobId: string;
  jobDir: string;
  result: TranscriptionResult;
}

export async function runElevenLabsImport(exportPath: string, options: RunImportOptions): Promise<ImportJob> {
  const log = options.onProgress ?? (() => {});
  const jobId = options.jobId ?? makeJobId(exportPath);
  const jobDir = path.join(options.dataDir, 'jobs', jobId);
  await mkdir(jobDir, { recursive: true });

  const raw = await readFile(exportPath, 'utf8');
  const result = parseElevenLabsExport(JSON.parse(raw));
  log(`job ${jobId}: ${result.utterances.length} segments (language: ${result.language})`);

  // Keep the raw export in the job dir (word timings live only there).
  await copyFile(exportPath, path.join(jobDir, path.basename(exportPath)));

  if (options.audioPath) {
    await copyFile(options.audioPath, path.join(jobDir, path.basename(options.audioPath)));
    log(`audio copied: ${path.basename(options.audioPath)}`);
  }

  await writeFile(path.join(jobDir, 'transcript.json'), JSON.stringify(result, null, 2), 'utf8');
  await writeFile(path.join(jobDir, 'transcript.txt'), formatTranscript(result), 'utf8');
  log(`done: ${result.utterances.length} utterances -> ${jobDir}`);

  return { jobId, jobDir, result };
}
