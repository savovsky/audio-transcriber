# POC_M4 — Speaker panel (roles/rename/reassign), regenerate, merge, LLM dropdowns

Branch: `POC_M4_speaker-panel-editing`. Approved plan:
`docs/implementation-plans/POC_M4.md` (discussion rounds 1–2, all recommendations
accepted).

## Task state

| # | Task | State |
| --- | --- | --- |
| 1 | Shared contracts + `ROLE_VOCABULARY` move to `shared/` | 🔵 in progress |
| 2 | Pipeline entry points (candidate / reclean-batch / artifact) + repo merge/pending methods + tests | ⬜ pending |
| 3 | Routes (blocks extend, speakers, sessions extend) + `buildApp` LLM injection + tests | ⬜ pending |
| 4 | Client typed API additions | ⬜ pending |
| 5 | SpeakerPanel + block caption/reassign | ⬜ pending |
| 6 | Regenerate popover + preview/apply + merge button | ⬜ pending |
| 7 | Header LLM controls + re-clean-all + summary/key-facts cards | ⬜ pending |
| 8 | Full gates green once → author review → closing commits | ⬜ pending |

## Design decisions

Settled in the plan doc (rounds 1–2, all ⭐ accepted). Key ones: regenerate is
preview-then-apply (candidate never persisted until «Приложи»); merge-with-previous
concatenates per layer, provenance kept only on exact match, ids not renumbered;
re-clean-all runs one batch per request with the client looping (blocking UI +
progress count); block caption = `confirmedRole ?? label`; summary/key-facts
display + generate land in M4.

## Validation

_(filled as tasks land)_

## Notes

_(filled as tasks land)_
