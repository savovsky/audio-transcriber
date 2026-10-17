import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config';
import type { AppDatabase } from './db/database';
import { registerBlockRoutes } from './routes/blocks';
import { registerHealthRoutes } from './routes/health';
import { registerSessionRoutes } from './routes/sessions';

// App assembly, separate from the entry point (index.ts) so tests can build an
// instance against a temp data dir and drive it with fastify.inject.
export function buildApp(config: AppConfig, db: AppDatabase): FastifyInstance {
  const app = Fastify({ logger: true });
  registerHealthRoutes(app, config);
  registerSessionRoutes(app, { db, dataDir: config.dataDir });
  registerBlockRoutes(app, db);
  return app;
}
