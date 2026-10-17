# POC_M3 — Frontend: session list + transcript editor (dual view) + audio-block sync playback

Branch: `POC_M3_transcript-editor`. Design settled via discussion rounds 1–2 —
all recommendations accepted by the author. Architecture gate: **structure holds**
(new code slots into the planned `routes/` + `pages/` + `components/` layout from
`docs/03-architecture.md`; no layer or folder changes).

## Scope

The user can **review**: list sessions, open one, read the dual verbatim/cleaned
transcript, edit both text layers, and click a block to hear exactly that audio
segment. Everything that changes speaker assignment or re-runs the LLM is POC_M4.

## Settled decisions (discussion rounds 1–2, all accepted)

1. **M3 includes inline text editing** of both layers (verbatim + cleaned) via
   `PATCH /api/blocks/:id`. Speaker reassignment, merge, regenerate, LLM dropdowns
   (style/model/temperature), role confirmation → POC_M4.
2. **API shape:** `GET /api/sessions`, `GET /api/sessions/:id` (session + speakers
   + blocks in one payload), `GET /api/sessions/:id/audio` (HTTP Range streaming
   from `data/jobs/<id>/<audioFileName>`), `PATCH /api/blocks/:id`.
3. **Playback:** one page-level `<audio>` element; block play button seeks to
   `startSec`, plays, auto-pauses at `endSec`; playing block highlighted, its icon
   toggles to pause. Continuous follow-along playback: stretch only.
4. **Dual view:** stacked per block — cleaned text primary, verbatim below in
   italic/smaller; global toggle hides the verbatim layer (**shown by default**).
   Blocks with `cleanedText = NULL` show verbatim only + "изчаква изчистване".
5. **Speakers read-only in M3:** label per block; suggested role shown as a chip
   marked as a proposal ("предложение: …"); no confirm/edit UI.
6. **Session list columns:** title, reference number, date, duration, status —
   Bulgarian labels; click → detail. No delete/rename in M3.
7. **No import affordance** — new sessions arrive via the existing CLIs.
8. **Text-edit save UX:** auto-save on blur + inline "запазено" confirmation;
   Escape reverts to last saved text.
9. **Playback trigger:** dedicated play icon button per block (hover-visible) +
   timestamp — whole-block click would fight text selection/editing.
10. **Tests:** server route tests via `fastify.inject` against a temp data dir
    (incl. 404s + audio path-traversal guard + Range requests); shared constants
    tests; **no client component-test setup in M3** (manual test pass instead).
11. **Task split:** (a) shared contracts → (b) server routes + tests → (c) client
    typed API client + session list page → (d) session detail page (dual-view
    blocks + playback sync). Full gates once at the end.

## Shared contracts (data-model-first, `shared/src/index.ts`)

```ts
// GET /api/sessions
export interface SessionListItem { id; title; referenceNumber; durationSec; status; createdAt }
export interface SessionListResponse { sessions: SessionListItem[] }

// GET /api/sessions/:id — everything the detail page needs in one payload
export interface SessionDetailResponse {
  session: Session;
  speakers: Speaker[];
  blocks: TranscriptBlock[];
  audioUrl: string; // '/api/sessions/<id>/audio'
}

// PATCH /api/blocks/:id — both text layers editable
export interface BlockUpdateRequest { verbatimText?: string; cleanedText?: string }
export interface BlockUpdateResponse { block: TranscriptBlock }

export interface ApiErrorResponse { error: string }

// Bulgarian status labels (same precedent as CLEANUP_STYLE_DISPLAY_NAMES)
export const SESSION_STATUS_DISPLAY_NAMES: Readonly<Record<SessionStatus, string>>
```

Manual text edits do **not** touch the `cleaned_model/style/temperature`
provenance columns (they describe the LLM run that produced the base text; the
regenerate-compare workflow is POC_M4).

## Server work

- `server/src/db/repositories.ts`: add `BlocksRepo.get(id)` and
  `BlocksRepo.updateText(id, { verbatimText?, cleanedText? })`.
- `server/src/routes/sessions.ts`: list, detail, audio streaming.
  - Audio route: resolve `path.join(dataDir, 'jobs', session.id, session.audioFileName)`,
    verify the resolved path stays inside the session's job dir (traversal guard),
    404 when the file is missing, support `Range` headers (206 partial content,
    `audio/mpeg`).
- `server/src/routes/blocks.ts`: `PATCH /api/blocks/:id` — 400 on empty body,
  404 on unknown block.
- `server/src/index.ts`: open the DB via `openDatabase(config.dataDir)` and
  register the new routes.

## Client work (Bulgarian UI only)

- `client/src/api/` — typed client: `fetchSessions`, `fetchSessionDetail`,
  `updateBlock` (thin wrapper over `fetch`, `/api` proxied by Vite).
- `client/src/pages/SessionListPage.tsx` — table of sessions (decision 6);
  keeps the scaffold's server-status chip in the header.
- `client/src/pages/SessionDetailPage.tsx` — header (title, status, duration,
  verbatim toggle), speaker-legend chips (proposals marked), block list.
- `client/src/components/TranscriptBlock.tsx` — dual text layers, play button +
  timestamp, speaker label, editable texts (blur saves / Escape reverts /
  "запазено" flash), active-block highlight.
- `client/src/components/useBlockPlayback.ts` (or small AudioPlayer component) —
  owns the single `<audio>` element, seek/play/auto-pause-at-endSec state machine.
- `client/src/App.tsx` — routes: `/` → list, `/sessions/:id` → detail.

## Test plan

- `server/src/routes/sessions.test.ts` + `blocks.test.ts`: temp data dir +
  in-memory-ish sqlite (temp file), `fastify.inject`; cover list/detail/404,
  PATCH validation, audio 200/206/404 + traversal guard.
- `shared/src/index.test.ts`: extend for the new constants.
- Client: no component tests (decision 10); pure helpers (time formatting) get a
  unit test only if they emerge.

## Out of scope (POC_M4+)

Speaker panel (rename/reassign/role confirm), per-block regenerate, block merge,
LLM style/model/temperature dropdowns, summary/key-facts display, .docx export
(POC_M5), session import UI, delete/rename sessions.
