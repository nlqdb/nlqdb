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
**Cross-refs:** docs/architecture.md §5.4 (analytics layers) · docs/phase-plan.md (events architecture) · docs/runbook.md §6 (`apps/events-worker` ops) · docs/performance.md §3.1 (`nlqdb.events.emit` span — wrapped in `ctx.waitUntil`, server-side only) · §4 Slices 5/6/7 (`user.registered` / `user.first_query` / `billing.*` emission contracts asserted with stub sink) · `apps/events-worker/README.md`

## Touchpoints — read this feature before editing

- `packages/events/**` (producer SDK + `ProductEvent` discriminated union)
- `apps/events-worker/**` (queue consumer + sinks)
- `apps/api/**` call-sites (`events.emit(...)`)
- Cloudflare Queue `nlqdb-events` (binding `EVENTS_QUEUE`)
- `wrangler.toml` queue-consumer config (`max_retries`, future DLQ)

## Decisions

### SK-EVENTS-001 — Producer/consumer split via Cloudflare Queue, never inline `ctx.waitUntil`

- **Decision:** Product events flow `apps/api` → `EVENTS_QUEUE` (Cloudflare Queue `nlqdb-events`) → `apps/events-worker` → sinks. The producer side is `@nlqdb/events`; only `apps/events-worker` talks to external sinks. `apps/api` MUST NOT import any sink SDK (LogSnag, PostHog, Resend, Stripe-aftermath logic, outbound webhook libs).
- **Core value:** Fast, Honest latency, Bullet-proof
- **Why:** The `/v1/ask` p50 budget (< 400ms cache hit) cannot absorb sink latency. Inline `ctx.waitUntil` runs after the response but still bills the Worker invocation and blocks isolate shutdown — and gives no retry budget when the sink is briefly down. Queues hand us 3 free retries (`wrangler.toml max_retries`), batching (consumer pulls up to 10 events per invocation), and sink isolation (a wedged LogSnag SDK can't reach the `/v1/ask` hot path) for free on Workers Free tier (10K queue ops/day = ~3.3K msgs/day at 3 ops/msg).
- **Consequence in code:** CI rejects any `apps/api` import of `@logsnag/*`, `posthog-*`, or other sink SDKs. New sinks are added as `apps/events-worker/src/sinks/<name>.ts` files with their own env-gated branch in `sendToSinks()`. Adding a producer call-site is one `events.emit({...})` line; no fan-out logic ever lives at the call-site.
- **Alternatives rejected:**
  - Inline `ctx.waitUntil(logSnagClient.publish(...))` on the request path — couples request-Worker bundle size to sink SDKs, breaks `GLOBAL-013`'s 3 MiB ceiling, and gives zero retry budget.
  - A third Worker per sink — the queue + dispatch shape already isolates sinks per-handler; an extra Worker doubles cold-start cost without buying isolation.

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

- **Decision:** When a sink's required env vars are absent (`LOGSNAG_TOKEN` / `LOGSNAG_PROJECT` for LogSnag), the consumer reaches a no-op `return` and `msg.ack()`s the message. It does not throw, retry, or block any other sink. This is intentional dev / CI behaviour: `wrangler dev` without secrets ack-drops every message, no-op verified by unit test.
- **Core value:** Effortless UX, Bullet-proof
- **Why:** Throwing on missing config piles up retries forever and exhausts queue ops budget. Adding a sink shouldn't be able to break delivery to existing sinks (especially during a partial rollout where a new secret hasn't been mirrored yet). The OTel `nlqdb.events.dispatch` span on the parent already records the event id — operators missing config find dropped events via traces, not via crashed Workers.
- **Consequence in code:** Each sink in `sendToSinks()` is gated on its own env-var check (`if (!env.X || !env.Y) return`). Adding a new sink requires (a) the env-gate, (b) entry in `apps/events-worker/.envrc` example, (c) entry in `scripts/mirror-secrets-workers.sh`'s `SECRETS=` array, (d) entry in `apps/events-worker/src/env.d.ts`. The four-place sync is documented in `apps/events-worker/README.md` "Adding a new sink".
- **Alternatives rejected:**
  - Throw on missing config and rely on Cloudflare retry — burns the 10K/day queue ops budget within minutes of a config drift.
  - Crash-fast on the first batch — silently drops every event, but only after retries exhaust; same end result, longer delay, more noise.

### SK-EVENTS-006 — Canonical event-name schema: `<domain>.<verb_noun>`, snake_dot, lowercase

