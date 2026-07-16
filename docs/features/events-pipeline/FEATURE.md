---
name: events-pipeline
description: EVENTS_QUEUE producer + events-worker consumer that fans out to sinks (LogSnag, etc.).
when-to-load:
  globs:
    - apps/events-worker/**
    - packages/events/**
  topics: [events, queue, events-worker, sinks, logsnag, posthog]
---

# Feature: Events Pipeline

**One-liner:** EVENTS_QUEUE producer + events-worker consumer that fans out to sinks (LogSnag, etc.).
**Status:** implemented (Slice 3 — `packages/events` + queue; Slice 7 wires `billing.*` emissions)
**Owners (code):** `packages/events/**`, `apps/events-worker/**`
**Cross-refs:** docs/architecture.md §5.4 · docs/phase-plan.md · docs/runbook.md §6 · docs/performance.md §3.1 + §4 · `apps/events-worker/README.md`

## Touchpoints — read this feature before editing

- `packages/events/**` (producer SDK + `ProductEvent` discriminated union)
- `apps/events-worker/**` (queue consumer + sinks)
- `apps/api/**` call-sites (`events.emit(...)`)
- Cloudflare Queue `nlqdb-events` (binding `EVENTS_QUEUE`)
- `wrangler.toml` queue-consumer config (`max_retries`, future DLQ)

## Decisions

### SK-EVENTS-001 — Producer/consumer split via Cloudflare Queue, never inline `ctx.waitUntil`

- **Decision:** Events flow `apps/api` → `EVENTS_QUEUE` (Cloudflare Queue `nlqdb-events`) → `apps/events-worker` → sinks. Only `apps/events-worker` talks to external sinks; `apps/api` MUST NOT import any sink SDK (LogSnag, PostHog, Resend).
- **Core value:** Fast, Honest latency, Bullet-proof
- **Why:** `/v1/ask` p50 (<400ms cache hit) cannot absorb sink latency. Inline `ctx.waitUntil` still bills the Worker, blocks isolate shutdown, and gives no retry budget. Queues hand us 3 free retries, batching (up to 10 per invocation), and sink isolation on Workers Free tier (10K queue ops/day = ~3.3K msgs/day at 3 ops/msg).
- **Consequence in code:** CI rejects any `apps/api` import of `@logsnag/*` / `posthog-*`. New sinks land as `apps/events-worker/src/sinks/<name>.ts` with their own env-gated branch. Adding a producer call-site is one `events.emit({...})` line.
- **Alternatives rejected:**
  - Inline `ctx.waitUntil(sink.publish(...))` — couples request bundle to sink SDKs, breaks `GLOBAL-013`'s 3 MiB ceiling, zero retry.
  - A third Worker per sink — the queue + dispatch already isolates; doubles cold-start cost.

### SK-EVENTS-002 — Discriminated-union event payloads, not free-form `(name, props)`

- **Decision:** `ProductEvent` in `packages/events/src/types.ts` is a TypeScript discriminated union keyed on `name`. Producers call `events.emit({ name: "user.first_query", userId, dbId })`; consumer dispatch is type-checked. Adding a new event = (1) new union variant, (2) new sink case in `apps/events-worker/src/sinks/logsnag.ts`'s `buildPayload()`, (3) test asserting dispatch.
- **Core value:** Bullet-proof, Simple
- **Why:** Free-form `(name, props)` shapes drift across producer and consumer — a typo'd property maps to `null` at the sink and the funnel reports a hole that doesn't exist. A discriminated union makes the consumer's `switch (event.name)` exhaustive at compile time; the `default: const _exhaustive: never = event` arm errors when a new variant lands without sink coverage.
- **Consequence in code:** No `Record<string, unknown>` properties on events. Sink files use `switch (event.name)` with no default arm reachable at runtime. Producer call-sites that omit a required field fail `bun run typecheck` before merge. Reviewers reject any `as ProductEvent` cast.
- **Alternatives rejected:**
  - PostHog-style `capture(name, props)` — no compile-time guarantee the consumer recognises the name; reorderings of property names produce silent funnel breakage.
  - Protobuf / external schema — overkill for ≤ 10 event types and adds a build step on the Worker bundle.

### SK-EVENTS-003 — Fire-and-forget on producer; queue retries are the only retry surface

- **Decision:** `events.emit()` resolves to `Promise<void>` and never throws. A failed `queue.send()` is recorded on the `nlqdb.events.enqueue` OTel span (status `ERROR`, exception attached) and the call returns normally. Retry behaviour is delegated entirely to Cloudflare Queues' `max_retries` (3) on the consumer side.
- **Core value:** Honest latency, Effortless UX, Bullet-proof
- **Why:** A producer that throws on enqueue failure either 500s the user's `/v1/ask` (unacceptable — events are observability, not part of the answer) or forces every call-site to wrap `events.emit()` in try/catch (boilerplate that decays). The OTel span is the diagnostic surface; the queue retry budget is the recovery surface. They never overlap.
- **Consequence in code:** Producer call-sites do `await events.emit(...)` without try/catch; reviewers reject try/catch wrappers around `emit()`. `makeNoopEmitter()` covers tests + any env without an `EVENTS_QUEUE` binding so call-sites don't branch on emitter shape. `nlqdb.events.enqueue` failure surfaces as an OTel span — alerting watches the span, not the request status.
- **Alternatives rejected:**
  - Throw on `queue.send()` failure — leaks queue-availability into user-facing latency.
  - Local in-memory retry on the producer — Workers' isolate is recycled mid-retry; the events are lost and the latency contract was already violated.

### SK-EVENTS-004 — Stable envelope `id` per event for downstream idempotency

- **Decision:** Every emission is wrapped in an `EventEnvelope { id, ts, event }`. The `id` defaults to a deterministic per-event-shape derivation (`user.first_query.<userId>`, `billing.subscription_created.<subscriptionId>`, etc.) so duplicate emissions of the same logical event collapse at the sink (LogSnag accepts an `event_id` for idempotency). Producers can override via `events.emit(event, { id })`; the Stripe handler does this with `billing.subscription_created.<sub.id>` because `dispatchEvent` doesn't see the wrapping `Stripe.Event.id`.
- **Core value:** Bullet-proof
- **Why:** Producer-side enqueues retry implicitly (Workers, Stripe webhooks, anon-handoff). Without a stable id, LogSnag double-counts. Deriving the id from the event's logical scope (user, subscription, email-hash) makes dedup structural — not a "remember to pass an idempotency key" call-sites can forget.
- **Consequence in code:** `defaultId()` in `packages/events/src/index.ts` has an exhaustive `switch (event.name)` over `ProductEvent`. New variants must add a deterministic case or a documented fallback to `crypto.randomUUID()`. The consumer passes the envelope `id` through to LogSnag's `event_id` field in `apps/events-worker/src/sinks/logsnag.ts`. Adding a new event without thinking about idempotency keys is a TypeScript error (the `_exhaustive: never` line).
- **Alternatives rejected:**
  - Random UUID for every emission — duplicates are uncatchable; the founder-signal channel becomes noisy.
  - Server-derived id at the sink — couples idempotency to the sink's contract; a second sink that doesn't honour `event_id` silently double-counts.

### SK-EVENTS-005 — Unconfigured sink ack-and-drops; never blocks delivery to other sinks

- **Decision:** When a sink's required env vars are absent (`LOGSNAG_TOKEN` / `LOGSNAG_PROJECT`), the consumer reaches a no-op `return` and `msg.ack()`s. It does not throw, retry, or block other sinks. Intentional dev / CI behaviour: `wrangler dev` without secrets ack-drops every message.
- **Core value:** Effortless UX, Bullet-proof
- **Why:** Throwing on missing config piles up retries forever and exhausts the queue ops budget. Adding a sink must not break delivery to existing sinks (especially mid-rollout before a new secret is mirrored). The OTel `nlqdb.events.dispatch` span records the event id — operators find dropped events via traces, not crashed Workers.
- **Consequence in code:** Each sink is env-gated (`if (!env.X || !env.Y) return`). Adding a sink requires a four-place sync: env-gate + `apps/events-worker/.envrc` + `scripts/mirror-secrets-workers.sh` SECRETS array + `apps/events-worker/src/env.d.ts`. Documented in `apps/events-worker/README.md` "Adding a new sink".
- **Alternatives rejected:**
  - Throw on missing config and rely on Cloudflare retry — burns the 10K/day queue ops budget within minutes of a config drift.
  - Crash-fast on first batch — same end result after retries exhaust, longer delay, more noise.

### SK-EVENTS-006 — Canonical event-name schema: `<domain>.<verb_noun>`, snake_dot, lowercase

- **Decision:** Event names follow `<domain>.<verb_noun>` (e.g. `user.registered`, `billing.subscription_created`). Domains today: `user`, `billing`, `ask`, `feature`, `home`, `pricing`. **No `trial.*`** — the free tier IS the trial (`docs/architecture.md §5`). Sign-ins are not emitted — would dominate the LogSnag 2,500/mo quota with no founder signal.
- **Core value:** Free, Simple, Honest latency
- **Why:** Consistent naming keeps LogSnag dashboards readable without a translation layer. The 2,500/mo quota is the hard constraint on what's worth routing; high-volume or noisy signals would burn it. Trial events would lie about a funnel that doesn't exist.
- **Consequence in code:** Reviewers reject `userSignedIn` (camelCase), `signin` (no domain). New events firing more than once per user-lifecycle need an explicit cost analysis. Stripe billing event choices (omitted `subscription_updated`, per-invoice dedup on `payment_failed`) live in `SK-STRIPE-005`/`SK-STRIPE-011`.
- **Alternatives rejected:** Per-team naming (LogSnag UI fragments); emit-everything (burns quota with no founder signal).

### SK-EVENTS-007 — PostHog as a future second sink, gated on a real cohort question

- **Status:** Superseded by `SK-EVENTS-013` — the named trigger (a real lifecycle/funnel question, founder directive 2026-07-16) landed and the sink is wired exactly where this decision reserved it (`apps/events-worker/src/sinks/posthog.ts`).

### SK-EVENTS-008 — Retry exhaustion drops silently; DLQ deferred until OTel signal warrants it

- **Decision:** `wrangler.toml`'s `max_retries = 3` is the only retry surface. After exhaustion the message drops — no DLQ today. When OTel counters show meaningful volume, configure a DLQ via a second queue (`dead_letter_queue = "nlqdb-events-dlq"`).
- **Core value:** Simple, Free, Honest latency
- **Why:** A DLQ is a second queue + consumer + alerting story. The OTel span on every dispatch gives us the signal; building the DLQ before that signal lands is over-engineering. Structured logs (`dispatch failed <name> id=<id>: <message>`) plus `wrangler tail` cover ad-hoc drops in the meantime.
- **Consequence in code:** `apps/events-worker/src/index.ts` calls `msg.retry()` on dispatch error, `msg.ack()` on success / unconfigured sink. No DLQ binding. The "future DLQ" snippet lives in `apps/events-worker/README.md`'s "Failure handling" so wiring is one-step when the signal arrives.
- **Alternatives rejected:**
  - DLQ from day one — extra infra for a system that has not observed retry exhaustion.
  - Persist failed messages to D1 — D1 is the primary user store; conflating event backlog with user data violates the boundary.

### SK-EVENTS-009 — `ask.completed` → Tinybird `query_log` sink; circuit-break after 5 consecutive failures

- **Decision:** Every `/v1/ask` success emits one `ask.completed` (anonymised — `db_id`, `schema_hash`, `query_hash`, `plan_shape`, `engine`, `orchestrator_ms`, `rows_returned`, `ts`, `event_id`; no SQL text, values, or PII), handed to `ctx.waitUntil` so the queue round-trip never sits on the `/v1/ask` path. The events-worker drains the whole batch via a single Tinybird HTTP call. The Tinybird boundary lives in `@nlqdb/db/clickhouse-tinybird/query-log.ts` (`GLOBAL-021`); the worker imports `writeQueryLog` and never holds the token / SDK / wire format. After 5 consecutive batch-write failures the sink trips an isolate-scoped circuit-breaker — the next batch ack-and-drops until a successful write resets it.
- **Core value:** Fast, Free, Bullet-proof
- **Why:** `/v1/ask` p99 cannot absorb a Tinybird HTTP call (`SK-EVENTS-001`); the queue + sink is the only safe place to write the workload-analyser input (W5 reads `query_log`). One canonical owner per `GLOBAL-021` keeps the token / fetch client / OTel mapping in one file. The breaker protects the Tinybird Free-tier budget when upstream is wedged — it short-circuits rather than burning the retry budget × batch size, and the OTel failures counter is the operator signal. Five is the bar because Queues already retries each message thrice in-flight, so the fifth distinct batch failure is unambiguous upstream-down.
- **Consequence in code:** `apps/events-worker/src/sinks/query-log.ts` dispatches; `packages/db/src/clickhouse-tinybird/query-log.ts` owns the wire format. Spans + metrics are catalogued in `performance.md §3.1` (`nlqdb.events.sink.query_log*`). Env: `TINYBIRD_TOKEN`, optional `TINYBIRD_API_BASE`; missing config ack-and-drops per `SK-EVENTS-005`. The wire row carries `event_id` from `EventEnvelope.id` for read-time dedup. Widening the wire shape requires same-PR edits to `AskCompletedEvent`, `toWireRow`, and `infrastructure/tinybird/datasources/query_log.datasource`.
- **Alternatives rejected:**
  - Inline Tinybird POST from `apps/api` — adds 100–300ms RTT to every ask; violates `SK-EVENTS-001`.
  - Events-worker holds the token directly — violates `GLOBAL-021`; spreads the SDK shape across files.
  - Per-message Tinybird call — burns the Tinybird Free-tier daily request budget when batched ingest works trivially.
  - DLQ-on-failure instead of circuit-break — premature per `SK-EVENTS-008`; flipping to DLQ is a one-line wrangler change once the failure counter says so.

### SK-EVENTS-010 — `feature.*` event domain: every "not yet" path emits a typed signal

- **Decision:** The `feature.*` domain joins `user.*` / `billing.*` / `ask.*`. Variants: `feature.requested.ddl_via_ask` (LLM emitted DDL on `/v1/ask` — reject reasons in `DDL_REJECT_REASONS`); and **two distinct rate-limit signals** — `feature.requested.heavier_tier` (an **anon per-IP tier** trip — no account, wants one) and `feature.requested.larger_account` (an **authed per-account** D1-bucket trip on `/v1/ask`, `/v1/run`, or `/v1/chat` — already has an account, hit its 60/min ceiling). Both are distinct from the `auth_required` sign-in nudge; all carry `principalId` and `surface: NlqSurface`. The two 429s stay separate because an authed cap hit is the highest-intent paying signal (see the rejected single-`rate_limited` alternative). `home.surface_wishlist` landed in `SK-EVENTS-011`. Future variants (`byo_pg`, `team_workspace`, `unknown_cli_verb`) land with their emit site.
- **Core value:** Bullet-proof, Free, Honest latency
- **Why:** [`GLOBAL-024`](../../decisions/GLOBAL-024-demand-signal-telemetry.md) is the canonical rule; this block is the shape. The §6 trigger reads off `feature.*` counts, so a typed union keeps a property typo from silently swallowing the signal (`SK-EVENTS-002`). Reusing the queue + sink seam (`SK-EVENTS-001`) limits the cost to one `switch` arm per variant.
- **Consequence in code:**
  - `packages/events/src/types.ts`: the `feature.requested.*` variants plus `NlqSurface = "hero" | "chat" | "embed" | "mcp" | "cli"` — one union is both the event field and the `nlqdb.surface` OTel attribute value (`performance.md §3.3`).
  - `defaultId()` keys the `feature.requested.*` variants by `${name}.${principalId}.${utcDay}`; the LogSnag sink passes `EventEnvelope.id` through to `event_id` (`SK-EVENTS-004`) so the per-day collapse actually happens.
  - `apps/events-worker/src/sinks/logsnag.ts`: every variant lands on the `demand-signal` channel with `notify: false`.
  - `apps/api/src/ask/demand-signal.ts`: `emitFeatureSignal()` fires from `outcome.error` arms of `/v1/ask` (SSE + JSON) and `/v1/chat` — its `rate_limited` arm is the per-account trip, so `larger_account`. The anon per-IP 429 emits `heavier_tier` inline (`/v1/ask` + `/v1/run`); `/v1/run`'s per-account trip emits `larger_account` inline (the helper also fires `ddl_via_ask`, unwanted there). All via `ctx.waitUntil`.
  - `DDL_REJECT_REASONS` lives in `apps/api/src/ask/sql-validate.ts` next to `SqlRejectReason` so the demand-signal set can't drift from the validator.
  - Surface derivation lives in `surfaceFromPrincipal()` (`apps/api/src/principal.ts`) — `anon → hero`, `user → chat`, `pk_live → embed`.
- **Alternatives rejected:**
  - Variants for surfaces that don't exist yet (MCP, CLI) — orphan types drift.
  - Emit on `auth_required` — conflates sign-in nudge with "I want a heavier tier".
  - One `rate_limited` event for both anon and authed 429s — collapses the highest-intent paying signal (authed cap hit) into the anon "wants an account" bucket; GLOBAL-024 rejects coarse single-counter signal.
  - Per-emit UUID id — burns the quota; per-(user, day) matches the §6 unit-of-decision.

### SK-EVENTS-011 — `home.surface_wishlist` wires the marketing CodePanel into the demand-signal pipeline

- **Decision:** `home.surface_wishlist` carries `principalId` and `surface: WishlistSurface`. `POST /v1/events/wishlist` is public (KV-throttled 10/min/IP), acks 202 + waitUntil per `SK-EVENTS-003`.
- **Core value:** Bullet-proof, Free, Honest latency
- **Why:** The wishlist click previously fired a DOM CustomEvent no one listened to. Wiring it into the events pipeline routes it to the `demand-signal` LogSnag channel where the §6 monetization trigger reads off aggregate surface interest. Wishlist stays public so a marketing visitor doesn't need an anon-bearer for one optional click.
- **Consequence in code:**
  - `packages/events/src/types.ts`: `HomeSurfaceWishlistEvent` joins `ProductEvent`. `defaultId()` keys per-(principal, surface, day) — preserves distinct-surface signals.
  - `apps/events-worker/src/sinks/logsnag.ts`: routes to `demand-signal` with `notify: false` (aggregate matters, not per-click).
  - `apps/api/src/events-feature.ts`: `recordWishlist()` derives `principalId = wl:${sha256(ip:day, 16)}` — distinct prefix from `anon:` so LogSnag's user_id facet doesn't conflate the two.
  - `apps/api/src/index.ts`: `/v1/events/*` rides the existing credentialed CORS allow-list.
  - `apps/web/src/components/CodePanel.astro`: existing wishlist handler now also fires a `keepalive: true` fetch to `/v1/events/wishlist`. DOM CustomEvent stays for legacy listeners; mailto: still runs.
- **Alternatives rejected:**
  - Mint an anon-bearer on marketing load — coerces every visitor into an auth artifact for one optional click.
  - Emit on render rather than click — destroys the intent signal; a render is not an opt-in.

### SK-EVENTS-012 — `pricing.*` funnel: first-party, identity-bearing pricing-page events

- **Decision:** Two events instrument the marketing pricing page. `pricing.page_viewed` (one per visitor per day) and `pricing.plan_selected` (`plan: "hobby" | "pro"`, one per visitor per plan per day) both carry `principalId` + `email: string | null`. `POST /v1/events/pricing` is public (KV-throttled 20/min/IP) and resolves the session cookie **server-side** to attribute a signed-in visitor to their `userId` + account email; a logged-out visitor falls back to a per-day IP-hash bucket `pv:<16hex>`. Both land on a dedicated LogSnag `pricing` channel (`notify: false`). Client capture is a `keepalive` fetch from `apps/web/src/pages/pricing.astro` (`credentials: "include"`), never the Cloudflare Web Analytics beacon.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** Cloudflare Web Analytics ([`GLOBAL-034`](../../decisions/GLOBAL-034-analytics-stack.md)) is the wrong tool for the founder's actual question — "how many **unique** people looked at pricing / picked a paid plan, and which are me". Its beacon (`static.cloudflareinsights.com`) is on every ad/privacy blocklist, so the technical-founder ICP is exactly who it under-counts (a founder's own visits never registered at all); its free tier rounds page counts to buckets of 10 and drops sub-floor pages; and a pageview carries no identity to dedupe or self-exclude. A first-party POST to our own origin survives blockers, and a server-derived `principalId` makes unique-count + self-exclusion (`tags.email`) answerable on the existing LogSnag `user_id` facet — no new sink, no client SDK, so GLOBAL-034's Lighthouse / no-cookie-banner posture holds. Per-day `defaultId` dedup makes "unique" the default unit and keeps the 2,500/mo quota safe.
- **Consequence in code:**
  - `packages/events/src/types.ts`: `PricingPlan`, `PricingPageViewedEvent`, `PricingPlanSelectedEvent` join `ProductEvent`; `pricing` added to the domain list (`SK-EVENTS-006`). `defaultId()` keys page-view per-(principal, day) and plan-select per-(principal, plan, day).
  - `apps/events-worker/src/sinks/logsnag.ts`: both variants route to the `pricing` channel; `user_id = principalId`, `tags` carry `authed` + optional `email` + (for select) `plan`.
  - `apps/api/src/events-feature.ts`: `recordPricingEvent()` derives identity (authed `userId` + email, else `pv:` IP-hash bucket) and never trusts a client-supplied identifier.
  - `apps/api/src/index.ts`: `POST /v1/events/pricing` rides the existing `/v1/events/*` credentialed CORS and resolves the session opportunistically (degrades to anon on resolver failure).
  - `apps/web/src/pages/pricing.astro`: page-view emit on load; plan-select emit at the top of the CTA handler (fires for logged-out clicks too — the redirect-to-sign-in path is still intent).
- **Alternatives rejected:**
  - **Fix the Cloudflare beacon instead.** Can't — blockers, 10-rounding, and zero identity are inherent to the tool, not a wiring bug.
  - **Client-supplied email / identifier.** Spoofable; a visitor could inflate or forge the unique-user count. Identity is server-derived from the session cookie.
  - **A dedicated PostHog integration for this question.** The question was answerable on the existing LogSnag `user_id` facet + tags; the `SK-EVENTS-013` generic sink now carries `pricing.*` to PostHog with no per-event work.
  - **Mint an anon-bearer for logged-out views.** Coerces every visitor into an auth artifact for a page load; the per-day IP bucket is the honest anon floor (`SK-EVENTS-011` precedent).

### SK-EVENTS-013 — PostHog sink: server-side fan-out of every `ProductEvent`

**Body:** [`decisions/SK-EVENTS-013-posthog-sink.md`](./decisions/SK-EVENTS-013-posthog-sink.md).
`src/sinks/posthog.ts` drains every `EventEnvelope` to PostHog in one `/batch` POST per queue batch (plain `fetch`, no SDK); envelope `id` → deterministic `uuid` for dedup; env-gated per `SK-EVENTS-005`, best-effort — never touches ack/retry. Client half is [`SK-WEB-024`](../web-app/decisions/SK-WEB-024-posthog-app-surfaces-only.md).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
- **GLOBAL-013** — $0/month free tier; ≤ 3 MiB Workers bundle. *In this feature:* the events-worker imports `@nlqdb/db/clickhouse-tinybird` for `writeQueryLog`; plain `fetch` keeps it in budget.
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
- **GLOBAL-021** — Each external system has one canonical owning module. *In this feature:* the events-worker owns `EVENTS_QUEUE` (consumer); `packages/events/` owns the producer types; Tinybird HTTP is owned by `packages/db/clickhouse-tinybird/`, so `SK-EVENTS-009`'s sink imports `writeQueryLog` rather than POSTing (owner-to-owner deps are GLOBAL-021-allowed).
- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path. *In this feature:* `SK-EVENTS-010` + `SK-EVENTS-011`.
- **GLOBAL-034** — Analytics stack. *In this feature:* the PostHog sink (`SK-EVENTS-013`) drains `EVENTS_QUEUE` server-side, fanning every `ProductEvent` out to PostHog for funnels/cohorts/retention.

## Open questions / known unknowns

- **DLQ activation threshold** — Decided: wire the DLQ when `nlqdb.events.dropped` exceeds 500/day for 2 consecutive days (≈15% of the daily budget); below that the TTL dead-letter pattern is cheaper. Document in the events-worker README when the Grafana alert lands.
- **Schema evolution** — Decided: `ProductEvent` changes are additive-only (new fields optional with a default). Non-additive changes (rename/remove/retype) need a two-step deploy: add the new shape optional alongside the old, then drop the old once all producers ship.
- **Queue free-tier ceiling** — Alert threshold > 7 000 ops/day (70% of 10K), as a Grafana alert on `nlqdb.events.queue_ops`.
- **Inbound-email sink — Parked until a `support.email_received` consumer exists** (`GLOBAL-033` speculative-scope). Email Routing is wired separately; the producer reuses the additive `ProductEvent` contract.
- **Wishlist global cap (SK-EVENTS-011)** — shape resolved per `GLOBAL-033` (pin-a-number, fail-safe; availability-biased non-destructive write): reuse the `apps/api/src/anon-global-cap.ts` counter for a daily `/v1/events/wishlist` cap behind the per-IP 10/min throttle. **Parked until** `nlqdb.events.wishlist` shows distributed-IP abuse.
- **`feature.requested.ddl_via_run` event** — shape resolved per `GLOBAL-033` (reuse what's built): a dedicated `ddl_via_run` `ProductEvent` variant (`packages/events/src/types.ts` + `/v1/run`), not `ddl_via_ask` reuse. **Parked until** raw-SQL DDL is a meaningful signal share.
