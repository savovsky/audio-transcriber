# POC_M2 — Session Prompt (delete at session close, per AGENTS.md conventions)

> Temp file: stays in the working tree for the whole POC_M2 session; its deletion
> lands in the session's closing commit. The durable record is the milestone
> tracker in `docs/implementation-tasks/`.

```text
I'm working on the audio-transcriber project (local web app: multi-hour Bulgarian
audio -> speaker-separated, reviewed, exportable transcripts).

Read first, in this order:
1. C:\work\personal\projects\audio-transcriber\AGENTS.md  (non-negotiable session rules)
2. C:\work\personal\projects\audio-transcriber\README.md  (session state, document map)
3. docs/01-project-purpose.md, docs/02-tech-stack.md, docs/03-architecture.md
4. docs/04-poc-milestones.md (POC_M2 scope + the POC_M1 gate outcome)
5. docs/implementation-tasks/POC_M1.md (gate verdict + confirmed strategy)
⛔ Never read docs/app-requirements/author_notebook.md.
Local-only context: docs/elevenlabs-pricing-notes.md is gitignored (pricing research);
the real ElevenLabs web-export sample is data/jobs/1362_2025-2026-10-16T14-33-04/_1362_2025_bul.json
(segments: text/start_time/end_time/speaker{id,name}/words[]; audio events as bracketed text).

Subagents: .pi/agents/workhorse.md (flash, mechanical) + workhorse-heavy.md (pro,
state machines/DB/timestamp math) are configured for this repo — use them per
AGENTS.md rule 5 (fully-specified briefs, agentScope "both", parallel by default).

State: POC_M1 is DONE and pushed (branch POC_M1_chunking-deepgram, commits 1717812 +
6d0a912/7128f18 gate verdicts; 5bc4768 workhorse subagent setup; latest: e763a83
makeJobId platform fix).
Gate verdict: Deepgram NO-GO (garbled BG on covert audio), ElevenLabs Scribe GO (~95%).

CONFIRMED STRATEGY (author): build the app OFFLINE against ElevenLabs WEB-EXPORT
imports — no ElevenLabs API key until the end user approves the subscription.
The OpenRouter key IS already in .env, so LLM cleanup/summary is built and demoed live.
The API provider is a small bolt-on behind server/src/transcription/provider.ts later.

POC_M2 scope (from docs/04-poc-milestones.md, author-confirmed build order):
1. Branch POC_M2_import-sqlite-cleanup from main (merge/rebase POC_M1 first if needed).
2. server/src/transcription/elevenlabs-import.ts — parse the web-export JSON into the
   shared contract (TranscriptionResult/TranscriptUtterance); map speaker_N strings to
   indices; keep audio-event tags as inline […] text. CLI entry point
   (npm run import -w server -- <export.json> --audio <recording.mp3>) producing the
   same data/jobs/<jobId>/ structure as the transcribe CLI. Unit tests with a fixture.
3. shared/src — extend the data model FIRST (Session/TranscriptBlock/Speaker already
   stubbed there): dual verbatim/cleaned text, speaker roles, cleanup-style fields.
4. server/src/db/ — better-sqlite3 schema + repositories (sessions, speakers, blocks);
   data/app.db (gitignored). Add dep to the server workspace.
5. server/src/llm/openrouter.ts — plain HTTP client; cleanup with the 5 style presets
   (Bulgarian display names + prompt texts finalized here), per-block regenerate,
   speaker-role SUGGESTIONS (never auto-applied — proposals until the user confirms).
6. Wire a resumable pipeline: import -> transcribe-equivalent -> clean -> roles,
   progress per stage; headless test entry point (CLI or endpoint) that runs an
   imported transcript through cleanup end-to-end.

Environment: OPENROUTER_API_KEY is in .env (server loads via --env-file; never log it).
DEEPGRAM_API_KEY also present (fallback engine only). ELEVENLABS_API_KEY does NOT exist
yet — nothing may call the ElevenLabs API in POC_M2.
Real recordings live only in docs/test-examples/ — gitignored, never commit them or any
transcript output derived from them (all outputs under data/, also gitignored).

Closing procedure (AGENTS.md rules 1-5): full gates green ONCE (npm run gates) ->
present changes + manual test list -> my typed "approve" -> task commit -> hash commit
-> push. No git mutation without the typed approval.
```
