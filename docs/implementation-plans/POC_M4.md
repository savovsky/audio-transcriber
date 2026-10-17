# POC_M4 — Full editing workflow: speaker panel, regenerate, merge, LLM dropdowns

Branch: `POC_M4_editing-workflow`. Design settled via discussion rounds 1–2 —
all recommendations accepted by the author. Architecture gate: **structure holds**
(routes → pipeline → providers preserved: LLM work gets new public entry points in
`pipeline/process.ts`; speaker/merge DB ops go through repos like the existing
session routes; `SpeakerPanel` + `routes/speakers.ts` are in the planned layout;
the only relocation is `ROLE_VOCABULARY` → `shared/`, same precedent as
`CLEANUP_STYLE_DISPLAY_NAMES`).

## Scope

The user gets the **full editing workflow**: confirm/edit speaker roles, rename
speakers, reassign blocks between speakers, regenerate a block's cleaned text with
chosen LLM settings (preview before apply), merge a block with the previous one,
re-clean the whole session with chosen settings, and view/generate the
session-level summary / key-facts artifacts.

## Settled decisions (discussion rounds 1–2, all accepted)

1. **Regenerate = preview-then-apply.** `POST /api/blocks/:id/regenerate` returns
   a candidate and persists **nothing**; the block shows current-vs-candidate
   stacked (decision 9 below); «Приложи» persists text + provenance, «Отказ»
   discards. Manual edits are never silently destroyed.
2. **LLM dropdowns at both levels.** A header bar (style / model / temperature
   from the shared constants) holds the session defaults and drives
   «Преизчисти всички блокове» — behind a confirm dialog warning that it
   overwrites manual edits. The per-block ↻ popover has the same three dropdowns,
   pre-filled from the block's `cleaned_*` provenance (or defaults when never
   cleaned).
3. **Merge with previous.** Kept (earlier) block: union time range, per-layer
   text concatenation with a space (`cleanedText` = `null` if either side is
   `null`), provenance kept **only if both sides match exactly**, else nulled.
   Block ids are NOT renumbered — the merged-away id leaves a gap; ordering by
   `orderIndex` is unaffected. No undo.
4. **Speaker panel.** Collapsible right-side panel (`components/SpeakerPanel.tsx`):
   editable label (blur-save, applies globally), suggested role + reasoning in an
   expandable section, confirmed role via MUI Autocomplete `freeSolo` with
   `ROLE_VOCABULARY` options (free text allowed), explicit «Потвърди».
5. **Block caption:** `confirmedRole ?? label` — confirmed role wins.
6. **Reassignment:** per-block dropdown of the session's existing speakers only.
   No «new speaker» creation in M4.
7. **Summary / key-facts in M4:** cards at the top of the detail page — stored
   text if present, else a «Генерирай» button (uses the header dropdowns'
   model/temperature; style is fixed by the artifact kind).
8. **Merge across different speakers is allowed**; the kept block keeps the
   earlier block's speaker.
9. **Regenerate preview format:** stacked current-vs-candidate inside the block,
   candidate with a highlight border + provenance line («модел · стил ·
   температура»). No word-level diff, no side-by-side columns.
10. **Header dropdown values are component state only** — reset to defaults on
    reload (first style, first model, temperature 0.2). No persistence.
11. **Long LLM runs block the UI with a progress count** («Изчистване 14/69…»),
    editing disabled meanwhile. Mechanism (keeps single requests short and gives
    the count for free): the re-clean endpoint processes **one batch per call**;
    the client loops until `remaining === 0`. The NULL-marker resume semantics
    are preserved — a crash mid-run leaves pending blocks, and re-running
    continues where it stopped.

## Shared contracts (data-model-first, `shared/src/index.ts`)

- **Move** `ROLE_VOCABULARY` from `server/src/llm/role-vocabulary.ts` (the file is
  deleted; `server/src/llm/roles.ts` imports from `shared`).

