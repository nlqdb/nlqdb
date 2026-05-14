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
**Cross-refs:** docs/architecture.md §3.6.1 (endpoint shape), §3.6.2 (typed-plan pipeline), §3.6.4 (dbId resolution), §3.6.5 (validator paths), §9 (bullet-proof checklist) · docs/performance.md §4 Slice 6 (`/v1/ask` E2E) · docs/performance.md §2.1, §2.2, §3 · `docs/features/hosted-db-create/FEATURE.md` (Phase 1 — the `kind=create` arm of this pipeline lives there per SK-HDC-001; this feature keeps the read/write arm)

## Touchpoints — read this feature before editing

- `apps/api/src/ask/**`

## Decisions

### SK-ASK-001 — `/v1/ask` is the single create-or-query endpoint

- **Decision:** A single endpoint `POST /v1/ask` accepts a natural-language `goal` and a cheap classifier-tier LLM call decides `kind ∈ {"create", "query", "write"}`. `create` routes to the typed-plan pipeline (`docs/architecture.md §3.6.2`); `query` and `write` route to the read/write orchestrator. There is no `/v1/db/new`, no separate "create" verb.
- **Core value:** Goal-first, Simple, Effortless UX
- **Why:** Every persona walks in with a goal, not a database. Two endpoints (`/v1/ask` for chat, `/v1/run` for raw queries) is the canonical surface (`GLOBAL-017`). Splitting create from query would force the user to know which one to call, contradicting `GLOBAL-017` and the on-ramp inversion principle in `docs/architecture.md §0.1`.
- **Consequence in code:** `apps/api/src/routes/v1/ask.ts` is the only handler; create/query/write are internal branches behind the classifier. PRs that add `/v1/db/new`, `/v1/queries`, or `/v1/plans` are rejected.
- **Alternatives rejected:** REST resource explosion (`/v1/queries`, `/v1/runs`, `/v1/plans`) — bigger surface, more docs, more inconsistency. `/v1/ask` + `/v1/db/new` — splits a single user goal across two endpoints; the user has to know which.

### SK-ASK-002 — Canonical step order: edge → auth → rate-limit → hash → plan-cache → (hit: validate → exec) | (miss: route → plan → SQL-validate → exec → cache-write) → optional summarize

- **Decision:** Every `/v1/ask` request follows the canonical step order in `docs/performance.md §2.1, §2.2`. New steps require a `SK-ASK-NNN` decision; reordering existing steps requires updating the canonical tables in `performance.md` in the same PR. The cache-miss path opens with one merged `route` LLM call (SK-ASK-009) — no separate `classify` then `disambiguate` step.
- **Core value:** Bullet-proof, Honest latency, Fast
- **Why:** A canonical order means every reviewer, every dashboard, every test agrees on what "the ask path" is. Inserting an unsanctioned step (e.g., a third LLM call between plan and exec) is the kind of change that silently breaks the latency budget and the trace UI. The order is also load-bearing for `GLOBAL-011`: surfaces stream the trace in the order steps complete. Folding classify + disambiguate into one `route` call halves the cheap-tier latency on the dbId-absent path.
- **Consequence in code:** `orchestrateAsk()` (per `docs/performance.md §4` Slice 6) walks the steps in order. Each step gets one OTel span (per `docs/performance.md §3.1`). The route-handler prelude (SK-ASK-009) emits one `llm.route` span per cache-miss / dbId-absent send. A reorder regression is caught by the span-tree assertion in the slice's vitest. Latency budgets in `performance.md §2.1, §2.2` are CI-asserted at 1.5× p50.
- **Alternatives rejected:** Per-handler order — would let the order drift between create / query / write without notice. Skip cache when LLM is fast — defeats `GLOBAL-006` and breaks the cache-warming intent. Keep classify + disambiguate as separate steps — see SK-ASK-009.

### SK-ASK-003 — superseded by SK-ASK-009 (merged `routeAsk` decision).

### SK-ASK-004 — Two distinct validator paths: read/write (LLM-generated) vs DDL (typed-plan compiler) — never mixed

