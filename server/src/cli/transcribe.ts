import { stat } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../config';
import { runTranscription } from '../pipeline/transcribe';
import { createTranscriptionProvider } from '../transcription';

// POC_M1 test entry point (headless milestone — no UI yet):
//   npm run transcribe -w server -- <recording.mp3> [--job <jobId>] [--chunk-minutes <n>]
// Runs chunk -> transcribe with per-chunk caching and dumps transcript.json /
// transcript.txt under data/jobs/<jobId>/ (gitignored). Re-run with the same
// --job id to resume from the failed chunk.

function parseArgs(argv: string[]): { inputPath: string; jobId?: string; chunkMinutes?: number } {
  const [input, ...rest] = argv;
  if (!input || input.startsWith('--')) {
    throw new Error(
      'Usage: npm run transcribe -w server -- <recording.mp3> [--job <jobId>] [--chunk-minutes <n>]',
    );
  }
  let jobId: string | undefined;
  let chunkMinutes: number | undefined;
  for (let i = 0; i < rest.length; i += 2) {
    const value = rest[i + 1];
    if (rest[i] === '--job') jobId = value;
    else if (rest[i] === '--chunk-minutes') chunkMinutes = Number(value);
    else throw new Error(`Unknown argument: ${rest[i]}`);
  }
  return { inputPath: path.resolve(input), jobId, chunkMinutes };
}

async function main(): Promise<void> {
  const { inputPath, jobId, chunkMinutes } = parseArgs(process.argv.slice(2));
  await stat(inputPath); // fail fast on a bad path

  const config = loadConfig();
  const provider = createTranscriptionProvider(config);

  const result = await runTranscription(inputPath, {
    dataDir: config.dataDir,
    provider,
    jobId,
    chunkLengthSec: chunkMinutes !== undefined ? chunkMinutes * 60 : undefined,
    onProgress: (message) => console.info(`[transcribe] ${message}`),
  });

  const speakers = new Set(result.utterances.map((u) => u.speakerIndex));
  console.info(`[transcribe] ${result.utterances.length} utterances, ${speakers.size} speaker(s)`);
}

main().catch((error: unknown) => {
  console.error('[transcribe] FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
