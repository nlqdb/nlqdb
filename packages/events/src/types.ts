// Product-event schema. Discriminated union — `name` is the
// dispatch key in `apps/events-worker/src/sinks/`. Adding a new event:
//
//   1. Add a variant here.
//   2. Add a sink (or extend an existing sink's `handle()` switch) in
//      apps/events-worker/src/sinks/<name>.ts.
//   3. Producers can call `events.emit({ name, ... })` immediately —
//      consumer dispatch is the only place that needs to know the new
//      shape.
//
// Convention: `name` is `<domain>.<verb_noun>` (e.g. `user.first_query`,
// `billing.subscription_created`, `ask.completed`). Domains today:
// `user`, `billing`, `ask`, `feature`.

// Originating surface for a request. Single source of truth for both
// the `nlqdb.surface` OTel attribute (performance.md §3.3) and the
// `surface` field on `feature.*` events (SK-EVENTS-010). Adding a
// surface here is the one edit needed — every consumer reads from this
// union.
export type NlqSurface = "hero" | "chat" | "embed" | "mcp" | "cli";

// `ask.completed` carries the anonymised fingerprint of a successful
// `/v1/ask` resolution — the input W5's daily reshape consumes off the
// Tinybird `query_log` Data Source. No SQL text, no values, no PII;
// `query_hash` is sufficient for de-duplication of recurring patterns.
export type AskCompletedEvent = {
  name: "ask.completed";
  dbId: string;
  schemaHash: string;
  queryHash: string;
  // Anonymised fingerprint of the planned SQL — distinct from
  // `queryHash` (which is over the user's goal). Same goal can produce
  // structurally different plans across schema_hashes / model versions;
  // capturing both gives the analyser dedup at goal- and at plan-shape-
  // level.
  planShape: string;
  engine: "postgres" | "clickhouse";
  // Orchestrator-internal latency: time from orchestrate-entry to the
  // emit point, BEFORE response serialise / egress. Distinct from the
  // `/v1/ask` SLO timing (`docs/performance.md §1`) which is wall-clock
  // request → response. The W5 analyser must not conflate the two —
  // hence the explicit `orchestrator_` prefix.
  orchestratorMs: number;
  rowsReturned: number;
  // Unix-ms at orchestrator success. Distinct from `EventEnvelope.ts`
  // (producer enqueue time) — the analyser needs the `/v1/ask` end
  // timestamp, not the queue-publish timestamp, for accurate p99
  // bucketing.
  ts: number;
};

// `feature.requested.*` is the GLOBAL-024 demand-signal domain
// (SK-EVENTS-010). Every "not yet" path on every surface fires one of
// these so the §6 monetization trigger has typed signal instead of
// guesses. `principalId` is the SHA-256-prefix anon id for anon
// principals or the authed `userId` — same shape as the OTel
// `nlqdb.user.id` attribute. Per-(principalId, day) dedup is applied
// by `defaultId()` so the LogSnag 2,500/mo quota survives.
export type FeatureRequestedDdlViaAskEvent = {
  name: "feature.requested.ddl_via_ask";
  principalId: string;
  surface: NlqSurface;
  // The sql-validate reject reason (`drop_statement`,
  // `alter_statement`, `truncate_statement`, `grant_or_revoke`,
  // `disallowed_verb`). Lets the sink slice "which DDL shape did the
  // LLM produce" without re-parsing.
  rejectReason: string;
};

export type FeatureRequestedHeavierTierEvent = {
  name: "feature.requested.heavier_tier";
  principalId: string;
  surface: NlqSurface;
};

// `feature.requested.notify_paid` is the user-clicked CTA variant of the
// GLOBAL-024 demand-signal domain (SK-EVENTS-011). Distinct from
// `feature.requested.heavier_tier`, which fires implicitly on a 429 — this
// fires only when the user *clicks* the "Notify me when paid launches"
// button on one of the three documented hosts. The `cta` label distinguishes
// which surface produced the signal so the §6 monetization-trigger
// dashboard can slice by intent strength (success-state click ≠ panic-on-
// rate-limit click). One signal per principal per day per cta keeps the
// LogSnag 2,500/mo quota intact (`SK-EVENTS-006`).
export type NotifyPaidCta = "db_create_success" | "anon_warning" | "rate_limit";

export type FeatureRequestedNotifyPaidEvent = {
  name: "feature.requested.notify_paid";
  principalId: string;
  surface: NlqSurface;
  cta: NotifyPaidCta;
};

// `home.surface_wishlist` is the queued counterpart of the marketing-page
// DOM event of the same name (`apps/web/src/components/CodePanel.astro`).
// Each click on a wishlist badge (VSCode / JetBrains / Slack / Discord)
// posts to `/v1/events/wishlist` so the click becomes typed signal in the
// `home.*` domain rather than a DOM event that goes nowhere. The
// marketing visitor may have no auth at all — `principalId` falls back
// to a per-day IP-hash bucket so dedup still works without coercing the
// visitor into an anon-bearer mint just to register a wishlist click.
export type HomeSurfaceWishlistEvent = {
  name: "home.surface_wishlist";
  principalId: string;
  // The wishlist surface id from the badge's `data-wishlist` attribute
  // (`vscode`, `jetbrains`, `slack`, `discord`). Kept as a free string
  // rather than a closed union so new wishlist surfaces land without a
  // packages/events bump — the LogSnag tag carries it through to the
  // dashboard verbatim.
  surface: string;
};

export type ProductEvent =
  | { name: "user.first_query"; userId: string; dbId: string }
  | { name: "user.registered"; userId: string; email: string }
  | { name: "user.waitlist_joined"; emailHash: string; source: string }
  | {
      name: "billing.subscription_created";
      userId: string;
      customerId: string;
      subscriptionId: string;
      priceId: string;
    }
  | {
      name: "billing.subscription_canceled";
      userId: string;
      customerId: string;
      subscriptionId: string;
      priceId: string;
    }
  | AskCompletedEvent
  | FeatureRequestedDdlViaAskEvent
  | FeatureRequestedHeavierTierEvent
  | FeatureRequestedNotifyPaidEvent
  | HomeSurfaceWishlistEvent;

// Envelope wrapping the event with producer-side metadata. The consumer
// reads `id` for idempotency keys (passed to LogSnag) and `ts` for late-
// arrival debugging.
export type EventEnvelope = {
  // Stable per-emission id. `${name}.${userId}.${day}` for one-shot
  // user events; `crypto.randomUUID()` otherwise. Producer decides.
  id: string;
  // Unix-ms at producer time.
  ts: number;
  event: ProductEvent;
};