- **Decision:** `/v1/ask` query/write traffic routes through `apps/api/src/ask/sql-validate.ts`, which allows only `SELECT / INSERT / UPDATE / DELETE / WITH / EXPLAIN / SHOW` (multi-statement and `EXPLAIN ANALYZE` rejected). DDL is the **only** privilege of the typed-plan compiler in `docs/architecture.md §3.6.2` and never reaches the read/write validator.
- **Core value:** Bullet-proof, Simple
- **Why:** The LLM never has DDL rights through the read/write path — the only legitimate `CREATE` comes from our deterministic typed-plan compiler, which we wrote and we tested. The hard split makes prompt-injection structurally unable to reach DDL. Layered guardrails (AST reject-list + role isolation + RLS + statement timeout + transactional wrapper) follow the Replit-incident lesson from `docs/research-receipts.md §1`.
- **Consequence in code:** `validateReadWrite(sql)` in `sql-validate.ts` rejects every DDL verb. The DDL path's validator is a separate file (Zod over `SchemaPlan` plus libpg_query parse on the compiled DDL) and is invoked **only** from the create path. PRs that try to merge the two validator surfaces are rejected.
- **Alternatives rejected:** Single validator with a `mode: "rw" | "ddl"` flag — a single `mode` flag flip would re-open DDL to LLM-generated SQL. LLM emits DDL directly — explicitly rejected in `§3.6.2`; the LLM emits a typed plan, our code emits SQL.

### SK-ASK-005 — Summarize is conditional: skip when `Accept: application/json` or row count below threshold

