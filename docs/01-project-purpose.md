# 01 — Project Purpose

## What this is

A **local web application** that converts multi-hour (1–3+ hour) Bulgarian-language
audio recordings (MP3) into **speaker-separated transcripts**, with:

- a **dual text view** per paragraph — verbatim transcript + LLM-cleaned version, both editable,
- human review and editing tools (speaker reassignment, block merge, per-block regenerate),
- synchronized audio playback per transcript block,
- **.docx export** with configurable options.

## Who it is for

Exactly **one end user**, running the app on a local machine. Single user, **no
authentication**, no multi-tenancy. The app must be operable after a fresh clone with:

```bash
npm install && npm run dev
```

**UI language: Bulgarian only.** Code, comments, and documentation: English.

## Why it exists

Manual transcription of long recordings is hours of tedious work. Existing tools either
do not handle Bulgarian well, do not separate speakers, or require sending data to
hosted services with accounts and subscriptions. This app combines a speech-to-text API
(with built-in speaker diarization) and an LLM cleanup pass behind a local, review-first
UI: nothing is auto-applied, every suggestion is confirmed by the user.

## Privacy posture

- Recordings and transcripts **stay on the local disk** (`data/`, gitignored).
- Cloud APIs are used for **processing in transit only**: the transcription provider
  receives audio chunks; the LLM provider receives text. No permanent cloud storage.
- If privacy requirements ever tighten, the transcription engine is swappable for a
  self-hosted option behind the same provider interface (see `03-architecture.md`).

## In scope (POC)

- Upload one MP3, process it end-to-end (chunk → transcribe → clean → suggest speaker roles).
- Review UI: dual text view, speaker panel, audio-block playback sync, editing.
- Session list persisted in SQLite; sessions reopen with audio + transcript + edits.
- .docx export with options (header fields, timestamps on/off, verbatim/cleaned/both).

## Explicitly out of scope (POC)

- Job queues (Celery/Redis-style), batch multi-file upload.
- Hosting/deployment, auth, multi-user support.
- Auto-applying LLM-suggested speaker roles without user confirmation.
- Local AI model hosting (no suitable GPU on the target machine).
