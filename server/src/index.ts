import { buildApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/database';
import { OpenRouterClient } from './llm/openrouter';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = await openDatabase(config.dataDir);
  const llm = config.openrouterApiKey ? new OpenRouterClient(config.openrouterApiKey) : null;
  const app = buildApp(config, { db, llm });
  await app.listen({ port: config.port, host: '127.0.0.1' });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
