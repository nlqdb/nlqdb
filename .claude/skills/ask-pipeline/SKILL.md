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
**Cross-refs:** docs/design.md §3.6.1 (endpoint shape), §3.6.2 (typed-plan pipeline), §3.6.4 (dbId resolution), §3.6.5 (validator paths), §9 (bullet-proof checklist) · docs/implementation.md Slice 6 (`/v1/ask` E2E) · docs/performance.md §2.1, §2.2, §3

## Touchpoints — read this skill before editing

- `apps/api/src/ask/**`

## Decisions

### SK-ASK-001 — `/v1/ask` is the single create-or-query endpoint

- **Decision:** A single endpoint `POST /v1/ask` accepts a natural-language `goal` and a cheap classifier-tier LLM call decides `kind ∈ {"create", "query", "write"}`. `create` routes to the typed-plan pipeline (`docs/design.md §3.6.2`); `query` and `write` route to the read/write orchestrator. There is no `/v1/db/new`, no separate "create" verb.
- **Core value:** Goal-first, Simple, Effortless UX
- **Why:** Every persona walks in with a goal, not a database. Two endpoints (`/v1/ask` for chat, `/v1/run` for raw queries) is the canonical surface (`GLOBAL-017`). Splitting create from query would force the user to know which one to call, contradicting `GLOBAL-017` and the on-ramp inversion principle in `docs/design.md §0.1`.
- **Consequence in code:** `apps/api/src/routes/v1/ask.ts` is the only handler; create/query/write are internal branches behind the classifier. PRs that add `/v1/db/new`, `/v1/queries`, or `/v1/plans` are rejected.
- **Alternatives rejected:** REST resource explosion (`/v1/queries`, `/v1/runs`, `/v1/plans`) — bigger surface, more docs, more inconsistency. `/v1/ask` + `/v1/db/new` — splits a single user goal across two endpoints; the user has to know which.
- **Source:** docs/design.md §3.6.1

### SK-ASK-002 — Canonical step order: edge → auth → rate-limit → hash → plan-cache → (hit: validate → exec) | (miss: classify → plan → SQL-validate → exec → cache-write) → optional summarize

- **Decision:** Every `/v1/ask` request follows the canonical step order in `docs/performance.md §2.1, §2.2`. New steps require a `SK-ASK-NNN` decision; reordering existing steps requires updating the canonical tables in `performance.md` in the same PR.
- **Core value:** Bullet-proof, Honest latency, Fast
- **Why:** A canonical order means every reviewer, every dashboard, every test agrees on what "the ask path" is. Inserting an unsanctioned step (e.g., a third LLM call between plan and exec) is the kind of change that silently breaks the latency budget and the trace UI. The order is also load-bearing for `GLOBAL-011`: surfaces stream the trace in the order steps complete.
- **Consequence in code:** `orchestrateAsk()` (per `docs/implementation.md` Slice 6) walks the steps in order. Each step gets one OTel span (per `docs/performance.md §3.1`). A reorder regression is caught by the span-tree assertion in the slice's vitest. Latency budgets in `performance.md §2.1, §2.2` are CI-asserted at 1.5× p50.
- **Alternatives rejected:** Per-handler order — would let the order drift between create / query / write without notice. Skip cache when LLM is fast — defeats `GLOBAL-006` and breaks the cache-warming intent.
- **Source:** docs/design.md §3.6.1, §3.6.2 · docs/performance.md §2.1, §2.2 · docs/implementation.md Slice 6

### SK-ASK-003 — `dbId` resolution is deterministic per surface — never an LLM-driven "did you mean…?"

- **Decision:** When `dbId` is omitted, resolution follows `docs/design.md §3.6.4`: HTML embeds resolve from `pk_live_<dbId>`; REST returns `409 Conflict` with `candidate_dbs` if the account has 2+ DBs; CLI uses MRU + interactive `select`; MCP uses elicitation. The system **never** runs an LLM-based "which DB did you mean" heuristic.
- **Core value:** Bullet-proof, Honest latency, Effortless UX
- **Why:** A guess that hits the wrong DB writes (or reads sensitive data from) the wrong tenant — silent corruption is the worst possible failure mode. Deterministic per-surface resolution turns "ambiguous" into a structured error the surface can render usefully (`409` for REST, prompt for CLI, elicitation for MCP).
- **Consequence in code:** `resolveDbId(req)` returns `{db}` or `{candidates: [...]}`; ambiguity is never resolved by an LLM call. The HTTP handler returns 409 with the `candidate_dbs` envelope; the CLI prompts; MCP returns an elicitation. Schema-match scoring (LLM heuristic disambiguation) is **deferred to Phase 2+**.
- **Alternatives rejected:** Auto-pick the most-recently-used DB on REST — silent wrong-tenant write. LLM "did you mean…" — failure mode is silent and unexplainable.
- **Source:** docs/design.md §3.6.4

