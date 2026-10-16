# 04 — POC Milestones

Naming convention: milestones are **POC_M1 … POC_M5**. Git branches for milestone work
start with the same prefix, e.g. `POC_M1_chunking-deepgram`, `POC_M3_transcript-editor`.

| # | Milestone | Validates |
| --- | --- | --- |
| **POC_M1** | Server skeleton + FFmpeg chunking + Deepgram engine + test endpoint/CLI | **Bulgarian transcription + diarization quality on a REAL recording** — the go/no-go gate before any UI is built |
| **POC_M2** | SQLite schema + full resumable pipeline + OpenRouter cleanup (5 style presets) + speaker-role suggestions | End-to-end transcript in the DB |
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

## After the POC

If the POC proves useful, the app may be ported as a feature/page into an existing
cloud product (SPA + serverless backend). The provider interfaces and the
`routes → pipeline → providers` dependency rule exist to keep that port cheap: the
port touches the adapters (storage, HTTP calls), not the application core. That
decision — including its changed privacy posture (recordings would live in cloud
storage, not only transit APIs) — is deferred until after POC_M5.
