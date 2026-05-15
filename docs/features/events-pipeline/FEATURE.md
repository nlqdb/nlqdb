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
- **Why:** Free-form `(name, props)` shapes drift across producer and consumer — the producer typos a property and the sink silently maps to `null`, the funnel reports a hole that doesn't exist. A discriminated union makes the consumer's `switch (event.name)` exhaustive at compile time; the `default: const _exhaustive: never = event` arm is a TypeScript error when a new variant is added without sink coverage.
- **Consequence in code:** No `Record<string, unknown>` properties on events. Sink files use `switch (event.name)` with no default arm reachable at runtime. Producer call-sites that omit a required field fail `bun run typecheck` before merge. Reviewers reject any `as ProductEvent` cast.
- **Alternatives rejected:**
  - PostHog-style `capture(name, props)` — no compile-time guarantee the consumer recognises the name; reorderings of property names produce silent funnel breakage.
  - Protobuf / external schema — overkill for ≤ 10 event types and adds a build step on the Worker bundle.

### SK-EVENTS-003 — Fire-and-forget on producer; queue retries are the only retry surface

- **Decision:** `events.emit()` resolves to `Promise<void>` and never throws. A failed `queue.send()` is recorded on the `nlqdb.events.enqueue` OTel span (status `ERROR`, exception attached) and the call returns normally. Retry behaviour is delegated entirely to Cloudflare Queues' `max_retries` (3) on the consumer side.
- **Core value:** Honest latency, Effortless UX, Bullet-proof
- **Why:** A producer that throws on enqueue failure either 500s the user's `/v1/ask` (unacceptable — events are observability, not part of the answer) or forces every call-site to wrap `events.emit()` in try/catch (boilerplate that decays). The OTel span is the diagnostic surface; the queue retry budget is the recovery surface. They never overlap.
- **Consequence in code:** Producer call-sites do `await events.emit(...)` without try/catch; reviewers reject try/catch wrappers around `emit()`. The `makeNoopEmitter()` helper is used in tests and any environment without an `EVENTS_QUEUE` binding (local `wrangler dev` without `--remote`) so call-sites don't branch on emitter shape. `nlqdb.events.enqueue` failure surfaces as an OTel span — alerting hooks watch the span, not the request status.
- **Alternatives rejected:**
  - Throw on `queue.send()` failure — leaks queue-availability into user-facing latency.
  - Local in-memory retry on the producer — Workers' isolate is recycled mid-retry; the events are lost and the latency contract was already violated.

### SK-EVENTS-004 — Stable envelope `id` per event for downstream idempotency

- **Decision:** Every emission is wrapped in an `EventEnvelope { id, ts, event }`. The `id` defaults to a deterministic per-event-shape derivation (`user.first_query.<userId>`, `billing.subscription_created.<subscriptionId>`, etc.) so duplicate emissions of the same logical event collapse at the sink (LogSnag accepts an `event_id` for idempotency). Producers can override via `events.emit(event, { id })`; the Stripe handler does this with `billing.subscription_created.<sub.id>` because `dispatchEvent` doesn't see the wrapping `Stripe.Event.id`.
- **Core value:** Bullet-proof
- **Why:** Producer-side enqueues retry implicitly (Workers retries, Stripe webhook retries, anonymous-mode handoff retries). Without a stable id, LogSnag double-counts a single user's first query. Deriving the id from the event's logical scope (user, subscription, email-hash) means deduplication is structural — not a "remember to pass an idempotency key" thing call-sites can forget.
- **Consequence in code:** `defaultId()` in `packages/events/src/index.ts` has an exhaustive `switch (event.name)` over `ProductEvent`. New variants must add a deterministic case or a documented fallback to `crypto.randomUUID()`. The consumer passes the envelope `id` through to LogSnag's `event_id` field in `apps/events-worker/src/sinks/logsnag.ts`. Adding a new event without thinking about idempotency keys is a TypeScript error (the `_exhaustive: never` line).
- **Alternatives rejected:**
  - Random UUID for every emission — duplicates are uncatchable; the founder-signal channel becomes noisy.
  - Server-derived id at the sink — couples idempotency to the sink's contract; a second sink that doesn't honour `event_id` silently double-counts.

### SK-EVENTS-005 — Unconfigured sink ack-and-drops; never blocks delivery to other sinks

