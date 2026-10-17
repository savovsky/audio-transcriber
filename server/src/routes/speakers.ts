import type { FastifyInstance } from 'fastify';
import type { ApiErrorResponse, SpeakerUpdateRequest, SpeakerUpdateResponse } from 'shared';
import type { AppDatabase } from '../db/database';
import { SpeakersRepo } from '../db/repositories';

// Speaker routes (POC_M4): rename and role confirmation. Both are EXPLICIT user
// actions — suggested_role stays a proposal; confirmed_role is written only here.

export function registerSpeakerRoutes(app: FastifyInstance, db: AppDatabase): void {
  const speakers = new SpeakersRepo(db);

  app.patch<{ Params: { id: string }; Body: SpeakerUpdateRequest }>(
    '/api/speakers/:id',
    (request, reply): SpeakerUpdateResponse | ApiErrorResponse => {
      const body = request.body ?? {};
      const { label, confirmedRole } = body;
      if (label === undefined && confirmedRole === undefined) {
        void reply.code(400);
        return { error: 'Nothing to update: pass label and/or confirmedRole' };
      }
      if (label !== undefined && label.trim() === '') {
        void reply.code(400);
        return { error: 'label must not be empty' };
      }
      if (confirmedRole !== undefined && confirmedRole.trim() === '') {
        void reply.code(400);
        return { error: 'confirmedRole must not be empty' };
      }
      if (!speakers.get(request.params.id)) {
        void reply.code(404);
        return { error: 'Speaker not found' };
      }
      if (label !== undefined) speakers.rename(request.params.id, label.trim());
      if (confirmedRole !== undefined) speakers.confirmRole(request.params.id, confirmedRole.trim());
      const speaker = speakers.get(request.params.id);
      return { speaker: speaker! };
    },
  );
}
