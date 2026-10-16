export interface AppConfig {
  port: number;
  deepgramApiKey: string | null;
  openrouterApiKey: string | null;
}

const DEFAULT_PORT = 3001;

// Secrets arrive via Node's --env-file flag (see package.json scripts) and never
// leave the server process — the client only learns WHETHER a key is configured
// (via the health endpoint), never its value.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? DEFAULT_PORT),
    deepgramApiKey: env.DEEPGRAM_API_KEY ?? null,
    openrouterApiKey: env.OPENROUTER_API_KEY ?? null,
  };
}
