---
name: stripe-billing
description: Stripe webhook ingest, subscription state, idempotent processing, R2 archive.
when-to-load:
  globs:
    - apps/api/src/billing/**
    - apps/api/src/routes/webhooks/stripe*.ts
  topics: [stripe, billing, webhook, subscription, r2-archive]
---

# Feature: Stripe Billing

**One-liner:** Stripe webhook ingest, subscription state, idempotent processing, R2 archive.
**Status:** implemented
**Owners (code):** `apps/api/src/billing/**`, `apps/api/src/routes/webhooks/stripe*.ts`
**Cross-refs:** docs/design.md §billing · docs/implementation.md stripe slice · docs/runbook.md stripe section

## Touchpoints — read this skill before editing

- `apps/api/src/billing/**`
- `apps/api/src/routes/webhooks/stripe*.ts`

## Decisions

<!--
  Populate in wave 2 per docs/skill-conventions.md §4 (the five-field
  format) and §5 (duplicate relevant GLOBAL-NNN blocks verbatim with a
  Source: line back to docs/decisions.md).

  ID prefix for local decisions: SK-STRIPE-NNN.
  Sources to extract from: docs/design.md §billing · docs/implementation.md stripe slice · docs/runbook.md stripe section.
-->

_Decisions to be populated in wave 2._

## Open questions / known unknowns

- _To be enumerated in wave 2._