- **Decision:** When a sink's required env vars are absent (`LOGSNAG_TOKEN` / `LOGSNAG_PROJECT`), the consumer reaches a no-op `return` and `msg.ack()`s. It does not throw, retry, or block other sinks. Intentional dev / CI behaviour: `wrangler dev` without secrets ack-drops every message.
- **Core value:** Effortless UX, Bullet-proof
- **Why:** Throwing on missing config piles up retries forever and exhausts the queue ops budget. Adding a sink must not break delivery to existing sinks (especially during a partial rollout where a new secret hasn't been mirrored). The OTel `nlqdb.events.dispatch` span already records the event id — operators find dropped events via traces, not via crashed Workers.
- **Consequence in code:** Each sink is env-gated (`if (!env.X || !env.Y) return`). Adding a sink requires a four-place sync: env-gate + `apps/events-worker/.envrc` + `scripts/mirror-secrets-workers.sh` SECRETS array + `apps/events-worker/src/env.d.ts`. Documented in `apps/events-worker/README.md` "Adding a new sink".
- **Alternatives rejected:**
  - Throw on missing config and rely on Cloudflare retry — burns the 10K/day queue ops budget within minutes of a config drift.
  - Crash-fast on first batch — same end result after retries exhaust, longer delay, more noise.

### SK-EVENTS-006 — Canonical event-name schema: `<domain>.<verb_noun>`, snake_dot, lowercase

- **Decision:** Event names follow `<domain>.<verb_noun>` (e.g. `user.registered`, `user.first_query`, `billing.subscription_created`, `billing.subscription_canceled`). Domains today: `user`, `billing`. **No `trial.*` events** (the free tier IS the trial — see `docs/architecture.md §5`). **Sign-ins are deliberately not emitted** — they would dominate the LogSnag 2,500/mo free quota with no founder signal.
- **Core value:** Free, Simple, Honest latency
- **Why:** A consistent naming scheme keeps LogSnag / future PostHog dashboards readable without a translation layer. The 2,500/mo quota is a hard constraint on what's worth emitting — the rule "fire only one-shot lifecycle events" is what keeps the free-tier sink viable. Trial events would lie about a funnel that doesn't exist.
- **Consequence in code:** Reviewers reject names like `userSignedIn` (camelCase), `user-first-query` (kebab), `signin` (no domain). Reviewers reject any new event that fires more than once per user-lifecycle without an explicit cost analysis (e.g. PostHog wired alongside LogSnag with its own quota). The Stripe webhook deliberately does not emit `billing.subscription_updated` (`SK-STRIPE-005`); update is pure state sync.
- **Alternatives rejected:**
  - Per-team naming conventions — LogSnag's UI fragments into incomparable groups within a quarter.
  - Emit every signal "for completeness" — exhausts the free-tier sink quota and adds zero founder signal.

### SK-EVENTS-007 — PostHog as a future second sink, gated on a real cohort question

- **Decision:** PostHog Cloud is held in reserve. Wiring is deferred until a real cohort / funnel / retention question lands that SQL on D1/Neon can't answer. When wired, it plugs into `apps/events-worker/src/sinks/posthog.ts` — call-sites stay unchanged. Server-side from the Worker only (no client SDK on the marketing site — would break Lighthouse 100s).
- **Core value:** Free, Honest latency, Effortless UX
- **Why:** PostHog Cloud is free for 1M events/mo but its client SDK adds ~30KB and a third-party fetch that hurts Lighthouse and contradicts the zero-tracking-pixel posture (DESIGN §5.4). Until a real cohort question lands, env vars stay empty and the sink no-ops via `SK-EVENTS-005`.
- **Consequence in code:** No PostHog client in `apps/api` or `apps/web`. When wiring, follow the four-place sync from `SK-EVENTS-005`. Until then, `apps/events-worker/src/sinks/` has only `logsnag.ts` + `query-log.ts`.
- **Alternatives rejected:**
  - PostHog client SDK on marketing site — destroys Lighthouse, contradicts no-tracking-pixel posture.
  - Wire PostHog now for redundancy — burns time on signal we can't yet act on.

### SK-EVENTS-008 — Retry exhaustion drops silently; DLQ deferred until OTel signal warrants it

- **Decision:** `wrangler.toml`'s `max_retries = 3` is the only retry surface. After exhaustion the message drops — no DLQ today. When OTel counters show meaningful volume, configure a DLQ via a second queue (`dead_letter_queue = "nlqdb-events-dlq"`).
- **Core value:** Simple, Free, Honest latency
- **Why:** A DLQ is a second queue + consumer + alerting story. The OTel span on every dispatch gives us the signal; building the DLQ before that signal lands is over-engineering. Structured logs (`dispatch failed <name> id=<id>: <message>`) plus `wrangler tail` cover ad-hoc drops in the meantime.
- **Consequence in code:** `apps/events-worker/src/index.ts` calls `msg.retry()` on dispatch error, `msg.ack()` on success / unconfigured sink. No DLQ binding. The "future DLQ" snippet lives in `apps/events-worker/README.md`'s "Failure handling" so wiring is one-step when the signal arrives.
- **Alternatives rejected:**
  - DLQ from day one — extra infra for a system that has not observed retry exhaustion.
  - Persist failed messages to D1 — D1 is the primary user store; conflating event backlog with user data violates the boundary.

### SK-EVENTS-009 — `ask.completed` → Tinybird `query_log` sink; circuit-break after 5 consecutive failures

- **Decision:** Every `/v1/ask` success emits one `ask.completed` (anonymised — `db_id`, `schema_hash`, `query_hash`, `plan_shape`, `engine`, `orchestrator_ms`, `rows_returned`, `ts`, plus `event_id` from the envelope; no SQL text, no values, no PII). Orchestrator hands the emit to `ctx.waitUntil` so the queue round-trip never sits on the `/v1/ask` path. The events-worker drains the whole batch via a single Tinybird HTTP call (`/v0/events?name=query_log&wait=true`). The Tinybird HTTP boundary lives in `@nlqdb/db/clickhouse-tinybird/query-log.ts` (`GLOBAL-021`); the worker imports `writeQueryLog` and never holds the token / SDK / wire format itself. After 5 consecutive batch-write failures the sink trips an isolate-scoped circuit-breaker — the next batch ack-and-drops until a successful write resets the counter.
- **Core value:** Fast, Free, Bullet-proof
- **Why:** `/v1/ask` p99 cannot absorb a Tinybird HTTP call (`SK-EVENTS-001`); the queue + sink is the only safe place to write the workload-analyser input (W5 reads `query_log`). One canonical owner per `GLOBAL-021` keeps the token / fetch client / OTel mapping in one file. The breaker protects the Tinybird Free-tier 1k-reads/day budget when upstream is wedged — rather than burning the 3-retry queue budget × 100-row batches × N retries, the breaker short-circuits and lets the OTel failures counter be the operator signal. Five failures is the bar because Cloudflare Queues already retries each message three times in-flight; the fifth distinct batch failure is unambiguous upstream-down.
- **Consequence in code:** `apps/events-worker/src/sinks/query-log.ts` dispatches; `packages/db/src/clickhouse-tinybird/query-log.ts` owns the wire format. Spans (`performance.md §3.1`): `nlqdb.events.sink.query_log` per batch (`batch_size`, `http.response.status_code`, `rows_written`, `circuit_open`); the writer also emits a `db.query` span (`operation=EVENTS_WRITE`) so write latency lands on `nlqdb.db.duration_ms{operation}`. Metrics: `nlqdb.events.sink.query_log.batch_size` (histogram), `nlqdb.events.sink.query_log.failures.total{status_class}` (`4xx`/`5xx`/`transport`). Env: `TINYBIRD_TOKEN`, optional `TINYBIRD_API_BASE`; missing config ack-and-drops per `SK-EVENTS-005`. The wire row carries `event_id` from `EventEnvelope.id` so consumers dedupe at read time. Widening the wire shape requires same-PR edits to `AskCompletedEvent`, `toWireRow`, and `infrastructure/tinybird/datasources/query_log.datasource`.
- **Alternatives rejected:**
  - Inline Tinybird POST from `apps/api` — adds 100–300ms RTT to every ask; violates `SK-EVENTS-001`.
  - Events-worker holds the token directly — violates `GLOBAL-021`; spreads the SDK shape across files.
  - Per-message Tinybird call — burns the Tinybird Free-tier daily request budget when batched ingest works trivially.
  - DLQ-on-failure instead of circuit-break — premature per `SK-EVENTS-008`; flipping to DLQ is a one-line wrangler change once the failure counter says so.

### SK-EVENTS-010 — `feature.*` event domain: every "not yet" path emits a typed signal

- **Decision:** The `feature.*` domain joins `user.*` / `billing.*` / `ask.*`. Phase 1.5 ships two variants: `feature.requested.ddl_via_ask` (LLM emitted DDL on `/v1/ask` — reject reasons in `DDL_REJECT_REASONS`) and `feature.requested.heavier_tier` (any `/v1/ask` 429; distinct from the `auth_required` sign-in nudge). Both carry `principalId` and `surface: NlqSurface`. `home.surface_wishlist` landed in `SK-EVENTS-011`. Future variants (`byo_pg`, `team_workspace`, `unknown_cli_verb`) land with their emit site.
- **Core value:** Bullet-proof, Free, Honest latency
- **Why:** [`GLOBAL-024`](../../decisions/GLOBAL-024-demand-signal-telemetry.md) is the canonical rule; this block is the shape. The §6 trigger reads off `feature.*` counts, so a typed union keeps a property typo from silently swallowing the signal (`SK-EVENTS-002`). Reusing the queue + sink seam (`SK-EVENTS-001`) limits the cost to one `switch` arm per variant.
- **Consequence in code:**
  - `packages/events/src/types.ts`: two variants plus `NlqSurface = "hero" | "chat" | "embed" | "mcp" | "cli"` — one union is both the event field and the `nlqdb.surface` OTel attribute value (`performance.md §3.3`).
  - `defaultId()` keys the new variants by `${name}.${principalId}.${utcDay}`; the LogSnag sink passes `EventEnvelope.id` through to `event_id` (`SK-EVENTS-004`) so the per-day collapse actually happens.
  - `apps/events-worker/src/sinks/logsnag.ts`: both variants land on the `demand-signal` channel with `notify: false`.
  - `apps/api/src/ask/demand-signal.ts`: `emitFeatureSignal()` fires from `outcome.error` arms of `/v1/ask` (SSE + JSON) and `/v1/chat/messages`; the anon per-IP 429 path emits inline before its early return. All emits go through `ctx.waitUntil`.
  - `DDL_REJECT_REASONS` lives in `apps/api/src/ask/sql-validate.ts` next to `SqlRejectReason` so the demand-signal set can't drift from the validator.
  - Surface derivation lives in `surfaceFromPrincipal()` (`apps/api/src/principal.ts`) — `anon → hero`, `user → chat`, `pk_live → embed`.
- **Alternatives rejected:**
  - Variants for surfaces that don't exist yet (MCP, CLI) — orphan types drift.
  - Emit on `auth_required` — conflates sign-in nudge with "I want a heavier tier".
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

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
- **GLOBAL-013** — $0/month free tier; ≤ 3 MiB Workers bundle. *In this feature:* the events-worker imports `@nlqdb/db/clickhouse-tinybird` for `writeQueryLog`; plain `fetch` keeps bundle weight within budget.
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
- **GLOBAL-021** — Each external system has one canonical owning module. *In this feature:* the events-worker owns `EVENTS_QUEUE` (consumer); `packages/events/` owns the producer types. Tinybird HTTP is owned by `packages/db/clickhouse-tinybird/` — `SK-EVENTS-009`'s sink imports `writeQueryLog` rather than POSTing directly. Owner-to-owner library dependency is explicitly allowed by GLOBAL-021.
- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path. *In this feature:* `SK-EVENTS-010` + `SK-EVENTS-011`.

## Open questions / known unknowns

- **DLQ activation threshold.** No agreed dropped-event rate that triggers DLQ wiring; document the threshold (e.g. > X drops/day for 3 days) in `apps/events-worker/README.md`.
- **PostHog wiring criteria.** "Real cohort question SQL can't answer" is qualitative. Capture a concrete checklist before wiring.
- **Schema evolution.** Adding a field to an existing `ProductEvent` variant breaks `typecheck` for older producers in flight during deploy. Document a migration recipe before a non-additive change lands.
- **Queue free-tier ceiling.** 10K ops/day = ~3.3K msgs/day at 3 ops/msg. Head-room is thin; capture a "hot signal" alert when daily ops cross 70%.
- **Inbound-email sink.** Cloudflare Email Routing is wired separately; decide whether a future `support.email_received` event flows through this pipeline.
- **Wishlist global cap (SK-EVENTS-011).** Only per-IP throttle (10/min). Distributed-IP abuse can exceed the Queue free-tier ceiling at request time even though producer-side dedup bounds LogSnag burn. Add a daily global cap on `/v1/events/wishlist` when `nlqdb.events.wishlist` shows abuse.