### SK-ASK-004 — Two distinct validator paths: read/write (LLM-generated) vs DDL (typed-plan compiler) — never mixed

- **Decision:** `/v1/ask` query/write traffic routes through `apps/api/src/ask/sql-validate.ts`, which allows only `SELECT / INSERT / UPDATE / DELETE / WITH / EXPLAIN / SHOW` (multi-statement and `EXPLAIN ANALYZE` rejected). DDL is the **only** privilege of the typed-plan compiler in `docs/design.md §3.6.2` and never reaches the read/write validator.
- **Core value:** Bullet-proof, Simple
- **Why:** The LLM never has DDL rights through the read/write path — the only legitimate `CREATE` comes from our deterministic typed-plan compiler, which we wrote and we tested. The hard split makes prompt-injection structurally unable to reach DDL. Layered guardrails (AST reject-list + role isolation + RLS + statement timeout + transactional wrapper) follow the Replit-incident lesson from `docs/research-receipts.md §1`.
- **Consequence in code:** `validateReadWrite(sql)` in `sql-validate.ts` rejects every DDL verb. The DDL path's validator is a separate file (Zod over `SchemaPlan` plus libpg_query parse on the compiled DDL) and is invoked **only** from the create path. PRs that try to merge the two validator surfaces are rejected.
- **Alternatives rejected:** Single validator with a `mode: "rw" | "ddl"` flag — a single `mode` flag flip would re-open DDL to LLM-generated SQL. LLM emits DDL directly — explicitly rejected in `§3.6.2`; the LLM emits a typed plan, our code emits SQL.
- **Source:** docs/design.md §3.6.2, §3.6.5

### SK-ASK-005 — Summarize is conditional: skip when `Accept: application/json` or row count below threshold

