# POC_M3 — Session Prompt (delete at session close, per AGENTS.md conventions)

> Temp file: stays in the working tree for the whole POC_M3 session; its deletion
> lands in the session's closing commit. The durable record is the milestone
> tracker in `docs/implementation-tasks/`.

```text
I'm working on the audio-transcriber project (local web app: multi-hour Bulgarian
audio -> speaker-separated, reviewed, exportable transcripts).

Read first, in this order:
1. C:\work\personal\projects\audio-transcriber\AGENTS.md  (non-negotiable session rules)
2. C:\work\personal\projects\audio-transcriber\README.md  (session state, document map)
3. docs/01-project-purpose.md, docs/02-tech-stack.md, docs/03-architecture.md
4. docs/04-poc-milestones.md (POC_M3 scope)
5. docs/implementation-tasks/POC_M2.md (what the headless pipeline gives you to render)
⛔ Never read docs/app-requirements/author_notebook.md.

Subagents: .pi/agents/workhorse.md (flash, mechanical) + workhorse-heavy.md (pro) —
use per AGENTS.md rule 5 (fully-specified briefs, agentScope "both").

State: POC_M1 ✅ (gate: ElevenLabs GO, Deepgram removed), POC_M2 ✅ (offline
ElevenLabs web-export import + SQLite + resumable pipeline import→clean→roles +
OpenRouter cleanup with 5 BG presets + role suggestions; headless CLIs `import` /
`process` in the server workspace). DB at data/app.db; jobs at data/jobs/<jobId>/
(audio + transcript.json/txt + raw export).

POC_M3 scope (docs/04-poc-milestones.md): FRONTEND —
session list + transcript editor (dual verbatim/cleaned view) + audio-block sync
playback. Server endpoints needed (routes → pipeline → providers; components stay
dumb, typed API client only): sessions list/detail, blocks, audio streaming from
the job dir. UI language: Bulgarian only. LLM knobs (LLM_MODEL_IDS,
CLEANUP_STYLE_IDS + CLEANUP_STYLE_DISPLAY_NAMES, LLM_TEMPERATURE_OPTIONS) are
shared constants — render them as dropdowns; per-block cleaned_* provenance
exists for comparing regenerated results. Role suggestions are PROPOSALS
(confirmed_role only via user action).

Environment: OPENROUTER_API_KEY in .env (never log it). No ElevenLabs API key —
imports only. Real recordings only in docs/test-examples/ and data/ (gitignored,
never commit).

Closing procedure (AGENTS.md rules 1-5): full gates green ONCE (npm run gates) ->
present changes + manual test list -> my typed "approve" -> task commit -> hash
commit -> push. No git mutation without the typed approval.
```
