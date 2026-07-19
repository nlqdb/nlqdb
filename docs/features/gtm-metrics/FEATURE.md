---
name: gtm-metrics
description: Canonical GTM/PMF metric set — admin-gated live metrics endpoint, daily snapshots, and the /app/admin founder dashboard.
when-to-load:
  globs:
    - apps/api/src/admin/**
    - apps/web/src/pages/app/admin.astro
    - apps/web/src/components/admin/**
  topics: [gtm, pmf, metrics, funnel, admin, dashboard, acquisition]
---

# Feature: GTM Metrics

**One-liner:** Canonical GTM/PMF metric set — admin-gated live metrics endpoint, daily snapshots, and the `/app/admin` founder dashboard.
**Status:** implemented (2026-07-19 — endpoint + snapshots + dashboard v1; external sources stay out of scope, see Open questions)
**Owners (code):** `apps/api/src/admin/**`, `apps/api/migrations/0022_gtm_snapshots.sql`, `apps/web/src/pages/app/admin.astro`, `apps/web/src/components/admin/**`

**Contribution to north-star:** Onboarding — the funnel/activation/retention numbers ARE the onboarding pillar's measurement (TTFV cousins, first-10 success, retention per [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md)), now continuously measured instead of hand-pulled; per [`GLOBAL-038`](../../decisions/GLOBAL-038-gtm-pmf-instrumentation.md) acquisition measurement is additionally first-class. No other pillar degrades: the endpoint is admin-only D1 reads off the request path of every product surface.

**Cross-refs:** [`GLOBAL-038`](../../decisions/GLOBAL-038-gtm-pmf-instrumentation.md) · `docs/scorecard.md` funnel rows #1–#5 · [`onboarding`](../onboarding/FEATURE.md) (`SK-ONBOARD-006` first10 counters) · [`anonymous-mode`](../anonymous-mode/FEATURE.md) (adoption) · [`events-pipeline`](../events-pipeline/FEATURE.md) (PostHog behavioral layer)

## Touchpoints — read this feature before editing

- `apps/api/src/admin/**` (gate + metric definitions + snapshots)
- `apps/web/src/pages/app/admin.astro`, `apps/web/src/components/admin/**`

## Decisions

### SK-GTM-001 — One module owns the metric definitions, including the internal-email split

- **Decision:** Every GTM/PMF metric is defined once, in
  `apps/api/src/admin/gtm-metrics.ts` (`computeGtmMetrics`), reading only
  the control-plane D1. The **population split is part of the metric**:
  every headline number reports real strangers separately from
  founder/test accounts, using the `INTERNAL_EMAIL` patterns in that
  module (`omer@salfati.group`, `omer.hochman@*`, `*@nlqdb.com`,
  `*@example.com`, `*@preview.dev`). Metric set v1: signups (total /
  real, by day), anon funnel (anon DBs, adoptions, adoption rate),
  activation (`first10_asks > 0` started, `first10_ok > 0` activated,
  first-10 success rate — `SK-ONBOARD-006`'s canonical query), retention
  (active 7d/30d, real users active ≥ 7 days after signup, `first10_asks
  ≥ 2` depth), PMF proxies (`premium_interest`, paying `customers` by
  status, Sean-Ellis gate = runnable once ≥ 10 activated real strangers).
- **Core value:** Simple, Bullet-proof
- **Why:** The scorecard's "most active user is your test suite" lesson:
  a metric that doesn't name its population measures your robots. Before
  this module the exclusion list lived in prose (scorecard row #2) and
  was re-typed per pull — one canonical SQL/TS home means the dashboard,
  the loops, and the scorecard cannot drift apart.
- **Consequence in code:** New metrics land as fields in
  `computeGtmMetrics` (additive; never repurpose a field), with the
  stranger/internal split applied wherever a `user.email` join exists.
  Reviewers reject GTM SQL re-derived outside this module (loop prompts
  and scorecard pulls should read the endpoint). Timestamp units are
  normalized here — `user.createdAt` TEXT ISO-8601, `databases.*`
  unixepoch seconds, `chat_message.created_at` milliseconds — callers
  never see the mismatch.
- **Alternatives rejected:**
  - Per-surface SQL (dashboard + scorecard + loops each query D1) —
    guaranteed definition drift; exactly the hand-pull status quo.
  - Excluding internal accounts at write time (don't record founder
    traffic) — destroys the ops/debug value of the raw rows; read-time
    filtering is reversible.

### SK-GTM-002 — Admin gate: exact founder allowlist + `@nlqdb.com` domain, server-side only

- **Decision:** `isAdminEmail(email)` in `apps/api/src/admin/gate.ts` is
  the only authorization predicate for admin surfaces: case-insensitive
  match against the exact allowlist (`omer@salfati.group`) or the
  `nlqdb.com` email domain. `GET /v1/admin/metrics` runs it after
  `requireSession` (cookie session only — an `sk_live_`/`pk_live_`/anon
  bearer can never reach admin data) and returns `403 {error:
  "forbidden"}` for a signed-in non-admin. The static `/app/admin/` page
  repeats the check client-side for UX only (redirect), via
  `apps/web/src/lib/admin-gate.ts` — a documented presentation-copy of
  the API predicate, never a security boundary.
- **Core value:** Seamless auth, Bullet-proof, Simple
- **Why:** `apps/web` ships as static assets with no server middleware
  (`SK-WEB-001`), so the page itself cannot enforce anything — the data
  boundary must be the API. Sign-in methods are OAuth/magic-link only
  (`SK-AUTH-002`), so a session email is a verified identity; domain
  matching on `@nlqdb.com` admits future teammates with zero code
  change, and the exact allowlist covers the founder's personal domain.
- **Consequence in code:** Any future admin endpoint reuses
  `requireSession` + `isAdminEmail` — reviewers reject a second
  predicate or a `requirePrincipal`-based admin route. The gate returns
  403 (not 404): the route is documented in-repo, hiding it buys
  nothing. Changes to the allowlist are code-reviewed constants, not
  env vars.
- **Alternatives rejected:**
  - A `role` column on `user` — schema + backfill for two constants;
    revisit only if non-email-domain admins appear.
  - 404 for non-admins — obscurity with a debugging cost; the gate is
    the security, not the status code.
  - Client-side gate only — the page is a static asset; anyone can read
    the JS. Rejected outright.

### SK-GTM-003 — Daily `gtm_snapshots` rows make progress observable; written by cron AND on authorized reads

- **Decision:** Migration `0022_gtm_snapshots.sql` adds `gtm_snapshots
  (day TEXT PRIMARY KEY, metrics_json TEXT, created_at)`. A headline
  subset of `computeGtmMetrics` is written as an `INSERT OR IGNORE`
  per-UTC-day row from two triggers: the existing daily `scheduled()`
  cron (`0 4 * * *` branch, best-effort, before the Tinybird
  early-return) and — belt-and-braces — a `waitUntil` write on every
  authorized `GET /v1/admin/metrics`. The endpoint returns up to 90
  snapshot rows so the dashboard renders trends.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** D1 holds only current state; without an append-only daily
  row, "are we making progress?" is unanswerable next month. INSERT OR
  IGNORE keyed on the UTC day makes both writers race-safe and
  idempotent; the on-read write means history accrues even across cron
  outages (and costs one no-op write per dashboard view). JSON payload
  keeps the shape additive (`SK-EVENTS-002`'s schema-evolution lesson)
  without a migration per new metric.
- **Consequence in code:** Snapshot JSON fields are additive-only; a
  renamed/retyped field needs a new key, old keys stay readable. The
  cron write must never throw past its try/catch (a snapshot miss can't
  break the sweep or analyser). Rows are never updated or deleted —
  the first write of a day wins.
- **Alternatives rejected:**
  - Reconstruct trends from PostHog later — different population
    (events, client-blockable) than D1 truth; the numbers would never
    reconcile with the scorecard.
  - One column per metric — a migration per new metric; JSON + additive
    keys is the `ProductEvent` lesson applied to storage.
  - Cron-only writes — a single missed cron leaves a hole; the on-read
    write is free insurance.

### SK-GTM-004 — Founder dashboard at `/app/admin/`; deliberately not in SDK/CLI/MCP/elements

- **Decision:** `/app/admin/` is an Astro page following the `keys.astro`
  pattern (client session guard + hidden shell) mounting the
  `AdminDashboard.tsx` island (ErrorBoundary-wrapped per `SK-WEB-001`,
  calm tokens per `SK-WEB-020`, no chart library — inline SVG
  sparklines/bars only). It fetches `GET /v1/admin/metrics` with
  `credentials: "include"` via a small `lib` helper (the
  `lib/billing.ts` precedent for web-internal endpoints). Per
  [`GLOBAL-003`](../../decisions/GLOBAL-003-all-surfaces-one-pr.md) this
  capability is **deliberately web-only**: it is internal founder
  tooling, not a user capability — the SDK/CLI/MCP/elements gap is a
  decision, not an omission.
- **Core value:** Simple, Free, Goal-first
- **Why:** The founder's question is "show me progress", answered
  fastest by one always-current page; shipping admin verbs into four
  public surfaces would advertise an endpoint 99.9% of callers can only
  403 on. No chart dependency keeps the island small and the static
  build clean.
- **Consequence in code:** No admin methods in `packages/sdk`, `cli`,
  `packages/mcp`, or `packages/elements`; reviewers reject adding them
  without superseding this decision. No nav link from shared chrome
  (`Topnav` is static and public) — the page is reached by URL; a
  session-gated link may land later inside `/app` chrome only.
- **Alternatives rejected:**
  - SDK method + CLI verb (`nlq admin metrics`) — public API surface
    for a two-person audience; GLOBAL-003 exists for user capabilities.
  - A chart library (recharts/d3) — bundle + design drift for four
    sparklines; the calm token system covers it.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the line.

- **GLOBAL-038** — GTM/PMF instrumentation is first-class; this feature is its implementation.
- **GLOBAL-003** — New capability ships to all surfaces or the gap is annotated. *In this feature:* web-only by decision (`SK-GTM-004`).
- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`. *In this feature:* the only route is a GET (exempt); the snapshot write is idempotent by primary key.
- **GLOBAL-013** — $0/month free tier. *In this feature:* D1-only reads, no new vendor, one small island.
- **GLOBAL-014** — OTel span on every external call. *In this feature:* the handler wraps in `nlqdb.admin.metrics`; the cron snapshot logs `gtm_snapshot_*`.
- **GLOBAL-025** — North-star KPIs. *In this feature:* activation/retention read `SK-ONBOARD-006`'s counters verbatim — same numbers, now continuous (amended in part by GLOBAL-038).
- **GLOBAL-034** — Analytics stack. *In this feature:* D1 truth here; behavioral funnels/TTFV stay PostHog's job.

## Open questions / known unknowns

- **External sources on the dashboard (CF Web Analytics visits, GSC clicks/impressions)** — Parked until the D1-derived dashboard proves daily use. Both need operator tokens (`CF_ANALYTICS_TOKEN`, GSC service account) mirrored into the Worker; the v1 dashboard names the gap honestly (visits row links to the scorecard method) rather than proxying half-configured sources.
- **Signup source attribution (referrer/UTM captured at anon-create/signup)** — Parked until stranger signups > 0 make attribution answerable. PostHog client capture on `/app` (`SK-WEB-024`) already records initial referrer for signed-in flows; a first-party `signup_source` column is the follow-up slice if PostHog's view proves insufficient.
- **Loop integration** — the `/daily` scorecard funnel pull can switch from remote-D1 SQL to `GET /v1/admin/metrics` (founder session or a read token TBD); decide when a loop prompt next touches the funnel rows.
