---
name: sql-allowlist
description: Safety boundary on LLM-generated SQL — what is allowed to execute.
when-to-load:
  globs:
    - apps/api/src/ask/sql-validate.ts
    - apps/api/src/ask/allowlist*.ts
  topics: [sql-allowlist, validation, safety, sanitization]
---

# Feature: Sql Allowlist

**One-liner:** Safety boundary on LLM-generated SQL — what is allowed to execute.
**Status:** implemented
**Owners (code):** `apps/api/src/ask/sql-validate.ts`, `apps/api/src/ask/allowlist*.ts`
**Cross-refs:** docs/design.md §4.5 (sql allowlist) · docs/implementation.md sql-allowlist slice

## Touchpoints — read this skill before editing

- `apps/api/src/ask/sql-validate.ts`
- `apps/api/src/ask/allowlist*.ts`

## Decisions

<!--
  Populate in wave 2 per docs/skill-conventions.md §4 (the five-field
  format) and §5 (duplicate relevant GLOBAL-NNN blocks verbatim with a
  Source: line back to docs/decisions.md).

  ID prefix for local decisions: SK-SQLAL-NNN.
  Sources to extract from: docs/design.md §4.5 (sql allowlist) · docs/implementation.md sql-allowlist slice.
-->

_Decisions to be populated in wave 2._

## Open questions / known unknowns

- _To be enumerated in wave 2._
