---
name: api-keys
description: Long-lived API keys for CI / MCP hosts; rotation, revocation, scoping.
when-to-load:
  globs:
    - apps/api/src/keys/**
    - packages/sdk/**
  topics: [api-key, credential, rotation, revocation, ci]
---

# Feature: Api Keys

**One-liner:** Long-lived API keys for CI / MCP hosts; rotation, revocation, scoping.
**Status:** implemented
**Owners (code):** `apps/api/src/keys/**`, `packages/sdk/**`
**Cross-refs:** docs/design.md §3 (api keys) · docs/implementation.md api-keys slice

## Touchpoints — read this skill before editing

- `apps/api/src/keys/**`
- `packages/sdk/**`

## Decisions

<!--
  Populate in wave 2 per docs/skill-conventions.md §4 (the five-field
  format) and §5 (duplicate relevant GLOBAL-NNN blocks verbatim with a
  Source: line back to docs/decisions.md).

  ID prefix for local decisions: SK-APIKEYS-NNN.
  Sources to extract from: docs/design.md §3 (api keys) · docs/implementation.md api-keys slice.
-->

_Decisions to be populated in wave 2._

## Open questions / known unknowns

- _To be enumerated in wave 2._
