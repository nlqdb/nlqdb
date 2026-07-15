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
// `user`, `billing`, `ask`, `feature`, `home`, `pricing`.

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
//
// The two rate-limit variants are deliberately distinct (SK-EVENTS-010):
// `heavier_tier` = an anon per-IP tier trip (wants to sign up / a real
// account); `larger_account` = an authed per-account D1-bucket trip
// (already has an account, wants higher limits). Collapsing them would
// erase exactly the granularity the §6 monetization trigger reasons
// about — an authed cap hit is the highest-intent paying signal.
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

// Authed per-account rate-limit trip (the D1 60/min bucket in the
// `/v1/ask` + `/v1/run` orchestrators, and `/v1/chat`). Distinct from
// `heavier_tier` (anon per-IP tier) — this principal already has an
// account and hit its ceiling, the closest-to-paying demand signal.
export type FeatureRequestedLargerAccountEvent = {
  name: "feature.requested.larger_account";
  principalId: string;
  surface: NlqSurface;
};

// SK-TRUST-004 — the destructive-op retry-rate instrument (the GLOBAL-025
// UX pillar). `feature.destructive.preview_rendered` fires on the
// `SK-TRUST-001` preview hop (a write plan rendered as a diff, no exec);
// `feature.destructive.committed` fires when the confirmed write actually
// executes. Retry rate = `1 − (committed / preview_rendered)` over a window,
// sliced by `surface`. Both are per-request volume events (random
// `event_id`, see `defaultId`) so every preview and every commit counts —
// writes are a small fraction of `/v1/ask`, so this never threatens the
// LogSnag quota, and per-(principal, day) dedup would collapse exactly the
// repeats the retry rate is meant to measure. `principalId` is the
// authed `userId` / anon id (same shape as `nlqdb.user.id`), a facet only.
export type FeatureDestructivePreviewRenderedEvent = {
  name: "feature.destructive.preview_rendered";
  principalId: string;
  surface: NlqSurface;
};

export type FeatureDestructiveCommittedEvent = {
  name: "feature.destructive.committed";
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

// `pricing.*` is the pricing-page conversion-funnel domain
// (SK-EVENTS-012). Two events instrument `apps/web/src/pages/pricing.astro`
// so the founder can answer "how many UNIQUE people looked at pricing,
// how many picked a paid plan, and which of those are me". Both are
// first-party — a `keepalive` fetch to `POST /v1/events/pricing`, not the
// Cloudflare Web Analytics beacon (GLOBAL-034) — so they survive
// ad/privacy blockers (the exact tool that hides the technical-founder
// ICP), and unlike a pageview they carry a stable identity for
// unique-count + self-exclusion.
//
// `principalId` is the authed `userId` when the visitor is signed in
// (server-derived from the session cookie in `recordPricingEvent`, never
// client-supplied), else a per-day IP-hash bucket `pv:<16hex>` — same
// shape as the wishlist `wl:` bucket so raw IPs never reach the sink.
// `email` is the authed account email (null for anon) so the founder can
// subtract their own account from the unique-user count.
export type PricingPlan = "hobby" | "pro";

export type PricingPageViewedEvent = {
  name: "pricing.page_viewed";
  principalId: string;
  email: string | null;
};

export type PricingPlanSelectedEvent = {
  name: "pricing.plan_selected";
  principalId: string;
  plan: PricingPlan;
  email: string | null;
};

// `feature.eval.*` is the quality-eval domain (SK-QUAL-002). Emitted by
// the on-demand GH-Actions run after the BIRD Mini-Dev pass completes.
// Per-run dedup is on `runId` (the ISO timestamp the eval started) so
// a retry of the same workflow run can't double-count a regression.
export type FeatureEvalWeeklyEvent = {
  name: "feature.eval.weekly";
  // The eval run timestamp — ISO-8601 UTC; same value as `EvalReport.run_at`.
  runId: string;
  dataset: string;
  questionCount: number;
  // EA per dispatch lane. Keyed by lane name (`"free"`, `"frontier"`,
  // `"agentic-frontier"`). Object (not array) so the LogSnag tags map
  // flattens 1:1.
  laneExecutionAccuracy: Record<string, number>;
  // Single-model frontier delta — informational per `SK-QUAL-004`. Null
  // when the `frontier` lane didn't run.
  freeVsFrontierDelta: number | null;
  // SK-QUAL-009 — the headline KPI per `GLOBAL-025`: free chain vs.
  // exec-retry-scaffolded frontier. Phase 2 floor ≤ 25 pp, Phase 3 ≤ 16
  // pp. Null when the `agentic-frontier` lane didn't run. Optional in
  // the type so pre-3c producers (the deployed Worker before this PR)
  // still pass typecheck on the consumer side.
  freeVsAgenticFrontierDelta?: number | null;
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
  // `billing.payment_failed`, emitted on Stripe `invoice.payment_failed`,
  // drives BOTH halves of dunning at the sink: the operator LogSnag alert
  // (SK-STRIPE-011) and the customer-facing reminder email (SK-STRIPE-013).
  // The customer's in-app banner is driven separately by the `past_due`
  // status sync (SK-WEB-012). Deduped per invoice at the producer so
  // Stripe's dunning retries don't re-page (SK-EVENTS-008). `amountDue` is
  // in the currency's minor units (Stripe convention); `hostedInvoiceUrl`
  // is null until the invoice finalizes; `customerEmail` is null when
  // Stripe omitted it on the invoice (the email sink then skips).
  | {
      name: "billing.payment_failed";
      userId: string;
      customerId: string;
      customerEmail: string | null;
      invoiceId: string;
      amountDue: number;
      currency: string;
      attemptCount: number;
      hostedInvoiceUrl: string | null;
    }
  | AskCompletedEvent
  | FeatureRequestedDdlViaAskEvent
  | FeatureRequestedHeavierTierEvent
  | FeatureRequestedLargerAccountEvent
  | FeatureDestructivePreviewRenderedEvent
  | FeatureDestructiveCommittedEvent
  | HomeSurfaceWishlistEvent
  | PricingPageViewedEvent
  | PricingPlanSelectedEvent
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
