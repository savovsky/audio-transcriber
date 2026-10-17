import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  type ApiErrorResponse,
  type BlockMergeResponse,
  type BlockRegenerateResponse,
  type BlockUpdateRequest,
  type BlockUpdateResponse,
  type CleanedRun,
  PER_BLOCK_CLEANUP_STYLE_IDS,
  type PerBlockCleanupStyleId,
} from 'shared';
import type { AppDatabase } from '../db/database';
import { BlocksRepo, SpeakersRepo } from '../db/repositories';
import type { LlmClient } from '../llm/openrouter';
import { generateBlockCandidate } from '../pipeline/process';

// Block routes: text edits on both layers (POC_M3) + speaker reassignment,
// regenerate (preview-then-apply), and merge-with-previous (POC_M4). LLM work
// goes through the pipeline (dependency rule); plain DB edits through the repos.

export interface BlockRoutesContext {
  db: AppDatabase;
  llm: LlmClient | null; // null → LLM routes answer 503 (no OpenRouter key)
}

function isPerBlockStyleId(value: unknown): value is PerBlockCleanupStyleId {
  return typeof value === 'string' && (PER_BLOCK_CLEANUP_STYLE_IDS as readonly string[]).includes(value);
}

// Validates the {style, model, temperature} triple shared by the regenerate and
// cleanedRun payloads. Returns an error message or null.
function validateRun(body: Partial<CleanedRun>): string | null {
  if (!isPerBlockStyleId(body.style)) {
    return `style must be one of: ${PER_BLOCK_CLEANUP_STYLE_IDS.join(', ')}`;
  }
  if (typeof body.model !== 'string' || body.model.trim() === '') return 'model must be a non-empty string';
  if (typeof body.temperature !== 'number' || !Number.isFinite(body.temperature)) {
    return 'temperature must be a finite number';
  }
  return null;
}

function llmUnavailable(reply: FastifyReply): ApiErrorResponse {
  void reply.code(503);
  return { error: 'OpenRouter API key is not configured' };
}

// Body validation for PATCH — extracted to keep the handler within the
// complexity budget. Returns an error message or null.
function validatePatchBody(body: BlockUpdateRequest): string | null {
  const { verbatimText, cleanedText, speakerId, cleanedRun } = body;
  if (verbatimText === undefined && cleanedText === undefined && speakerId === undefined) {
    return 'Nothing to update: pass verbatimText, cleanedText and/or speakerId';
  }
  if (verbatimText !== undefined && verbatimText.trim() === '') return 'verbatimText must not be empty';
  if (cleanedRun !== undefined) {
    if (cleanedText === undefined)
      return 'cleanedRun requires cleanedText (it is the provenance of that text)';
    return validateRun(cleanedRun);
  }
  return null;
}

export function registerBlockRoutes(app: FastifyInstance, ctx: BlockRoutesContext): void {
  const { db, llm } = ctx;
  const blocks = new BlocksRepo(db);
  const speakers = new SpeakersRepo(db);

  app.patch<{ Params: { id: string }; Body: BlockUpdateRequest }>(
    '/api/blocks/:id',
    (request, reply): BlockUpdateResponse | ApiErrorResponse => {
      const body = request.body ?? {};
      const { verbatimText, cleanedText, speakerId, cleanedRun } = body;
      const bodyError = validatePatchBody(body);
      if (bodyError) {
        void reply.code(400);
        return { error: bodyError };
      }

      const block = blocks.get(request.params.id);
      if (!block) {
        void reply.code(404);
        return { error: 'Block not found' };
      }
      if (speakerId !== undefined) {
        const speaker = speakers.get(speakerId);
        if (!speaker) {
          void reply.code(404);
          return { error: 'Speaker not found' };
        }
        if (speaker.sessionId !== block.sessionId) {
          void reply.code(400);
          return { error: 'Speaker belongs to a different session' };
        }
      }

      if (verbatimText !== undefined) blocks.updateText(block.id, { verbatimText });
      if (cleanedText !== undefined) {
        if (cleanedRun) {
          // Regenerate apply: the text came from this exact run → provenance is set.
          blocks.setCleaned(block.id, {
            cleanedText,
            cleanedModel: cleanedRun.model,
            cleanedStyle: cleanedRun.style,
            cleanedTemperature: cleanedRun.temperature,
          });
        } else {
          blocks.updateText(block.id, { cleanedText });
        }
      }
      if (speakerId !== undefined) blocks.setSpeaker(block.id, speakerId);

      const updated = blocks.get(block.id);
      return { block: updated! };
    },
  );

  // Preview-then-apply regenerate: returns the candidate, persists NOTHING.
  // The apply step is the PATCH above with cleanedText + cleanedRun.
  app.post<{ Params: { id: string }; Body: Partial<CleanedRun> }>(
    '/api/blocks/:id/regenerate',
    async (request, reply): Promise<BlockRegenerateResponse | ApiErrorResponse> => {
      if (!llm) return llmUnavailable(reply);
      const body = request.body ?? {};
      const runError = validateRun(body);
      if (runError) {
        void reply.code(400);
        return { error: runError };
      }
      const block = blocks.get(request.params.id);
      if (!block) {
        void reply.code(404);
        return { error: 'Block not found' };
      }
      const run: CleanedRun = { style: body.style!, model: body.model!, temperature: body.temperature! };
      const candidateText = await generateBlockCandidate({ llm, block, run });
      return { candidateText, run };
    },
  );

  // Merge with the previous block (by orderIndex): union time range, per-layer
  // concat, earlier block's speaker, provenance only on exact match.
  app.post<{ Params: { id: string } }>(
    '/api/blocks/:id/merge',
    (request, reply): BlockMergeResponse | ApiErrorResponse => {
      const result = blocks.mergeWithPrevious(request.params.id);
      if (!result) {
        if (!blocks.get(request.params.id)) {
          void reply.code(404);
          return { error: 'Block not found' };
        }
        void reply.code(400);
        return { error: 'First block — nothing to merge into' };
      }
      return { block: result.kept, removedBlockId: result.removedId };
    },
  );
}
