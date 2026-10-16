# 03 — Architecture

## High level

```text
React + MUI (Bulgarian UI)  ──►  Node/TS backend (Fastify)  ──►  SQLite (better-sqlite3)
   SPA, Vite dev server            port 3001                       data/app.db (gitignored)
   port 3000, /api proxy                │
                                        ├─► Transcription API (swappable interface)
                                        │     • v1: Deepgram Nova-3 (BG + diarization)
                                        │     • future: self-hosted WhisperX sidecar
                                        │
                                        └─► LLM cleanup via OpenRouter
                                              (model dropdown, 3 options)
```

**Audio files, the SQLite DB, and the per-chunk cache live in `data/` (gitignored) —
recordings never leave the machine except as transient API payloads.**

## Repository layout (npm workspaces)

```text
audio-transcriber/
├── package.json            # workspaces + orchestration scripts (dev/lint/tsc/test/gates)
├── shared/                 # workspace: TS types & constants shared by server and client
│   └── src/                #   Session, TranscriptBlock, Speaker, API contracts
├── server/                 # workspace: Node + TS backend
│   └── src/
│       ├── routes/         # sessions, blocks, speakers, export
│       ├── pipeline/       # chunk → transcribe → clean → roles (resumable, per-chunk cache)
│       ├── transcription/  # provider interface + deepgram.ts (swappable!)
│       ├── llm/            # openrouter.ts + cleanup-style presets + role suggestion
│       ├── export/         # docx builder (npm "docx" package)
│       └── db/             # better-sqlite3 schema + repositories
├── client/                 # workspace: React + MUI + Vite + TS
│   └── src/
│       ├── api/            # typed backend client
│       ├── pages/          # SessionList, SessionDetail
│       └── components/     # TranscriptBlock, SpeakerPanel, ExportDialog, AudioPlayer
├── data/                   # sqlite file, audio files, chunk cache (GITIGNORED)
└── docs/                   # numbered docs (see README document map)
```

## Dependency rule (non-negotiable)

```text
routes → pipeline → (transcription | llm | export)
```

- Providers **never** import routes or each other.
- The pipeline talks to **interfaces only** — that is what keeps the transcription
  engine (Deepgram ↔ WhisperX) and the LLM model swappable.
- React components are dumb: they render and call the typed API client. No pipeline,
  no provider, no business logic in components.
- Shared types live in `shared/` and are defined **before** the code that consumes them.

## Transcription provider landscape

| Provider | Bulgarian | Diarization | Price/hour | Role |
| --- | --- | --- | --- | --- |
| **Deepgram Nova-3** | Good–Excellent | Built-in | ~$0.31 | 🥇 Primary — best price/speed/dev experience; $200 free credit, no card |
| **Speechmatics** | Excellent | Built-in | ~$0.38 | 🥈 Fallback 1 — strongest BG accuracy reputation |
| **ElevenLabs Scribe v2** | Excellent | Built-in | ~$0.22 | 🥉 Fallback 2 — best on messy/overlapping audio |
| AssemblyAI | Good | Built-in | ~$0.37 | Fallback 3 |
| Google Cloud STT V2 | Good | Speaker labels | ~$0.96 | Fallback 4 (heavier GCP setup) |
| Azure Speech | Good | Yes | ~$1.00 | Fallback 5 |
| WhisperX self-hosted | Good | Decent | GPU rental ~$0.40/h | Nuclear option — only if APIs are ever rejected for privacy; requires a Python sidecar behind the same interface |

> Deepgram is NOT available via OpenRouter — OpenRouter proxies LLMs only. Two
> separate API keys are required (see `02-tech-stack.md`).

## Pipeline design (resilient, resumable)

1. **Chunk** — FFmpeg splits the upload into ~15-minute audio chunks.
2. **Transcribe** — each chunk goes to the transcription provider; results are cached
   **per chunk** on disk. A failed 3-hour job resumes from the failed chunk, not from zero.
3. **Clean** — transcript blocks go through the LLM with one of **5 cleanup-style presets**
   (dropdown; exact Bulgarian display names finalized in POC_M2). Per-block "↻ regenerate"
   re-runs the cleanup for that block only.
4. **Roles** — the LLM **suggests** a role per speaker from a configurable vocabulary,
   with reasoning. The user **confirms or edits before anything is applied**; a speaker
   rename applies globally.

Progress is reported per stage (transcribing → cleaning → roles) so the UI can show a
stage progress bar.

## Review & editing model

- Every transcript block carries **two texts**: verbatim (rendered italic) + cleaned.
  **Both are editable.** A global toggle hides the verbatim layer.
- Click a block → audio plays that segment (timestamps from diarization).
- Each block has a **speaker dropdown** (diarization is imperfect — lines can be
  reassigned) + a "merge with previous block" action.

## Sessions & persistence

- Home screen lists past sessions (date, reference number, duration, status) from SQLite.
- Reopening a session restores audio + transcript + edits; the audio file is kept in
  `data/` for playback sync.

## Export

.docx via the `docx` npm package, with an options dialog: reference-number header, date,
organization, timestamps per block on/off, content choice — verbatim only / cleaned only /
both (verbatim in italic).

## Cost estimates

- Transcription: ~$0.31/audio-hour → a 3-hour recording ≈ **$0.93**.
- LLM cleanup: **a few cents** per 3-hour recording.
- Processing time: 3-hour file → ~2–4 min transcription + LLM pass.
