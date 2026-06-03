---
name: observability
description: OTel span / metric / label catalog; mandatory on every external call.
when-to-load:
  globs:
    - packages/otel/**
    - apps/api/src/index.ts
    - apps/api/src/ask/orchestrate.ts
    - apps/api/src/stripe/webhook.ts
    - packages/db/src/postgres.ts
    - apps/api/src/llm-router.ts
  topics: [otel, observability, tracing, metrics, spans, grafana]
---

# Feature: Observability

**One-liner:** OTel span / metric / label catalog; mandatory on every external call.
**Status:** implemented (Phase 0 / Slice 3 — OTel SDK + OTLP/HTTP exporters land as one-time infrastructure; later slices import the helpers).
**Owners (code):** `packages/otel/**` (the canonical helpers), `apps/api/src/index.ts` (per-request setup + force-flush), `apps/api/src/ask/orchestrate.ts` (`/v1/ask` span tree), `apps/api/src/stripe/webhook.ts` (`nlqdb.webhook.stripe`), `packages/db/src/postgres.ts` (`db.query`), `apps/api/src/llm-router.ts` (`llm.*`).
**Cross-refs:** docs/performance.md §1 (SLOs) · §2 (latency budgets) · §3 (span / metric / label catalog — load-bearing) · §4 (slice instrumentation plan) · §5 (sampling + cost discipline) · docs/architecture.md §5.4 line 743 (Sentry + OTel → Grafana Cloud) · §5.4 line 772 (events-vs-spans boundary) · docs/runbook.md §2.6 line 343 (telemetry env wiring) · [GLOBAL-014](../../decisions/GLOBAL-014-otel-on-external-calls.md) · [GLOBAL-011](../../decisions/GLOBAL-011-honest-latency.md)

## Touchpoints — read this feature before editing

- `packages/otel/src/index.ts` — `setupTelemetry`, `installTelemetryForTest`, the lazy-instrument helpers, the OTel semconv pin, `redactPii`.
- `packages/otel/src/test.ts` — in-memory exporters for vitest assertions.
- `apps/api/src/index.ts` — Worker handler installs telemetry on each request and `ctx.waitUntil(forceFlush())` at the end.
- Any new external call site — DB / LLM / HTTP / queue / KV — adds its span via the helpers.

## Decisions

### SK-OBS-001 — One canonical catalog: PERFORMANCE §3 is the only source of truth for span/metric/label names

- **Decision:** Span names, metric names, and label keys are defined once in `docs/performance.md` §3 (the catalog). Every slice MUST use those exact names — no one-off variants like `tenant`, `tenant-id`, `tenantId` for what is canonically `nlqdb.tenant_id`.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Per-team conventions fragment dashboards within a quarter (`GLOBAL-014` Alternatives). One catalog means dashboards/queries written today still work next year, and a new contributor knows where to look. The cardinality budget in §3.3 only works if there's a single set of label keys to bound.
- **Consequence in code:** New spans/metrics/labels add a row to PERFORMANCE §3 in the same PR. Cardinality assertions in CI catch label drift; reviewers reject names that don't appear in §3. The lazy-instrument helpers in `packages/otel/src/index.ts` (e.g. `dbDurationMs`, `llmCallsTotal`) are the canonical export; importing the metric directly from `@opentelemetry/api` and creating an ad-hoc one bypasses the catalog and fails review.
- **Alternatives rejected:**
  - Per-team / per-package catalogs — fragmentation in <1 quarter.
  - Sample only slow requests to "save costs" — loses the baseline distribution; pinned out by GLOBAL-014.

### SK-OBS-002 — Cardinality budget: < 8 k active series, leaving 2 k headroom under Grafana Cloud's 10 k free-tier ceiling

- **Decision:** Total combined active metric series stays under 8 k. The Grafana Cloud free tier's hard ceiling is 10 k; the 2 k headroom absorbs spikes and short-lived label values without paging.
- **Core value:** Free, Honest latency
- **Why:** Going over 10 k means paying — the free-tier story (`GLOBAL-013`) breaks. 8 k is a budget that's enforceable in CI (cardinality assertions) and lets us catch a runaway label before the bill arrives. The exact bound matters less than the discipline of having one.
- **Consequence in code:** Every label key in PERFORMANCE §3.3 has an explicit cardinality concern (`Bounded`, `Low (~10)`, `**High** — gated`). A new label PR must include a cardinality estimate; CI rejects PRs that introduce a label without a §3.3 row. `nlqdb.user_id` is gated to auth events only — never on per-request metrics — because user count is unbounded.
- **Alternatives rejected:**
  - Paid Grafana tier — kills the free-forever story; pinned out by GLOBAL-013.
  - Sample metrics — averages out the long tail, defeats the dashboards' point.

### SK-OBS-003 — Sampling rules: trace 100% of `/v1/ask` cache miss, 1% of cache hit, 0% of `/v1/health`

- **Decision:** Trace sampling is path-aware (PERFORMANCE §5): `/v1/health` 0%, `/v1/ask` cache hit 1%, `/v1/ask` cache miss 100%, `/v1/auth/*` 100%, any 5xx 100% (sampler override), any 4xx 10%, Stripe webhook 100%.
- **Core value:** Free, Honest latency, Bullet-proof
- **Why:** Cache hits are cheap, plentiful, and predictable — a 1% sample is enough to confirm SLO and costs almost nothing. Cache misses are rare (<10% by design after warm-up) but expensive and informative — 100% is affordable. 5xx override at 100% guarantees we have the trace when something breaks. `/v1/health` is a load-balancer noise floor — sampling it would burn quota for zero signal.
- **Consequence in code:** The Worker handler picks the sampler decision per route at the top of the request, before child spans are recorded. Histograms aggregate at 60s with 8 buckets (`docs/performance.md §5`) — wide enough for p50/p95/p99, cheap on series count.
- **Alternatives rejected:**
  - Uniform sampling (e.g. 10% everywhere) — under-samples 5xx (where we most need traces), over-samples cache hits (where we need least).
  - Tail-based sampling — Workers don't have a long-lived collector hop where tail-based decisions naturally fit; deferred until we add one.

### SK-OBS-004 — Workers context: per-request setup + `ctx.waitUntil(forceFlush())` at request end

- **Decision:** `setupTelemetry()` is idempotent — first call wins, subsequent return the same handle. Workers don't reliably tick `setInterval` across requests, so trace/metric flushes happen at the end of each request via `ctx.waitUntil(forceFlush())`. The default `BatchSpanProcessor` buffers spans; `forceFlush()` drains the buffer.
- **Core value:** Bullet-proof, Free, Honest latency
- **Why:** `SimpleSpanProcessor` POSTs synchronously per `span.end()`, which OTel docs flag as test/debug only and would burn through the Workers free-tier 50 subrequests/request limit fast. Periodic timers don't fire reliably between requests on Workers. Per-request flush in `ctx.waitUntil` runs after the response is returned — zero user-facing latency cost — and guarantees spans actually leave the isolate before it freezes.
- **Consequence in code:** `apps/api/src/index.ts` calls `setupTelemetry(...)` once and `ctx.waitUntil(handle.forceFlush())` after every response. New endpoints inherit by virtue of the wrapping handler. PRs adding their own `BasicTracerProvider` / `SimpleSpanProcessor` bypass the catalog and fail review.
- **Alternatives rejected:**
  - Synchronous span export per `span.end()` — exhausts the 50-subrequest budget on a single complex request.
  - No flush — spans drop on isolate freeze; we'd lose the entire `/v1/ask` trace tree silently.

### SK-OBS-005 — Test telemetry uses in-memory exporters; CI asserts spans + metrics emitted per slice

- **Decision:** Tests install telemetry via `installTelemetryForTest({ spanProcessors, metricReaders })` with in-memory exporters. Every slice from 3 onward MUST include a vitest assertion that each new span/metric was emitted; missing instrumentation fails CI (PERFORMANCE §4 line 192).
- **Core value:** Bullet-proof, Honest latency
- **Why:** Treating telemetry as a "ship it and hope it works" surface lets observability rot. Asserting in tests means the catalog and the code stay in sync, and a refactor that accidentally drops a span fails before merge. The in-memory exporter pattern is fast (no network) and deterministic.
- **Consequence in code:** `installTelemetryForTest` resets prior global state (the OTel `setGlobalMeterProvider` silently no-ops on re-registration; we `disable()` first). `resetTelemetryForTest()` and `resetInstrumentsForTest()` are exported so beforeEach hooks can install fresh exporters per test. PRs adding a new external call must add a span-presence assertion; reviewers reject untested instrumentation.
- **Alternatives rejected:**
  - Manual smoke test in staging — too easy to skip; doesn't catch refactor regressions.
  - OTel collector mocked over HTTP — slower, more brittle, no upside.

### SK-OBS-006 — Span-vs-product-event boundary: spans describe the system; events describe the user

- **Decision:** OTel spans capture what the *system* did (DB query, LLM call, plan-cache lookup); product events (LogSnag, future PostHog) capture what the *user* did (`user.registered`, `user.first_query`, `billing.subscription_*`). The two never collapse — high-cardinality labels like `nlqdb.user_id` stay out of metrics (PERFORMANCE §3.3) and only appear on auth events / spans.
- **Core value:** Honest latency, Bullet-proof, Free
- **Why:** Mixing user events into metrics blows the cardinality budget instantly (`SK-OBS-002`). Mixing system spans into product events bloats the LogSnag quota. Each side answers a different question with a different consumer; keeping them separate is what makes both useful.
- **Consequence in code:** `nlqdb.events.emit` span exists for the *dispatch* of a product event (so we can see drops), but the event payload itself goes to `EVENTS_QUEUE` (DESIGN §5.4 line 745–755) → `apps/events-worker` → LogSnag. Span attributes on `/v1/ask` use `nlqdb.tenant_id` and `nlqdb.cache_hit`, never `nlqdb.user_id`. The `redactPii()` helper in `packages/otel/src/index.ts` strips emails / API keys / JWTs / cards / phones / tokens from any prompt or completion before it lands on a span.
- **Alternatives rejected:**
  - One pipeline for everything — cardinality explosion on the metrics side, quota exhaustion on the events side.
  - Surface spans via the same dashboards as events — confuses the audience; ops cares about p99, growth cares about funnels.

### SK-OBS-007 — OTel semconv pinned to v1.37.0; gen_ai is Development, bumps require coordinated review

- **Decision:** `packages/otel/src/index.ts` pins `SEMCONV_SCHEMA_VERSION = "1.37.0"` and exports the `gen_ai.*` attribute keys (`gen_ai.system`, `gen_ai.operation.name`, `gen_ai.request.model`, `gen_ai.response.model`) as the Stable subset. Bumping the version requires a coordinated review across every span/metric site.
- **Core value:** Bullet-proof, Simple
- **Why:** The OTel `gen_ai` namespace is Development as of 1.37 — fields can rename mid-2026 (`packages/otel/src/index.ts` line 13–14, 256–258). Pinning insulates us from breaking changes; passing the schema URL to `trace.getTracer(name, version, { schemaUrl })` lets schema-aware backends (Tempo, Honeycomb) attach the right gen_ai field semantics. We export only the Stable subset; experimental knobs stay opt-in.
- **Consequence in code:** Tracers built via `trace.getTracer(...)` should use `SEMCONV_SCHEMA_URL` so backend schema-aware features work. New gen_ai attributes added to the export require a check against the spec's Stable status; experimental fields stay out of the canonical helpers.
- **Alternatives rejected:**
  - Track latest semconv automatically — Development namespaces rename without notice; we'd ship breakage.
  - Avoid gen_ai attributes entirely — loses backend integrations that already understand the namespace.

### SK-OBS-008 — PII redaction before any prompt/completion lands on a span

- **Decision:** Prompts and completions pass through `redactPii()` before they go on a span attribute, log line, or trace export. The redactor replaces matched patterns (email, JWT, Google API key, URL key params, generic API key prefixes, phone, card, long-token runs) with `[email]` / `[jwt]` / `[apikey]` / `[token]` etc.
- **Core value:** Bullet-proof, Effortless UX
- **Why:** LLM prompts contain user data. A trace export that includes a raw prompt is a privacy incident waiting to happen — Grafana Cloud / our exporters / future operators all see traces. Redaction is conservative (some false negatives accepted; partial IBANs miss) because false positives that litter traces with `[card] [card] [card]` are worse than rare misses. The structure of the prompt is preserved (we replace tokens, not whole lines) so debugging stays possible.
- **Consequence in code:** Any span attribute carrying user-typed text (`gen_ai.prompt`, `nlqdb.ask.goal` if added) MUST go through `redactPii()` first. The patterns are ordered most-specific-first (email, jwt, google-api-key, url-key-param, apikey, card, phone, token) — order matters; reordering can cause false-positive cascades. New PII categories add a pattern + a comment justifying the structural anchor that prevents false positives.
- **Alternatives rejected:**
  - Hash the prompt instead of redacting — destroys debuggability.
  - Trust the LLM provider to redact upstream — varies wildly by provider; doesn't cover our own logs.
  - Replace prompts with `[redacted]` wholesale — debugging becomes impossible.

### SK-OBS-009 — SQL span attributes are capped at 4 096 characters

- **Decision:** `db.statement` (Postgres adapter) and `db.query.text` (ClickHouse/Tinybird adapter) are truncated to 4 096 characters before being attached to the `db.query` span. The raw SQL is still executed in full; only the diagnostic copy on the span is capped.
- **Core value:** Bullet-proof
- **Why:** OTel exporters and downstream backends (Grafana Tempo, Honeycomb) have practical per-attribute size limits, typically 4–64 KB depending on configuration. Provisioning SQL (CREATE TABLE with many columns, RLS policies, index definitions) can easily exceed 4 KB. An unbounded attribute risks dropped spans or silent truncation by the exporter — worse than an explicit cap because the truncation point is unpredictable. 4 096 chars covers every LLM-generated query and the overwhelming majority of provisioning SQL while guaranteeing the attribute fits any reasonable exporter configuration.
- **Consequence in code:** `redactPii(sqlText).slice(0, 4096)` in `packages/db/src/postgres.ts`; `(plan.sql as string).slice(0, 4096)` in the ClickHouse adapter. PII redaction runs before truncation so secrets near the 4 096-char boundary are still redacted. The truncation does not affect the SQL actually sent to the database engine.
- **Alternatives rejected:** Truncate at exporter level — unpredictable and silent; operators see incomplete data with no indication of why. Store as a span event instead of an attribute — not yet supported by our OTel SDK wrapper; would be a larger refactor.

### SK-OBS-010 — `AsyncLocalStorageContextManager` registered so `startActiveSpan` propagates across `await`

- **Decision:** `packages/otel/src/index.ts` calls `context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())` inside both `setupTelemetry` and `installTelemetryForTest`. Requires `nodejs_compat` (already on in `apps/api/wrangler.toml`); never `.disable()`d because Workers' AsyncLocalStorage omits the method.
- **Core value:** Honest latency, Bullet-proof
- **Why:** Trace `285b805cee6e2688768d9ffcd75a86fe` (2026-05-13) — `nlqdb.ask` had no children in Tempo; `llm.schema_infer` ×2, `db.transaction`, `recent_tables.touch` were separate root traces. `BasicTracerProvider` defaults to `NoopContextManager`, which doesn't carry active-span context across `await`. Triage took ~10× longer because the span tree didn't reconstruct.
- **Consequence in code:** `packages/otel/package.json` adds `@opentelemetry/context-async-hooks ^2.7.1`. Shared `enableContextManager()` helper called from both setup paths; idempotent. Regression test asserts a child span from inside `await Promise.resolve()` shares its parent's `traceId` and `parentSpanContext.spanId`.
- **Alternatives rejected:** `@microlabs/otel-cf-workers` (larger surface than the fix needs); manual `context.with(...)` at every async boundary (doesn't scale).

### SK-OBS-011 — Exceptions → Sentry; traces + metrics → Grafana; spans still `recordException`

- **Decision:** Error/exception triage lives in **Sentry** (5k errors/mo free); traces and metrics go to **Grafana Cloud** via OTel. The two are not redundant: spans still call `span.recordException` so the Grafana side sees the error in the trace timeline, but Sentry is the canonical exception-grouping / alerting UI.
- **Core value:** Honest latency, Simple
- **Why:** The boundary was ambiguous (DESIGN §5.4 lists both). Pinning it: Sentry is purpose-built for exception grouping, release-tracking, and noise suppression — re-deriving that in Grafana is wasted effort; OTel traces/metrics are purpose-built for latency/rates — Sentry can't show a span tree. `recordException` on spans keeps the trace self-describing without making Grafana the alerting surface. Resolved per `GLOBAL-033` (build-vs-adopt → use each tool for its job).
- **Consequence in code:** Uncaught + explicitly-captured exceptions report to Sentry; `setupTelemetry` exports spans/metrics to Grafana; the span-level `recordException` (already wired) stays. No exception-grouping logic is built on the Grafana side.
- **Alternatives rejected:**
  - **OTel-only (drop Sentry)** — Grafana error-tracking is less mature for grouping/alerting; we'd rebuild Sentry badly.
  - **Sentry-only** — loses the span tree and metric histograms OTel gives for free.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
- **GLOBAL-011** — Honest latency — show the live trace; never spinner-lie.
- **GLOBAL-022** — Recoverable failures retry to success — never surface a fixable error.
  - *In this feature:* every retry decorates its parent span with
    `nlqdb.retry.attempt` and increments
    `nlqdb.retry.total{stage, reason}`. Sustained retry-rate climb
    is the alert signal that recovery is masking a real upstream
    regression.

## Open questions / known unknowns

- **`onTrace` SDK hook (GLOBAL-011)** — cross-ref, owned by the `sdk` feature; until it lands web/CLI render the SSE stream directly. Not an observability decision.
- **`db.operation` cardinality CI assertion** — Resolved per `GLOBAL-033` (silent-drift → add the cheap assertion): add a CI check that the active `db.operation` set stays < 50. **Parked until** enough DDL noun-phrases exist to make drift plausible (Phase 3 multi-engine) — the set is ~30 verbs + ~10 nouns today, far under the cap.
- **Parked until Phase 1 traffic lands:** tail-based sampling (revisit if the cache-hit 1% sample proves lossy; needs a buffering collector — DO vs Grafana tail sampler decided then), histogram bucket recalibration (needs a metrics-replay tool we don't have), and dashboards-as-code (trigger: first SLO breach or first paying user, whichever first; spans + metrics already export).