- **Decision:** Event names follow `<domain>.<verb_noun>` (e.g. `user.registered`, `user.first_query`, `billing.subscription_created`, `billing.subscription_canceled`). Domains today: `user`, `billing`. **No `trial.*` events** (the free tier IS the trial — see `docs/architecture.md §5`). **Sign-ins are deliberately not emitted** — they would dominate the LogSnag 2,500/mo free quota with no founder signal.
- **Core value:** Free, Simple, Honest latency
- **Why:** A consistent naming scheme keeps LogSnag / future PostHog dashboards readable without a translation layer. The 2,500/mo quota is a hard constraint on what's worth emitting — the rule "fire only one-shot lifecycle events" is what keeps the free-tier sink viable. Trial events would lie about a funnel that doesn't exist.
- **Consequence in code:** Reviewers reject names like `userSignedIn` (camelCase), `user-first-query` (kebab), `signin` (no domain). Reviewers reject any new event that fires more than once per user-lifecycle without an explicit cost analysis (e.g. PostHog wired alongside LogSnag with its own quota). The Stripe webhook deliberately does not emit `billing.subscription_updated` (`SK-STRIPE-005`); update is pure state sync.
- **Alternatives rejected:**
  - Per-team naming conventions — LogSnag's UI fragments into incomparable groups within a quarter.
  - Emit every signal "for completeness" — exhausts the free-tier sink quota and adds zero founder signal.

### SK-EVENTS-007 — PostHog as a future second sink, gated on a real cohort question

- **Decision:** A second sink — PostHog Cloud — is held in reserve. Wiring is deliberately deferred until a real cohort / funnel / retention question lands that SQL on D1/Neon can't answer. When wired, it plugs into `apps/events-worker/src/sinks/posthog.ts` alongside LogSnag — call-sites stay unchanged. PostHog must run server-side from the Worker (no client SDK on the marketing site, would break Lighthouse 100s) wrapped in `ctx.waitUntil` after the response.
- **Core value:** Free, Honest latency, Effortless UX
- **Why:** PostHog Cloud is free for 1M events/mo, but the marketing-site client SDK adds ~30KB and a third-party fetch that hurts Lighthouse and contradicts our zero-tracking-pixel posture (DESIGN §5.4). Server-side capture from the Worker preserves the user-facing latency budget by construction. Until a question lands that needs cohort analysis, the env vars stay empty and the sink no-ops via `SK-EVENTS-005`.
- **Consequence in code:** No PostHog client in `apps/api` or `apps/web`. When wiring, follow the four-place sync from `SK-EVENTS-005`. Capture path: server-side from `apps/events-worker`, in `ctx.waitUntil`, attaching `nlqdb.events.emit` span attributes (PERFORMANCE §3.1). Until then, the `apps/events-worker/src/sinks/` directory has only `logsnag.ts`.
- **Alternatives rejected:**
  - Wire PostHog client SDK into the marketing site for "complete funnel coverage" — destroys Lighthouse scores and contradicts the no-tracking-pixel posture.
  - Wire PostHog now as a second sink for redundancy — burns engineering time on signal we can't yet act on.

### SK-EVENTS-008 — Retry exhaustion drops silently; DLQ deferred until OTel signal warrants it

- **Decision:** On the consumer side, `wrangler.toml`'s `max_retries = 3` is the only retry surface. After exhaustion the message is dropped — there is no DLQ wired today. When dropped-message counters in OTel start showing meaningful volume, configure a DLQ via a second queue and set `dead_letter_queue = "nlqdb-events-dlq"` in `wrangler.toml`'s `[[queues.consumers]]` block.
- **Core value:** Simple, Free, Honest latency
- **Why:** A DLQ is a second queue, a second consumer, and a second alerting story. Standing one up before the data shows it's needed is over-engineering. The OTel span on every dispatch (`nlqdb.events.dispatch`) gives us the signal — when retry-exhaustion drops cross some threshold, build the DLQ then. Until then, structured logs (`dispatch failed <name> id=<id>: <message>`) plus `wrangler tail` give an operator enough to diagnose ad-hoc drops.
- **Consequence in code:** The consumer in `apps/events-worker/src/index.ts` calls `msg.retry()` on dispatch error and `msg.ack()` on success or unconfigured sink. No DLQ binding in `wrangler.toml`. The "future DLQ" snippet is preserved in `apps/events-worker/README.md`'s "Failure handling" section so the wiring is one-step when the signal arrives.
- **Alternatives rejected:**
  - DLQ from day one — extra infra surface for a Phase-0 system that has not yet observed retry exhaustion in the wild.
  - Persist failed messages to D1 — D1 is the primary user store; conflating event-pipeline backlog with user data violates the boundary.