- **Decision:** The post-exec LLM summarization step (`llm.summarize`) only runs when (a) the result row count is above a threshold (default 5) **or** (b) the intent classifier flagged the query as conversational. It is skipped entirely when the client sent `Accept: application/json`.
- **Core value:** Fast, Free, Honest latency
- **Why:** Summarization adds 300 ms p50 / 800 ms p99 — material on a cache-miss path. Most fact-lookup queries return raw rows; summarising "[{count: 42}]" wastes user time and LLM credits. Programmatic clients (`Accept: application/json`) want raw data; humans on the chat surface want prose.
- **Consequence in code:** `shouldSummarize(rows, intent, accept)` is a pure function tested in isolation. The summarize step is skipped *before* the LLM call, not inside it (no wasted token spend on a result we'd discard).
- **Alternatives rejected:** Always summarise — wastes 80% of summarize budget on row-count queries. Always skip — chat surface loses prose; bad UX for the conversational majority.
- **Source:** docs/design.md §8 (cost-control rule 4) · docs/performance.md §2.2

### SK-ASK-006 — Anonymous-mode is a separate rate-limit tier — not "free with a lower limit"

- **Decision:** The API has an explicit anonymous-mode rate-limit tier, distinct from authed-free and paid tiers (`GLOBAL-007`). Anonymous traffic shares its tier across all anonymous device-tokens by IP + device-token; signing in promotes the device's outstanding budget to the authed tier (no fresh quota grant).
- **Core value:** Free, Bullet-proof, Goal-first
- **Why:** Without a separate tier, an anonymous abuse spike (per-IP create-floods) eats authed-user budget. With it, abuse is contained in its own bucket while the authed surface stays fast. Promoting on sign-in (no fresh grant) prevents farming free quota by signing in repeatedly under fresh emails.
- **Consequence in code:** Rate-limit middleware (`packages/rate-limit`) reads `(tier, identifier)` where `identifier` is `device_token` for anonymous and `user_id` for authed. `attachIdentity()` carries forward the consumed budget. PoW challenges fire on signup if the bucket spikes (`docs/design.md §3.6.8`).
- **Alternatives rejected:** Single global free tier — every anonymous abuse spike degrades authed users. Allow anonymous to refresh budget by attaching a new identity — quota-farming.
- **Source:** docs/design.md §3.6.8 · docs/decisions.md#GLOBAL-007

### SK-ASK-007 — `user.first_query` fires exactly once per user via the lookup-then-emit-then-commit pattern

- **Decision:** The first successful `/v1/ask` per user emits a `user.first_query` product event exactly once. The implementation uses lookup-then-emit-then-commit with a KV marker — the marker is checked, the event is emitted, the marker is committed. The full pattern is in `docs/implementation.md` Slice 6.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Naively writing the marker before emitting can drop the event on a Worker crash; emitting then writing can double-emit on retry. The lookup-then-emit-then-commit pattern with idempotent sink writes (events-pipeline) gives us at-most-once user-visible (the dashboard counts unique users) without dropping the signal.
- **Consequence in code:** `firstQueryGate(user_id)` is wrapped in `nlqdb.cache.first_query.lookup` and `nlqdb.cache.first_query.commit` spans. The events emit is wrapped in `ctx.waitUntil` (per `docs/performance.md §3.1`) so it runs after the response. Test asserts exactly-once across two concurrent first calls (the second observes the marker).
- **Alternatives rejected:** Write marker first — event drops on crash. Emit first — double-emit on retry. Synchronous DB write — adds DB round-trip to the response path.
- **Source:** docs/implementation.md Slice 6 · docs/performance.md §3.1

### SK-ASK-008 — Live trace is streamed in step-completion order; no spinner-lying

- **Decision:** `apps/web` and CLI render the live trace of an in-flight `/v1/ask` request in the order steps complete (cache lookup, plan, allowlist, exec, summarize) with real timings. There is no generic spinner; if a step takes long, the surface names the step.
- **Core value:** Honest latency, Effortless UX, Bullet-proof
- **Why:** A spinner that hides progress trains users to assume the worst when latency spikes. A live trace turns slow steps into legible, debuggable information — and forces us to fix the slow steps because users see them. This is `GLOBAL-011`'s consequence on the ask path.
- **Consequence in code:** Each step in the canonical order (`SK-ASK-002`) emits a trace event the SDK exposes via the `onTrace` hook. `apps/web` renders them in order; CLI's TTY mode prints each as it completes. Tests assert that every step in the cache-miss path produces exactly one trace event.
- **Alternatives rejected:** Generic spinner with "this is taking longer than usual" — gives no information; trains users not to trust the surface. Hide latency below a threshold — users notice anyway, and lose trust when the threshold is wrong.
- **Source:** docs/design.md §0 (Honest latency) · docs/decisions.md#GLOBAL-011

### GLOBAL-005 — Every mutation accepts `Idempotency-Key`

- **Decision:** Every state-changing endpoint (HTTP, SDK, CLI, MCP) accepts an optional `Idempotency-Key` header. Mutations are recorded keyed by `(user_id, idempotency_key)` so retries return the original response body byte-for-byte.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Networks fail. Workers retry. Without idempotency, retries duplicate writes (double-charge, double-emit, double-record). This is non-negotiable for any system that bills, emits events, or mutates state on behalf of an agent that can itself retry.
- **Consequence in code:** Every `POST` / `PATCH` / `DELETE` in the API layer reads `Idempotency-Key`, dedupes by `(user_id, key)` against a bounded-TTL store, and returns the recorded response on a hit. SDK helpers auto-generate keys for retried calls.
- **Alternatives rejected:**
  - Server-side dedup by content hash — misses semantic duplicates (same intent, different timestamp / nonce / client clock).
  - Client retries without keys — dangerous on any critical path; banned by review.
- **Source:** docs/decisions.md#GLOBAL-005

### GLOBAL-006 — Plans content-addressed by `(schema_hash, query_hash)`

- **Decision:** A query plan's cache key is the pair `(schema_hash, query_hash)`. There is no time-based invalidation, no "cache version," no manual flush. If the inputs match, the plan matches.
- **Core value:** Fast, Simple, Bullet-proof
- **Why:** Cache invalidation is the second-hardest problem in computer science; we side-step it by making every cache key derive entirely from the inputs that determine the output. Combined with `GLOBAL-004`, this guarantees plans are stable under benign schema growth.
- **Consequence in code:** `plan-cache` writes are keyed by `(schema_hash, query_hash)`; reads are exact-match only. Anything that wants to "force a new plan" must change `query_hash` (e.g., a pin or a hint), not invalidate the cache. LLM-generated plans are the only writers; humans pinning a plan write to the same store.
- **Alternatives rejected:**
  - TTL-based caches — wastes the 99% case where the inputs are unchanged, plus introduces flakiness around the boundary.
  - Versioned plans tied to schema versions — would force `GLOBAL-004` to branch.
- **Source:** docs/decisions.md#GLOBAL-006

### GLOBAL-011 — Honest latency — show the live trace; never spinner-lie

- **Decision:** When a request is in flight, surfaces show what is actually happening (cache lookup, plan, allowlist, exec, summarize) with real timings — not a generic spinner. If a step takes long, we say what step.
- **Core value:** Honest latency, Effortless UX
- **Why:** A spinner that hides progress trains users to assume the worst. A live trace shows exactly where time goes and turns perceived latency into legible, cacheable, debuggable information. It also makes us better at performance because we *see* every slow step.
- **Consequence in code:** `apps/web` streams trace events from the ask-pipeline (or polls the OTel-exposed step state) and renders them in order. CLI's TTY mode prints each step as it completes. The SDK exposes an `onTrace` hook for surfaces to consume.
- **Alternatives rejected:**
  - Generic spinner with "this is taking longer than usual" — gives no information.
  - Hide latency below a threshold — users notice anyway, and lose trust when the threshold is wrong.
- **Source:** docs/decisions.md#GLOBAL-011

### GLOBAL-014 — OTel span on every external call (DB, LLM, HTTP, queue)

- **Decision:** Every call that crosses a process boundary — DB query, LLM call, outbound HTTP, queue enqueue/dequeue — is wrapped in an OpenTelemetry span with the canonical attributes from `docs/performance.md` §3 (the span / metric / label catalog).
- **Core value:** Honest latency, Bullet-proof, Fast
- **Why:** Without spans on every external call, we can't answer "why is this request slow," "is the LLM the bottleneck," or "did this retry actually go to the DB twice." The catalog enforces consistent attribute names so dashboards and queries don't fragment.
- **Consequence in code:** `packages/otel` exposes the wrapper helpers; all DB / LLM / HTTP / queue clients in the codebase route through them. New external calls without a span fail review. Span names, attributes, and metrics match the catalog (no ad-hoc names).
- **Alternatives rejected:**
  - Sample only slow requests — loses the baseline distribution.
  - Per-team conventions — fragments the dashboards within a quarter.
- **Source:** docs/decisions.md#GLOBAL-014

### GLOBAL-015 — Power users always have an escape hatch

- **Decision:** Every layer that turns natural language into something executable — `/v1/ask` → SQL, plan-cache → plan, db-adapter → query — exposes the underlying primitive directly. A power user can bypass the LLM and run raw SQL / Mongo / connection-string queries.
- **Core value:** Creative, Bullet-proof, Goal-first
- **Why:** Anyone who outgrows the conversational interface must not hit a wall. The product loses credibility (and users) if "the LLM decided" is the only path to the data. The escape hatch is also the thing that makes the LLM safe — humans can verify and fix.
- **Consequence in code:** `/v1/run` (raw query) sits next to `/v1/ask` (NL query). CLI's `nlq run` runs raw SQL. The plan surfaced from `/v1/ask` is editable and re-runnable. Connection strings are exposed for users on plans that can self-host the DB.
- **Alternatives rejected:**
  - LLM-only API — fine for demos, fatal for production users.
  - Hide raw access behind enterprise tier — blocks the OSS contributor path and contradicts `GLOBAL-019`.
- **Source:** docs/decisions.md#GLOBAL-015

### GLOBAL-017 — Two endpoints, two CLI verbs, one chat box — one way to do each thing

- **Decision:** The HTTP API exposes two primary endpoints (`/v1/ask`, `/v1/run`). The CLI exposes two primary verbs (`nlq ask`, `nlq run`). The web app exposes one chat box. There is exactly one way to perform each conceptual operation; no aliases, no shadow endpoints.
- **Core value:** Simple, Effortless UX
- **Why:** Surface area is the enemy of learnability. If a user can do X "via two endpoints" or "via three commands," they spend energy on which one to pick instead of on their goal. A small canonical surface keeps docs short and behavior consistent.
- **Consequence in code:** New conceptual operations require a decision: extend an existing endpoint/verb, or introduce a third one (which requires explicit justification). No aliases. The CLI may have helpers (`nlq init`, `nlq login`) — but the *operations on data* are the two verbs.
- **Alternatives rejected:**
  - REST resource explosion (`/v1/queries`, `/v1/runs`, `/v1/plans`) — bigger surface, more docs, more inconsistency.
  - Multiple aliased CLI verbs — every alias becomes a new way to misuse the tool.
- **Source:** docs/decisions.md#GLOBAL-017

## Open questions / known unknowns

- **Schema-match scoring (Phase 2+).** `SK-ASK-003` defers LLM-driven multi-DB disambiguation. Need to decide before Phase 2 whether to ship it at all, and if so what the failure mode is when the LLM picks wrong (silent vs. confirmable).
- **Streaming protocol for live trace.** `SK-ASK-008` and `GLOBAL-011` require a live trace, but the wire protocol (SSE? chunked JSON? OTel-over-WS?) is not yet pinned. SDK's `onTrace` hook in `packages/sdk` will fix the surface API; the wire format is open.
- **Failure-mode for partial results.** If `exec` succeeds but `summarize` fails, do we return the rows + a summarize-error envelope, or 5xx the whole call? Design.md doesn't decide. Leaning toward "rows + envelope" so the user sees data, but needs an explicit `SK-ASK-NNN`.
- **Idempotency on `/v1/ask`.** `GLOBAL-005` says every mutation accepts `Idempotency-Key`. `/v1/ask` is sometimes a query (no mutation), sometimes a write. Confirm whether the dedupe store is consulted for the write branch only or for every call (and what `kind=create` deduping looks like).
