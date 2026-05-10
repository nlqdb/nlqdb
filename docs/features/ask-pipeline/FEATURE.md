---
name: ask-pipeline
description: /v1/ask orchestration: rate-limit → cache → LLM router → SQL allowlist → exec → summarize.
when-to-load:
  globs:
    - apps/api/src/ask/**
  topics: [ask, /v1/ask, natural-language, pipeline, orchestration]
---

# Feature: Ask Pipeline

**One-liner:** /v1/ask orchestration: rate-limit → cache → LLM router → SQL allowlist → exec → summarize.
**Status:** implemented
**Owners (code):** `apps/api/src/ask/**`
**Cross-refs:** docs/architecture.md §3.6.1 (endpoint shape), §3.6.2 (typed-plan pipeline), §3.6.4 (dbId resolution), §3.6.5 (validator paths), §9 (bullet-proof checklist) · docs/architecture.md §10 Slice 6 (`/v1/ask` E2E) · docs/performance.md §2.1, §2.2, §3 · `docs/features/hosted-db-create/FEATURE.md` (Phase 1 — the `kind=create` arm of this pipeline lives there per SK-HDC-001; this skill keeps the read/write arm)

## Touchpoints — read this skill before editing

- `apps/api/src/ask/**`

## Decisions

### SK-ASK-001 — `/v1/ask` is the single create-or-query endpoint

- **Decision:** A single endpoint `POST /v1/ask` accepts a natural-language `goal` and a cheap classifier-tier LLM call decides `kind ∈ {"create", "query", "write"}`. `create` routes to the typed-plan pipeline (`docs/architecture.md §3.6.2`); `query` and `write` route to the read/write orchestrator. There is no `/v1/db/new`, no separate "create" verb.
- **Core value:** Goal-first, Simple, Effortless UX
- **Why:** Every persona walks in with a goal, not a database. Two endpoints (`/v1/ask` for chat, `/v1/run` for raw queries) is the canonical surface (`GLOBAL-017`). Splitting create from query would force the user to know which one to call, contradicting `GLOBAL-017` and the on-ramp inversion principle in `docs/architecture.md §0.1`.
- **Consequence in code:** `apps/api/src/routes/v1/ask.ts` is the only handler; create/query/write are internal branches behind the classifier. PRs that add `/v1/db/new`, `/v1/queries`, or `/v1/plans` are rejected.
- **Alternatives rejected:** REST resource explosion (`/v1/queries`, `/v1/runs`, `/v1/plans`) — bigger surface, more docs, more inconsistency. `/v1/ask` + `/v1/db/new` — splits a single user goal across two endpoints; the user has to know which.
- **Source:** docs/architecture.md §3.6.1

### SK-ASK-002 — Canonical step order: edge → auth → rate-limit → hash → plan-cache → (hit: validate → exec) | (miss: route → plan → SQL-validate → exec → cache-write) → optional summarize

- **Decision:** Every `/v1/ask` request follows the canonical step order in `docs/performance.md §2.1, §2.2`. New steps require a `SK-ASK-NNN` decision; reordering existing steps requires updating the canonical tables in `performance.md` in the same PR. The cache-miss path opens with one merged `route` LLM call (SK-ASK-009) — no separate `classify` then `disambiguate` step.
- **Core value:** Bullet-proof, Honest latency, Fast
- **Why:** A canonical order means every reviewer, every dashboard, every test agrees on what "the ask path" is. Inserting an unsanctioned step (e.g., a third LLM call between plan and exec) is the kind of change that silently breaks the latency budget and the trace UI. The order is also load-bearing for `GLOBAL-011`: surfaces stream the trace in the order steps complete. Folding classify + disambiguate into one `route` call halves the cheap-tier latency on the dbId-absent path.
- **Consequence in code:** `orchestrateAsk()` (per `docs/architecture.md §10` Slice 6) walks the steps in order. Each step gets one OTel span (per `docs/performance.md §3.1`). The route-handler prelude (SK-ASK-009) emits one `llm.route` span per cache-miss / dbId-absent send. A reorder regression is caught by the span-tree assertion in the slice's vitest. Latency budgets in `performance.md §2.1, §2.2` are CI-asserted at 1.5× p50.
- **Alternatives rejected:** Per-handler order — would let the order drift between create / query / write without notice. Skip cache when LLM is fast — defeats `GLOBAL-006` and breaks the cache-warming intent. Keep classify + disambiguate as separate steps — see SK-ASK-009.
- **Source:** docs/architecture.md §3.6.1, §3.6.2 · docs/performance.md §2.1, §2.2 · docs/architecture.md §10 Slice 6

### SK-ASK-003 — `dbId` resolution: deterministic fast-path then cheap-tier LLM, with confidence floor + visible echo

- **Status:** superseded by SK-ASK-009 — see SK-ASK-009 for the merged `routeAsk` decision.
- **Decision:** When `dbId` is omitted on `/v1/ask`: 0 dbs → CREATE; 1 db → auto-target; 2+ dbs → (a) deterministic slug-substring match — if exactly one DB's slug words appear in the goal, pick it; (b) KV cache lookup `(tenantId, goalHash, dbsetHash)`; (c) cheap-tier `llm.disambiguate` call. Auto-target requires `confidence ≥ 0.7`; below threshold the API returns `409 ambiguous_db` with `candidate_dbs` ranked by score. Every auto-target echoes `selected_db: { id, slug, confidence, reason }` on the response. CLI / MCP keep their per-surface fallbacks (MRU prompt / elicitation).
- **Core value:** Effortless UX, Goal-first, Honest latency
- **Why:** Forcing a `409` round-trip on every multi-DB ambiguous send breaks the goal-first chat flow. The "silent wrong-tenant" failure mode is contained by three properties: a confidence floor, a visible `selected_db` echo (wrong picks are immediately visible, not silent), and one-click rail recovery. Destructive verbs still pass the SK-ASK-004 validator + SK-ONBOARD-004 confirm-diff gate, so a wrong-tenant write requires both a wrong LLM pick and the user approving a diff that names the wrong table.
- **Consequence in code:** `apps/api/src/ask/disambiguate-db.ts` runs slug-fast-path → KV cache → `llm.disambiguate` (`packages/llm/src/types.ts` + `prompts.ts` + `_chat-provider.ts` + `router.ts`). The route handler in `apps/api/src/index.ts` parallelizes `classify` + `listDatabasesForTenant`, then speculatively kicks off disambiguate as soon as the DB list returns. SSE prepends a `selected_db` event before `plan_pending`; JSON includes `selected_db` on the `AskOk` envelope. The SDK's `AskRequest['dbId']` is optional; `AskOk.selected_db?` is the echo. Per-attempt LLM timeout 1500 ms (cheap-tier).
- **Alternatives rejected:** Bare deterministic 409 — UX wall on goal-first chat. LLM pick *without* confidence floor — silent on low-signal goals. LLM pick *without* `selected_db` echo — silent again. Planner-tier LLM — overkill; cheap tier is accurate enough on slug + schema-hash inputs.
- **Source:** docs/architecture.md §3.6.4 · docs/research-receipts.md §7 · docs/performance.md §2.3

### SK-ASK-004 — Two distinct validator paths: read/write (LLM-generated) vs DDL (typed-plan compiler) — never mixed

- **Decision:** `/v1/ask` query/write traffic routes through `apps/api/src/ask/sql-validate.ts`, which allows only `SELECT / INSERT / UPDATE / DELETE / WITH / EXPLAIN / SHOW` (multi-statement and `EXPLAIN ANALYZE` rejected). DDL is the **only** privilege of the typed-plan compiler in `docs/architecture.md §3.6.2` and never reaches the read/write validator.
- **Core value:** Bullet-proof, Simple
- **Why:** The LLM never has DDL rights through the read/write path — the only legitimate `CREATE` comes from our deterministic typed-plan compiler, which we wrote and we tested. The hard split makes prompt-injection structurally unable to reach DDL. Layered guardrails (AST reject-list + role isolation + RLS + statement timeout + transactional wrapper) follow the Replit-incident lesson from `docs/research-receipts.md §1`.
- **Consequence in code:** `validateReadWrite(sql)` in `sql-validate.ts` rejects every DDL verb. The DDL path's validator is a separate file (Zod over `SchemaPlan` plus libpg_query parse on the compiled DDL) and is invoked **only** from the create path. PRs that try to merge the two validator surfaces are rejected.
- **Alternatives rejected:** Single validator with a `mode: "rw" | "ddl"` flag — a single `mode` flag flip would re-open DDL to LLM-generated SQL. LLM emits DDL directly — explicitly rejected in `§3.6.2`; the LLM emits a typed plan, our code emits SQL.
- **Source:** docs/architecture.md §3.6.2, §3.6.5

### SK-ASK-005 — Summarize is conditional: skip when `Accept: application/json` or row count below threshold

- **Decision:** The post-exec LLM summarization step (`llm.summarize`) only runs when (a) the result row count is above a threshold (default 5) **or** (b) the intent classifier flagged the query as conversational. It is skipped entirely when the client sent `Accept: application/json`.
- **Core value:** Fast, Free, Honest latency
- **Why:** Summarization adds 300 ms p50 / 800 ms p99 — material on a cache-miss path. Most fact-lookup queries return raw rows; summarising "[{count: 42}]" wastes user time and LLM credits. Programmatic clients (`Accept: application/json`) want raw data; humans on the chat surface want prose.
- **Consequence in code:** `shouldSummarize(rows, intent, accept)` is a pure function tested in isolation. The summarize step is skipped *before* the LLM call, not inside it (no wasted token spend on a result we'd discard).
- **Alternatives rejected:** Always summarise — wastes 80% of summarize budget on row-count queries. Always skip — chat surface loses prose; bad UX for the conversational majority.
- **Source:** docs/architecture.md §8 (cost-control rule 4) · docs/performance.md §2.2

### SK-ASK-006 — Anonymous-mode is a separate rate-limit tier — not "free with a lower limit"

- **Decision:** The API has an explicit anonymous-mode rate-limit tier, distinct from authed-free and paid tiers (`GLOBAL-007`). Anonymous traffic shares its tier across all anonymous device-tokens by IP + device-token; signing in promotes the device's outstanding budget to the authed tier (no fresh quota grant).
- **Core value:** Free, Bullet-proof, Goal-first
- **Why:** Without a separate tier, an anonymous abuse spike (per-IP create-floods) eats authed-user budget. With it, abuse is contained in its own bucket while the authed surface stays fast. Promoting on sign-in (no fresh grant) prevents farming free quota by signing in repeatedly under fresh emails.
- **Consequence in code:** Rate-limit middleware (`packages/rate-limit`) reads `(tier, identifier)` where `identifier` is `device_token` for anonymous and `user_id` for authed. `attachIdentity()` carries forward the consumed budget. PoW challenges fire on signup if the bucket spikes (`docs/architecture.md §3.6.8`).
- **Alternatives rejected:** Single global free tier — every anonymous abuse spike degrades authed users. Allow anonymous to refresh budget by attaching a new identity — quota-farming.
- **Source:** docs/architecture.md §3.6.8 · [GLOBAL-007](../../decisions/GLOBAL-007-no-login-wall.md)

### SK-ASK-007 — `user.first_query` fires exactly once per user via the lookup-then-emit-then-commit pattern

- **Decision:** The first successful `/v1/ask` per user emits a `user.first_query` product event exactly once. The implementation uses lookup-then-emit-then-commit with a KV marker — the marker is checked, the event is emitted, the marker is committed. The full pattern is in `docs/architecture.md §10` Slice 6.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Naively writing the marker before emitting can drop the event on a Worker crash; emitting then writing can double-emit on retry. The lookup-then-emit-then-commit pattern with idempotent sink writes (events-pipeline) gives us at-most-once user-visible (the dashboard counts unique users) without dropping the signal.
- **Consequence in code:** `firstQueryGate(user_id)` is wrapped in `nlqdb.cache.first_query.lookup` and `nlqdb.cache.first_query.commit` spans. The events emit is wrapped in `ctx.waitUntil` (per `docs/performance.md §3.1`) so it runs after the response. Test asserts exactly-once across two concurrent first calls (the second observes the marker).
- **Alternatives rejected:** Write marker first — event drops on crash. Emit first — double-emit on retry. Synchronous DB write — adds DB round-trip to the response path.
- **Source:** docs/architecture.md §10 Slice 6 · docs/performance.md §3.1

### SK-ASK-008 — Live trace is streamed in step-completion order; no spinner-lying

- **Decision:** `apps/web` and CLI render the live trace of an in-flight `/v1/ask` request in the order steps complete (cache lookup, plan, allowlist, exec, summarize) with real timings. There is no generic spinner; if a step takes long, the surface names the step.
- **Core value:** Honest latency, Effortless UX, Bullet-proof
- **Why:** A spinner that hides progress trains users to assume the worst when latency spikes. A live trace turns slow steps into legible, debuggable information — and forces us to fix the slow steps because users see them. This is `GLOBAL-011`'s consequence on the ask path.
- **Consequence in code:** Each step in the canonical order (`SK-ASK-002`) emits a trace event the SDK exposes via the `onTrace` hook. `apps/web` renders them in order; CLI's TTY mode prints each as it completes. Tests assert that every step in the cache-miss path produces exactly one trace event.
- **Alternatives rejected:** Generic spinner with "this is taking longer than usual" — gives no information; trains users not to trust the surface. Hide latency below a threshold — users notice anyway, and lose trust when the threshold is wrong.
- **Source:** docs/architecture.md §0 (Honest latency) · [GLOBAL-011](../../decisions/GLOBAL-011-honest-latency.md)

### SK-ASK-009 — Cheap-tier classifier sees the principal's recent tables; classify + disambiguate merge into `routeAsk`

- **Decision:** The `/v1/ask` cheap-tier classifier receives the principal's 100 most-recent `(dbId, table)` tuples in its prompt. Output is `{kind, targetDbId, referencedTables, confidence, reason}` from a single LLM call (`llm.route`). This collapses today's two cheap-tier calls (`classify` + `disambiguate`) into one.
- **Core value:** Bullet-proof, Fast, Effortless UX
- **Why:** Without table-level context the classifier can't tell "insert red and blue tables" (intended `kind=create`) from "insert into red and blue" (intended `kind=write`). Recent tables are the cheapest signal that disambiguates the two — if `red`/`blue` aren't in the cache, the goal must be create. Merging classify + disambiguate halves cheap-tier latency on the dbId-absent path; the prompt budget absorbs the extra context (100 × ~30 chars ≈ 3 KB).
- **Consequence in code:** `apps/api/src/ask/route-ask.ts` exports `routeAsk(deps, input)`. `apps/api/src/ask/classifier.ts` and `apps/api/src/ask/disambiguate-db.ts` are deleted. `LLMRouter.classify` and `LLMRouter.disambiguate` are replaced by `LLMRouter.route`; `LLMOperation.classify` and `LLMOperation.disambiguate` are removed. The route handler in `apps/api/src/index.ts` runs `routeAsk` in parallel with `listDatabasesForTenant` and dispatches on `{kind, targetDbId}`. PRs that re-introduce a separate kind-classification call fail review.
- **Alternatives rejected:**
  - Keep classify + disambiguate as separate cheap-tier calls — two LLM round-trips on every dbId-absent send; second call's input partially overlaps the first.
  - Pass the full schema (every table across every db) — token-explodes on power users; bounded MRU is the right subset.
  - Pass dbset only (no tables) — solves classify+disambiguate merge but doesn't help the "insert red and blue tables" misclassification, which is the load-bearing case.

### SK-ASK-010 — Goal text is capped at 2 000 characters server-side

- **Decision:** Every endpoint that accepts a `goal` string (`/v1/ask`, `/v1/databases`, `/v1/chat/message`) rejects inputs longer than 2 000 characters with `400 goal_too_long { maxLength: 2000 }`. The cap applies before any LLM call so adversarially long strings cannot inflate token spend.
- **Core value:** Bullet-proof, Honest latency
- **Why:** A natural-language query goal is a sentence or short paragraph. 2 000 chars is ~400 words — generous enough for complex multi-step requests while bounding worst-case token cost at the API boundary. Without a cap, a single anon request carrying a multi-megabyte string would exhaust the cheap-tier model's context window, inflate the run's LLM invoice, and degrade latency for other requests sharing the isolate.
- **Consequence in code:** `MAX_GOAL_LENGTH = 2000` is exported from `apps/api/src/http.ts` and checked in `parseGoalDbBody`, `parseAskBody`, and the `POST /v1/databases` handler. The error body carries `maxLength` so SDK consumers can render a precise message without hard-coding the limit (GLOBAL-012).
- **Alternatives rejected:** Silent truncation — hides the problem from the caller; the truncated goal produces a wrong result with no diagnostic. Per-tier limits — adds complexity without meaningful UX benefit; 2 000 chars covers every legitimate use case across all tiers.

### SK-ASK-011 — Speculative create on probable-0-dbs (cache-stale defense)

- **Decision:** When `probablyZeroDbs(recentTables, goal)` returns true on `/v1/ask`, the handler kicks off `startSpeculativeCreate` in parallel with the authoritative `listDatabasesForTenant` D1 read. The reconciler commits the create when D1 confirms 0 dbs; on D1 returning ≥ 1 dbs (or the read failing), the reconciler issues `dropSchemaAndRegistry` (DROP SCHEMA CASCADE + DELETE FROM databases) + evicts the request's `Idempotency-Key` dedupe entry, then routes the request through the existing 0/1/2+ dispatch.
- **Core value:** Bullet-proof, Fast
- **Why:** A stale or empty cache (`recentTables` is the most likely culprit, but listDb itself can also lie under D1 cold-pool) can falsely suggest 0 dbs. Pure serial "list-then-create" loses the create-pipeline parallelism on the genuine cold-start path (~800 ms). Speculating preserves cold-start latency while making the duplicate-create case impossible — the rollback closes the hole even when the cache lies. `Idempotency-Key` eviction prevents a retry from returning a rolled-back create response.
- **Consequence in code:** Three small modules: `apps/api/src/ask/route-hint.ts` (predicate), `apps/api/src/db-create/speculative.ts` (handle + rollback), `apps/api/src/ask/reconcile-speculative.ts` (dispatcher). Each function ≤ 30 lines; PRs that fold them back into a single function fail review. Spans `nlqdb.create.speculative.{start,rollback}` and metrics `nlqdb.create.speculative.{start_total,commit_total,rollback_total,overhead_ms}` (per `GLOBAL-014`) drive a dashboard alert at rollback rate > 0.1 % / hour. The anon create-cap gate runs before speculation kicks off (mirrors `runCreatePath` parity); see `apps/api/src/index.ts` `checkAnonCreateGate` helper.
- **Alternatives rejected:**
  - Trust the cache only — duplicate creates on stale cache; user-visible bug.
  - Always serial — biggest cold-start latency hit; create is the slowest step (~800 ms).
  - Defer the create's COMMIT until reconcile — holds a Postgres connection across LLM-tier latency; Workers can't sustain that pattern.
  - Skip Idempotency-Key eviction — retry returns the rolled-back response; dedupe store lies.

**Open follow-ups (track in this skill's Open questions):**
- pgvector card cleanup on rollback when embedding lands (today `embedTableCards` is a no-op in `apps/api/src/db-create/build-deps.ts`).
- `pk_live` revocation on rollback when the api-keys subsystem ships.
- Anon create-cap consumption when speculation rolls back: cap is consumed at gate time so a false-positive predicate over-counts the user's hourly cap by 1. Acceptable today; reconsider once WS1's cache makes the predicate selective enough that false positives become rare.
- `Idempotency-Key` middleware itself is still open work (`SK-IDEMP-005` is locked, implementation pending). The `IdempotencyStore` interface in `apps/api/src/db-create/speculative.ts` carries the `delete(principalId, key)` primitive the rollback path needs; the route handler does not yet wire a store, so eviction is a no-op until the middleware lands.

### SK-ASK-012 — Per-principal recent-tables LRU (100 entries) in KV

- **Decision:** Each principal (`user:<id>` or `anon:<hash>`) has a KV-backed MRU list of the 100 most recently used `(dbId, slug, table)` tuples. Stored at `recent_tables:<principalId>` with a 90-day `expirationTtl` matching `SK-ANON-002`'s server retention. Updated after every successful `/v1/ask` exec and after every successful `db.create` provisioning.
- **Core value:** Bullet-proof, Free, Fast
- **Why:** SK-ASK-009's classifier consumes this list to disambiguate ambiguous verbs ("insert / add / put") that can mean either DML against existing tables or DDL for new ones. Per-principal scope mirrors the existing rate-limit and disambiguate-cache patterns; 100 × ~30 chars ≈ 3 KB fits cheap-tier prompt budget. KV writes ride `ctx.waitUntil` so the update never sits on the user-visible p99.
- **Consequence in code:** `apps/api/src/ask/recent-tables.ts` exports `makeRecentTablesStore(kv): RecentTablesStore` with `load` / `touch`. `OrchestrateDeps` (read + create) carry the store. The OTel spans `nlqdb.recent_tables.{lookup,touch}` (per `GLOBAL-014`) wrap the KV read-merge-write inside the store. PRs that read or update the MRU outside this module fail review.
- **Alternatives rejected:**
  - Derive lazily from per-db schema introspection — every classifier call pays a schema query; the union view across multiple dbs is what's actually needed.
  - Per-(principal, db) cache — needs the dbId at classify time, but classify *outputs* the dbId; chicken-and-egg.
  - Track all-time tables (no LRU cap) — unbounded growth on power users; 100 covers the realistic active set.

### SK-ASK-013 — Per-stage recoverable-failure retries with feedback (3 attempts)

- **Decision:** Each `/v1/ask` orchestrator stage with a recoverable error class wraps its work in `withStageRetry(stage, fn)` (3 attempts max): `route` (the SK-ASK-009 classifier), `plan` (LLM emit + validator allowlist as one loop), `exec` (DB query). When `validateSql` rejects, the next plan call receives the rejected SQL + reason in `PlanRequest.previousAttempt` so the prompt produces a different shape. Non-recoverable cases (`DbConfigError`, billing-cap, 4xx) skip the retry via the `Nonrecoverable` sentinel. Composes with the LLM provider chain's 3-hop failover (SK-LLM-006).
- **Core value:** Bullet-proof, Effortless UX
- **Why:** Without per-stage retries, a single Neon hiccup / provider 5xx / first-shot invalid SQL surfaces as `db_unreachable` / `llm_failed` / `sql_rejected` and breaks the Bullet-proof contract. Three attempts absorbs the transient without unbounded wall-clock; validator-reject feedback closes the "LLM emits DROP, we 4xx, user retypes" loop.
- **Consequence in code:** `apps/api/src/ask/retry.ts` exports `withStageRetry`, `Nonrecoverable`, `RETRY_MAX_ATTEMPTS = 3`. `orchestrate.ts` wraps plan-with-validate and exec; the route handler wraps `routeAsk`. `PlanRequest.previousAttempt` carries `{sql?, error}`; `buildPlanUser` appends the previous-attempt block. Each retry stamps `nlqdb.retry.attempt` on the active span and increments `nlqdb.retry.total{stage, reason}` (`GLOBAL-014`).
- **Alternatives rejected:**
  - Single attempt — surfaces every transient as a user-visible failure.
  - Unbounded retries — turns transients into request hangs.
  - SDK-only retries — server-side recoveries (re-plan with parser feedback, provider failover) need server context.
  - Skip validator-reject feedback — LLM commonly emits the same shape twice.

## The LLM loop

This is the part most implementations get wrong. A single "prompt → SQL → run" pipeline is a demo, not a product. The `/v1/ask` pipeline runs these eight steps per query:

1. **Schema retrieval.** Embed table + column names + sample values + foreign keys. Retrieve top-K relevant objects via pgvector. Cache per schema hash — this step is free on repeat schemas.
2. **Intent classification.** Classify as read / write / ambiguous / clarification-needed / out-of-scope. Uses a cheap model (Groq Llama 3.1 8B / Gemini 2.5 Flash). Ambiguous → surface inline clarification chips, not a new turn.
3. **Plan generation.** Structured tool-use with the target engine's grammar as a constrained decode where possible (grammars for SQL exist; for Mongo aggregation we hand-roll). The LLM emits a typed plan; our code emits SQL from the plan — the LLM never emits SQL directly (`SK-ASK-004`).
4. **Static validation.** Parse the plan. Check referenced columns exist in the schema snapshot. Check for destructive ops. Dry-run with `EXPLAIN` when cheap (`EXPLAIN ANALYZE` is explicitly rejected — real data).
5. **Confidence gate.** If confidence is low OR the plan is destructive OR touches > N rows, set `requires_confirm: true` in the response and surface a plain-English diff + row-count preview in the UI. Execution is blocked until the user approves (`SK-ONBOARD-004`).
6. **Execute + stream.** Stream rows back as they arrive. The live trace shows this step completing in real time (`SK-ASK-008`).
7. **Summarize.** A cheap model turns rows into prose. Always attach the raw data too — we never paraphrase away the truth. Skipped when `Accept: application/json` or row count is below threshold (`SK-ASK-005`).
8. **Log.** Write `{ fingerprint, latency, rows_scanned, rows_returned, engine, plan_shape }` to the workload log. This feeds the Workload Analyzer in Phase 2 (`docs/architecture.md §10 §2`).

**Reinventions on this path (intentional — see `docs/guidelines.md §7`):**
- Grammar-constrained SQL decoder tuned to each dialect, not raw LLM SQL generation.
- Schema-embedding format that treats foreign keys as edges (not just `text-embedding-3` over column names).
- A learned query-shape classifier that runs in <10ms on the hot path and hands off to the LLM only when unsure.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
- **GLOBAL-006** — Plans content-addressed by `(schema_hash, query_hash)`.
- **GLOBAL-011** — Honest latency — show the live trace; never spinner-lie.
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
- **GLOBAL-015** — Power users always have an escape hatch.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
- **GLOBAL-022** — Recoverable failures retry to success — never surface a fixable error.
  - *In this skill:* see `SK-ASK-013` for the canonical implementation. Each pipeline stage owns its recoverable error class — classifier (wrong intent), planner (invalid SQL), validator (allowlist re-plan), executor (transient DB error) — and retries up to 3 attempts via `withStageRetry`, feeding the prior attempt's error into the next prompt where applicable.

## Open questions / known unknowns

- **Streaming protocol for live trace.** `SK-ASK-008` and `GLOBAL-011` require a live trace, but the wire protocol (SSE? chunked JSON? OTel-over-WS?) is not yet pinned. SDK's `onTrace` hook in `packages/sdk` will fix the surface API; the wire format is open.
- **Failure-mode for partial results.** If `exec` succeeds but `summarize` fails, do we return the rows + a summarize-error envelope, or 5xx the whole call? Design.md doesn't decide. Leaning toward "rows + envelope" so the user sees data, but needs an explicit `SK-ASK-NNN`.
- **Idempotency on `/v1/ask`.** `GLOBAL-005` says every mutation accepts `Idempotency-Key`. `/v1/ask` is sometimes a query (no mutation), sometimes a write. Confirm whether the dedupe store is consulted for the write branch only or for every call (and what `kind=create` deduping looks like).
- **Null-pick disambiguator cache TTL.** When the LLM returns `chosenId: null` (cannot disambiguate), `disambiguate-db.ts` caches that result for 7 days under the `(tenantId, goalHash, dbsetHash)` key. The dbsetHash evicts naturally when the user adds/removes a DB, but a false-null (LLM wrong, answer exists) is sticky for up to 7 days against the same DB set. Two options: (a) don't cache null picks — costs an LLM call on each retry of an ambiguous goal; (b) cache with a shorter TTL (e.g. 1 hour) — limits stale-null exposure. Current code does option (a) by caching null with the full 7-day TTL, which may be the wrong default. Needs a decision (new `SK-ASK-NNN`).

## Happy path walkthrough

HTTP API cURL examples (default + writes with `Idempotency-Key` + anonymous-mode reuse) and the Priya persona walkthrough live in `docs/architecture.md` §14.6 / §15.3 — that's the canonical home for surface examples and persona stories so they don't drift out of sync with the architecture spec.
