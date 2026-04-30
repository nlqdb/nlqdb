---
name: rate-limit
description: Per-key, per-IP rate-limit middleware with X-RateLimit-* headers.
when-to-load:
  globs:
    - apps/api/src/middleware/rate-limit*.ts
  topics: [rate-limit, throttle, 429]
---

# Feature: Rate Limit

**One-liner:** Per-key, per-IP rate-limit middleware with X-RateLimit-* headers.
**Status:** implemented
**Owners (code):** `apps/api/src/middleware/rate-limit*.ts`
**Cross-refs:** docs/design.md §rate-limit · docs/implementation.md rate-limit slice

## Touchpoints — read this skill before editing

- `apps/api/src/middleware/rate-limit*.ts`

## Decisions

<!--
  Populate in wave 2 per docs/skill-conventions.md §4 (the five-field
  format) and §5 (duplicate relevant GLOBAL-NNN blocks verbatim with a
  Source: line back to docs/decisions.md).

  ID prefix for local decisions: SK-RL-NNN.
  Sources to extract from: docs/design.md §rate-limit · docs/implementation.md rate-limit slice.
-->

_Decisions to be populated in wave 2._

## Open questions / known unknowns

- _To be enumerated in wave 2._
