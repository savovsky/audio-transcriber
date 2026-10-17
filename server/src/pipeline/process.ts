import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  type CleanupStyleId,
  DEFAULT_CLEANUP_TEMPERATURE,
  DEFAULT_ROLES_TEMPERATURE,
  type PerBlockCleanupStyleId,
  type Session,
  type Speaker,
  type TranscriptBlock,
  type TranscriptionResult,
} from 'shared';
import { type AppDatabase, openDatabase } from '../db/database';
import { BlocksRepo, SessionsRepo, SpeakersRepo, makeBlockId, makeSpeakerId } from '../db/repositories';
import { cleanBlocks, cleanSingleBlock } from '../llm/cleanup';
import { getPreset, isPerBlockStyle } from '../llm/cleanup-presets';
import type { LlmClient } from '../llm/openrouter';
import { suggestSpeakerRole } from '../llm/roles';
import { runElevenLabsImport } from '../transcription/elevenlabs-import';

// Resumable end-to-end pipeline (POC_M2 headless milestone):
//   import → persist (SQLite) → clean → suggest roles
// Resume semantics: the DB rows ARE the resume state —
//   blocks.cleaned_text IS NULL  → pending cleanup
//   speakers.suggested_role IS NULL → pending role suggestion
// A failed run is re-run with the same --session id and picks up where it stopped.

export interface ProcessOptions {
  dataDir: string;
  llm: LlmClient;
  exportPath?: string; // ElevenLabs web-export JSON; required unless resuming
  audioPath?: string; // copied into the job dir on (re)import
  sessionId?: string; // resume/re-run this session (=== jobId)
  style: CleanupStyleId;
  model: string;
  temperature?: number; // one of LLM_TEMPERATURE_OPTIONS; defaults per stage
  onProgress?: (message: string) => void;
}

export interface ProcessResult {
  sessionId: string;
  blocksTotal: number;
  blocksCleaned: number;
  rolesPending: number;
}

const MAX_SESSION_INPUT_CHARS = 50_000; // session-level styles (summary/key-facts)

async function loadOrImportTranscript(
  options: ProcessOptions,
): Promise<{ jobId: string; result: TranscriptionResult }> {
  const log = options.onProgress ?? (() => {});
  if (options.sessionId) {
    const jobDir = path.join(options.dataDir, 'jobs', options.sessionId);
    try {
      const raw = await readFile(path.join(jobDir, 'transcript.json'), 'utf8');
      log(`import: reusing existing transcript.json (session ${options.sessionId})`);
      return { jobId: options.sessionId, result: JSON.parse(raw) as TranscriptionResult };
    } catch {
      // No transcript on disk — fall through to a fresh import (needs exportPath).
    }
  }
  if (!options.exportPath) {
    throw new Error(
      'No transcript found for this session — pass the ElevenLabs web-export JSON to import it.',
    );
  }
  const job = await runElevenLabsImport(options.exportPath, {
    dataDir: options.dataDir,
    jobId: options.sessionId,
    audioPath: options.audioPath,
    onProgress: options.onProgress,
  });
  return { jobId: job.jobId, result: job.result };
}

interface PipelineContext {
  db: AppDatabase;
  options: ProcessOptions;
}

function toRows(
  sessionId: string,
  input: { result: TranscriptionResult; audioFileName: string },
): {
  session: Session;
  speakers: Speaker[];
  blocks: TranscriptBlock[];
} {
  const { result, audioFileName } = input;
  const indices = [...new Set(result.utterances.map((u) => u.speakerIndex))].sort((a, b) => a - b);
  const durationSec = result.utterances.reduce((max, u) => Math.max(max, u.endSec), 0);
  const session: Session = {
    id: sessionId,
    title: sessionId,
    referenceNumber: null,
    audioFileName,
    durationSec,
    status: 'importing',
    summaryText: null,
    keyFactsText: null,
    createdAt: new Date().toISOString(),
  };
  const speakers: Speaker[] = indices.map((speakerIndex) => ({
    id: makeSpeakerId(sessionId, speakerIndex),
    sessionId,
    speakerIndex,
    label: `Speaker ${speakerIndex}`,
    suggestedRole: null,
    roleReasoning: null,
    confirmedRole: null,
  }));
  const blocks: TranscriptBlock[] = result.utterances.map((u, orderIndex) => ({
    id: makeBlockId(sessionId, orderIndex),
    sessionId,
    speakerId: makeSpeakerId(sessionId, u.speakerIndex),
    orderIndex,
    startSec: u.startSec,
    endSec: u.endSec,
    verbatimText: u.text,
    cleanedText: null,
    cleanedModel: null,
    cleanedStyle: null,
    cleanedTemperature: null,
  }));
  return { session, speakers, blocks };
}

function buildSessionTranscript(speakers: Speaker[], blocks: TranscriptBlock[]): string {
  const labelById = new Map(speakers.map((s) => [s.id, s.label]));
  let text = '';
  for (const block of blocks) {
    const line = `[${labelById.get(block.speakerId) ?? '?'}]: ${block.cleanedText ?? block.verbatimText}\n\n`;
    if (text.length + line.length > MAX_SESSION_INPUT_CHARS) {
      text += '[... отрязано поради ограничение на дължината ...]';
      break;
    }
    text += line;
  }
  return text;
}

