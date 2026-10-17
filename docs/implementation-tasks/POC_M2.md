# POC_M2 — ElevenLabs web-export import + SQLite + OpenRouter cleanup + roles

Branch: `POC_M2_import-sqlite-cleanup`. Scope: headless milestone — no UI work
(the LLM knobs are modeled as shared constants so POC_M3 renders them as dropdowns).

## Task state

| # | Task | State |
| --- | --- | --- |
| 1 | Branch from main (POC_M1 merged first) | ✅ done |
| 2 | Deepgram removal (gate-rejected engine: code, dep, env key, CLI) | ✅ done |
| 3 | Shared data model FIRST: dual text provenance, session artifacts, temperature options, style display names | ✅ done |
| 4 | `server/src/transcription/elevenlabs-import.ts` + import CLI + unit tests | ✅ done |
| 5 | `server/src/db/` — better-sqlite3 schema + repositories (sessions/speakers/blocks) | ✅ done |
| 6 | `server/src/llm/` — OpenRouter client, 5 presets (BG prompts), batched cleanup, role suggestions | ✅ done |
| 7 | Resumable pipeline `runProcessing` (import → persist → clean → roles) + process CLI | ✅ done |

Closing commit: `a10827e`; live end-to-end run verified by the author (69/69 blocks
cleaned, 3 role suggestions: Съдия + 2× Адвокат — proposals only, resume verified).

## Design decisions (author-confirmed, discussion rounds 1–2)

- **Offline strategy:** ElevenLabs web-export JSON is the only transcription input;
  the API provider bolts on behind `transcription/provider.ts` after subscription approval.
- **Deepgram fully removed** (author decision): files, `@deepgram/sdk`, env key, transcribe CLI.
  Kept: provider interface, chunker, transcribe orchestration (provider-agnostic, for the
  future ElevenLabs API provider). Gate verdict record stays in docs.
- **Import adapter is NOT a `TranscriptionProvider`** (JSON in, absolute timestamps out) —
  sibling module in `transcription/`, produces the shared `TranscriptionResult` contract.
- **Resume state = DB rows** (no second cache): `blocks.cleaned_text IS NULL` and
  `speakers.suggested_role IS NULL` are the resume sets. Re-import upserts verbatim but
  never wipes cleaned text.
- **Batched cleanup** (~15 blocks / ~3000 chars per call, `<<<BLOCK N>>>` marker protocol),
  persisted per block; per-block regenerate = single-block batch.
- **5 presets:** 3 per-block (`clean-verbatim` «Дословен (изчистен)», `light-clean`
  «Леко редактиран», `formal-style` «Официален стил») + 2 session-level
  (`summary` «Резюме» → `sessions.summary_text`, `key-facts` «Ключови факти» →
  `sessions.key_facts_text`). Prompts in Bulgarian, server-only.
- **LLM knobs as dropdown data** (author requirement): `LLM_MODEL_IDS`,
  `CLEANUP_STYLE_IDS` + display names, `LLM_TEMPERATURE_OPTIONS` [0.0, 0.2, 0.3, 0.4, 0.7, 1.0]
  in `shared/`; defaults 0.2 cleanup / 0.3 roles; provenance columns per block
  (`cleaned_model/style/temperature`) so regenerated results are comparable.
- **Role vocabulary:** legal-domain defaults (Съдия, Прокурор, Адвокат, Ищец, Ответник,
  Свидетел, Вещо лице, Секретар) in `server/src/llm/role-vocabulary.ts` (editable);
  suggestions are proposals only — `confirmed_role` stays NULL until the user decides.
- **Deterministic ids:** session = jobId; `'<sessionId>/s<index>'`, `'<sessionId>/b<orderIndex×5>'`.

## Validation

- Unit/integration tests: 60 passing (shared constants; import parse + job-dir output;
  DB repositories incl. resume sets + re-import preservation; cleanup batching/marker
  protocol + presets; role sample/parse; end-to-end pipeline with fake LLM incl.
  resume-after-crash and session-level styles).
- Real-file smoke: imported the real ElevenLabs web-export (69 segments, 3 speakers,
  `[…]` audio-event tags inline) → `data/jobs/_1362_2025_bul-…/` with `transcript.json`
  + `transcript.txt` in the POC_M1 shape (outputs gitignored).
- Live OpenRouter end-to-end run: author's manual test (real API, real recording).

## Live-run fixes (author's manual test)

- **Model catalog drift:** first live run returned OpenRouter HTTP 404 —
  `gemini-2.0-flash-001` and `claude-3.5-haiku` are retired. `LLM_MODEL_IDS` updated
  against the live catalog (GET /api/v1/models): `google/gemini-2.5-flash` (default),
  `openai/gpt-4o-mini`, `anthropic/claude-haiku-4.5`.
- **Windows libuv crash on CLI failure** (`UV_HANDLE_CLOSING` assertion): fixed by
  clearing the fetch timeout via a manual `AbortController` and exiting the CLIs with
  `process.exitCode = 1` instead of `process.exit(1)`.
- Failed runs now mark the session `failed` even for fresh imports (jobId tracked).

## Notes

- `better-sqlite3` is synchronous by design (single user, local app); WAL mode,
  foreign keys ON, schema via `CREATE TABLE IF NOT EXISTS` on open.
- OpenRouter client: plain fetch, 60s timeout, 2 retries (500ms/1500ms backoff) on
  429/5xx/timeouts; the key never appears in logs or error messages.
- `docs/03-architecture.md` dependency rule extended: `routes → pipeline → (transcription | llm | export | db)`.
