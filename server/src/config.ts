import path from 'node:path';

export interface AppConfig {
  port: number;
  deepgramApiKey: string | null;
  openrouterApiKey: string | null;
  dataDir: string;
}

const DEFAULT_PORT = 3001;
// server/src/config.ts -> repo root is two levels up; data/ lives there (gitignored).
const DEFAULT_DATA_DIR = path.resolve(import.meta.dirname, '..', '..', 'data');

// Secrets arrive via Node's --env-file flag (see package.json scripts) and never
// leave the server process — the client only learns WHETHER a key is configured
// (via the health endpoint), never its value.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? DEFAULT_PORT),
    deepgramApiKey: env.DEEPGRAM_API_KEY ?? null,
    openrouterApiKey: env.OPENROUTER_API_KEY ?? null,
    dataDir: env.DATA_DIR ?? DEFAULT_DATA_DIR,
  };
}
