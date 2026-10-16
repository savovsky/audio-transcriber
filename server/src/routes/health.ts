import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from 'shared';
import type { AppConfig } from '../config';

export function registerHealthRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/health', (): HealthResponse => {
    return {
      status: 'ok',
      service: 'audio-transcriber-server',
      keysConfigured: {
        deepgram: config.deepgramApiKey !== null,
        openrouter: config.openrouterApiKey !== null,
      },
      timestamp: new Date().toISOString(),
    };
  });
}
