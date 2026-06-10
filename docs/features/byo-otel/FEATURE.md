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
destination); configuration model resolved per
[`SK-BYOTEL-002`](#sk-byotel-002). No code yet — slice 1 is now wiring,
parked until a user with an existing OTel stack asks (or the Phase 2 BYO
slice, whichever first).

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
  auth-header secret-at-rest envelope are resolved by
  [`SK-BYOTEL-002`](#sk-byotel-002).
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

### SK-BYOTEL-002 — Egress configuration model: per-account, dual-emit default, inherit `SK-OBS-003` sampling, reuse the `SK-DB-011` KEK envelope

- **Decision:** The four slice-1 design forks resolve from the values
  (`GLOBAL-033`), so slice 1 is wiring, not a fresh design pass:
  **(a) per-account**, not per-DB — one `otel_exporter_config` row keyed
  on the account; **(b) dual-emit by default** (nlqdb backend + the
  user's collector), with a per-account `replace` toggle to send only to
  the user's collector; **(c) the user collector inherits**
  [`SK-OBS-003`](../observability/FEATURE.md#sk-obs-003)'s path-aware
  sampling — no second sampling vocabulary; **(d) the auth header reuses
  the [`SK-DB-011`](../db-adapter/decisions/SK-DB-011-byo-postgres-promoted.md)
  KEK envelope** for secret-at-rest.
- **Core value:** Simple, Effortless UX, Bullet-proof
- **Why:** Each fork has one answer the values already fix
  (`GLOBAL-033`): per-account because per-DB explodes the config surface
  for a need no user has voiced (Simple); dual-emit because it keeps
  nlqdb's support visibility (Honest) and the cost is ~1 extra batched
  export per `forceFlush`, far inside the Workers 50-subrequest budget
  (`GLOBAL-013`); inherit sampling because one sampling rule across both
  destinations is the "one way to do each thing" default (Simple) and a
  per-collector knob is a parallel config to maintain for no asked-for
  benefit; reuse the KEK envelope because `GLOBAL-021` wants one canonical
  envelope for tenant secrets — a second one is drift.
- **Consequence in code:** `otel_exporter_config` is a per-account D1 row
  (`{ endpoint, auth_header_sealed, signals, mode: "dual" | "replace" }`).
  `packages/otel/src/index.ts` reads it and composes a second OTLP
  exporter behind the existing path-aware sampler; `apps/api/src/index.ts`
  selects it off the principal's account. The auth header seals/unseals
  through the same KEK path as `SK-DB-011`. No per-DB column, no
  per-collector sampler config.
- **Alternatives rejected:**
  - **Per-DB config** — config-surface explosion for a need no user has
    voiced; revisit only if a user wants different collectors per DB.
  - **Replace-only (drop nlqdb's copy)** — loses support visibility,
    which is the honest default; offered as an opt-in toggle instead.
  - **Independent per-collector sampling** — a second sampling vocabulary
    to maintain and reason about; violates Simple.
  - **A new secret envelope for the auth header** — second canonical
    owner for tenant secrets; violates `GLOBAL-021`.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per
GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list
below names the rules that constrain this feature; feature-local
commentary is added once direction is pinned.

- **GLOBAL-014** — OTel span on every external call.
- **GLOBAL-019** — Free + Open Source core; Cloud is convenience, not a moat.
- **GLOBAL-021** — Each external system has one canonical owning module.

## Open questions / known unknowns

- **Slice-1 build — Parked until a user with an existing OTel stack
  asks** (or the Phase 2 BYO slice, whichever first). Direction
  (`SK-BYOTEL-001`) and the full configuration model (`SK-BYOTEL-002`)
  are locked, so the slice is wiring against `otel_exporter_config`, not
  a fresh design pass.
