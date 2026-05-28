---
name: byo-otel
description: Configure nlqdb's OTel exporter to ship to your own collector (Grafana Cloud / Honeycomb / Datadog / self-hosted) instead of nlqdb's default backend. Direction-to-pin before code lands.
when-to-load:
  globs:
    - packages/otel/**
    - apps/api/src/index.ts
  topics: [byo-otel, otlp, exporter, collector, observability-byo]
---

# Feature: BYO OTel Collectors

**One-liner:** Configurable OTLP endpoint per-tenant — nlqdb's emitted
spans/metrics/logs ship to the user's own OTel collector instead of
(or alongside) the nlqdb-owned backend.

**Status:** planned — direction-to-pin (see [Open question §1](#1-direction-blocks-all-other-decisions))
blocks code. Per [`CLAUDE.md`](../../../CLAUDE.md) `P4 / D1 / D2`,
vague decisions are worse than no decisions; this feature does not
promote to `Status: partial` until the open direction question is
resolved.

**Contribution to north-star:** UX (per
[`GLOBAL-019`](../../decisions/GLOBAL-019-apache2-open-source-core.md),
the open-source promise extends to "your telemetry, your backend";
users with an existing OTel stack should not need to re-instrument).

**Owners (code):** none yet — `packages/otel/**` and
`apps/api/src/index.ts` will carry the per-tenant exporter wiring
once direction is pinned.

**Cross-refs:** [`observability/FEATURE.md`](../observability/FEATURE.md)
(the canonical OTel emit catalog this feature configures the
destination of) ·
[`docs/research/otel-grafana-pivot.md`](../../research/otel-grafana-pivot.md)
(the *other* OTel direction — nlqdb as Grafana competitor — explicitly
out of scope here until §1 resolves) ·
[`GLOBAL-014`](../../decisions/GLOBAL-014-otel-on-external-calls.md) ·
[`GLOBAL-019`](../../decisions/GLOBAL-019-apache2-open-source-core.md) ·
[`GLOBAL-021`](../../decisions/GLOBAL-021-external-system-ownership.md)

## Touchpoints — read this feature before editing

- `packages/otel/src/index.ts` — exporter setup (today: hard-pinned to
  one OTLP endpoint via env var)
- `apps/api/src/index.ts` — per-request telemetry install + `forceFlush`
- D1 schema (planned) — per-tenant exporter config row
- `apps/web/src/pages/app/observability.astro` (planned) — UI for the
  per-account collector field

## Decisions

*TBD — gated on [Open question §1](#1-direction-blocks-all-other-decisions). Per
[`docs/feature-conventions.md §6`](../../feature-conventions.md), a
`planned` feature carries a placeholder until the direction is
resolved; SK-BYOTEL-NNN IDs are reserved but unwritten.*

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per
GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list
below names the rules that constrain this feature; feature-local
commentary is added once direction is pinned.

- **GLOBAL-014** — OTel span on every external call.
- **GLOBAL-019** — Free + Open Source core; Cloud is convenience, not a moat.
- **GLOBAL-021** — Each external system has one canonical owning module.

## Open questions / known unknowns

### §1. Direction (blocks all other decisions)

Two coherent interpretations of "BYO OTel collectors"; pick one
before any code lands. Per [`CLAUDE.md`](../../../CLAUDE.md) `P4 / D2`,
this stays unwritten until the question is answered.

- **(a) Egress — user-configurable OTLP exporter destination.**
  nlqdb's emitted telemetry (the existing
  [`observability/FEATURE.md`](../observability/FEATURE.md) catalog —
  `nlqdb.ask`, `db.query`, `llm.plan`, etc.) ships to the user's OTLP
  endpoint instead of (or alongside) the nlqdb-owned Grafana Cloud
  backend. Per-account config: OTLP endpoint URL + auth header +
  chosen signals (traces / metrics / logs). Small, additive, no
  storage cost to us; fits squarely under `GLOBAL-019`.

- **(b) Ingress — nlqdb accepts OTel telemetry FROM the user.**
  Scope of
  [`docs/research/otel-grafana-pivot.md`](../../research/otel-grafana-pivot.md)
  (Options A / B / C in that doc). Storage layer (ClickHouse-class)
  + OTLP receiver + retention/compaction become required platform
  infrastructure. This is a strategic pivot, not a feature.

(a) and (b) are not the same feature; they share the OTel namespace
and nothing else. **Resolve before promoting this feature out of
`planned`.**

### §2. Once §1 lands as (a)

- Per-DB or per-account? Probably per-account; per-DB explodes the
  config surface.
- Dual-emit (nlqdb backend + user collector) or replace? Dual-emit by
  default is honest — keeps support visibility — but doubles outbound
  fan-out per request; trade-off against the Workers free-tier
  subrequest budget.
- Sampling: does the user collector inherit
  [`SK-OBS-003`](../observability/FEATURE.md#sk-obs-003)'s path-aware
  sampling, or set its own?
- Auth-header secret-at-rest: same KEK envelope as BYO Postgres
  (`SK-DB-011`), or separate? Reuse keeps `GLOBAL-021` clean.

### §3. Once §1 lands as (b)

This feature folder is the wrong home; the existing
[`docs/research/otel-grafana-pivot.md` §5](../../research/otel-grafana-pivot.md)
promotion path applies — promote the pivot doc into a feature there,
not here, and retire this folder.
