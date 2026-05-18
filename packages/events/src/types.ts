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

// Closed union of wishlist surface ids. Must match the `data-wishlist`
// attributes in `apps/web/src/components/CodePanel.astro` AND the
// `WISHLIST_SURFACES` validation set in `apps/api/src/events-feature.ts`.
// Adding a wishlist badge is a three-place edit (HTML + API + this
// union) — kept that way deliberately so a typo in any one place is
// caught at the next: TypeScript flags the API, the API 400s the
// click, or the LogSnag dashboard surfaces an unknown tag.
export type WishlistSurface = "vscode" | "jetbrains" | "slack" | "discord";

// `home.surface_wishlist` is the queued counterpart of the marketing-page
// DOM event of the same name (`apps/web/src/components/CodePanel.astro`).
// The marketing visitor may have no auth at all — `principalId` falls
// back to a per-day IP-hash bucket so dedup still works without
// coercing the visitor into an anon-bearer mint for a wishlist click.
export type HomeSurfaceWishlistEvent = {
  name: "home.surface_wishlist";
  principalId: string;
  surface: WishlistSurface;
};

// `feature.eval.*` is the quality-eval domain (SK-QUAL-002). Emitted by
// the weekly GH-Actions cron after the BIRD Mini-Dev pass completes.
// Per-run dedup is on `runId` (the ISO timestamp the eval started) so
// a retry of the same workflow run can't double-count a regression.
export type FeatureEvalWeeklyEvent = {
  name: "feature.eval.weekly";
  // The eval run timestamp — ISO-8601 UTC; same value as `EvalReport.run_at`.
  runId: string;
  dataset: string;
  questionCount: number;
  // EA per dispatch lane. Keyed by lane name (`"free"`, `"frontier"`).
  // Object (not array) so the LogSnag tags map flattens 1:1.
  laneExecutionAccuracy: Record<string, number>;
  // SK-QUAL-004 headline KPI. Null when only one lane ran.
  freeVsFrontierDelta: number | null;
};

// `feature.eval.regression` fires only when a regression trigger flags
// per `SK-QUAL-002` (>5 pp WoW drop or McNemar p<0.05 paired test).
// Drives the on-call page; high-signal, never deduped at the day level.
export type FeatureEvalRegressionEvent = {
  name: "feature.eval.regression";
  runId: string;
  dataset: string;
  // Which lane regressed; same key set as `FeatureEvalWeeklyEvent.laneExecutionAccuracy`.
  lane: string;
  // Baseline → current EA (signed; negative = regression).
  deltaPp: number;
  // The trigger that fired: `"threshold"` (>5 pp drop) or
  // `"mcnemar"` (paired-test p<0.05). Both can fire; the producer
  // emits one event per trigger so the on-call sees both signals.
  trigger: "threshold" | "mcnemar";
  // McNemar p-value when `trigger === "mcnemar"`; null otherwise.
  pValue: number | null;
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
  | HomeSurfaceWishlistEvent
  | FeatureEvalWeeklyEvent
  | FeatureEvalRegressionEvent;

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
