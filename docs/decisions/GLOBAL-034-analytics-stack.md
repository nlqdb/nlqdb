# GLOBAL-034 — Analytics stack: Cloudflare Web Analytics for pageviews; PostHog Cloud is a Phase-2-optional product sink

- **Decision:** Web-engagement analytics (pageviews, sources, top pages,
  Core Web Vitals) for every public surface — `apps/web` and `apps/docs` —
  is **Cloudflare Web Analytics**: one beacon `<script>`, no client SDK, no
  cookie banner. **PostHog Cloud** (already provisioned — `POSTHOG_API_KEY`
  / `POSTHOG_HOST` point at the EU region) is the **Phase-2-optional**
  product-analytics sink for funnels / cohorts / retention, wired only when
  a real question lands that SQL on D1/Neon can't answer, and then
  server-side from the Worker (no client SDK) as a second `packages/events`
  sink. Self-hosted **Plausible is dropped.** Per-slug demand-signal
  funnels (`vs.try_query_clicked`, …) keep flowing through the existing
  LogSnag sink until PostHog is wired.

- **Core value:** Free, Simple, Effortless UX

- **Why:** Per [`GLOBAL-033`](./GLOBAL-033-resolution-defaults.md)
  (build-vs-adopt → adopt the free, mature option; pin to strict-$0) and the
  canonical analytics plan already in
  [`docs/research/email-and-marketing.md §4`](../research/email-and-marketing.md):
  Cloudflare Web Analytics is free, GDPR-exempt, cookie-banner-free, and
  loads no client JS, so the marketing-site Lighthouse 100s survive. Self-
  hosting Plausible on Fly needs Postgres + ClickHouse + the app server
  (≥ $5/mo) and saves ~$9/mo vs Plausible Cloud — not worth the ops or the
  strict-$0 breach pre-PMF. The "Plausible (self-hosted)" line in
  `architecture.md §3.1` predated this and was never reconciled; the
  per-feature analytics open questions (web-app, comparison-pages,
  solve-pages, docs-site) all pointed in slightly different directions.
  One decision closes them.

- **Consequence in code & docs:** `apps/web` (and `apps/docs` when wired)
  embed the Cloudflare Web Analytics beacon; no analytics client SDK ships
  to the browser. PostHog wiring, when it lands, drains the existing
  Cloudflare Queue as a second sink wrapped in `ctx.waitUntil` (0 ms
  user-facing cost; call sites unchanged). `architecture.md §3.1` + stack
  table and `phase-plan.md §1` are corrected from "Plausible" to "Cloudflare
  Web Analytics". The web-app / comparison-pages / solve-pages / docs-site
  analytics open questions are rewritten to "Parked until the
  analytics-wiring slice".

- **Alternatives rejected:**
  - **Plausible self-hosted (the old architecture-prose plan).** Recurring
    cost + Fly ops for marginal saving — fails strict-$0 pre-PMF.
  - **PostHog as the primary web-analytics backend.** A client SDK on the
    marketing site hurts Lighthouse and adds a cookie/consent surface;
    PostHog's strength is funnels/cohorts, not pageviews. Reserve it
    server-side for Phase 2.
  - **No web analytics until Phase 2.** Loses the cheapest acquisition
    signal during the exact window the ICP-validation plan needs it.