### SK-EVENTS-009 — `ask.completed` → Tinybird `query_log` sink; circuit-break after 5 consecutive failures

- **Decision:** Every successful `/v1/ask` resolution emits one `ask.completed` event onto `EVENTS_QUEUE` (anonymised — `db_id`, `schema_hash`, `query_hash`, `plan_shape`, `engine`, `orchestrator_ms`, `rows_returned`, `ts`, plus `event_id` from the producer envelope; no SQL text, no parameter values, no PII). The orchestrator hands the emit to `ctx.waitUntil` from the route handler so the queue producer round-trip never sits on the `/v1/ask` response path. The events-worker drains the whole batch via a single Tinybird HTTP call to `/v0/events?name=query_log&wait=true`. The Tinybird HTTP boundary lives in `@nlqdb/db/clickhouse-tinybird/query-log.ts` (per `GLOBAL-021`); the events-worker imports `writeQueryLog`/`createQueryLogWriter` and never imports Tinybird's HTTP client / SDK / wire format of its own — the token is delivered via env per Workers convention. After 5 consecutive batch-write failures the sink trips an isolate-scoped circuit-breaker — the next batch ack-and-drops without calling Tinybird until a successful write resets the counter.
- **Core value:** Fast, Free, Bullet-proof
- **Why:** `/v1/ask` p99 latency cannot absorb a Tinybird HTTP call (`SK-EVENTS-001`); the queue + sink is the only safe place to write the workload-analyser input (W5 reads `query_log`). One canonical owner per `GLOBAL-021` keeps the Tinybird token / fetch client / OTel attribute mapping in one file — the events-worker stays thin. Circuit-break protects the Tinybird Free-tier 1k-reads/day budget when the upstream is wedged: rather than burning the 3-retry queue budget per message + 100-row batches × N retries, the breaker short-circuits and lets the OTel `nlqdb.events.sink.query_log.failures.total` counter be the operator signal. Five consecutive failures is the bar because Cloudflare Queues already retries each message three times in-flight; the fifth distinct batch failure is unambiguous upstream-down.
- **Consequence in code:** `apps/events-worker/src/sinks/query-log.ts` dispatches; `packages/db/src/clickhouse-tinybird/query-log.ts` is the wire-format owner (per `GLOBAL-021`). Spans (`performance.md §3.1`): `nlqdb.events.sink.query_log` per batch (carries `batch_size`, `http.response.status_code`, `rows_written`, `circuit_open`); the writer also emits a `db.query` span (`operation=EVENTS_WRITE`, `db.system=other_sql`) so write latency lands on `nlqdb.db.duration_ms{operation}` alongside the read path. Metrics: `nlqdb.events.sink.query_log.batch_size` (histogram) and `nlqdb.events.sink.query_log.failures.total{status_class}` (`status_class` clamped to `4xx` / `5xx` / `transport` per §3.3). Env: `TINYBIRD_TOKEN`, optional `TINYBIRD_API_BASE`; missing config ack-and-drops per `SK-EVENTS-005`. The wire row carries `event_id` from `EventEnvelope.id` so consumers dedupe at read time (Tinybird does not dedupe natively; Queues redeliver). Widening the wire shape requires same-PR edits to `AskCompletedEvent`, `toWireRow`, and `infrastructure/tinybird/datasources/query_log.datasource`.
- **Alternatives rejected:**
  - Inline Tinybird POST from `apps/api` on the `/v1/ask` request path — adds 100–300ms of HTTP RTT to every successful ask; violates `SK-EVENTS-001`. The queue is the only safe seam.
  - Events-worker holds the Tinybird token directly — violates `GLOBAL-021`. The owner table maps Tinybird to `packages/db/clickhouse-tinybird/`; reaching past it from the events-worker spreads the SDK shape across files and re-implements OTel attributes inconsistently.
  - Per-message Tinybird call (one HTTP per event) — burns the Tinybird Free-tier daily request budget on dispatch, when ClickHouse trivially ingests one NDJSON-batch of 100 rows in a single call.
  - DLQ-on-Tinybird-failure instead of circuit-break — premature; DLQ infrastructure is deferred per `SK-EVENTS-008`. The breaker bounds damage in the meantime; flipping to DLQ is a one-line wrangler change once the failure counter shows it's worth the operational surface.

### SK-EVENTS-010 — `feature.*` event domain: every "not yet" path emits a typed signal

