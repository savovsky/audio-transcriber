# POC_M3 — Session list + transcript editor (dual view) + audio-block sync playback

Branch: `POC_M3_transcript-editor`. Approved plan: `docs/implementation-plans/POC_M3.md`
(discussion rounds 1–2, all recommendations accepted).

## Task state

| # | Task | State |
| --- | --- | --- |
| 1 | Shared API contracts (list/detail/PATCH + BG status display names) | ✅ done |
| 2 | Server routes: sessions list/detail, audio streaming (Range), blocks PATCH + repo additions + tests | ✅ done |
| 3 | Client typed API client + session list page | ✅ done |
| 4 | Session detail page: dual-view blocks, text editing, sync playback | ✅ done |
| 5 | Full gates green once → author review → closing commits | ✅ done |

Closing commit: `de6ddf5` (author-approved).

## Manual test assignment (author)

1. Session list renders the ready session (status «Готов», duration 10:38) + server chip.
2. Detail page: header, 3 speaker proposal chips, 69 blocks.
3. Playback: block button plays exactly that segment (auto-pause at end), toggle, highlight.
4. Dual view + «Дословен текст» toggle.
5. Edits persist across reload (both layers); Escape reverts.
6. Server down → list shows «Сървър: недостъпен» + alert.

## Design decisions

Settled in the plan doc (rounds 1–2). Key ones: M3 edits both text layers
(PATCH), speakers read-only (proposals as chips), stacked dual view with
verbatim shown by default, per-block play button with auto-pause at block end,
auto-save on blur / Escape reverts, no import/delete UI, no client component
tests in M3.

## Validation

- Route tests via `fastify.inject` on a temp data dir: sessions list/detail/404,
  audio full/Range-206/open-ended-range/416/missing-file/traversal-guard,
  blocks PATCH (both layers, provenance preserved, 400/404). 73 tests total.
- Live smoke against the real `data/`: session list + detail JSON OK; audio
  returns `206 audio/mpeg` on a Range request (Cyrillic file name included).
- Full gates green once: lint 24.1s, tsc 8.7s, vitest 73/73.

## Notes

- Block ids contain `/` (`<sessionId>/b<idx>`) — clients must URL-encode them
  (`encodeURIComponent`); the typed client does.
- `@mui/icons-material` pinned to `^7` (latest v9 requires `@mui/material` v9).
- `server/src/app.ts` (buildApp) split from `index.ts` so tests can inject.
- Client has no component tests in M3 (decision 10) — verification is the
  author's manual pass.
