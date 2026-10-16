# 04 — POC Milestones

Naming convention: milestones are **POC_M1 … POC_M5**. Git branches for milestone work
start with the same prefix, e.g. `POC_M1_chunking-deepgram`, `POC_M3_transcript-editor`.

| # | Milestone | Validates |
| --- | --- | --- |
| **POC_M1** ✅ | Server skeleton + FFmpeg chunking + Deepgram engine + test endpoint/CLI | **Bulgarian transcription + diarization quality on a REAL recording** — the go/no-go gate before any UI is built. **Outcome: Deepgram NO-GO, ElevenLabs GO** (see gate outcome below) |
| **POC_M2** | ElevenLabs **web-export import adapter** + SQLite schema + full resumable pipeline + OpenRouter cleanup (5 style presets) + speaker-role suggestions | End-to-end transcript in the DB — built OFFLINE against imported web-export files (no ElevenLabs API key until the end user approves the subscription) |
| **POC_M3** | Frontend: session list, transcript editor (dual view), audio-block sync playback | The user can review |
| **POC_M4** | Speaker panel (roles, rename, reassign), regenerate, merge, style/model dropdowns | Full editing workflow |
| **POC_M5** | .docx export + options dialog | Deliverable |

## POC_M1 quality gate (go/no-go)

Before any UI work: run a real multi-hour recording through the Deepgram engine **and**
through the ElevenLabs free web demo (upload MP3, no code), then compare Bulgarian
transcription + diarization quality by eye. Real recordings live in the local-only,
gitignored `docs/test-examples/` folder.

- Quality good → continue to POC_M2 with Deepgram.
- Quality poor → evaluate Speechmatics / ElevenLabs behind the same provider interface
  (this is exactly why the interface exists — see `03-architecture.md`).

### Gate outcome (recorded in POC_M1)

The real recordings turned out to be **covert/spy-grade audio** (one distant mic, noise,
overlapping talkers) — the normal input profile, not an edge case. On that profile:

- **Deepgram Nova-3 = NO-GO** — garbled Bulgarian, over-fragmented diarization.
- **ElevenLabs Scribe = GO** — ~95% per the author's listen-along test, stable
  diarization, word-level timestamps, audio-event tags.

**Strategy confirmed by the author:** build the app offline against ElevenLabs
**web-export imports** (no API key); the API provider lands behind the same interface
only after the end user approves the subscription. Deepgram stays as proof the
interface is swappable; Speechmatics remains the fallback if ElevenLabs ever fails.

## After the POC

If the POC proves useful, the app may be ported as a feature/page into an existing
cloud product (SPA + serverless backend). The provider interfaces and the
`routes → pipeline → providers` dependency rule exist to keep that port cheap: the
port touches the adapters (storage, HTTP calls), not the application core. That
decision — including its changed privacy posture (recordings would live in cloud
storage, not only transit APIs) — is deferred until after POC_M5.
