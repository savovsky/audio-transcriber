import { stat } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../config';
import { runElevenLabsImport } from '../transcription/elevenlabs-import';

// POC_M2 import entry point (offline strategy — no ElevenLabs API key needed):
//   npm run import -w server -- <export.json> [--audio <recording.mp3>] [--job <jobId>]
// Parses an ElevenLabs WEB-EXPORT JSON into the shared transcription contract and
// produces the same data/jobs/<jobId>/ structure as the chunk/transcribe pipeline
// (transcript.json + transcript.txt + raw export + audio copy).

function parseArgs(argv: string[]): { exportPath: string; audioPath?: string; jobId?: string } {
  const [input, ...rest] = argv;
  if (!input || input.startsWith('--')) {
    throw new Error(
      'Usage: npm run import -w server -- <export.json> [--audio <recording.mp3>] [--job <jobId>]',
    );
  }
  let audioPath: string | undefined;
  let jobId: string | undefined;
  for (let i = 0; i < rest.length; i += 2) {
    const value = rest[i + 1];
    if (rest[i] === '--audio') audioPath = value;
    else if (rest[i] === '--job') jobId = value;
    else throw new Error(`Unknown argument: ${rest[i]}`);
  }
  return { exportPath: path.resolve(input), audioPath: audioPath && path.resolve(audioPath), jobId };
}

async function main(): Promise<void> {
  const { exportPath, audioPath, jobId } = parseArgs(process.argv.slice(2));
  await stat(exportPath); // fail fast on a bad path
  if (audioPath) await stat(audioPath);

  const config = loadConfig();
  const { jobDir, result } = await runElevenLabsImport(exportPath, {
    dataDir: config.dataDir,
    jobId,
    audioPath,
    onProgress: (message) => console.info(`[import] ${message}`),
  });

  const speakers = new Set(result.utterances.map((u) => u.speakerIndex));
  console.info(`[import] ${result.utterances.length} utterances, ${speakers.size} speaker(s) -> ${jobDir}`);
}

main().catch((error: unknown) => {
  console.error('[import] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1; // let open handles drain (see cli/process.ts)
});
