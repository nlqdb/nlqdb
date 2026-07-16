# GLOBAL-034 — Analytics stack: Cloudflare Web Analytics for public pageviews; PostHog for product analytics

- **Decision:** Public-surface web-engagement analytics (pageviews,
  sources, top pages, Core Web Vitals) for `apps/web` and `apps/docs` is
  **Cloudflare Web Analytics** — one beacon `<script>`, no client SDK, no
  cookie banner. **Product analytics is PostHog Cloud** (EU region;
  `POSTHOG_API_KEY` is the publishable `phc_` project key,
  `POSTHOG_HOST=https://eu.i.posthog.com`), wired 2026-07-16 on two
  surfaces: (1) a **server-side sink** in `apps/events-worker`
  (`src/sinks/posthog.ts`, `SK-EVENTS-013`) that fans every `ProductEvent`
  out to PostHog for funnels / cohorts / retention; and (2) the
  **posthog-js client SDK on the product `/app` surfaces only**
  (`SK-WEB-024`) — autocapture, heatmaps, dead/rage-click and
  session-replay capture, with all inputs and the query-result region
  masked. **Marketing / blog / vs / solve pages stay SDK-free** (the
  Lighthouse-100 + no-cookie-banner posture), and **Plausible is dropped.**

- **Core value:** Free, Simple, Effortless UX

- **Why:** Per [`GLOBAL-033`](./GLOBAL-033-resolution-defaults.md) (adopt
  the free, mature option; pin to strict-$0): Cloudflare Web Analytics is
  free, GDPR-exempt, cookie-banner-free, and loads no client JS, so the
  marketing-site Lighthouse 100s survive. PostHog Cloud is free to 1M
  events/mo and is purpose-built for the founder's lifecycle questions —
  where users click more/less, what blocks them, why they leave — which
  pageview counting and SQL on D1/Neon can't answer. The client SDK is
  scoped to `/app` because that's where product interaction lives; keeping
  it off marketing preserves the performance posture. Session replay masks
  all inputs and the chat conversation region so user DB contents are
  never recorded.

- **Consequence in code & docs:** `apps/web` (and `apps/docs`) embed the
  Cloudflare Web Analytics beacon; the posthog-js SDK is lazy-loaded ONLY
  on `/app/*` (`apps/web/src/lib/posthog.ts` + `components/AppAnalytics.astro`;
  publishable key baked at build time in `deploy-web.yml`, same pattern as
  `PUBLIC_API_BASE`). The events-worker PostHog sink drains `EVENTS_QUEUE`
  server-side (plain `fetch` to `<host>/batch/`, no SDK — stays under
  GLOBAL-013's bundle ceiling); envelope `id` → PostHog `uuid` for
  idempotent dedup. `architecture.md §3.1` + stack table name Cloudflare
  Web Analytics (not Plausible).

- **Alternatives rejected:**
  - **Plausible self-hosted.** Recurring cost + Fly ops for marginal
    saving — fails strict-$0 pre-PMF.
  - **A client SDK on marketing / PostHog as the pageview backend.** Hurts
    Lighthouse and adds a cookie/consent surface; PostHog's strength is
    funnels/cohorts, not pageviews. Server-side sink for all events +
    client SDK on `/app` only is the split.
