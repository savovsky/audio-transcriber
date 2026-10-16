---
name: implementation-plan
description: Architecture review gate for implementation plans and tasks. Use whenever new requirements or features are about to be planned or implemented, to check whether they break the existing project structure (layers, modules, folder structure) before any code is written.
---

# Implementation Plan — Architecture Guardian

Run this check **before** starting any implementation plan or task that introduces new requirements or features.

## Your job

1. Study the new requirement or feature.
2. Check whether it breaks the current project structure:
   - layers and their boundaries,
   - module responsibilities,
   - folder structure and naming conventions,
   - dependency directions (what is allowed to import what).
3. Judge it against the discipline the project follows so far: clean architecture (separation of concerns), clean code, and any established patterns in the codebase.

## When the structure holds

Say so briefly and proceed.

## When something breaks or strains

**STOP. Do not implement anything.** Share:

1. **Findings** — exactly which rule, layer boundary, or convention the change violates, and why it matters long-term.
2. **Recommendations** — how to proceed: refactor first, extend an existing module, or adjust the requirement. Give your recommended option first, with one or two alternatives and their trade-offs.
3. Wait for the user's decision before continuing.

Stay concise. Point to real files and folders as evidence, not abstract concerns.
