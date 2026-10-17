import { buildApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/database';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = await openDatabase(config.dataDir);
  const app = buildApp(config, db);
  await app.listen({ port: config.port, host: '127.0.0.1' });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
