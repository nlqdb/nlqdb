---
name: events-pipeline
description: EVENTS_QUEUE producer + events-worker consumer that fans out to sinks (LogSnag, etc.).
when-to-load:
  globs:
    - apps/events-worker/**
    - packages/events/**
  topics: [events, queue, events-worker, sinks, logsnag]
---

# Feature: Events Pipeline

**One-liner:** EVENTS_QUEUE producer + events-worker consumer that fans out to sinks (LogSnag, etc.).
**Status:** implemented
**Owners (code):** `apps/events-worker/**`, `packages/events/**`
**Cross-refs:** docs/design.md §events · docs/implementation.md events slice · docs/runbook.md events section

## Touchpoints — read this skill before editing

- `apps/events-worker/**`
- `packages/events/**`

## Decisions

<!--
  Populate in wave 2 per docs/skill-conventions.md §4 (the five-field
  format) and §5 (duplicate relevant GLOBAL-NNN blocks verbatim with a
  Source: line back to docs/decisions.md).

  ID prefix for local decisions: SK-EVENTS-NNN.
  Sources to extract from: docs/design.md §events · docs/implementation.md events slice · docs/runbook.md events section.
-->

_Decisions to be populated in wave 2._

## Open questions / known unknowns

- _To be enumerated in wave 2._
