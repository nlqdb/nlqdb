---
name: ask-pipeline
description: /v1/ask orchestration: rate-limit → cache → LLM router → SQL allowlist → exec → summarize.
when-to-load:
  globs:
    - apps/api/src/ask/**
    - apps/api/src/routes/v1/ask*.ts
  topics: [ask, /v1/ask, natural-language, pipeline, orchestration]
---

# Feature: Ask Pipeline

**One-liner:** /v1/ask orchestration: rate-limit → cache → LLM router → SQL allowlist → exec → summarize.
**Status:** implemented
**Owners (code):** `apps/api/src/ask/**`, `apps/api/src/routes/v1/ask*.ts`
**Cross-refs:** docs/design.md §4 (ask pipeline) · docs/implementation.md ask slices · docs/performance.md §3

## Touchpoints — read this skill before editing

- `apps/api/src/ask/**`
- `apps/api/src/routes/v1/ask*.ts`

## Decisions

<!--
  Populate in wave 2 per docs/skill-conventions.md §4 (the five-field
  format) and §5 (duplicate relevant GLOBAL-NNN blocks verbatim with a
  Source: line back to docs/decisions.md).

  ID prefix for local decisions: SK-ASK-NNN.
  Sources to extract from: docs/design.md §4 (ask pipeline) · docs/implementation.md ask slices · docs/performance.md §3.
-->

_Decisions to be populated in wave 2._

## Open questions / known unknowns

- _To be enumerated in wave 2._
