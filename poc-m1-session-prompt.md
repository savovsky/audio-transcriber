# POC_M1 — Session Prompt (delete at session close, per AGENTS.md conventions)

> Temp file: stays in the working tree for the whole POC_M1 session; its deletion
> lands in the session's closing commit. The durable record is the milestone
> tracker in `docs/implementation-tasks/`.

```text
I'm working on the audio-transcriber project (local web app: multi-hour Bulgarian
audio -> speaker-separated, reviewed, exportable transcripts).

Read first, in this order:
1. C:\work\personal\projects\audio-transcriber\AGENTS.md  (non-negotiable session rules)
2. C:\work\personal\projects\audio-transcriber\README.md  (session state, document map)
3. docs/01-project-purpose.md, docs/02-tech-stack.md, docs/03-architecture.md
4. docs/04-poc-milestones.md (POC_M1 scope + the go/no-go quality gate)
⛔ Never read docs/app-requirements/author_notebook.md.

The scaffold is DONE (commit ebabe2b on main): npm workspaces (shared/server/client),
Fastify on :3001 with /api/health, React+MUI on :3000 with /api proxy, gates + CI.

POC_M1 scope (headless milestone — NO UI work):
1. Create branch POC_M1_chunking-deepgram from main.
2. Add deps: ffmpeg-static, @deepgram/sdk (server workspace only).
3. server/src/pipeline/ — FFmpeg chunking of an MP3 into ~15-minute chunks,
   written under data/ (gitignored), with per-chunk result caching so a failed
   job resumes from the failed chunk.
4. server/src/transcription/ — the swappable provider INTERFACE + deepgram.ts
   implementation (Nova-3, language=bg, diarization on). Dependency rule:
   routes -> pipeline -> providers; providers never import routes or each other.
5. A test entry point (endpoint or CLI script) that runs a real recording
   through chunk -> transcribe and dumps the diarized transcript locally.
6. GO/NO-GO QUALITY GATE (the point of the milestone): run one real recording
   from the local, gitignored docs/test-examples/ through Deepgram AND through
   the ElevenLabs free web demo (no code), then evaluate Bulgarian transcription
   + diarization quality together with me. Good -> plan POC_M2. Poor -> evaluate
   Speechmatics/ElevenLabs behind the same interface.

Environment: the real DEEPGRAM_API_KEY is in .env (server loads it via
--env-file; never log the key value). OpenRouter is NOT needed in POC_M1.
Real recordings live only in docs/test-examples/ — gitignored, never commit them
or any transcript output derived from them (dump outputs under data/).

Closing procedure (AGENTS.md rules 1-5): full gates green ONCE (npm run gates) ->
present changes + manual test list -> my typed "approve" -> task commit -> push.
No git mutation without the typed approval.
```
