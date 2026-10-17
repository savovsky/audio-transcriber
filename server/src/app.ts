import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config';
import type { AppDatabase } from './db/database';
import type { LlmClient } from './llm/openrouter';
import { registerBlockRoutes } from './routes/blocks';
import { registerHealthRoutes } from './routes/health';
import { registerSessionRoutes } from './routes/sessions';
import { registerSpeakerRoutes } from './routes/speakers';

// Dependencies beyond config — bundled so buildApp stays within max-params.
export interface AppDeps {
  db: AppDatabase;
  llm?: LlmClient | null; // null/absent → LLM routes answer 503 (no OpenRouter key)
}

// App assembly, separate from the entry point (index.ts) so tests can build an
// instance against a temp data dir and drive it with fastify.inject.
export function buildApp(config: AppConfig, deps: AppDeps): FastifyInstance {
  const { db, llm = null } = deps;
  const app = Fastify({ logger: true });
  registerHealthRoutes(app, config);
  registerSessionRoutes(app, { db, dataDir: config.dataDir, llm });
  registerBlockRoutes(app, { db, llm });
  registerSpeakerRoutes(app, db);
  return app;
}
