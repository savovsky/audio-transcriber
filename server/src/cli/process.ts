import { stat } from 'node:fs/promises';
import path from 'node:path';
import { CLEANUP_STYLE_IDS, type CleanupStyleId, LLM_MODEL_IDS, LLM_TEMPERATURE_OPTIONS } from 'shared';
import { loadConfig } from '../config';
import { OpenRouterClient } from '../llm/openrouter';
import { runProcessing } from '../pipeline/process';

// POC_M2 headless end-to-end entry point:
//   npm run process -w server -- <export.json> [--audio <recording.mp3>]
//        [--session <jobId>] [--style <id>] [--model <id>] [--temperature <n>]
// Runs the resumable pipeline: import → persist (SQLite) → clean → suggest roles.
// Re-run with the same --session id to resume (pending = cleaned_text/suggested_role IS NULL).
// --style/--model/--temperature mirror the future UI dropdowns (shared/ constants).

interface CliArgs {
  exportPath?: string;
  audioPath?: string;
  sessionId?: string;
  style: CleanupStyleId;
  model: string;
  temperature?: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { style: 'clean-verbatim', model: LLM_MODEL_IDS[0] };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const value = argv[++i];
    switch (arg) {
      case '--audio':
        args.audioPath = path.resolve(value);
        break;
      case '--session':
        args.sessionId = value;
        break;
      case '--style':
        if (!(CLEANUP_STYLE_IDS as readonly string[]).includes(value)) {
          throw new Error(`Unknown --style "${value}". Options: ${CLEANUP_STYLE_IDS.join(', ')}`);
        }
        args.style = value as CleanupStyleId;
        break;
      case '--model':
        if (!(LLM_MODEL_IDS as readonly string[]).includes(value)) {
          throw new Error(`Unknown --model "${value}". Options: ${LLM_MODEL_IDS.join(', ')}`);
        }
        args.model = value;
        break;
      case '--temperature': {
        const parsed = Number(value);
        if (!LLM_TEMPERATURE_OPTIONS.includes(parsed)) {
          throw new Error(`Unknown --temperature "${value}". Options: ${LLM_TEMPERATURE_OPTIONS.join(', ')}`);
        }
        args.temperature = parsed;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (positional.length > 0) args.exportPath = path.resolve(positional[0]);
  if (!args.exportPath && !args.sessionId) {
    throw new Error(
      'Usage: npm run process -w server -- <export.json> [--audio <recording.mp3>] ' +
        '[--session <jobId>] [--style <id>] [--model <id>] [--temperature <n>]',
    );
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.exportPath) await stat(args.exportPath); // fail fast on a bad path
  if (args.audioPath) await stat(args.audioPath);

  const config = loadConfig();
  if (!config.openrouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured (check .env and the --env-file flag).');
  }
  const llm = new OpenRouterClient(config.openrouterApiKey);

  const result = await runProcessing({
    dataDir: config.dataDir,
    llm,
    exportPath: args.exportPath,
    audioPath: args.audioPath,
    sessionId: args.sessionId,
    style: args.style,
    model: args.model,
    temperature: args.temperature,
    onProgress: (message) => console.info(`[process] ${message}`),
  });

  console.info(
    `[process] session ${result.sessionId}: ${result.blocksTotal} block(s), ` +
      `${result.blocksCleaned} cleaned this run, ${result.rolesPending} role suggestion(s)`,
  );
}

main().catch((error: unknown) => {
  console.error('[process] FAILED:', error instanceof Error ? error.message : error);
  // exitCode (not process.exit): let open handles drain — a hard exit raced libuv
  // handle teardown on Windows and crashed the process instead of failing cleanly.
  process.exitCode = 1;
});
