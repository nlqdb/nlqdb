---
name: auth
description: Better Auth identity across all surfaces — sessions, refresh, device flow, GitHub/Google/magic-link.
when-to-load:
  globs:
    - apps/api/src/routes/auth/**
    - packages/auth-internal/**
  topics: [auth, session, login, refresh, device-flow, oauth, magic-link]
---

# Feature: Auth

**One-liner:** Better Auth identity across all surfaces — sessions, refresh, device flow, GitHub/Google/magic-link.
**Status:** implemented
**Owners (code):** `apps/api/src/routes/auth/**`, `packages/auth-internal/**`
**Cross-refs:** docs/design.md §3 (auth) · docs/implementation.md auth slices · docs/runbook.md §5 (auth setup)

## Touchpoints — read this skill before editing

- `apps/api/src/routes/auth/**`
- `packages/auth-internal/**`

## Decisions

<!--
  Populate in wave 2 per docs/skill-conventions.md §4 (the five-field
  format) and §5 (duplicate relevant GLOBAL-NNN blocks verbatim with a
  Source: line back to docs/decisions.md).

  ID prefix for local decisions: SK-AUTH-NNN.
  Sources to extract from: docs/design.md §3 (auth) · docs/implementation.md auth slices · docs/runbook.md §5 (auth setup).
-->

_Decisions to be populated in wave 2._

## Open questions / known unknowns

- _To be enumerated in wave 2._