```ts
// PATCH /api/blocks/:id — extended (M3 fields + speaker reassign + regenerate apply)
export interface CleanedRun {
  model: string;
  style: PerBlockCleanupStyleId;
  temperature: number;
}

export interface BlockUpdateRequest {
  verbatimText?: string;
  cleanedText?: string;
  speakerId?: string; // reassign to another speaker of the same session
  cleanedRun?: CleanedRun; // regenerate apply: sets cleaned_* provenance WITH cleanedText
}

// POST /api/blocks/:id/regenerate — preview only, persists nothing
export interface BlockRegenerateRequest extends CleanedRun {}
export interface BlockRegenerateResponse {
  candidateText: string;
  run: CleanedRun;
}

// POST /api/blocks/:id/merge — merge with the previous block (by orderIndex)
export interface BlockMergeResponse {
  block: TranscriptBlock; // the kept (earlier) block, updated
  removedBlockId: string;
}

// PATCH /api/speakers/:id — rename and/or confirm role (explicit user actions)
export interface SpeakerUpdateRequest {
  label?: string;
  confirmedRole?: string;
}
export interface SpeakerUpdateResponse {
  speaker: Speaker;
}

// POST /api/sessions/:id/reclean — one batch per call; the client loops
export interface SessionRecleanRequest extends CleanedRun {
  mode: 'start' | 'continue'; // 'start' marks ALL blocks pending first (manual edits lost — UI confirms)
}
export interface SessionRecleanResponse {
  cleanedBlocks: TranscriptBlock[]; // the batch cleaned by THIS call
  total: number;
  remaining: number; // 0 = done
}

// POST /api/sessions/:id/artifacts — generate a session-level artifact
export interface SessionArtifactRequest {
  kind: 'summary' | 'key-facts';
  model: string;
  temperature: number;
}
export interface SessionArtifactResponse {
  session: Session; // summaryText / keyFactsText updated
}
```

## Server work

- **Pipeline (`server/src/pipeline/process.ts`)** — new public entry points:
  - `generateBlockCandidate({ llm, block, run }): Promise<string>` — the
    candidate-only half of the existing `regenerateBlock` (which shrinks to
    candidate + `BlocksRepo.setCleaned`).
  - `recleanSessionBatch({ db, llm, sessionId, run, mode })`: `start` nulls
    `cleaned_text` + `cleaned_*` for the session's blocks (the confirm dialog
    covers the data loss), then both modes clean the next pending batch via the
    existing `cleanBlocks` batching and persist per block. Returns
    `{ cleanedBlocks, total, remaining }`.
  - `generateSessionArtifact({ db, llm, sessionId, kind, model, temperature })` —
    public wrapper over the existing session-level-style logic; writes
    `summary_text` / `key_facts_text`.
