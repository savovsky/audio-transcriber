# AGENTS.md — Rules for AI Sessions

> **Non-negotiable session rules.** The code-writing AI must follow them; the author
> reviews against them. Ported from the openrebar project's rule set and adapted to
> this app.

## First steps in any session

1. Read `README.md` — it has the session state and the document map.
2. Read `docs/01-project-purpose.md`, `docs/02-tech-stack.md`, `docs/03-architecture.md`,
   and the milestone state in `docs/04-poc-milestones.md`.
3. **⛔ Do NOT read `docs/app-requirements/author_notebook.md`** — it is the author's
   private scratchpad. It is not project documentation and must never be used as
   context for any decision.

## Process rules

1. **Manual test list:** every task report ends with a list of what the author must
   test manually — never make him ask. A headless task's list is an explicit "none
   reachable in the UI yet" (with the reason) plus the regression smoke over the
   touched shared surfaces — never a silent omission.
2. **Author works in parallel — commit everything on approval:** the author may edit
   any file while a task is in progress; avoiding collisions is the author's
   responsibility. When the author approves a task, the commit includes ALL
   working-tree changes, not just the session's files. If an exact-match edit fails
   because of a parallel edit, re-read the file and adapt — never revert the author's
   changes.
3. **Closing a task — commit/push/next-session prompt:** the task commit is followed
   IMMEDIATELY by a small tracker-hash commit (a commit cannot contain its own hash).
   **NEVER amend.** Sequence on approval: gates green ONCE (no re-running) → task
   commit → hash-commit → push → the next-session prompt file lands in the
   hash-commit too.
4. **No git mutation without an explicit typed "approve":** file changes are ALWAYS
   presented in the session first (what was written / edited / deleted + a summary);
   the commit happens only after the author replies with an explicit approval
   ("approve" / "approved"). **Agreement with decisions or recommendations is NOT
   commit approval.** When in doubt: ask again. Asking 50 times is cheaper than one
   unauthorized push.
5. **Token economy — delegate + cheap gates per item:** delegate mechanical
   token-heavy work (multi-file exploration, gate runs, bulk verification) to
   subagents; the main context keeps reasoning, decisions, and edits. Per-item gates
   are CHEAP (`eslint --fix` on touched files + targeted vitest); the FULL gates
   (`npm run gates` = lint → tsc → vitest) run ONCE at the session/round close before
   the closing commit, never per item. Pipe noisy output through `tail`/`grep` so only
   verdict lines enter the context.

   **The workhorses (`.pi/agents/`, project-local):** the orchestrator (main session)
   writes fully-specified briefs; workhorses execute them literally — zero judgment
   calls, they NEVER commit, they report Completed/Files/Gates/Ambiguities. Two tiers,
   the orchestrator picks per link:
   - `workhorse` (deepseek-v4-flash) — MECHANICAL links: by-pattern mappers, import
     repointing, test additions from a brief, bulk exploration, batched gate digests.
   - `workhorse-heavy` (deepseek-v4-pro) — state-machine / resumability edge cases,
     SQLite schema work, timestamp/offset math, messy API-response shapes, debugging-
     adjacent links — where flash's litter costs more verification than pro's tokens.
   Delegation rules: judge every in-hand command by its FAILURE output (a red run dumps
   thousands of lines — delegate those; a green one-liner is free to run in-hand).
   Batch: ONE workhorse call returns ONE digest, not separate runs. Independent links
   run PARALLEL by default (chains only for true file dependencies). Invoke with
   `agentScope: "both"` so project agents are visible.
   Brief discipline (OpenRebar T10b/T11 lessons): ONE workhorse call = ONE coherent
   slice (never mix fixes with new test suites); the brief text lands in a temp file
   the worker reads (auditable, no truncation) and that file is deleted in the closing
   commit; the orchestrator re-verifies the briefed pins against the digest — a
   silently skipped pin once escaped into hands-on testing there.
6. **Answer typography — NO circled-number glyphs:** enumerations in chat answers use
   plain lettering (A. B. C. … or 1. 2. 3.), never Unicode circled numbers/letters.
   Applies to answers only; repo docs keep their own conventions.
7. **Use the skills:** design discussions go through the `discussion` skill, post-test
   feedback through the `feedback` skill, and new plans through the
   `implementation-plan` skill (see `.agents/skills/`).

## Architecture rules

1. **Dependency rule:** `routes → pipeline → (transcription | llm | export)`.
   Providers never import routes or each other; the pipeline talks to interfaces only.
2. **Dumb components:** React components render and call the typed API client. No
   pipeline, provider, or business logic in components.
3. **Data model first:** shared TypeScript types in `shared/src/` are defined before
    the server/client code that consumes them.
4. **Doors stay open:** before any structural decision, check the deferred/out-of-scope
    lists in `docs/01-project-purpose.md` and `docs/04-poc-milestones.md`.
5. **Nothing LLM-suggested is auto-applied:** speaker roles and cleanups are
    proposals until the user confirms them.

## Conventions

- **Milestones:** `POC_M1 … POC_M5`; git branches start with the milestone prefix,
  e.g. `POC_M1_chunking-deepgram`.
- **Privacy of content:** repo-tracked files (docs, code, commit messages) must stay
  free of personal and case-identifying details — generic domain language only.
  Real recordings live in the gitignored `docs/test-examples/` and `data/` folders.
- **UI language:** Bulgarian only. Code, comments, docs, commit messages: English.
- **Gates before review:** `npm run gates` must be green ONCE before the author
  reviews a task.
- **Session-prompt files** (temp, repo root, e.g. `poc-m2-session-prompt.md`): every
  task session ends with a ready-made prompt for the next task; the file is deleted at
  session close, its deletion landing in the closing commit.
