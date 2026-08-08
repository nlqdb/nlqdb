---
name: gtm-metrics
description: Canonical GTM/PMF metric set — admin-gated live metrics endpoint, daily snapshots, and the /app/admin founder dashboard.
when-to-load:
  globs:
    - apps/api/src/admin/**
    - apps/api/src/pmf-survey.ts
    - apps/web/src/pages/app/admin.astro
    - apps/web/src/components/admin/**
    - apps/web/src/lib/attribution.ts
    - apps/web/src/lib/pmf-survey.ts
    - apps/web/src/components/chat/PmfSurveyCard.tsx
  topics: [gtm, pmf, metrics, funnel, admin, dashboard, acquisition, attribution, utm, survey, sean-ellis]
---

# Feature: GTM Metrics

**One-liner:** Canonical GTM/PMF metric set — admin-gated live metrics endpoint, daily snapshots, and the `/app/admin` founder dashboard.
**Status:** implemented (2026-07-19 — endpoint + snapshots + dashboard v1; `SK-GTM-005`/`-006`/`-007` unique-people counts / Sean-Ellis survey / attribution; `SK-GTM-008` the SK-PIVOT-016 launch-gate section, 2026-07-28; `SK-GTM-009` paying-customer watchlist, 2026-08-08; external sources out of scope — see Open questions)
**Owners (code):** `apps/api/src/admin/**`, `apps/api/src/synthetic-ua.ts`, `apps/api/src/pmf-survey.ts`, `apps/api/migrations/0022_gtm_snapshots…0025_pmf_survey.sql` + `0027_customers_converted_at.sql`, `apps/web/src/pages/app/admin.astro`, `apps/web/src/components/admin/**`, `apps/web/src/lib/attribution.ts`, `apps/web/src/lib/pmf-survey.ts`, `apps/web/src/components/chat/PmfSurveyCard.tsx`

**Contribution to north-star:** Onboarding — the funnel/activation/retention numbers ARE the onboarding pillar's measurement ([`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md)), now continuous; acquisition measurement is first-class ([`GLOBAL-038`](../../decisions/GLOBAL-038-gtm-pmf-instrumentation.md)). No pillar degrades: admin-only D1 reads, off every product request path.

**Cross-refs:** `docs/scorecard.md` funnel rows #1–#5 · [`onboarding`](../onboarding/FEATURE.md) (`SK-ONBOARD-006` counters) · [`anonymous-mode`](../anonymous-mode/FEATURE.md) · [`events-pipeline`](../events-pipeline/FEATURE.md) (PostHog) · [`agent-memory-pivot`](../agent-memory-pivot/decisions/SK-PIVOT-016-dogfood-launch-gate.md) (the gate `SK-GTM-008` mirrors)

## Touchpoints — read this feature before editing

Non-obvious path: `apps/web/src/lib/attribution.ts` captures the SK-GTM-007 first touch, persisted via `/v1/ask`.

## Decisions

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-GTM-NNN`
(the feature-conventions §4a sharded layout, adopted when `FEATURE.md` reached
D4's 20 KB cap). The list below is the index; open the linked file for the full
five-field block.

- [**SK-GTM-001**](decisions/SK-GTM-001-one-module-owns-metric-definitions.md) — One module owns the metric definitions, including the internal-email split
- [**SK-GTM-002**](decisions/SK-GTM-002-admin-gate.md) — Admin gate: exact founder allowlist + `@nlqdb.com` domain, server-side only
- [**SK-GTM-003**](decisions/SK-GTM-003-daily-snapshots.md) — Daily `gtm_snapshots` rows make progress observable; written by cron + on-read
- [**SK-GTM-004**](decisions/SK-GTM-004-founder-dashboard.md) — Founder dashboard at `/app/admin/`; deliberately not in SDK/CLI/MCP/elements
- [**SK-GTM-005**](decisions/SK-GTM-005-synthetic-traffic-flag.md) — Synthetic traffic is stamped at DB create; unique-people counts exclude it
- [**SK-GTM-006**](decisions/SK-GTM-006-sean-ellis-in-product-survey.md) — Sean-Ellis Q1 ships as an in-product one-click survey, asked once per account on an eligible return visit
- [**SK-GTM-007**](decisions/SK-GTM-007-first-touch-attribution.md) — First-touch attribution: one localStorage slot, persisted on the created DB row
- [**SK-GTM-008**](decisions/SK-GTM-008-launch-gate-section.md) — The launch-gate section renders live-from-D1 or static-with-as-of, never an estimate
- [**SK-GTM-009**](decisions/SK-GTM-009-paying-customer-watchlist.md) — Paying-customer watchlist: per-customer drill-down, built ahead of the first conversion

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (index in [`docs/decisions.md`](../../decisions.md)); feature-local commentary is nested under each line.

- **GLOBAL-038** — GTM/PMF instrumentation is first-class; this feature is its implementation.
- **GLOBAL-003** — New capability ships to all surfaces or the gap is annotated. *In this feature:* web-only by decision (`SK-GTM-004`).
- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`. *In this feature:* the metrics GET is exempt; the snapshot write and `POST /v1/pmf-survey` are idempotent by primary key (SK-IDEMP-005, constant body).
- **GLOBAL-013** — $0/month free tier.
- **GLOBAL-014** — OTel span on every external call. *In this feature:* the handler wraps in `nlqdb.admin.metrics`; the cron snapshot logs `gtm_snapshot_*`.
- **GLOBAL-025** — North-star KPIs. *In this feature:* activation/retention read `SK-ONBOARD-006`'s counters verbatim, now continuous (amended in part by GLOBAL-038).
- **GLOBAL-034** — Analytics stack. *In this feature:* D1 truth; behavioral funnels/TTFV stay PostHog's.

## Open questions / known unknowns

- **External sources (CF Web Analytics visits, GSC clicks/impressions)** — Parked until the D1 dashboard proves daily use; both need operator tokens (`CF_ANALYTICS_TOKEN`, GSC service account) in the Worker, so v1 names the gap rather than proxy half-configured sources.
- **Loop integration — Resolved (`GLOBAL-033`).** `GET /v1/admin/metrics` is the canonical read (`gtm-metrics.ts` forbids re-derived SQL in loop prompts), but it is `requireSession` + `isAdminEmail`-gated (`SK-GTM-002`) with no token path — so an agent-run `/daily` can't call it without a new admin-token auth surface, which GLOBAL-033 says not to build on spec: remote-D1 is a working equivalent whose row-#2 exclusion list mirrors `INTERNAL_EMAIL_SQL` (no drift). **Parked until** a founder automation needs the endpoint.
- **No ask counter can answer `SK-PIVOT-016` criterion 1 (`SK-GTM-008`)** — the gate wants "≥ 100 real asks *through the public MCP surface*", and D1 carries **neither** a total-ask counter per DB (`databases.first10_asks` saturates at 10 by design, `SK-ONBOARD-006`) **nor** any per-ask surface attribution (`source_json` is a create-time first touch; MCP/CLI/SDK creates record `untracked`). So the dashboard renders a labeled lower bound, never the criterion. Closing it needs one saturating-free counter split by surface — smallest honest shape: `databases.asks_total` + `asks_mcp` bumped where `first10_*` already is, off the response path. **Owned by D-04** (the slice that first produces the volume).
- **Adoption-rate denominator understates the true anon-DB base** — `adoptionRate = adopted / (live anon DBs + adopted)`, but the `SK-ANON-002` sweep deletes abandoned anon DBs and adoption re-tenants off `anon:%`, so the rate slightly overstates. Exact share needs an append-only anon-created counter; parked until anon volume makes the gap material.
