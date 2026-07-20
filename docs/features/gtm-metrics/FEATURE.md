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
**Status:** implemented (2026-07-19 — endpoint + snapshots + dashboard v1; `SK-GTM-005` unique-people counts, `SK-GTM-007` attribution, `SK-GTM-006` Sean-Ellis survey; external sources out of scope — see Open questions)
**Owners (code):** `apps/api/src/admin/**`, `apps/api/src/synthetic-ua.ts`, `apps/api/src/pmf-survey.ts`, `apps/api/migrations/00{22_gtm_snapshots,23_synthetic_traffic_flag,24_databases_source,25_pmf_survey}.sql`, `apps/web/src/pages/app/admin.astro`, `apps/web/src/components/admin/**`, `apps/web/src/lib/attribution.ts`, `apps/web/src/lib/pmf-survey.ts`, `apps/web/src/components/chat/PmfSurveyCard.tsx`

**Contribution to north-star:** Onboarding — the funnel/activation/retention numbers ARE the onboarding pillar's measurement (per [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md)), now continuous instead of hand-pulled; acquisition measurement is first-class per [`GLOBAL-038`](../../decisions/GLOBAL-038-gtm-pmf-instrumentation.md). No other pillar degrades: admin-only D1 reads, off every product surface's request path.

**Cross-refs:** [`GLOBAL-038`](../../decisions/GLOBAL-038-gtm-pmf-instrumentation.md) · `docs/scorecard.md` funnel rows #1–#5 · [`onboarding`](../onboarding/FEATURE.md) (`SK-ONBOARD-006` counters) · [`anonymous-mode`](../anonymous-mode/FEATURE.md) · [`events-pipeline`](../events-pipeline/FEATURE.md) (PostHog)

## Touchpoints — read this feature before editing

Paths: see **Owners (code)** above. Non-obvious: `apps/web/src/lib/attribution.ts` captures the SK-GTM-007 first touch, persisted via `/v1/ask`.

## Decisions

### SK-GTM-001 — One module owns the metric definitions, including the internal-email split

