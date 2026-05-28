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

**Status:** partial — direction pinned to **egress** per
[`SK-BYOTEL-001`](#sk-byotel-001) (user-configurable OTLP exporter
destination). Configuration model + dual-emit + sampling inheritance
are the next-up sub-decisions, captured under
[Open questions §2](#2-egress-design-sub-questions). No code yet —
slice 1 lands once those resolve.

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

### SK-BYOTEL-001 — Direction is egress: nlqdb's emitted telemetry ships to the user's OTLP endpoint when configured

- **Decision:** "BYO OTel collectors" is **egress** — a per-tenant
  configurable OTLP exporter destination for the telemetry nlqdb
  already emits per
  [`observability/FEATURE.md`](../observability/FEATURE.md). When a
  tenant configures an OTLP endpoint + auth header + signal toggles
  (traces / metrics / logs), nlqdb's exporter ships there; when
  unset, telemetry continues to the nlqdb-owned default backend.
  **Ingress (nlqdb receives the user's telemetry — the
  [`otel-grafana-pivot.md`](../../research/otel-grafana-pivot.md)
  scope) is explicitly NOT this feature**; it remains a strategic
  pivot under that doc's promotion path.
- **Core value:** Open source, Effortless UX, Bullet-proof
- **Why:**
  [`GLOBAL-019`](../../decisions/GLOBAL-019-apache2-open-source-core.md)
  reads cleanest in the egress direction — the open-source promise
  extends to "your telemetry, your backend." Users with an existing
  OTel stack (Grafana Cloud, Honeycomb, Datadog, self-hosted) should
  not need to re-instrument or operate two parallel telemetry pipes
  to use nlqdb. Ingress is a fundamentally different product
  (ClickHouse-class storage + OTLP receiver + retention/compaction
  per the pivot doc); conflating the two would muddy both. Pinning
  direction unblocks the configuration-model slice.
- **Consequence in code:** Slice 1 (planned) lands a per-tenant
  `otel_exporter_config` row, reads it in `packages/otel/src/index.ts`,
  and lets `apps/api/src/index.ts` select the per-request exporter
  off the principal. The configuration unit (per-DB vs per-account),
  dual-emit-vs-replace behavior, sampling inheritance from
  [`SK-OBS-003`](../observability/FEATURE.md#sk-obs-003), and
  auth-header secret-at-rest envelope are sub-decisions tracked in
  [Open questions §2](#2-egress-design-sub-questions) — slice 1 PR
  resolves them.
- **Alternatives rejected:**
  - **Ingress (nlqdb receives user telemetry).** Different product
    (storage + receiver + retention). Routed to the
    [`otel-grafana-pivot.md`](../../research/otel-grafana-pivot.md)
    §5 promotion path.
  - **Both (egress + ingress in one feature).** Doubles surface and
    confuses positioning. If ingress ever ships, it's a separate
    feature folder.
  - **Leave as `planned` stub.** Both interpretations had distinct
    answers; the direction question was resolvable on principle
    (`GLOBAL-019`) without waiting for traffic. Per D1, resolve
    open questions; per D3, clarity always increases.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per
GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list
below names the rules that constrain this feature; feature-local
commentary is added once direction is pinned.

- **GLOBAL-014** — OTel span on every external call.
- **GLOBAL-019** — Free + Open Source core; Cloud is convenience, not a moat.
- **GLOBAL-021** — Each external system has one canonical owning module.

## Open questions / known unknowns

### §1. Direction — resolved

Resolved by [`SK-BYOTEL-001`](#sk-byotel-001): direction is **egress**.
The ingress alternative remains the
[`otel-grafana-pivot.md`](../../research/otel-grafana-pivot.md) §5
promotion path, not this feature.

### §2. Egress design sub-questions

Slice 1 PR resolves these:

- **Per-DB or per-account?** Lean per-account — per-DB explodes the
  config surface and almost no user wants different collectors per
  DB.
- **Dual-emit (nlqdb backend + user collector) or replace?** Dual-emit
  by default is honest — keeps support visibility — but doubles
  outbound fan-out per request; trade-off against the Workers
  free-tier 50-subrequest budget.
- **Sampling inheritance.** Does the user collector inherit
  [`SK-OBS-003`](../observability/FEATURE.md#sk-obs-003)'s path-aware
  sampling (100% cache-miss / 1% cache-hit / 0% health / 100% 5xx),
  or set its own?
- **Auth-header secret-at-rest envelope.** Lean reuse the same KEK
  envelope as
  [`SK-DB-011`](../db-adapter/decisions/SK-DB-011-byo-postgres-promoted.md)
  — keeps [`GLOBAL-021`](../../decisions/GLOBAL-021-external-system-ownership.md)
  clean (one canonical envelope for tenant secrets).
