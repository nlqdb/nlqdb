---
name: plan-cache
description: Content-addressed plan storage keyed by (schema_hash, query_hash).
when-to-load:
  globs:
    - apps/api/src/plan-cache/**
    - apps/api/src/ask/cache.ts
  topics: [plan-cache, schema_hash, query_hash, memoization]
---

# Feature: Plan Cache

**One-liner:** Content-addressed plan storage keyed by (schema_hash, query_hash).
**Status:** implemented
**Owners (code):** `apps/api/src/plan-cache/**`, `apps/api/src/ask/cache.ts`
**Cross-refs:** docs/design.md §4.3 (plan cache) · docs/implementation.md plan-cache slice

## Touchpoints — read this skill before editing

- `apps/api/src/plan-cache/**`
- `apps/api/src/ask/cache.ts`

## Decisions

<!--
  Populate in wave 2 per docs/skill-conventions.md §4 (the five-field
  format) and §5 (duplicate relevant GLOBAL-NNN blocks verbatim with a
  Source: line back to docs/decisions.md).

  ID prefix for local decisions: SK-PLAN-NNN.
  Sources to extract from: docs/design.md §4.3 (plan cache) · docs/implementation.md plan-cache slice.
-->

_Decisions to be populated in wave 2._

## Open questions / known unknowns

- _To be enumerated in wave 2._
