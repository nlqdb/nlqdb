# Email, content & marketing

## 1. Transactional email — Resend (3k/mo free)

Templates in **React Email**, one plain-text fallback per message, no
marketing content. Triggers: magic links, billing alerts (80% quota),
security alerts (new-device, new MCP host, key create/rotate/
revoke, global sign-out), DB-paused notification. Fallback: AWS SES
(~$0.10/1k) via the same templates — swap with one env var.

## 2. Marketing email — Listmonk (self-hosted, SES)

Opt-in newsletter, launch announcements, weekly build-in-public digest.
Plausible for click-through. No third-party tracking pixels.

## 3. Content strategy

Community-led, docs-first. Channels in priority order: **GitHub** (the
repo is the landing page), **docs** (SEO+AEO optimized), **build-in-public
on X/LinkedIn** (real metrics, real failures, weekly), **Hacker News**
(Show HN for major launches), **Product Hunt** (visual launches),
**Reddit** (`r/webdev`, `r/programming`, `r/ClaudeAI`, `r/LocalLLaMA`,
`r/htmx`, `r/databases`), **Discord** (single server, three channels),
**video** (short demos, transcripts feed AEO), **conferences**
(founder-speaks, year 1).

**Cadence:** 1 long-form blog / week, 3 build-in-public threads / week,
1 release / week, 1 community spotlight / month.

**Refuse:** cold outbound email, paid ads pre-PMF, influencer
partnerships pre-PMF, AppSumo lifetime deals, gated content.

## 4. Analytics

Three layers, kept distinct:

1. **Web engagement** — **Plausible** (self-hosted on Fly, GDPR-exempt,
   no cookie banner). Page views, sources, click-through to sign-up.
2. **Ops telemetry** — **Sentry** (5k errors/mo free) + **OpenTelemetry**
   → **Grafana Cloud** free for traces / metrics / logs. Drives the
   "fast" promise.
3. **Product events** — an in-house [`packages/events`](../../packages/events)
   producer that writes to a **Cloudflare Queue** (`nlqdb-events`); a
   separate consumer Worker [`apps/events-worker`](../../apps/events-worker)
   drains the queue and fans out to sinks. **One sink today: LogSnag**
   (free tier 2,500 events/mo — plenty if we fire only one-shot events:
   `user.registered`, `user.first_query`, `billing.subscription_created`,
   `billing.subscription_canceled`; never per-sign-in. **No `trial.*`
   events** — the free tier *is* the trial). LogSnag forwards to
   Slack/Discord/email itself, so the founder-ping channel is one less
   thing to wire.

   The producer/consumer split keeps `apps/api`'s `/v1/ask` hot path
   clean — no LogSnag client, no network round-trips on event-emit,
   the p50 budget stays intact. Quotas, retry behavior, and the DLQ
   wiring live in [`docs/history/infrastructure-setup.md §6`](../history/infrastructure-setup.md)
   and [`apps/events-worker/README.md`](../../apps/events-worker/README.md).

A second sink — **PostHog Cloud** for funnels / cohorts / retention —
is held in reserve for Phase 2, *only* if a real cohort question lands
that SQL on D1/Neon can't answer. Zero-overhead is enforced in code:
server-side capture from the Worker, no client SDK on the marketing
site (would hurt Lighthouse 100s), wrapped in `ctx.waitUntil` so it
runs after the response is returned. User-facing latency cost: 0 ms.
Billed CPU per emission: ≤ 1 ms. Until a need lands, the env vars stay
empty and the sink no-ops.

The boundary is firm: OTel spans describe what the *system* did,
product events describe what the *user* did. They never collapse —
high-cardinality labels like `nlqdb.user_id` stay out of metrics (see
[`docs/performance.md §3.3`](../performance.md)).
