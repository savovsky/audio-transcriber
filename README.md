# Audio Transcriber

A local web app that converts multi-hour Bulgarian-language audio recordings (MP3)
into speaker-separated transcripts — with a dual verbatim/cleaned text view, human
review and editing, synchronized playback, and .docx export.

Single user, no auth, runs fully locally. UI language: Bulgarian.

## Quick start

Prerequisites: **Node.js ≥ 22** (developed on Node 24). Nothing else — FFmpeg and
SQLite are bundled as npm dependencies.

```bash
npm install
cp .env.example .env   # then fill in DEEPGRAM_API_KEY and OPENROUTER_API_KEY
npm run dev
```

`npm run dev` starts both apps: the API server on **http://localhost:3001** and the
web client on **http://localhost:3000** (opens automatically; `/api` is proxied to the
server). API keys are needed only from milestone POC_M1 on — the bare scaffold runs
without them.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start server (:3001) + client (:3000) with reload |
| `npm run gates` | The quality gates: lint → tsc → vitest (one line per gate, logs in `.gates/`) |
| `npm run lint` / `lint:fix` | ESLint (includes Prettier as a rule) |
| `npm run tsc` | TypeScript project-references build check |
| `npm test` / `test:watch` | Vitest |
| `npm run build` | Production build of the client |

## Document map

```text
README.md                          ← YOU ARE HERE — session state & overview
AGENTS.md                          ← rules for AI sessions (ported from openrebar)
├── docs/
│   ├── 01-project-purpose.md      ← what/why, scope, privacy posture
│   ├── 02-tech-stack.md           ← all chosen technologies & versions
│   ├── 03-architecture.md         ← structure, dependency rule, providers, pipeline
│   ├── 04-poc-milestones.md       ← POC_M1–POC_M5 + branch naming + go/no-go gate
│   ├── app-requirements/          ← 📝 AUTHOR-OWNED (incl. ⛔ author_notebook.md — never read)
│   ├── implementation-plans/      ← 🔵 LIVE — approved milestone plans
│   ├── implementation-tasks/      ← 🔵 LIVE — task state trackers
│   └── test-examples/             ← local-only real recordings (GITIGNORED)
├── shared/                        ← workspace: types shared by server & client
├── server/                        ← workspace: Fastify backend
├── client/                        ← workspace: React + MUI SPA
└── data/                          ← sqlite + audio + chunk cache (GITIGNORED)
```

## Session state

- **Scaffold** — workspace setup, docs, toolchain, health endpoint, placeholder UI.
- **Next:** POC_M1 — FFmpeg chunking + Deepgram engine + Bulgarian quality validation
  on a real recording (see `docs/04-poc-milestones.md`).

## For AI sessions

Read `AGENTS.md` first — it has the non-negotiable session rules. Then `README.md`
(this file) and the numbered docs above.