- **Decision:** Every GTM/PMF metric is defined once, in
  `apps/api/src/admin/gtm-metrics.ts` (`computeGtmMetrics`), reading only
  the control-plane D1. The **population split is part of the metric**:
  every headline number reports real strangers separately from
  founder/test accounts, via the `INTERNAL_EMAIL` patterns
  (`omer@salfati.group`, `omer.hochman@*`, `*@nlqdb.com`, `*@example.com`,
  `*@preview.dev`). Metric set v1 (full shape = the `GtmMetrics` type):
  signups, anon funnel, activation (`SK-ONBOARD-006`'s first-10 counters),
  retention (7d/30d + retained ≥ 7 days after signup), PMF proxies
  (`premium_interest`, paying `customers`, Sean-Ellis gate runnable once ≥
  10 activated real strangers).
- **Core value:** Simple, Bullet-proof
- **Why:** The scorecard's "most active user is your test suite" lesson:
  a metric that doesn't name its population measures your robots. The
  exclusion list lived in prose (scorecard row #2), re-typed per pull; one
  canonical home stops the dashboard, loops, and scorecard drifting apart.
- **Consequence in code:** New metrics land as additive fields in
  `computeGtmMetrics` (never repurpose a field), with the
  stranger/internal split wherever a `user.email` join exists. Reviewers
  reject GTM SQL re-derived elsewhere (loops/scorecard read the
  endpoint). Timestamp units are normalized here — `user.createdAt` TEXT
  ISO-8601, `databases.*` unixepoch seconds, `chat_message.created_at` ms
  — callers never see the mismatch.
- **Alternatives rejected:**
  - Per-surface SQL — guaranteed definition drift; the hand-pull status
    quo.
  - Excluding internal accounts at write time — destroys the ops/debug
    value of raw rows; read-time filtering is reversible.

### SK-GTM-002 — Admin gate: exact founder allowlist + `@nlqdb.com` domain, server-side only

- **Decision:** `isAdminEmail(email)` in `apps/api/src/admin/gate.ts` is
  the only authorization predicate for admin surfaces: case-insensitive
  match against the exact allowlist (`omer@salfati.group`) or the
  `nlqdb.com` domain. `GET /v1/admin/metrics` runs it after
  `requireSession` (cookie session only — an `sk_live_`/`pk_live_`/anon
  bearer never reaches admin data) and returns `403 {error: "forbidden"}`
  for a signed-in non-admin. The static `/app/admin/` page repeats the
  check client-side for UX only (redirect, `apps/web/src/lib/admin-gate.ts`)
  — a presentation-copy of the API predicate, never a security boundary.
- **Core value:** Seamless auth, Bullet-proof, Simple
- **Why:** `apps/web` ships as static assets with no server middleware
  (`SK-WEB-001`), so the page can't enforce anything — the data boundary
  is the API. Sign-in is OAuth/magic-link only (`SK-AUTH-002`), so a
  session email is a verified identity; `@nlqdb.com` matching admits
  teammates with zero code change, the allowlist covers the founder's
  domain.
- **Consequence in code:** Future admin endpoints reuse `requireSession` +
  `isAdminEmail` — reviewers reject a second predicate or a
  `requirePrincipal`-based admin route. The gate returns 403 (not 404):
  the route is documented in-repo, hiding it buys nothing. Allowlist
  changes are code-reviewed constants, not env vars.
- **Alternatives rejected:**
  - A `role` column on `user` — schema + backfill for two constants;
    revisit only if non-email-domain admins appear.
  - 404 for non-admins — obscurity with a debugging cost; the gate is the
    security, not the status code.
  - Client-side gate only — the page is a static asset; anyone reads the
    JS.

### SK-GTM-003 — Daily `gtm_snapshots` rows make progress observable; written by cron AND on authorized reads

- **Decision:** Migration `0022_gtm_snapshots.sql` adds `gtm_snapshots
  (day TEXT PRIMARY KEY, metrics_json TEXT, created_at)`. A headline
  subset of `computeGtmMetrics` is written as an `INSERT OR IGNORE`
  per-UTC-day row from two triggers: the daily `scheduled()` cron
  (`0 4 * * *`, best-effort, before the Tinybird early-return) and —
  belt-and-braces — a `waitUntil` write on every authorized
  `GET /v1/admin/metrics`. The endpoint returns up to 90 snapshot rows for
  the dashboard.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** D1 holds only current state; without an append-only daily row,
  "are we making progress?" is unanswerable next month. INSERT OR IGNORE
  on the UTC day makes both writers race-safe and idempotent; the on-read
  write accrues history across cron outages (one no-op write per view). A
  JSON payload keeps the shape additive (`SK-EVENTS-002`) without a
  migration per metric.
- **Consequence in code:** Snapshot JSON fields are additive-only; a
  renamed/retyped field needs a new key, old keys stay readable. The cron
  write must never throw past its try/catch (a miss can't break the sweep
  or analyser). Rows are never updated or deleted — first write of a day
  wins.
- **Alternatives rejected:**
  - Reconstruct trends from PostHog later — different population (events,
    client-blockable) than D1 truth; never reconciles with the scorecard.
  - One column per metric — a migration per metric; JSON + additive keys
    is the `ProductEvent` lesson.
  - Cron-only writes — a single missed cron leaves a hole; the on-read
    write is free insurance.

### SK-GTM-004 — Founder dashboard at `/app/admin/`; deliberately not in SDK/CLI/MCP/elements

- **Decision:** `/app/admin/` is an Astro page following the `keys.astro`
  pattern (client session guard + hidden shell) mounting the
  `AdminDashboard.tsx` island (ErrorBoundary-wrapped per `SK-WEB-001`,
  calm tokens per `SK-WEB-020`, no chart library — inline SVG
  sparklines/bars only). It fetches `GET /v1/admin/metrics` with
  `credentials: "include"` via a small `lib` helper (`lib/billing.ts`
  precedent). Per
  [`GLOBAL-003`](../../decisions/GLOBAL-003-all-surfaces-one-pr.md) this
  is **deliberately web-only**: internal founder tooling, not a user
  capability — the SDK/CLI/MCP/elements gap is a decision, not an
  omission.
- **Core value:** Simple, Free, Goal-first
- **Why:** The founder's question is "show me progress", answered fastest
  by one always-current page; shipping admin verbs into four public
  surfaces advertises an endpoint 99.9% of callers can only 403 on. No
  chart dependency keeps the island small and the build clean.
- **Consequence in code:** No admin methods in `packages/sdk`, `cli`,
  `packages/mcp`, or `packages/elements`; reviewers reject adding them
  without superseding this. No nav link from shared chrome (`Topnav` is
  static/public); reached by URL — a session-gated link may later land
  inside `/app` chrome only.
- **Alternatives rejected:**
  - SDK method + CLI verb (`nlq admin metrics`) — public API surface for
    a two-person audience; GLOBAL-003 exists for user capabilities.
  - A chart library (recharts/d3) — bundle + design drift for four
    sparklines; calm tokens cover it.

### SK-GTM-005 — Synthetic traffic is stamped at DB create; unique-people counts exclude it

- **Decision:** Migration `0023_synthetic_traffic_flag.sql` adds
  `databases.synthetic INTEGER NOT NULL DEFAULT 0`, stamped at every
  create path (hosted create both arms + BYO connect) when
  `isSyntheticRequest()` (`apps/api/src/synthetic-ua.ts`) says the request
  self-identifies as nlqdb-generated: the stranger-test walker UA token
  (`SK-ONBOARD-007`) or a preview/mock deploy (`NODE_ENV=preview` /
  `MOCK_IDP=1`, `SK-AUTH-018` — previews share the prod D1). Then
  `computeGtmMetrics` reports the **unique-people block**:
  `uniques.realUsers` (distinct stranger accounts — `user.email` is
  UNIQUE, so accounts ARE unique people), `uniques.anonDevices` split
  synthetic/organic (one anon tenant id = one device, `SK-ANON-008`; a
  device is synthetic when ANY of its DBs carries the flag), plus
  `funnel.anonDbsSynthetic`, `funnel.adoptionsReal` (adopter email outside
  the internal set) and `funnel.adoptionRateReal`. Existing fields keep
  their semantics (`SK-GTM-001` — additive only). Write-side complement of
  `SK-ONBOARD-007`: that keeps walker *asks* out of the first-10 counters;
  this keeps walker/preview *DBs and devices* out of the funnel counts.
- **Core value:** Bullet-proof, Simple, Free
- **Why:** The founder's headline question is "how many real unique
  people", and the anon side was unanswerable: the daily walker
  (`SK-STRG-003`) and preview deploys create anon DBs in prod D1 that
  read as strangers. Detection is strictly self-identification — walker
  UA + preview env flag — never a host/IP/UA heuristic: a false positive
  silently erases a REAL stranger from the north-star, worse than
  counting an extra robot.
- **Consequence in code:** `DbCreateArgs.synthetic` / `ConnectByoArgs.
  synthetic` are resolved only at the route via `isSyntheticRequest`
  (orchestrators pass them through); reviewers reject a second detection
  site or any IP/host rule. Dropping the `nlqdb-stranger-test` UA token
  (or unsetting `MOCK_IDP`/`NODE_ENV=preview`) silently re-pollutes the
  counts — treat as a breaking change. Rows created before migration 0023
  default to organic; the 90-day anon sweep ages that backlog out.
- **Alternatives rejected:**
  - Host/IP heuristics for previews — previews are same-origin merged
    workers; a host list rots and misfires on real users.
  - Excluding by the walker's 25 seeded prompt strings — goals aren't
    stored on `databases`; fragile string coupling.
  - Backfilling the pre-0023 backlog — no reliable key exists; the sweep
    resolves it within 90 days for free.

### SK-GTM-007 — First-touch attribution: one localStorage slot, persisted on the created DB row; channel keys canonical in the acquisition ledger

- **Decision:** Acquisition attribution is **first-party and first-touch**.
  The web layout (`Base.astro`) calls `captureFirstTouch()`
  (`apps/web/src/lib/attribution.ts`) on every page load: the FIRST
  touch a device makes (UTM params, external referrer host, landing
  pathname) is stored once in `localStorage["nlqdb_src"]` and never
  overwritten. `postAskCreate` forwards it as the `/v1/ask` `source`
  field; the API sanitizes it (`sanitizeAskSource` — whitelist keys,
  160-char caps, **drop-never-400**) and persists it to
  `databases.source_json` (migration `0024`) off the response path
  (`waitUntil`, best-effort). Adoption re-tenants that row untouched, so
  a stranger signup stays attributed to the channel that produced it.
  The channel key per metric row is `utm_source`, else referrer host,
  else `direct`; rows with no capture (pre-instrument, CLI/SDK/MCP) are
  `untracked` so instrument coverage is itself a visible number.
  **`utm_source` values are canonical in
  [`docs/research/acquisition-channels.md`](../../research/acquisition-channels.md)** —
  every externally published nlqdb URL carries its ledger key.
- **Core value:** Free, Bullet-proof, Simple
- **Why:** The first stranger cohort can never be attributed
  retroactively — waiting for "stranger signups > 0" (the prior parking)
  leaves the 2026-07-19 acquisition focus's (`GLOBAL-038`) channel
  experiments unmeasurable exactly when their readout matters. First-party
  capture is the D1 ground truth PostHog can't be (client-blockable,
  different population); first-touch (vs last-touch) matches "which
  channel *brought* them", and one slot needs no consent-scoped cookie.
- **Consequence in code:** Attribution is telemetry, never load-bearing:
  every layer (capture, parse, persist) drops on failure — a malformed
  `source` never 400s a create, a failed D1 write only logs
  (`gtm_source_write_failed`). New channels add a ledger row, not code.
  `acquisition.*` metrics group by the SQL channel expression
  (`SOURCE_CHANNEL_SQL`) — reviewers reject a second channel-derivation.
  First write wins on both layers (localStorage guard + `WHERE
  source_json IS NULL`).
- **Alternatives rejected:**
  - Wait for strangers before instrumenting (the prior parking) —
    attribution can't be backfilled; rejected by the acquisition focus.
  - PostHog-only attribution — client-blockable and a different
    population than the D1 rows the funnel counts (GLOBAL-034 keeps it
    for behavioral funnels).
  - Server-side capture from the `Referer` header — the create POST's
    referrer is our own page, never the acquiring channel; only the
    client sees the first touch.
  - A dedicated touches table keyed by principal — a second store + join
    for data 1:1 with the created row; the column is the smaller diff and
    adoption already carries it.

### SK-GTM-006 — Sean-Ellis Q1 ships as an in-product one-click survey, asked once per account on an eligible return visit

- **Decision:** The canonical PMF question ("How would you feel if you
  could no longer use nlqdb?" — wording verbatim from founder-playbook §2
  / acquisition-tracker Phase D §4.1) is asked **in-product**, in the
  `/app` chat (`PmfSurveyCard.tsx`), never by call or email. Eligibility
  is server-decided (`apps/api/src/pmf-survey.ts`,
  `GET /v1/pmf-survey`): owned DBs carry ≥ 2 successful first-10 answers
  (`SUM(first10_ok) ≥ 2`, the `SK-ONBOARD-006` counters) AND latest
  activity is ≥ 24 h old (a return visit, per PMFsurvey.com's "never
  survey day-1 users" rule). One response per account, ever: `pmf_survey`
  D1 table (migration `0025`), `user_id` PK + `ON CONFLICT DO NOTHING`
  (the `premium_interest` / SK-IDEMP-005 pattern); a dismissal snoozes 7
  days client-side (localStorage) without spending the one answer.
  `POST /v1/pmf-survey` accepts any signed-in response and snapshots
  `query_count` / `days_since_first` per row, so the read side enforces
  the population rule instead of the write 403ing a stale-tab answer. The
  founder is emailed per response (dispatch-after-insert, at most one per
  account); the metric read lives in `computeGtmMetrics` per `SK-GTM-001`
  (`veryDisappointedShare` na-excluded), with additive snapshot keys
  (`SK-GTM-003`). Per
  [`GLOBAL-003`](../../decisions/GLOBAL-003-all-surfaces-one-pr.md)
  **deliberately web-only**: a feedback widget on the chat surface, not a
  user capability — no SDK/CLI/MCP/elements verb.
- **Core value:** Goal-first, Free, Honest latency
- **Why:** The Sean-Ellis 40%-very-disappointed rule is the repo's
  committed PMF gate (Phase D §4.4) yet had no capture instrument —
  recommended twice and never built, so PMF would stay unmeasurable
  exactly when launch traffic (launch-kit.md) starts producing eligible
  users. Instrument before the cohort arrives: surveys can't be
  retrofitted onto users who already churned.
- **Consequence in code:** Both routes are session-only (an anon /
  `sk_*` bearer 401s — a survey answer is an account opinion); the card
  renders nothing unless the server says eligible, so anon and day-1
  users never see it. New PMF metrics read `pmf_survey` only via
  `computeGtmMetrics`. The first stored response per account is immutable
  — reviewers reject an UPDATE path. Q2–Q5 of Phase D §4.2 are NOT in
  scope; add them only when Q1 volume proves the surface (each a new
  nullable column or its own SK).
- **Alternatives rejected:**
  - Email/interview surveys (founder-playbook calls) — the tracker's
    zero-1:1-calls operating model; response rates die off-product.
  - Events-pipeline emission (`feature.pmf.sean_ellis_q1`) — the D1 row
    IS the queryable record; GLOBAL-024 targets "not yet" denial paths,
    not feedback capture, and a LogSnag event would duplicate the founder
    email for no reader.
  - Gating POST on live eligibility — rejects honest answers from a tab
    opened while eligible; population filtering belongs at the read.
  - Ask on every Nth query (no 24 h rule) — day-1 enthusiasm corrupts
    the 40% read; PMFsurvey.com guidance is explicit.

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

- **External sources on the dashboard (CF Web Analytics visits, GSC clicks/impressions)** — Parked until the D1 dashboard proves daily use. Both need operator tokens (`CF_ANALYTICS_TOKEN`, GSC service account) in the Worker; v1 names the gap honestly rather than proxying half-configured sources.
- **Loop integration** — the `/daily` funnel pull can switch from remote-D1 SQL to `GET /v1/admin/metrics` (founder session or a read token TBD); decide when a loop prompt next touches those rows.
- **Adoption-rate denominator understates the true anon-DB base** — `adoptionRate` = `adopted / (live anon DBs + adopted)`. Adoption re-tenants off `anon:%` and the sweep (`SK-ANON-002`) deletes abandoned anon DBs, so neither is in the live-anon count and the rate slightly overstates. Exact all-time share needs an append-only anon-DB-created counter; parked until anon volume makes the gap material.
