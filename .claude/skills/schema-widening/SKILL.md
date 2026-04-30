---
name: schema-widening
description: Schemas only widen — `schema_hash` is monotonically extended, never branched.
when-to-load:
  globs:
    - packages/db/**
    - apps/api/src/ask/schema*.ts
  topics: [schema, schema_hash, widening, fingerprint]
---

# Feature: Schema Widening

**One-liner:** Schemas only widen — `schema_hash` is monotonically extended, never branched.
**Status:** implemented
**Owners (code):** `packages/db/**`, `apps/api/src/ask/schema*.ts`
**Cross-refs:** docs/design.md §6.2 (schema widening) · docs/decisions.md#GLOBAL-004

## Touchpoints — read this skill before editing

- `packages/db/**`
- `apps/api/src/ask/schema*.ts`

## Decisions

<!--
  Populate in wave 2 per docs/skill-conventions.md §4 (the five-field
  format) and §5 (duplicate relevant GLOBAL-NNN blocks verbatim with a
  Source: line back to docs/decisions.md).

  ID prefix for local decisions: SK-SCHEMA-NNN.
  Sources to extract from: docs/design.md §6.2 (schema widening) · docs/decisions.md#GLOBAL-004.
-->

_Decisions to be populated in wave 2._

## Open questions / known unknowns

- _To be enumerated in wave 2._
