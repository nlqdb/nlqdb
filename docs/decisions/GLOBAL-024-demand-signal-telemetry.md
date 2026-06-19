# GLOBAL-024 — Demand-signal telemetry on every "not yet" path

- **Decision:** Every code path that returns "not supported" /
  "rate-limited" / "ambiguous" / "anonymous TTL warning" / "wishlist
  click" emits a typed product event into the existing `packages/events`
  pipeline. Event names follow the `feature.requested.<noun>` domain
  (e.g. `feature.requested.ddl_via_ask`, `feature.requested.byo_pg`,
  `feature.requested.team_workspace`, `feature.requested.unknown_cli_verb`).
- **Core value:** Bullet-proof, Honest latency, Free
- **Why:** The phase plan's monetization and scaling triggers (see
  [`phase-plan.md` §6](../phase-plan.md)) require data-driven decisions
  about *what to build next* and *when to light the cost-incurring
  layers* (Lago, Listmonk, scaling). Without
  systematic capture of unmet demand, the team can't tell whether a
  "missing feature" is real or imagined. The existing per-route /
  per-status metrics (`performance.md §3.2`) measure what *did*
  happen; this rule measures what users *tried* and failed to do —
  the negative space that drives the next priority.
- **Consequence in code:** A new event domain `feature.*` lives
  alongside the existing `user.*` / `billing.*` domains in
  [`packages/events`](../../packages/events). Each surface adds one
  emit on its negative paths: `/v1/ask` 4xx "unsupported_verb"
  emits `feature.requested.ddl_via_ask`; anon-tier rate-limit hit
  emits `feature.requested.heavier_tier`; CLI bare-form invocation of
  an unknown verb (when CLI ships) emits
  `feature.requested.unknown_cli_verb`. The wishlist row in
  [`progress.md`](../progress.md) §0 continues to fire
  `home.surface_wishlist`. All events stay in the same LogSnag sink;
  no client SDK is added. Cost: ≤ 1 ms billed CPU per emit, no
  user-facing latency (per the `ctx.waitUntil` pattern in
  [`email-and-marketing.md` §4](../research/email-and-marketing.md)).
- **Alternatives rejected:**
  - Log-only — no per-feature aggregation, no Slack alerting, no
    weekly digest. Logs are for incident triage, not for product
    prioritization.
  - Single spike-counter (`feature.unmet.total`) — no granularity to
    distinguish DDL-via-ask from BYO-PG-curious from team-workspace
    asks. Bucketed counters force the prioritization decision back
    onto the team without signal.
  - Post-hoc surveys — low response rate (typically <5% for free-tier
    users) and slow loop (week+ to results). The negative-event emit
    is real-time and 100% sample.
  - Stripe Checkout as the only signal — too late in the funnel;
    requires the user to be intent-loaded enough to click a payment
    button. Negative-path emits catch the user at the moment of
    friction, before the bounce.
