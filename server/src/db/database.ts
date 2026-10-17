import Database from 'better-sqlite3';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// Embedded single-file DB at <dataDir>/app.db (data/ is gitignored — recordings
// and transcripts never leave the machine). better-sqlite3 is synchronous by
// design: single user, local app — simplicity beats async ceremony here.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id               TEXT PRIMARY KEY,            -- === jobId (data/jobs/<id>/)
  title            TEXT NOT NULL,
  reference_number TEXT,
  audio_file_name  TEXT NOT NULL,
  duration_sec     REAL,
  status           TEXT NOT NULL,
  summary_text     TEXT,                        -- session-level 'summary' preset output
  key_facts_text   TEXT,                        -- session-level 'key-facts' preset output
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS speakers (
  id              TEXT PRIMARY KEY,             -- '<sessionId>/s<index>'
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  speaker_index   INTEGER NOT NULL,
  label           TEXT NOT NULL,                -- e.g. 'Speaker 0', user-renamable
  suggested_role  TEXT,                         -- LLM proposal only, never auto-applied
  role_reasoning  TEXT,
  confirmed_role  TEXT,                         -- the only role the UI treats as final
  UNIQUE (session_id, speaker_index)
);

CREATE TABLE IF NOT EXISTS blocks (
  id                  TEXT PRIMARY KEY,         -- '<sessionId>/b<orderIndex padded to 5>'
  session_id          TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  speaker_id          TEXT NOT NULL REFERENCES speakers(id) ON DELETE RESTRICT,
  order_index         INTEGER NOT NULL,
  start_sec           REAL NOT NULL,            -- absolute offset within the recording
  end_sec             REAL NOT NULL,
  verbatim_text       TEXT NOT NULL,            -- includes inline […] audio-event tags
  cleaned_text        TEXT,                     -- NULL = pending cleanup (resume marker)
  cleaned_model       TEXT,                     -- provenance: what produced cleaned_text
  cleaned_style       TEXT,
  cleaned_temperature REAL,
  UNIQUE (session_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_blocks_session ON blocks(session_id, order_index);
CREATE INDEX IF NOT EXISTS idx_speakers_session ON speakers(session_id);
`;

export type AppDatabase = Database.Database;

export async function openDatabase(dataDir: string): Promise<AppDatabase> {
  await mkdir(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'app.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