- **Repos (`server/src/db/repositories.ts`)**:
  - `BlocksRepo.mergeWithPrevious(id)`: transaction — find the kept block
    (highest `orderIndex` below this one in the same session), apply decision 3
    (union range, per-layer concat, provenance match-or-null, keep the earlier
    block's speaker), delete the merged block; returns
    `{ kept, removedId } | null` (null = no previous block).
  - `BlocksRepo.markCleanupPending(sessionId)` — nulls `cleaned_text` +
    `cleaned_*` for the session (reclean `start`).
  - `SessionsRepo`/`SpeakersRepo` need no new methods (`rename`, `confirmRole`,
    `setSummaryText`, `setKeyFactsText` already exist).
- **Routes**:
  - `routes/blocks.ts` (extend): PATCH gains `speakerId` (404 unknown speaker,
    400 speaker from another session) and `cleanedRun` (400 without
    `cleanedText`; uses `setCleaned`); `POST /:id/regenerate` (LLM);
    `POST /:id/merge` (400 on first block).
  - `routes/speakers.ts` (new): `PATCH /api/speakers/:id` — 400 empty
    body/blank label/blank role, 404 unknown speaker.
  - `routes/sessions.ts` (extend): `POST /:id/reclean`, `POST /:id/artifacts`.
  - LLM routes return **503** `{ error: 'OpenRouter API key is not configured' }`
    when no `LlmClient` is injected.
- **Wiring:** `buildApp(config, db, llm: LlmClient | null)`; `index.ts` builds an
  `OpenRouterClient` when `config.openrouterApiKey` is present, else passes null.

## Client work (Bulgarian UI only)

- `api/sessions.ts`: `regenerateBlock`, `mergeBlock`, `updateSpeaker`,
  `recleanSessionBatch`, `generateSessionArtifact`; `updateBlock` accepts the
  extended request.
- `components/LlmControls.tsx` — the three dropdowns (per-block style ids +
  `CLEANUP_STYLE_DISPLAY_NAMES`, `LLM_MODEL_IDS`, `LLM_TEMPERATURE_OPTIONS`),
  controlled component reused in the header bar and the ↻ popover.
- `components/SpeakerPanel.tsx` — collapsible right panel per decision 4
  (label blur-save, suggestion + reasoning expandable, freeSolo Autocomplete +
  «Потвърди»).
- `components/TranscriptBlock.tsx`:
  - caption = `confirmedRole ?? label`; speaker reassign `Select` next to it.
  - ↻ button → `Popover` with `LlmControls` + «Генерирай»; on success the block
    shows the stacked preview (decision 9) with «Приложи» (PATCH with
    `cleanedText` + `cleanedRun`) / «Отказ».
  - «Обедини с предишния» button — disabled on the first block.
- `pages/SessionDetailPage.tsx`:
  - header gains `LlmControls` + «Преизчисти всички блокове» (confirm dialog
    about overwriting manual edits) + blocking progress «Изчистване X/Y…» with
    editing disabled (decision 11);
  - summary / key-facts cards (stored text or «Генерирай») under the header;
  - layout becomes a flex row: transcript column + toggleable speaker panel;
  - 503 from LLM routes surfaces as «LLM услугата не е конфигурирана» alert.

## Test plan

- `server/src/routes/blocks.test.ts` (extend): speaker reassign (happy, 404
  unknown speaker, 400 cross-session speaker), merge (happy path concat/union/
  provenance-match, provenance-null on mismatch, null cleaned if either side
  null, keeps earlier speaker, 400 on first block), regenerate with a fake
  `LlmClient` (candidate returned, DB untouched), PATCH with `cleanedRun` sets
  provenance (400 without `cleanedText`).
- `server/src/routes/speakers.test.ts` (new): rename, confirm role, 400/404.
- `server/src/routes/sessions.test.ts` (extend): reclean start/continue with a
  fake LLM (marks pending, cleans one batch, `remaining` counts down, resume
  after partial run), artifacts (summary + key-facts write the right columns),
  503 when no LLM client.
- `server/src/pipeline/process.test.ts` (extend): `recleanSessionBatch` and
  `generateBlockCandidate` against a fake LLM.
- `shared/src/index.test.ts`: `ROLE_VOCABULARY` re-export.
- Client: no component tests (M3 precedent); verification is the author's manual
  pass + the real-user (wife) test with feedback afterwards.

## Task split

1. Shared contracts (`shared/`) + `ROLE_VOCABULARY` move.
2. Pipeline entry points + repo methods + tests.
3. Routes (blocks extend, speakers, sessions extend) + `buildApp` LLM injection + tests.
4. Client typed API additions.
5. SpeakerPanel + block caption/reassign.
6. Regenerate popover + preview/apply + merge button.
7. Header LLM controls + re-clean-all + summary/key-facts cards.
8. Full gates green once → author review → closing commits.

## Out of scope (POC_M5+)

.docx export + options dialog (M5), session import UI, session delete/rename,
«new speaker» creation, merge undo, continuous follow-along playback, persisted
LLM dropdown defaults, word-level diffs.
