# Author Notebook

***This is a notebook like doc of the author. It holds ideas, toughts and reminders for further docs, implementaions, tools, behaviour, fixes, etc.***

## Session chat

 Full POC_M4 manual test list (app is running at http://localhost:3000):

 A. Speaker panel (people icon, top right)
 1. Panel opens/closes; shows all speakers.
 2. Rename a speaker → click outside (blur-saves) → reload page → name persists.
 3. Expand «Предложение: …» → reasoning text shows.
 4. Confirm a role from the dropdown (e.g. «Съдия») → «Потвърди» → block captions switch to the role.
 5. Type a free-text role (outside the list) → «Потвърди» works too.

 B. Speaker reassignment
 6. On a block, change the speaker via the dropdown → caption chip updates → reload → persists.

 C. Per-block regenerate
 7. ↻ on a block → popover pre-filled from the block's last run → «Генерирай» → preview appears below with provenance line.
 8. «Отказ» → preview vanishes, nothing changes.
 9. ↻ again → «Генерирай» → «Приложи» → new text replaces the old → reload → persists.

 D. Merge (the fixed bug)
 10. Click «Обедини с предишния блок» on a mid-list block → the block disappears and its text is appended in the block above (both layers).
 11. Play the merged block → audio covers both original segments.
 12. First block in the list → merge button is disabled.

 E. Re-clean all
 13. «Преизчисти всички блокове» → confirm dialog warns about manual edits → «Потвърди» → progress «Изчистване X/Y…», editing controls disabled
 during the run, texts update as batches finish.

 F. Резюме / Ключови факти (the fixed bug + the new formatting)
 14. Delete/regenerate: «Генерирай» → text appears (no more «LLM услугата не е конфигурирана»).
 15. Bold renders as bold, bullets as real nested lists — no ** or * characters visible.
 16. Reload → artifacts persist.

 G. M3 regression
 17. Edit cleaned + verbatim text (blur-saves, Escape reverts), «Дословен текст» toggle, per-block play/pause with highlight.