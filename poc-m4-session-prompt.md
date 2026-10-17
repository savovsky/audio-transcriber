# POC_M4 — Session Prompt (delete at session close, per AGENTS.md conventions)

> Temp file: stays in the working tree for the whole POC_M4 session; its deletion
> lands in the session's closing commit. The durable record is the milestone
> tracker in `docs/implementation-tasks/`.

```text
I'm working on the audio-transcriber project (local web app: multi-hour Bulgarian
audio -> speaker-separated, reviewed, exportable transcripts).

Read first, in this order:
1. C:\work\personal\projects\audio-transcriber\AGENTS.md  (non-negotiable session rules)
2. C:\work\personal\projects\audio-transcriber\README.md  (session state, document map)
3. docs/01-project-purpose.md, docs/02-tech-stack.md, docs/03-architecture.md
4. docs/04-poc-milestones.md (POC_M4 scope)
5. docs/implementation-plans/POC_M3.md + docs/implementation-tasks/POC_M3.md (what the
   frontend gives you to build on)
⛔ Never read docs/app-requirements/author_notebook.md.

Subagents: .pi/agents/workhorse.md (flash, mechanical) + workhorse-heavy.md (pro) —
use per AGENTS.md rule 5 (fully-specified briefs, agentScope "both").

State: POC_M1 ✅ (gate: ElevenLabs GO, Deepgram removed), POC_M2 ✅ (offline
ElevenLabs web-export import + SQLite + resumable pipeline import→clean→roles +
OpenRouter cleanup with 5 BG presets + role suggestions), POC_M3 ✅ (frontend:
session list + transcript editor with dual verbatim/cleaned editable view +
audio-block sync playback; routes: sessions list/detail, blocks PATCH, Range
audio streaming; buildApp split for inject tests; 73 tests). DB at data/app.db;
jobs at data/jobs/<jobId>/.

POC_M4 scope (docs/04-poc-milestones.md): FULL EDITING WORKFLOW — speaker panel
(role confirm/edit, speaker rename, per-block speaker reassign), per-block
regenerate (pipeline has regenerateBlock ready from POC_M2), block merge,
LLM style/model/temperature dropdowns. LLM knobs are shared constants
(LLM_MODEL_IDS, CLEANUP_STYLE_IDS + CLEANUP_STYLE_DISPLAY_NAMES,
LLM_TEMPERATURE_OPTIONS) — render as dropdowns. Per-block cleaned_* provenance
exists for comparing regenerated results. Role suggestions stay PROPOSALS:
confirmed_role changes only via explicit user action. UI language: Bulgarian
only. Session-level styles (summary / key-facts) target sessions.summary_text /
key_facts_text — decide whether their display lands in M4 or M5.

Environment: OPENROUTER_API_KEY in .env (never log it). No ElevenLabs API key —
imports only. Real recordings only in docs/test-examples/ and data/ (gitignored,
never commit).

Closing procedure (AGENTS.md rules 1-5): full gates green ONCE (npm run gates) ->
present changes + manual test list -> my typed "approve" -> task commit -> hash
commit -> push. No git mutation without the typed approval.
```
