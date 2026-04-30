---
name: anonymous-mode
description: No-login first-value path across web / CLI / MCP; later attached to a Better Auth identity.
when-to-load:
  globs:
    - apps/web/**
    - cli/src/**
    - apps/api/src/middleware/anonymous*.ts
  topics: [anonymous, first-value, no-login, device]
---

# Feature: Anonymous Mode

**One-liner:** No-login first-value path across web / CLI / MCP; later attached to a Better Auth identity.
**Status:** partial
**Owners (code):** `apps/web/**`, `cli/src/**`, `apps/api/src/middleware/anonymous*.ts`
**Cross-refs:** docs/decisions.md#GLOBAL-007 · docs/personas.md · docs/design.md §anonymous

## Touchpoints — read this skill before editing

- `apps/web/**`
- `cli/src/**`
- `apps/api/src/middleware/anonymous*.ts`

## Decisions

<!--
  Populate in wave 2 per docs/skill-conventions.md §4 (the five-field
  format) and §5 (duplicate relevant GLOBAL-NNN blocks verbatim with a
  Source: line back to docs/decisions.md).

  ID prefix for local decisions: SK-ANON-NNN.
  Sources to extract from: docs/decisions.md#GLOBAL-007 · docs/personas.md · docs/design.md §anonymous.
-->

_Decisions to be populated in wave 2._

## Open questions / known unknowns

- _To be enumerated in wave 2._