- **Decision:** The post-exec LLM summarization step (`llm.summarize`) only runs when (a) the result row count is above a threshold (default 5) **or** (b) the intent classifier flagged the query as conversational. It is skipped entirely when the client sent `Accept: application/json`.
- **Core value:** Fast, Free, Honest latency
- **Why:** Summarization adds 300 ms p50 / 800 ms p99 — material on a cache-miss path. Most fact-lookup queries return raw rows; summarising "[{count: 42}]" wastes user time and LLM credits. Programmatic clients (`Accept: application/json`) want raw data; humans on the chat surface want prose.
- **Consequence in code:** `shouldSummarize(rows, intent, accept)` is a pure function tested in isolation. The summarize step is skipped *before* the LLM call, not inside it (no wasted token spend on a result we'd discard).
- **Alternatives rejected:** Always summarise — wastes 80% of summarize budget on row-count queries. Always skip — chat surface loses prose; bad UX for the conversational majority.

### SK-ASK-006 — Anonymous-mode is a separate rate-limit tier — not "free with a lower limit"

- **Decision:** The API has an explicit anonymous-mode rate-limit tier, distinct from authed-free and paid tiers (`GLOBAL-007`). Anonymous traffic shares its tier across all anonymous device-tokens by IP + device-token; signing in promotes the device's outstanding budget to the authed tier (no fresh quota grant).
- **Core value:** Free, Bullet-proof, Goal-first
- **Why:** Without a separate tier, an anonymous abuse spike (per-IP create-floods) eats authed-user budget. With it, abuse is contained in its own bucket while the authed surface stays fast. Promoting on sign-in (no fresh grant) prevents farming free quota by signing in repeatedly under fresh emails.
- **Consequence in code:** Rate-limit middleware (`packages/rate-limit`) reads `(tier, identifier)` where `identifier` is `device_token` for anonymous and `user_id` for authed. `attachIdentity()` carries forward the consumed budget. PoW challenges fire on signup if the bucket spikes (`docs/architecture.md §3.6.8`).
- **Alternatives rejected:** Single global free tier — every anonymous abuse spike degrades authed users. Allow anonymous to refresh budget by attaching a new identity — quota-farming.

### SK-ASK-007 — `user.first_query` fires exactly once per user via the lookup-then-emit-then-commit pattern

- **Decision:** The first successful `/v1/ask` per user emits a `user.first_query` product event exactly once. The implementation uses lookup-then-emit-then-commit with a KV marker — the marker is checked, the event is emitted, the marker is committed. The full pattern is in `docs/performance.md §4` Slice 6.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Naively writing the marker before emitting can drop the event on a Worker crash; emitting then writing can double-emit on retry. The lookup-then-emit-then-commit pattern with idempotent sink writes (events-pipeline) gives us at-most-once user-visible (the dashboard counts unique users) without dropping the signal.
- **Consequence in code:** `firstQueryGate(user_id)` is wrapped in `nlqdb.cache.first_query.lookup` and `nlqdb.cache.first_query.commit` spans. The events emit is wrapped in `ctx.waitUntil` (per `docs/performance.md §3.1`) so it runs after the response. Test asserts exactly-once across two concurrent first calls (the second observes the marker).
- **Alternatives rejected:** Write marker first — event drops on crash. Emit first — double-emit on retry. Synchronous DB write — adds DB round-trip to the response path.

### SK-ASK-008 — Live trace is streamed in step-completion order; no spinner-lying

- **Decision:** `apps/web` and CLI render the live trace in step-completion order (cache lookup, plan, allowlist, exec, summarize) with real timings. No generic spinner; if a step takes long, the surface names it.
- **Core value:** Honest latency, Effortless UX, Bullet-proof
- **Why:** Spinners hide progress and erode trust on latency spikes. A live trace turns slow steps into legible, debuggable information. This is GLOBAL-011 on the ask path.
- **Consequence in code:** Each canonical step (SK-ASK-002) emits a trace event the SDK exposes via `onTrace`. Tests assert every step in cache-miss produces exactly one trace event.
- **Alternatives rejected:** Generic spinner — no info, eroded trust. Hide latency below threshold — users notice anyway.

### SK-ASK-009 — Cheap-tier classifier sees the principal's recent tables; classify + disambiguate merge into `routeAsk`

- **Decision:** The cheap-tier classifier receives the principal's 100 most-recent `(dbId, table)` tuples. Output is `{kind, targetDbId, referencedTables, confidence, reason}` from a single LLM call (`llm.route`). Collapses the prior `classify` + `disambiguate` pair into one.
- **Core value:** Bullet-proof, Fast, Effortless UX
- **Why:** Without table-level context the classifier can't tell "insert red and blue tables" (`kind=create`) from "insert into red and blue" (`kind=write`). Recent tables are the cheapest disambiguator. Merging halves cheap-tier latency on the dbId-absent path; prompt budget absorbs 100 × ~30 chars ≈ 3 KB.
- **Consequence in code:** `apps/api/src/ask/route-ask.ts` exports `routeAsk(deps, input)`. The old `classifier.ts` / `disambiguate-db.ts` are deleted; `LLMRouter.route` replaces them. The route handler runs `routeAsk` in parallel with `listDatabasesForTenant`. Anon `kind=create` past the device cap returns the SK-ANON-012 `auth_required` envelope; the post-OAuth landing page replays via `nlqdb_pending`.
- **Alternatives rejected:** Two cheap-tier calls — overlapping input, double latency. Full schema in prompt — token-explodes on power users. Dbset only — doesn't help the load-bearing "insert red and blue tables" misclassification.

### SK-ASK-010 — Goal text is capped at 2 000 characters server-side

- **Decision:** Every endpoint that accepts a `goal` string (`/v1/ask`, `/v1/databases`, `/v1/chat/message`) rejects inputs longer than 2 000 characters with `400 goal_too_long { maxLength: 2000 }`. The cap applies before any LLM call so adversarially long strings cannot inflate token spend.
- **Core value:** Bullet-proof, Honest latency
- **Why:** A natural-language query goal is a sentence or short paragraph. 2 000 chars is ~400 words — generous enough for complex multi-step requests while bounding worst-case token cost at the API boundary. Without a cap, a single anon request carrying a multi-megabyte string would exhaust the cheap-tier model's context window, inflate the run's LLM invoice, and degrade latency for other requests sharing the isolate.
- **Consequence in code:** `MAX_GOAL_LENGTH = 2000` is exported from `apps/api/src/http.ts` and checked in `parseGoalDbBody`, `parseAskBody`, and the `POST /v1/databases` handler. The error body carries `maxLength` so SDK consumers can render a precise message without hard-coding the limit (GLOBAL-012).
- **Alternatives rejected:** Silent truncation — hides the problem from the caller; the truncated goal produces a wrong result with no diagnostic. Per-tier limits — adds complexity without meaningful UX benefit; 2 000 chars covers every legitimate use case across all tiers.

### SK-ASK-011 — superseded by SK-ASK-017 (speculative create removed; rollback path was post-COMMIT, producing a 21.6 s tail).

### SK-ASK-012 — Per-principal recent-tables LRU (100 entries) in KV

- **Decision:** Each principal (`user:<id>` or `anon:<hash>`) has a KV-backed MRU of the 100 most recent `(dbId, slug, table)` tuples at `recent_tables:<principalId>` with a 90-day TTL (matches SK-ANON-002). Updated after every successful `/v1/ask` exec and `db.create`.
- **Core value:** Bullet-proof, Free, Fast
- **Why:** SK-ASK-009's classifier uses this to disambiguate verbs ("insert/add/put") between DML and DDL. Per-principal scope mirrors rate-limit; 100 × ~30 chars ≈ 3 KB fits cheap-tier prompt budget. KV writes ride `ctx.waitUntil` so the update never sits on user-visible p99.
- **Consequence in code:** `apps/api/src/ask/recent-tables.ts` exports `makeRecentTablesStore(kv)` with `load` / `touch`. Both orchestrators carry the store. Spans `nlqdb.recent_tables.{lookup,touch}` wrap the KV ops.
- **Alternatives rejected:** Lazy per-db introspection — pays a schema query per call. Per-(principal, db) cache — chicken-and-egg with classify. No cap — unbounded growth.

### SK-ASK-013 — Per-stage recoverable-failure retries with feedback (3 attempts)

- **Decision:** Each `/v1/ask` orchestrator stage wraps its work in `withStageRetry(stage, fn)` (3 attempts max): `route` (classifier), `plan` (LLM emit + validator allowlist), `exec` (DB query). When `validateSql` rejects, the next plan call receives the rejected SQL + reason in `PlanRequest.previousAttempt`. Non-recoverable cases (`DbConfigError`, billing-cap, 4xx) skip retries via the `Nonrecoverable` sentinel. Composes with the LLM provider chain's 3-hop failover (SK-LLM-006).
- **Core value:** Bullet-proof, Effortless UX
- **Why:** Without per-stage retries, a single Neon hiccup / provider 5xx / first-shot invalid SQL surfaces as `db_unreachable` / `llm_failed` / `sql_rejected`. Three attempts absorb transients; validator feedback closes the "LLM emits DROP, we 4xx, user retypes" loop.
- **Consequence in code:** `apps/api/src/ask/retry.ts` exports `withStageRetry`, `Nonrecoverable`, `RETRY_MAX_ATTEMPTS = 3`. `orchestrate.ts` wraps plan + exec; the route handler wraps `routeAsk`. `PlanRequest.previousAttempt` carries `{sql?, error}`; each retry stamps `nlqdb.retry.attempt` + increments `nlqdb.retry.total{stage, reason}`.
- **Alternatives rejected:** Single attempt — surfaces every transient. Unbounded retries — request hangs. SDK-only retries — server-side recoveries need server context. Skip validator feedback — LLM emits the same shape twice.

### SK-ASK-014 — `routeAsk` runs on every `/v1/ask`, even when `dbId` is pinned

- **Decision:** `routeAsk` runs on every `/v1/ask` regardless of `dbId` pin. `kind=create + pinned` → `409 clarify_required` with `pinned_db:{id,slug}` so the surface shows "Create a new database, or query *<slug>*?" instead of the cryptic `sql_rejected` the allowlist would emit on the LLM's `CREATE TABLE`. `kind=create + no pin` → create path; `kind=query|write + pinned` → pin honoured. Refines SK-ASK-009. Per SK-ANON-013, anon principals without a pinned `dbId` short-circuit ahead of this.
- **Core value:** Effortless UX, Goal-first, Bullet-proof
- **Why:** "new table" against a pinned DB is a dead end — allowlist rejects, surface shows "rejected." Classify-every-send turns that into a typed forward action.
- **Consequence in code:** `apps/api/src/index.ts` lifts the routeAsk prelude out of `if (!parsed.body.dbId)`. New `clarify_required` AskError in `ask/types.ts`. `ChatPanel` chip: "Create new database" re-sends without `dbId`.
- **Alternatives rejected:** Silent pin override on `kind=create` — surprises. Convert only post-allowlist — burns a planner-tier hop first. Typed-plan extend pipeline — right long-term answer; Open.

### SK-ASK-015 — Plan cache writes are gated on successful exec

- **Decision:** `nlqdb.cache.plan.write` runs only after `withStageRetry("exec", …)` resolves ok. `cachePlanMissesTotal()` still fires on every miss — it measures cache shape, not plan quality.
- **Core value:** Bullet-proof, Fast
- **Why:** A plan that emits + validates is not a plan that EXECUTES. The prior order (write-then-exec) let one bad emit poison every subsequent request with the same goal. Trace: anon `/v1/ask` for `swimming pool visitors` cached a SELECT against a non-existent table; the next request 28 s later returned 502 in 1.4 s with no LLM call.
- **Consequence in code:** `planCache.write` moves below `withStageRetry("exec", …)` and runs only when `!cacheHit`. Test asserts `cache.write` never fires on a failed exec.
- **Alternatives rejected:** Tag cached plan `unconfirmed` + invalidate — two writes per request. Short TTL — masks the root cause.

### SK-ASK-016 — `schema_mismatch` envelope: pre-flight + 42P01 backstop, both Nonrecoverable, surface as 409

- **Decision:** When LLM-emitted SQL references a table not in the target DB, the orchestrator returns `{ status: "schema_mismatch", referencedTables, schemaTables }` as HTTP 409. Two paths converge: (A) pre-flight `extractTables(planSql)` vs. `db.schemaText` regex before exec; (B) post-exec backstop — `42P01 relation does not exist` caught in the exec callback, wrapped in `Nonrecoverable` so SK-ASK-013's retry loop bails after one attempt. Pre-flight skipped when `schemaText` is null (legacy rows); backstop covers those + regex misses (view-vs-table).
- **Core value:** Bullet-proof, Honest latency, Effortless UX
- **Why:** The failure is deterministic — three retries replay the same wrong SQL, then 502 `db_unreachable` 600+ ms later (surface lies "couldn't reach the DB"). Pre-flight catches it in ~0.5 ms; 42P01 is defense in depth. Trace: anon goal `swimming pool visitors` resolved to `kind=query` against a stale DB; 3× `db.query` failed `42P01`. The 409 lets the surface re-route rather than dead-end.
- **Consequence in code:** `SchemaMismatchError` + `schema_mismatch` AskError in `ask/types.ts`. `checkSchemaTables` in `orchestrate.ts` runs between plan emit and exec; the inner exec catch wraps 42P01 in `Nonrecoverable`. `errorStatus()` maps `"schema_mismatch" → 409`.
- **Alternatives rejected:** Retry plan with rejected table — LLM re-picks the same wrong table. Auto-reroute to create — same wrong classification. Treat 42P01 as recoverable — worse latency. `.code` only — Neon HTTP shim drops it sometimes; keep the message regex fallback.

### SK-ASK-017 — Speculative create removed; cold-start parallelism comes from `kickoffAskPrelude` alone

- **Decision:** `apps/api/src/ask/{route-hint,reconcile-speculative}.ts` and `apps/api/src/db-create/speculative.ts` are deleted. The `/v1/ask` handler no longer races a `startSpeculativeCreate` against `listDatabasesForTenant`. Cold-start parallelism is preserved by `kickoffAskPrelude` (listPromise + recentTablesPromise kick off before `routeAsk`, and routeAsk runs in parallel with listPromise). Supersedes SK-ASK-011.
- **Core value:** Simple, Bullet-proof, Honest latency
- **Why:** SK-ASK-011's rollback path was post-COMMIT — Postgres tx on Workers can't be cancelled mid-flight, so a doomed speculation must finish before its schema can be dropped. Trace evidence: prod `/v1/ask` for `swimming pool visitors` against a stale anon principal observed 21.6 s wall-time, 18 s of which was the speculative create finishing under a foregone-conclusion rollback. The ~600 ms saved on the cold-start LLM hop is dwarfed by the 18 s tail risk, and the mechanism multiplied three secondary failures (MRU pollution, plan-cache poisoning, classifier mis-route against the zombie DB).
- **Consequence in code:** Three modules deleted. `apps/api/src/index.ts` drops the speculative kickoff + consume blocks. `db-create/orchestrate.ts` keeps `recent_tables.touch` (only canonical creates reach it now). `neon-provision.ts` keeps `dropSchemaAndRegistry` for the registry-insert-failed path.
- **Alternatives rejected:** Gate speculation on listDb returning 0 — adds wait on every cold-create. Cancellable rollback — Postgres tx semantics don't allow it on Workers. Remove only the MRU-pre-rollback touch — 18 s tail risk remains. Feature flag — re-introduces the dead code.

### SK-ASK-018 — Seed `routeAsk` recentTables from the pinned DB's `schema_text` when the MRU is empty

- **Decision:** When `/v1/ask` arrives with `dbId` pinned and `recent_tables:<principalId>` is empty in KV, the route handler reads the pinned `databases` row from D1, synthesizes a `RecentTable` per `CREATE TABLE` in `schema_text`, and uses that list as `routeAsk`'s `recentTables` input. KV is authoritative when populated — the D1 fallback only fires on the cold-MRU path, so the steady state pays one KV read.
- **Core value:** Effortless UX, Goal-first, Fast
- **Why:** A freshly-adopted user typing *"new employee omer in this db"* against the pinned `db_factory_management_a723a5` saw `409 clarify_required` because `recordAnonAdoption` (SK-ANON-003) doesn't migrate `recent_tables:anon:<hash>` to `recent_tables:user:<id>`. With empty `recentTables`, routeAsk's LLM applied its "no recent tables → create" prompt rule. Seeding from `schema_text` puts `employees` in the prompt and the classifier picks `kind=write`. Gating on `recentTables.length === 0` keeps the hot path at one KV read — D1 fires only when the cache was going to misclassify anyway.
- **Consequence in code:** `tablesFromSchemaText` in `apps/api/src/ask/recent-tables.ts` (also reused by `checkSchemaTables`), `seedFromPinnedDb` in `apps/api/src/ask/prelude.ts`, and a conditional `resolveDb` call in `apps/api/src/index.ts` after `await recentTablesPromise`. Synthesized entries carry `touchedAt = 0` so any later real touch outranks them. Best-effort: a D1 throw leaves the empty MRU (same end-state as today).
- **Alternatives rejected:** Always fetch the pinned DB in parallel with MRU — extra D1 read per `/v1/ask` even when the cache already covers it. Migrate the anon MRU on adoption — adds a KV op to the sign-in transaction for a payoff smaller than the rare cold-MRU pinned path. Inline schema_text into the prompt — larger prompt budget; reusing `recentTables` is a smaller diff.

### SK-ASK-019 — Map PG `3F000` (schema does not exist) to `schema_mismatch` with structured logging

- **Decision:** The exec catch in `apps/api/src/ask/orchestrate.ts` matches PG SQLSTATE `3F000` (plus the `schema … does not exist` message fallback for Neon HTTP responses that drop `.code`) alongside the existing `42P01` (SK-ASK-016 Defense B) and wraps the error in `Nonrecoverable("schema_mismatch", new SchemaMismatchError([], []))` — `withStageRetry` then bails after attempt 1 (no retry on a deterministic missing-schema). Before throwing, the orchestrator stamps `nlqdb.ask.schema_mismatch.{reason,pg_code,db_id,sql,goal,pg_message,cache_hit}` on the active span and emits one structured `console.error` line with the same fields (each capped at 500 chars).
- **Core value:** Bullet-proof, Honest latency, Effortless UX
- **Why:** The recently-adopted `db_factory_management_a723a5` D1 row pointed at a Postgres schema that had been dropped in Neon (≈20 of 25 D1 rows in prod orphaned similarly). The INSERT hit `3F000`, which SK-ASK-016's `42P01`-only match didn't recognise; SK-ASK-013 retried 3× against the still-missing schema and surfaced a misleading `db_unreachable` 600 ms+ later. The structured log is the load-bearing piece for follow-up prompt tuning / orphan-schema diagnosis — the `SchemaMismatchError` envelope only carries table lists, so without it there's no way to grep for which (goal, dbId, sql) triples are misfiring.
- **Consequence in code:** `orchestrate.ts:350` matches `"42P01" | "3F000"` plus the two regex fallbacks, sets the seven span attributes, and emits the JSON log line under `{event: "schema_mismatch"}`. `reason` is `"schema_missing"` for 3F000-shaped errors and `"table_missing"` for 42P01. Tests in `apps/api/test/orchestrate.test.ts` assert no retry on either shape and the logged JSON carries the expected fields.
- **Alternatives rejected:** Pre-flight `pg_namespace` check on every `/v1/ask` — extra Neon round-trip on the hot path for a < 5% cohort. Auto-drop the orphan D1 row on 3F000 — couples the orchestrator to registry mutation. Keep `db_unreachable` (no envelope change) — burns 3 retries and the surface can't render a recovery CTA. Span attributes only (no `console.error`) — head-sampling loses the rare orphan-schema events.

## The LLM loop

Canonical step order is SK-ASK-002 (edge → auth → rate-limit → hash → plan-cache → (hit: validate → exec) | (miss: route → plan → SQL-validate → exec → cache-write) → optional summarize). Intentional reinventions on this path — grammar-constrained SQL decoder, foreign-key-aware schema embedding, learned query-shape classifier — are catalogued in `docs/guidelines.md §7`.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
- **GLOBAL-006** — Plans content-addressed by `(schema_hash, query_hash)`.
- **GLOBAL-011** — Honest latency — show the live trace; never spinner-lie.
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
- **GLOBAL-015** — Power users always have an escape hatch.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
- **GLOBAL-022** — Recoverable failures retry to success — never surface a fixable error.
  - *In this feature:* see `SK-ASK-013` for the canonical implementation. Each pipeline stage owns its recoverable error class — classifier (wrong intent), planner (invalid SQL), validator (allowlist re-plan), executor (transient DB error) — and retries up to 3 attempts via `withStageRetry`, feeding the prior attempt's error into the next prompt where applicable.
- **GLOBAL-023** — Trust UX baseline.
  - *In this feature:* SK-TRUST-002 shipped — `AskResult` carries the `trace: { sql, plan_id, confidence, model, cache_hit }` block on every successful response; top-level `sql` / `cached` were removed (cleaner-shape > backwards compat per CLAUDE.md P5). The SSE `plan` event is the streaming form of the same record. Writes/DDL responses carry the `diff` block for [`SK-TRUST-001`](../trust-ux/FEATURE.md) (planned); the orchestrator short-circuits to `low_confidence` per [`SK-TRUST-003`](../trust-ux/FEATURE.md) (planned) before `db.execute`.
- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path.
  - *In this feature:* 4xx `unsupported_verb` rejections (DDL via `/v1/ask`) emit `feature.requested.ddl_via_ask`; `low_confidence` refusals emit `feature.requested.ambiguous_goal`; `db_full` write-cap hits emit `feature.requested.larger_db`.

## Open questions / known unknowns

- **Streaming protocol for live trace.** `SK-ASK-008` and `GLOBAL-011` require a live trace, but the wire protocol (SSE? chunked JSON? OTel-over-WS?) is not yet pinned. SDK's `onTrace` hook in `packages/sdk` will fix the surface API; the wire format is open.
- **Failure-mode for partial results.** If `exec` succeeds but `summarize` fails, do we return the rows + a summarize-error envelope, or 5xx the whole call? Design.md doesn't decide. Leaning toward "rows + envelope" so the user sees data, but needs an explicit `SK-ASK-NNN`.
- **Idempotency on `/v1/ask`.** `GLOBAL-005` says every mutation accepts `Idempotency-Key`. `/v1/ask` is sometimes a query (no mutation), sometimes a write. Confirm whether the dedupe store is consulted for the write branch only or for every call (and what `kind=create` deduping looks like).
- **Null-pick disambiguator cache TTL.** `disambiguate-db.ts` caches `chosenId: null` for 7 days under `(tenantId, goalHash, dbsetHash)`; dbsetHash evicts on DB add/remove but a false-null is sticky for that window. Options: don't cache nulls (cheap LLM hit on retry) vs. 1 h TTL (bounded staleness). Needs a decision (new `SK-ASK-NNN`).
- **SK-ASK-014 follow-ups.** (a) Typed-plan extend-schema pipeline so "Add it to *<slug>*" works — `kind=extend` route + compiler + `sql-validate-ddl.ts` widening + table-card re-embed (`SK-HDC-NNN`). (b) Latency audit — classify-every-send adds ~150 ms p50 to dbId-pinned hot path; confirm PERFORMANCE §2.1/§2.2 still holds.

## Happy path walkthrough

HTTP API cURL examples (default + writes with `Idempotency-Key` + anonymous-mode reuse) and the Priya persona walkthrough live in `docs/architecture.md` §14.6 / §15.3 — that's the canonical home for surface examples and persona stories so they don't drift out of sync with the architecture spec.
