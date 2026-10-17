import type { PerBlockCleanupStyleId, Session, SessionStatus, Speaker, TranscriptBlock } from 'shared';
import type { AppDatabase } from './database';

// Repositories — the only place SQL lives. Consumed by routes (session list)
// and the pipeline (persisting imported/cleaned state). Deterministic ids make
// re-runs idempotent: re-importing the same job upserts the same rows.

export function makeSpeakerId(sessionId: string, speakerIndex: number): string {
  return `${sessionId}/s${speakerIndex}`;
}

export function makeBlockId(sessionId: string, orderIndex: number): string {
  return `${sessionId}/b${String(orderIndex).padStart(5, '0')}`;
}

// --- row mapping (snake_case columns <-> shared camelCase types) ---

interface SessionRow {
  id: string;
  title: string;
  reference_number: string | null;
  audio_file_name: string;
  duration_sec: number | null;
  status: string;
  summary_text: string | null;
  key_facts_text: string | null;
  created_at: string;
}

interface SpeakerRow {
  id: string;
  session_id: string;
  speaker_index: number;
  label: string;
  suggested_role: string | null;
  role_reasoning: string | null;
  confirmed_role: string | null;
}

interface BlockRow {
  id: string;
  session_id: string;
  speaker_id: string;
  order_index: number;
  start_sec: number;
  end_sec: number;
  verbatim_text: string;
  cleaned_text: string | null;
  cleaned_model: string | null;
  cleaned_style: string | null;
  cleaned_temperature: number | null;
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    title: row.title,
    referenceNumber: row.reference_number,
    audioFileName: row.audio_file_name,
    durationSec: row.duration_sec,
    status: row.status as SessionStatus,
    summaryText: row.summary_text,
    keyFactsText: row.key_facts_text,
    createdAt: row.created_at,
  };
}

function toSpeaker(row: SpeakerRow): Speaker {
  return {
    id: row.id,
    sessionId: row.session_id,
    speakerIndex: row.speaker_index,
    label: row.label,
    suggestedRole: row.suggested_role,
    roleReasoning: row.role_reasoning,
    confirmedRole: row.confirmed_role,
  };
}

function toBlock(row: BlockRow): TranscriptBlock {
  return {
    id: row.id,
    sessionId: row.session_id,
    speakerId: row.speaker_id,
    orderIndex: row.order_index,
    startSec: row.start_sec,
    endSec: row.end_sec,
    verbatimText: row.verbatim_text,
    cleanedText: row.cleaned_text,
    cleanedModel: row.cleaned_model,
    cleanedStyle: row.cleaned_style as PerBlockCleanupStyleId | null,
    cleanedTemperature: row.cleaned_temperature,
  };
}

// --- sessions ---

export class SessionsRepo {
  private readonly db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  upsert(session: Session): void {
    this.db
      .prepare(
        `INSERT INTO sessions (id, title, reference_number, audio_file_name, duration_sec, status, summary_text, key_facts_text, created_at)
         VALUES (@id, @title, @referenceNumber, @audioFileName, @durationSec, @status, @summaryText, @keyFactsText, @createdAt)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           reference_number = excluded.reference_number,
           audio_file_name = excluded.audio_file_name,
           duration_sec = excluded.duration_sec,
           status = excluded.status`,
      )
      .run(session);
  }

  get(id: string): Session | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
    return row ? toSession(row) : null;
  }

  list(): Session[] {
    const rows = this.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all() as SessionRow[];
    return rows.map(toSession);
  }

  setStatus(id: string, status: SessionStatus): void {
    this.db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run(status, id);
  }

  setSummaryText(id: string, summaryText: string): void {
    this.db.prepare('UPDATE sessions SET summary_text = ? WHERE id = ?').run(summaryText, id);
  }

  setKeyFactsText(id: string, keyFactsText: string): void {
    this.db.prepare('UPDATE sessions SET key_facts_text = ? WHERE id = ?').run(keyFactsText, id);
  }
}

// --- speakers ---