- **Decision:** The `feature.*` domain joins `user.*` / `billing.*` / `ask.*`. Phase 1.5 ships two variants: `feature.requested.ddl_via_ask` (LLM emitted DDL on `/v1/ask` — reject reasons in `DDL_REJECT_REASONS`) and `feature.requested.heavier_tier` (any `/v1/ask` 429 — anon per-IP or authed per-account; distinct from the `auth_required` envelope, which is a sign-in nudge). Both carry `principalId` and `surface: NlqSurface`. Future variants (`notify_paid`, `byo_pg`, `team_workspace`, `unknown_cli_verb`, queued `home.surface_wishlist`) land with their emit site — no orphan types.
- **Core value:** Bullet-proof, Free, Honest latency
- **Why:** [`GLOBAL-024`](../../decisions/GLOBAL-024-demand-signal-telemetry.md) is the canonical rule; this block is the shape. The §6 monetization trigger reads off `feature.*` counts, so a typed union keeps a property typo from silently swallowing the signal (`SK-EVENTS-002`). Reusing the queue + sink seam (`SK-EVENTS-001`) limits the cost to one `switch` arm per variant.
- **Consequence in code:**
  - `packages/events/src/types.ts`: two variants plus `NlqSurface = "hero" | "chat" | "embed" | "mcp" | "cli"` co-located so the same union is both the event field and the `nlqdb.surface` OTel attribute value (`performance.md §3.3`).
  - `defaultId()` keys the new variants by `${name}.${principalId}.${utcDay}` — one signal per user per day per missed feature is the unit the §6 trigger reasons about, and keeps the 2,500/mo LogSnag quota intact.
  - `apps/events-worker/src/sinks/logsnag.ts`: both variants land on the `demand-signal` channel with `notify: false`.
  - `apps/api/src/index.ts`: `emitFeatureSignal()` fires from the `outcome.error` arms of `/v1/ask` (both SSE and JSON branches) and `/v1/chat/messages`; the anon per-IP 429 path emits inline before its early return. All emits go through `executionCtx.waitUntil` so the 4xx isn't delayed.
  - Surface derivation lives in `surfaceFromPrincipal()` (`apps/api/src/principal.ts`) — `anon → hero`, `user → chat`, `pk_live → embed`. One mapping; every emit + every span attribute reads from it.
- **Alternatives rejected:**
  - Add variants for surfaces that don't exist yet (MCP, CLI) — orphan types drift; let each land with its emit site.
  - Emit on `auth_required` envelopes — sign-in is the free path forward, conflating it with "I want a heavier tier" pollutes the §6 trigger.
  - Per-emit UUID id — burns the LogSnag quota; per-(user, day) matches the §6 unit-of-decision.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
- **GLOBAL-013** — $0/month free tier; ≤ 3 MiB Workers bundle. *In this feature:* the events-worker imports `@nlqdb/db/clickhouse-tinybird` for `writeQueryLog`; the package's HTTP path is plain `fetch` with no SDK weight, keeping the bundle within budget.
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
- **GLOBAL-021** — Each external system has one canonical owning module. *In this feature:* the events-worker is the canonical owner of `EVENTS_QUEUE` (consumer) per the GLOBAL-021 owner table; `packages/events/` owns the producer types. Tinybird HTTP is owned by `packages/db/clickhouse-tinybird/` — `SK-EVENTS-009`'s sink imports `writeQueryLog` from there rather than POSTing directly. Owner-to-owner library dependency (events-worker → `@nlqdb/db`) is explicitly allowed by GLOBAL-021.
- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path. *In this feature:* implemented by `SK-EVENTS-010` (the `feature.*` event domain).

## Open questions / known unknowns

- **DLQ activation threshold.** No agreed-upon dropped-event rate that triggers DLQ wiring; document the threshold (e.g. > X drops/day for 3 consecutive days) in `apps/events-worker/README.md` so the trigger is observable, not opinion-driven.
- **PostHog wiring criteria.** The "real cohort question that SQL can't answer" is qualitative. Capture a concrete checklist (questions tried, time-spent, alternative outcomes) so the decision to wire PostHog is auditable rather than vibes.
- **Schema evolution.** Adding a field to an existing `ProductEvent` variant breaks `bun run typecheck` for older producers in flight during a deploy. There's no documented migration recipe — write one before a non-additive change lands.
- **Queue free-tier ceiling.** 10K ops/day on Workers Free = ~3.3K msgs/day at 3 ops/msg. PLAN's Phase 1 anonymous-mode + waitlist + first-query traffic is below this, but the head-room is thin; capture a "hot signal" alert when daily ops cross 70%.
- **Inbound-email sink (RUNBOOK §2.1.1).** Cloudflare Email Routing is wired separately; consider whether a future `support.email_received` event should flow through this pipeline or stay separate.
