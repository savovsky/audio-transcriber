import Fastify from 'fastify';
import { loadConfig } from './config';
import { registerHealthRoutes } from './routes/health';

const config = loadConfig();
const app = Fastify({ logger: true });

registerHealthRoutes(app, config);

app.listen({ port: config.port, host: '127.0.0.1' }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
