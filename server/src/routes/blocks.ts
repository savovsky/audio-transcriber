import type { FastifyInstance } from 'fastify';
import type { ApiErrorResponse, BlockUpdateRequest, BlockUpdateResponse } from 'shared';
import type { AppDatabase } from '../db/database';
import { BlocksRepo } from '../db/repositories';

// Block routes: user text edits on the two text layers (POC_M3). Speaker
// reassignment and merge arrive with POC_M4.

export function registerBlockRoutes(app: FastifyInstance, db: AppDatabase): void {
  const blocks = new BlocksRepo(db);

  app.patch<{ Params: { id: string }; Body: BlockUpdateRequest }>(
    '/api/blocks/:id',
    (request, reply): BlockUpdateResponse | ApiErrorResponse => {
      const body = request.body ?? {};
      const { verbatimText, cleanedText } = body;
      if (verbatimText === undefined && cleanedText === undefined) {
        void reply.code(400);
        return { error: 'Nothing to update: pass verbatimText and/or cleanedText' };
      }
      if (verbatimText !== undefined && verbatimText.trim() === '') {
        void reply.code(400);
        return { error: 'verbatimText must not be empty' };
      }
      if (!blocks.get(request.params.id)) {
        void reply.code(404);
        return { error: 'Block not found' };
      }
      blocks.updateText(request.params.id, { verbatimText, cleanedText });
      const block = blocks.get(request.params.id);
      return { block: block! };
    },
  );
}