export class SpeakersRepo {
  private readonly db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  upsertMany(speakers: Speaker[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO speakers (id, session_id, speaker_index, label, suggested_role, role_reasoning, confirmed_role)
       VALUES (@id, @sessionId, @speakerIndex, @label, @suggestedRole, @roleReasoning, @confirmedRole)
       ON CONFLICT(id) DO UPDATE SET
         speaker_index = excluded.speaker_index,
         label = excluded.label`,
    );
    const runAll = this.db.transaction((items: Speaker[]) => {
      for (const item of items) stmt.run(item);
    });
    runAll(speakers);
  }

  listBySession(sessionId: string): Speaker[] {
    const rows = this.db
      .prepare('SELECT * FROM speakers WHERE session_id = ? ORDER BY speaker_index')
      .all(sessionId) as SpeakerRow[];
    return rows.map(toSpeaker);
  }

  // Speakers whose role has not been suggested yet — the roles-stage resume set.
  listPendingRoleSuggestion(sessionId: string): Speaker[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM speakers WHERE session_id = ? AND suggested_role IS NULL ORDER BY speaker_index',
      )
      .all(sessionId) as SpeakerRow[];
    return rows.map(toSpeaker);
  }

  setRoleSuggestion(id: string, suggestion: { suggestedRole: string; roleReasoning: string }): void {
    this.db
      .prepare(
        'UPDATE speakers SET suggested_role = @suggestedRole, role_reasoning = @roleReasoning WHERE id = @id',
      )
      .run({ id, ...suggestion });
  }

  // User confirmation (POC_M4 UI) — the only write the app treats as final.
  confirmRole(id: string, confirmedRole: string): void {
    this.db.prepare('UPDATE speakers SET confirmed_role = ? WHERE id = ?').run(confirmedRole, id);
  }

  rename(id: string, label: string): void {
    this.db.prepare('UPDATE speakers SET label = ? WHERE id = ?').run(label, id);
  }
}

// --- blocks ---

export interface CleanedResult {
  cleanedText: string;
  cleanedModel: string;
  cleanedStyle: PerBlockCleanupStyleId;
  cleanedTemperature: number;
}

export class BlocksRepo {
  private readonly db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  insertMany(blocks: TranscriptBlock[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO blocks (id, session_id, speaker_id, order_index, start_sec, end_sec, verbatim_text,
                           cleaned_text, cleaned_model, cleaned_style, cleaned_temperature)
       VALUES (@id, @sessionId, @speakerId, @orderIndex, @startSec, @endSec, @verbatimText,
               @cleanedText, @cleanedModel, @cleanedStyle, @cleanedTemperature)
       ON CONFLICT(id) DO UPDATE SET
         speaker_id = excluded.speaker_id,
         order_index = excluded.order_index,
         start_sec = excluded.start_sec,
         end_sec = excluded.end_sec,
         verbatim_text = excluded.verbatim_text`,
      // cleaned_* deliberately NOT updated on conflict — re-importing must not
      // wipe already-cleaned text (resumability rule).
    );
    const runAll = this.db.transaction((items: TranscriptBlock[]) => {
      for (const item of items) stmt.run(item);
    });
    runAll(blocks);
  }

  listBySession(sessionId: string): TranscriptBlock[] {
    const rows = this.db
      .prepare('SELECT * FROM blocks WHERE session_id = ? ORDER BY order_index')
      .all(sessionId) as BlockRow[];
    return rows.map(toBlock);
  }

  // Blocks with cleaned_text IS NULL — the cleanup-stage resume set.
  listPendingCleanup(sessionId: string): TranscriptBlock[] {
    const rows = this.db
      .prepare('SELECT * FROM blocks WHERE session_id = ? AND cleaned_text IS NULL ORDER BY order_index')
      .all(sessionId) as BlockRow[];
    return rows.map(toBlock);
  }

  get(id: string): TranscriptBlock | null {
    const row = this.db.prepare('SELECT * FROM blocks WHERE id = ?').get(id) as BlockRow | undefined;
    return row ? toBlock(row) : null;
  }

  setCleaned(id: string, result: CleanedResult): void {
    this.db
      .prepare(
        `UPDATE blocks SET cleaned_text = @cleanedText, cleaned_model = @cleanedModel,
         cleaned_style = @cleanedStyle, cleaned_temperature = @cleanedTemperature WHERE id = @id`,
      )
      .run({ id, ...result });
  }

  updateVerbatimText(id: string, verbatimText: string): void {
    this.db.prepare('UPDATE blocks SET verbatim_text = ? WHERE id = ?').run(verbatimText, id);
  }

  // User text edits from the UI (POC_M3): updates whichever layers are provided.
  // The cleaned_* provenance columns are deliberately untouched — they describe
  // the LLM run that produced the base text (see shared BlockUpdateRequest).
  updateText(id: string, fields: { verbatimText?: string; cleanedText?: string }): void {
    if (fields.verbatimText !== undefined) {
      this.db.prepare('UPDATE blocks SET verbatim_text = ? WHERE id = ?').run(fields.verbatimText, id);
    }
    if (fields.cleanedText !== undefined) {
      this.db.prepare('UPDATE blocks SET cleaned_text = ? WHERE id = ?').run(fields.cleanedText, id);
    }
  }

  setSpeaker(id: string, speakerId: string): void {
    this.db.prepare('UPDATE blocks SET speaker_id = ? WHERE id = ?').run(speakerId, id);
  }
}
