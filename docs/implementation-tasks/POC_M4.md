# POC_M4 — Speaker panel (roles/rename/reassign), regenerate, merge, LLM dropdowns

Branch: `POC_M4_speaker-panel-editing`. Approved plan:
`docs/implementation-plans/POC_M4.md` (discussion rounds 1–2, all recommendations
accepted). Plan commit: `6f0b4ea` (author-approved).

## Task state

| # | Task | State |
| --- | --- | --- |
| 1 | Shared contracts + `ROLE_VOCABULARY` move to `shared/` | ✅ done |
| 2 | Pipeline entry points (candidate / reclean-batch / artifact) + repo merge/pending methods + tests | ✅ done |
| 3 | Routes (blocks extend, speakers, sessions extend) + `buildApp` LLM injection + tests | ✅ done |
| 4 | Client typed API additions | ✅ done |
| 5 | SpeakerPanel + block caption/reassign | ✅ done |
| 6 | Regenerate popover + preview/apply + merge button | ✅ done |
| 7 | Header LLM controls + re-clean-all + summary/key-facts cards | ✅ done |
| 8 | Full gates green once → author review → closing commits | ✅ done (gates green; awaiting approval) |

## Design decisions

Settled in the plan doc (rounds 1–2, all ⭐ accepted). Key ones: regenerate is
preview-then-apply (candidate never persisted until «Приложи»); merge-with-previous
concatenates per layer, provenance kept only on exact match, ids not renumbered;
re-clean-all runs one batch per request with the client looping (blocking UI +
progress count); block caption = `confirmedRole ?? label`; summary/key-facts
display + generate land in M4.

## Validation

- Route tests via `fastify.inject` (fake LLM where needed): blocks PATCH extended
  (speaker reassign + cross-session guard + cleanedRun provenance), regenerate
  (candidate, DB untouched), merge (concat/union/provenance/speaker, 400/404);
  speakers PATCH (rename/confirm/free-text/400/404); reclean start/continue +
  artifacts (happy + 400/404); 503 on all LLM routes without a client.
- Pipeline tests: `generateBlockCandidate` persists nothing; `recleanSessionBatch`
  start/continue + provenance; `generateSessionArtifact` writes the session row.
- Repo tests: `mergeWithPrevious` (match/mismatch/null cases, earlier speaker,
  first-block/unknown null) + `markCleanupPending`.
- Full gates green once: lint 31.0s, tsc 10.8s, vitest 98/98 (73 → 98).
- Live smoke against real `data/`: server boot, session list, audio Range 206.
- Client: no component tests (M3 precedent) — the author's manual pass + the
  real-user test afterwards.

## Notes

- `buildApp(config, deps: { db, llm? })` — the deps bundle keeps the max-params
  budget; `index.ts` builds an `OpenRouterClient` only when the key is present.
- Re-clean mechanism: `POST /api/sessions/:id/reclean` cleans ONE batch per call
  (`mode: 'start' | 'continue'`); the client loops until `remaining === 0` and
  STOPS on a no-progress batch (model repeatedly omitting blocks) with an error.
- Merge keeps the earlier block's speaker and id; ids are not renumbered (gaps
  are fine — everything orders by `order_index`).
- Client files split to stay inside lint budgets: `DetailHeader`, `DetailBody`,
  `ArtifactCard`, `RecleanConfirmDialog`, `SpeakerPanel`, `EditableText`,
  `RegeneratePopover`, `CandidatePreview`, `useDetailActions`, `LlmControls`;
  `DEFAULT_LLM_RUN` in `client/src/llmRun.ts`, `toUserMessage` in
  `client/src/api/errors.ts`, `speakerDisplayName` in `client/src/format.ts`.
- Boolean props are `is*` per the naming-convention rule.
- **M5 requirement (author-confirmed):** the .docx export must map the artifact
  Markdown structure to Word formatting (bold runs, bullet lists, headings) so
  the export looks approximately like the UI — react-markdown's parser (remark)
  is the intended tool. UI rendering: `components/MarkdownText.tsx`.
- Manual-test fixes: merged blocks now show the combined text — `EditableText`
  is keyed by its saved value so external changes (merge/re-clean/apply) remount
  it (it intentionally has no prop→state sync). «LLM не е конфигурирана» during
  the first manual pass was a STALE dev server (Oct 16) holding port 3001 —
  tsx watch reloads code but never re-reads `--env-file`; a fresh `npm run dev`
  reports `openrouter: true` and a real regenerate call succeeded.
