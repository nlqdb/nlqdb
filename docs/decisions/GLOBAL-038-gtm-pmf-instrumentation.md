# GLOBAL-038 — GTM/PMF instrumentation is first-class: one canonical acquisition metric set, live on `/app/admin`

- **Decision:** nlqdb maintains **one canonical GTM/PMF metric set** —
  the acquisition funnel (anon creates → signups → activation →
  retention, always split **real strangers vs founder/test accounts**)
  plus the PMF proxies (7-day-retained share, `premium_interest` count,
  paying customers, the Sean-Ellis survey gate) — computed live from the
  control-plane D1 by `apps/api/src/admin/gtm-metrics.ts`, served at
  admin-gated `GET /v1/admin/metrics`, trended via daily `gtm_snapshots`
  rows, and rendered at `/app/admin/`. **Admin access** = the exact
  allowlist (`omer@salfati.group`) plus any `@nlqdb.com` account email,
  enforced **server-side in `apps/api`** (`admin/gate.ts`); any web-side
  check is presentation only. Founder directive 2026-07-19: the current
  operating focus is **user acquisition** — GTM/PMF numbers must be
  measured continuously and show real progress. This **amends
  [`GLOBAL-025`](./GLOBAL-025-north-star.md) in part**: its
  "growth-style NSM rejected (premature pre-PMF)" alternative no longer
  bars growth *measurement* — the four quality pillars remain the
  product compass, but acquisition metrics are now first-class measured
  numbers with a canonical live instrument.
- **Core value:** Free, Simple, Bullet-proof
- **Why:** Until now every GTM number was a hand-pulled point-in-time
  read (remote-D1 SQL, CF GraphQL) living in `docs/scorecard.md` — it
  rots between `/daily` runs, the founder can't self-serve it, and the
  population split (row #2's "real strangers = 0") was re-derived by
  hand each pull. Worse, D1 stores only *current* state
  (`last_queried_at` is one timestamp, not a log), so week-over-week
  progress is unmeasurable retroactively — without a snapshot table
  there is no way to ever show a trend. One module that owns the metric
  definitions kills silent drift between the scorecard, the loops, and
  the dashboard; a daily snapshot row makes "real progress" observable
  from the day this lands.
- **Consequence in code & docs:** Metric definitions (incl. the
  internal-email exclusion patterns) live **only** in
  `apps/api/src/admin/gtm-metrics.ts`; the scorecard funnel rows and any
  loop prompt read `GET /v1/admin/metrics` (or quote that module) rather
  than re-deriving SQL. The acquisition focus also re-orders the loops'
  lever priority (acquisition/distribution yield first — `daily.md`
  step 2, `weekly.md` default focus, both marked founder-resolved
  2026-07-19) and makes channel yield attributable end-to-end:
  first-touch capture per `SK-GTM-007`, channel keys canonical in
  [`docs/research/acquisition-channels.md`](../research/acquisition-channels.md). The gate predicate lives only in
  `apps/api/src/admin/gate.ts` (`isAdminEmail`). The daily `scheduled()`
  cron and every authorized dashboard read write an idempotent
  per-UTC-day `gtm_snapshots` row (additive JSON shape). Feature-local
  contracts are `SK-GTM-*` in
  [`docs/features/gtm-metrics/FEATURE.md`](../features/gtm-metrics/FEATURE.md).
- **Alternatives rejected:**
  - **Keep the manual `/daily` pulls as the only instrument** — no
    history, no self-serve, numbers stale between runs; the founder
    asked to *see* progress.
  - **PostHog dashboards as the only surface** — PostHog holds emitted
    events, not the D1 source of truth (registered users, adoption
    rows, first10 counters); it stays the tool for behavioral
    funnels/TTFV, not the canonical counts.
  - **Grafana `north-star.json` board** — reads OTel metrics, not D1
    state; adds secret/ops surface for numbers one SQL batch answers.
  - **Env-var admin allowlist** — a secret-mirroring errand for a
    constant that changes ~never; a reviewed code constant is simpler
    and auditable.
