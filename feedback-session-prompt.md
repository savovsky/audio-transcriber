# Feedback session — real-user test of POC_M4 (delete at session close, per AGENTS.md conventions)

> Temp file: stays in the working tree for the feedback session; its deletion
> lands in that session's closing commit. The durable record is the tracker in
> `docs/implementation-tasks/`.

```text
I'm working on the audio-transcriber project (local web app: multi-hour Bulgarian
audio -> speaker-separated, reviewed, exportable transcripts).

Read first, in this order:
1. C:\work\personal\projects\audio-transcriber\AGENTS.md  (non-negotiable session rules)
2. C:\work\personal\projects\audio-transcriber\README.md  (session state, document map)
3. docs/04-poc-milestones.md (what is done vs what is left)
4. docs/implementation-tasks/POC_M4.md (what the real user just tested)
⛔ Never read docs/app-requirements/author_notebook.md.

This is a FEEDBACK session, not an implementation session. The real user (my wife)
has tested the POC_M4 editing workflow (speaker panel, regenerate, merge, re-clean
all, summary/key-facts with Markdown rendering). I will bring her feedback items.

Process (AGENTS.md rule 7 + the skills in .agents/skills/):
- Run EVERY item through the `feedback` skill: restate each item, recommend with
  options (⭐ first), cross-check against existing decisions and planned work,
  estimate effort 1-10, group heavy items into sub-tasks, and wait for my explicit
  "can I proceed" before changing anything.
- If feedback turns into new planned work (not a quick fix), use the
  `implementation-plan` skill for the architecture gate before any code.

State: POC_M1 ✅ POC_M2 ✅ POC_M3 ✅ POC_M4 ✅ (full editing workflow: speaker panel
with role confirm/rename/reassign, per-block regenerate preview-then-apply, block
merge, session re-clean-all, summary/key-facts rendered as Markdown via
react-markdown). Next milestone after this session: POC_M5 (.docx export + options
dialog) — NOTE the author-confirmed M5 requirement recorded in the POC_M4 tracker:
artifact Markdown must map to real Word formatting (bold runs, bullet lists,
headings) via remark so the export matches the UI.

Environment: OPENROUTER_API_KEY in .env (never log it). Real recordings only in
docs/test-examples/ and data/ (gitignored, never commit). UI language: Bulgarian only.

Closing procedure (AGENTS.md rules 1-5): full gates green ONCE (npm run gates) ->
present changes + manual test list -> my typed "approve" -> task commit -> hash
commit -> push. No git mutation without the typed approval.
```
