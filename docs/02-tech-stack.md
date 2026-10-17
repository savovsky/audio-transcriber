# 02 — Tech Stack

## Principles

- **Full-stack TypeScript.** One language across server, client, and shared types.
  No Python: all AI processing happens via APIs, so no local ML libraries are needed.
- **Trivial local setup.** `npm install && npm run dev` on a fresh Windows machine.
  No system-level installs (FFmpeg is bundled as an npm binary, SQLite is embedded).
- **No local AI hosting.** Target machine: Windows 11, 14 GB RAM, Intel Iris Xe iGPU,
  no NVIDIA GPU — local speech models are impractical. APIs are used instead.

## Runtime stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| Language | TypeScript ~6.0 (strict) | Single language, shared types between client and server |
| Runtime | Node.js ≥ 22 (dev on 24) | Native `--env-file`, native TS-friendly tooling |
| Package manager | **npm workspaces** | Zero extra tooling for the end user; one `npm install` at root |
| Server framework | **Fastify 5** | Modern, typed, fast |
| Server TS execution | **tsx watch** | Zero-config TS execution with reload; no build step for a local app |
| Client | React 19 + Vite 8 + MUI 7 | Owner's home turf; MUI gives a complete Bulgarian-localizable component set |
| Client routing | react-router-dom 7 | Session list ↔ session detail pages |
| Storage | **better-sqlite3** | Embedded single-file DB; no DB server to install |
| Audio processing | **ffmpeg-static** | Bundled FFmpeg binary — no system install; used for chunking |
| Transcription | **ElevenLabs Scribe v2** (plain HTTP) | Won the POC_M1 gate: ~95% BG accuracy on covert audio + diarization, ~$0.22/audio-hour. Web-export import until the API key lands; Deepgram gate-rejected (POC_M1) and removed |
| LLM cleanup | **OpenRouter** via plain HTTP | Model dropdown; a few cents per 3-hour session |
| Export | **docx** (npm package) | .docx generation without Word installed |

## External services (two API keys)

| Service | Purpose | Key location |
| --- | --- | --- |
| ElevenLabs | Speech-to-text + speaker diarization (primary) | `.env` → `ELEVENLABS_API_KEY` (server-only) — added when the subscription is approved; web-export import until then |
| OpenRouter | LLM text cleanup + speaker-role suggestions | `.env` → `OPENROUTER_API_KEY` (server-only) |

Keys are loaded by the Node server via Node's native `--env-file` flag. The client
never sees them; it talks to the server through the Vite dev proxy.

## LLM model dropdown (POC defaults)

1. `google/gemini-2.5-flash` — default
2. `openai/gpt-4o-mini`
3. `anthropic/claude-haiku-4.5`

(Ids verified against the live OpenRouter catalog in POC_M2 — the original
2.0-flash / 3.5-haiku ids are retired and return HTTP 404.)

## Dev tooling

| Tool | Choice |
| --- | --- |
| Lint | ESLint 10 flat config + typescript-eslint (typed rules) + Prettier as a lint rule |
| Format | Prettier 3 + `@trivago/prettier-plugin-sort-imports` (options in `.prettierrc.json`) |
| Types | `tsc -b` project references (root / shared / server / client) |
| Tests | Vitest 4 (unit); Playwright added later when the UI exists (POC_M3+) |
| Gates | `npm run gates` → `scripts/gates.mjs` (lint → tsc → vitest, one line per gate) |
| CI | GitHub Actions, PR-only trigger: install → lint → tsc → test → build |
| Dev orchestration | `concurrently`: server on :3001, Vite on :3000 with `/api` proxy |

## Dependency policy

Dependencies are added **per milestone, when wired up** — the scaffold installs only
what the running skeleton needs (framework, toolchain, MUI). `better-sqlite3`,
`ffmpeg-static`, and `docx` arrive with POC_M1/POC_M2.
