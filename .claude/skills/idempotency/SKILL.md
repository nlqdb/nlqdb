---
name: idempotency
description: `Idempotency-Key` on every mutation; (user_id, key) dedupe store; byte-exact retry response.
when-to-load:
  globs:
    - apps/api/src/middleware/idempotency*.ts
    - packages/sdk/**
  topics: [idempotency, idempotency-key, retry, dedupe]
---

# Feature: Idempotency

**One-liner:** `Idempotency-Key` on every mutation; (user_id, key) dedupe store; byte-exact retry response.
**Status:** implemented
**Owners (code):** `apps/api/src/middleware/idempotency*.ts`, `packages/sdk/**`
**Cross-refs:** docs/design.md §7 (idempotency) · docs/implementation.md idempotency middleware · docs/decisions.md#GLOBAL-005

## Touchpoints — read this skill before editing

- `apps/api/src/middleware/idempotency*.ts`
- `packages/sdk/**`

## Decisions

<!--
  Populate in wave 2 per docs/skill-conventions.md §4 (the five-field
  format) and §5 (duplicate relevant GLOBAL-NNN blocks verbatim with a
  Source: line back to docs/decisions.md).

  ID prefix for local decisions: SK-IDEMP-NNN.
  Sources to extract from: docs/design.md §7 (idempotency) · docs/implementation.md idempotency middleware · docs/decisions.md#GLOBAL-005.
-->

_Decisions to be populated in wave 2._

## Open questions / known unknowns

- _To be enumerated in wave 2._