async function runSessionLevelStyle(ctx: PipelineContext, sessionId: string): Promise<void> {
  const { db, options } = ctx;
  const log = options.onProgress ?? (() => {});
  const sessions = new SessionsRepo(db);
  const speakers = new SpeakersRepo(db).listBySession(sessionId);
  const blocks = new BlocksRepo(db).listBySession(sessionId);
  const preset = getPreset(options.style); // 'summary' | 'key-facts'
  log(`cleanup: session-level style "${preset.displayName}" over ${blocks.length} block(s)`);

  const output = await options.llm.chat({
    model: options.model,
    temperature: options.temperature ?? DEFAULT_CLEANUP_TEMPERATURE,
    messages: [
      { role: 'system', content: preset.systemPrompt },
      { role: 'user', content: buildSessionTranscript(speakers, blocks) },
    ],
  });
  if (options.style === 'summary') sessions.setSummaryText(sessionId, output);
  else sessions.setKeyFactsText(sessionId, output);
  log(`cleanup: ${preset.displayName} stored on the session`);
}

async function runPerBlockCleanup(ctx: PipelineContext, sessionId: string): Promise<number> {
  const { db, options } = ctx;
  const log = options.onProgress ?? (() => {});
  const blocksRepo = new BlocksRepo(db);
  const pending = blocksRepo.listPendingCleanup(sessionId);
  if (pending.length === 0) {
    log('cleanup: nothing pending (all blocks already cleaned)');
    return 0;
  }
  log(`cleanup: ${pending.length} pending block(s), style "${getPreset(options.style).displayName}"`);
  const style = options.style as PerBlockCleanupStyleId; // caller checked isPerBlockStyle
  const cleaned = await cleanBlocks(options.llm, {
    blocks: pending,
    style,
    model: options.model,
    temperature: options.temperature ?? DEFAULT_CLEANUP_TEMPERATURE,
    onProgress: options.onProgress,
  });
  for (const item of cleaned) {
    blocksRepo.setCleaned(item.blockId, {
      cleanedText: item.cleanedText,
      cleanedModel: options.model,
      cleanedStyle: style,
      cleanedTemperature: options.temperature ?? DEFAULT_CLEANUP_TEMPERATURE,
    });
  }
  return cleaned.length;
}

async function runRoleSuggestions(ctx: PipelineContext, sessionId: string): Promise<number> {
  const { db, options } = ctx;
  const log = options.onProgress ?? (() => {});
  const speakersRepo = new SpeakersRepo(db);
  const blocks = new BlocksRepo(db).listBySession(sessionId);
  const pending = speakersRepo.listPendingRoleSuggestion(sessionId);
  for (const [i, speaker] of pending.entries()) {
    log(`roles: suggesting for ${speaker.label} (${i + 1}/${pending.length})`);
    const suggestion = await suggestSpeakerRole(options.llm, {
      speaker,
      blocks,
      model: options.model,
      temperature: options.temperature ?? DEFAULT_ROLES_TEMPERATURE,
    });
    // Proposals only — confirmed_role stays NULL until the user decides.
    speakersRepo.setRoleSuggestion(speaker.id, suggestion);
    log(`roles: ${speaker.label} → ${suggestion.suggestedRole} (proposal, not applied)`);
  }
  return pending.length;
}

export async function runProcessing(options: ProcessOptions): Promise<ProcessResult> {
  const log = options.onProgress ?? (() => {});
  const db = await openDatabase(options.dataDir);
  const sessions = new SessionsRepo(db);
  const speakers = new SpeakersRepo(db);
  const blocks = new BlocksRepo(db);

  let jobId: string | undefined;
  try {
    // Stage 1 — import (or reuse the job-dir transcript when resuming).
    const loaded = await loadOrImportTranscript(options);
    jobId = loaded.jobId;
    const { result } = loaded;

    // Stage 2 — persist (idempotent upserts; never wipes cleaned text).
    sessions.setStatus(jobId, 'importing');
    const audioFileName =
      options.audioPath !== undefined
        ? path.basename(options.audioPath)
        : (sessions.get(jobId)?.audioFileName ?? '');
    const rows = toRows(jobId, { result, audioFileName });
    sessions.upsert(rows.session);
    speakers.upsertMany(rows.speakers);
    blocks.insertMany(rows.blocks);
    log(`persist: ${rows.blocks.length} block(s), ${rows.speakers.length} speaker(s)`);

    // Stage 3 — cleanup (per-block styles) or session-level artifact (summary/key-facts).
    sessions.setStatus(jobId, 'cleaning');
    const ctx: PipelineContext = { db, options };
    let blocksCleaned = 0;
    if (isPerBlockStyle(options.style)) {
      blocksCleaned = await runPerBlockCleanup(ctx, jobId);
    } else {
      await runSessionLevelStyle(ctx, jobId);
    }

    // Stage 4 — role suggestions (proposals only).
    sessions.setStatus(jobId, 'roles');
    const rolesPending = await runRoleSuggestions(ctx, jobId);

    sessions.setStatus(jobId, 'ready');
    const total = blocks.listBySession(jobId).length;
    log(`done: session ${jobId} ready`);
    return { sessionId: jobId, blocksTotal: total, blocksCleaned, rolesPending };
  } catch (error) {
    // Mark the session failed even for fresh imports (jobId is known by then).
    if (jobId !== undefined) sessions.setStatus(jobId, 'failed');
    throw error;
  } finally {
    db.close();
  }
}

// Per-block "↻ regenerate" entry point (used by the future UI action).
export interface RegenerateBlockInput {
  db: AppDatabase;
  llm: LlmClient;
  block: TranscriptBlock;
  run: { style: PerBlockCleanupStyleId; model: string; temperature: number };
}

export async function regenerateBlock(input: RegenerateBlockInput): Promise<void> {
  const { db, llm, block, run } = input;
  const result = await cleanSingleBlock(llm, { block, ...run });
  if (!result)
    throw new Error(`Regenerate failed: block ${block.orderIndex} missing from the model response.`);
  new BlocksRepo(db).setCleaned(block.id, {
    cleanedText: result.cleanedText,
    cleanedModel: run.model,
    cleanedStyle: run.style,
    cleanedTemperature: run.temperature,
  });
}
