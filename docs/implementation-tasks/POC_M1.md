# POC_M1 — Chunking + Deepgram engine + BG quality gate

Branch: `POC_M1_chunking-deepgram`. Scope: headless milestone — no UI work.

## Task state

| # | Task | State |
| --- | --- | --- |
| 1 | Branch + deps (`ffmpeg-static`, `@deepgram/sdk` v5, server workspace only) | ✅ done |
| 2 | `server/src/pipeline/chunker.ts` — FFmpeg chunking (~15 min) into `data/jobs/<jobId>/chunks/`, per-chunk file cache | ✅ done |
| 3 | `server/src/transcription/` — provider interface (`provider.ts`) + `deepgram.ts` (Nova-3, `language=bg`, diarization) + factory (`index.ts`) | ✅ done |
| 4 | `server/src/pipeline/transcribe.ts` — resumable orchestration, per-chunk JSON cache (`chunk-NNN.json`), absolute-timestamp merge, txt/json dumps | ✅ done |
| 5 | Test entry point — CLI: `npm run transcribe -w server -- <mp3> [--job <id>] [--chunk-minutes <n>]` | ✅ done |
| 6 | **GO/NO-GO quality gate** — Deepgram run vs ElevenLabs web demo, evaluated together | ✅ done — verdict below |

Closing commit: `1717812`

## Validation so far

- Unit tests: 18 passing (duration parse, chunk plan, offset shift/merge, txt format,
  job-id sanitize, Deepgram response mapping).
- Real run on a test recording from `docs/test-examples/`:
  single-chunk job → 41 utterances, 2 speakers; re-run with `--job` → cache hit
  (resume works); forced 2-minute chunks → 3 chunks merged into 44 utterances with
  consistent speaker labels across chunk boundaries.
- Outputs live under `data/jobs/<jobId>/` (gitignored) — `transcript.json` +
  readable `transcript.txt` ([HH:MM:SS] Speaker N: text).

## Gate verdict (author ear-test, real covert-grade recordings)

- **Deepgram Nova-3 = NO-GO.** Garbled Bulgarian non-words, over-fragmented
  diarization (4 unstable speaker labels), unusable on spy-grade audio
  (distant mic, noise, overlapping talkers — the NORMAL input profile).
- **ElevenLabs Scribe = GO.** ~95% accuracy per author's listen-along test on the
  same recording; stable 3-speaker diarization; word-level timestamps; audio-event
  tags (e.g. paper rustling) — valuable on covert audio.
- **Confirmed strategy (author, same session):** build the whole app OFFLINE against
  ElevenLabs **web-export imports** (no API key yet — web-export JSON has segments,
  speaker labels, word timestamps). Demo to the end user for approval of the
  subscription (~$22–40/mo at real volume); the API provider is a small bolt-on
  behind the existing interface AFTER approval. LLM cleanup/summary (POC_M2) is
  demoable NOW — the OpenRouter key is already in `.env`.
- Deepgram code stays: it proves the provider interface is swappable.
- Pricing research lives in the LOCAL, gitignored `docs/elevenlabs-pricing-notes.md`.

## Notes

- `@deepgram/sdk` v5 is a full rewrite vs v3/v4 docs (`DeepgramClient`,
  `listen.v1.media.transcribeFile`, `ListenV1Response`) — code targets v5.15.0.
- Quality-gate step 2 (ElevenLabs free web demo) is a manual author action;
  compare against `transcript.txt` from the Deepgram run.
