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

### SK-ASK-002 — Canonical step order: edge → auth → rate-limit → hash → plan-cache → (hit: validate → exec) | (miss: classify → plan → SQL-validate → exec → cache-write) → optional summarize

- **Decision:** Every `/v1/ask` request follows the canonical step order in `docs/performance.md §2.1, §2.2`. New steps require a `SK-ASK-NNN` decision; reordering existing steps requires updating the canonical tables in `performance.md` in the same PR.
- **Core value:** Bullet-proof, Honest latency, Fast
- **Why:** A canonical order means every reviewer, every dashboard, every test agrees on what "the ask path" is. Inserting an unsanctioned step (e.g., a third LLM call between plan and exec) is the kind of change that silently breaks the latency budget and the trace UI. The order is also load-bearing for `GLOBAL-011`: surfaces stream the trace in the order steps complete.
- **Consequence in code:** `orchestrateAsk()` (per `docs/architecture.md §10` Slice 6) walks the steps in order. Each step gets one OTel span (per `docs/performance.md §3.1`). A reorder regression is caught by the span-tree assertion in the slice's vitest. Latency budgets in `performance.md §2.1, §2.2` are CI-asserted at 1.5× p50.
- **Alternatives rejected:** Per-handler order — would let the order drift between create / query / write without notice. Skip cache when LLM is fast — defeats `GLOBAL-006` and breaks the cache-warming intent.
- **Source:** docs/architecture.md §3.6.1, §3.6.2 · docs/performance.md §2.1, §2.2 · docs/architecture.md §10 Slice 6

### SK-ASK-003 — `dbId` resolution is deterministic per surface — never an LLM-driven "did you mean…?"

- **Decision:** When `dbId` is omitted, resolution follows `docs/architecture.md §3.6.4`: HTML embeds resolve from `pk_live_<dbId>`; REST returns `409 Conflict` with `candidate_dbs` if the account has 2+ DBs; CLI uses MRU + interactive `select`; MCP uses elicitation. The system **never** runs an LLM-based "which DB did you mean" heuristic.
- **Core value:** Bullet-proof, Honest latency, Effortless UX
- **Why:** A guess that hits the wrong DB writes (or reads sensitive data from) the wrong tenant — silent corruption is the worst possible failure mode. Deterministic per-surface resolution turns "ambiguous" into a structured error the surface can render usefully (`409` for REST, prompt for CLI, elicitation for MCP).
- **Consequence in code:** `resolveDbId(req)` returns `{db}` or `{candidates: [...]}`; ambiguity is never resolved by an LLM call. The HTTP handler returns 409 with the `candidate_dbs` envelope; the CLI prompts; MCP returns an elicitation. Schema-match scoring (LLM heuristic disambiguation) is **deferred to Phase 2+**.
- **Alternatives rejected:** Auto-pick the most-recently-used DB on REST — silent wrong-tenant write. LLM "did you mean…" — failure mode is silent and unexplainable.
- **Source:** docs/architecture.md §3.6.4

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
- **Source:** docs/architecture.md §3.6.8 · docs/decisions.md#GLOBAL-007

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
- **Source:** docs/architecture.md §0 (Honest latency) · docs/decisions.md#GLOBAL-011

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

Canonical text in [`docs/decisions.md`](../../decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
- **GLOBAL-006** — Plans content-addressed by `(schema_hash, query_hash)`.
- **GLOBAL-011** — Honest latency — show the live trace; never spinner-lie.
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
- **GLOBAL-015** — Power users always have an escape hatch.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.

## Open questions / known unknowns

- **Schema-match scoring (Phase 2+).** `SK-ASK-003` defers LLM-driven multi-DB disambiguation. Need to decide before Phase 2 whether to ship it at all, and if so what the failure mode is when the LLM picks wrong (silent vs. confirmable).
- **Streaming protocol for live trace.** `SK-ASK-008` and `GLOBAL-011` require a live trace, but the wire protocol (SSE? chunked JSON? OTel-over-WS?) is not yet pinned. SDK's `onTrace` hook in `packages/sdk` will fix the surface API; the wire format is open.
- **Failure-mode for partial results.** If `exec` succeeds but `summarize` fails, do we return the rows + a summarize-error envelope, or 5xx the whole call? Design.md doesn't decide. Leaning toward "rows + envelope" so the user sees data, but needs an explicit `SK-ASK-NNN`.
- **Idempotency on `/v1/ask`.** `GLOBAL-005` says every mutation accepts `Idempotency-Key`. `/v1/ask` is sometimes a query (no mutation), sometimes a write. Confirm whether the dedupe store is consulted for the write branch only or for every call (and what `kind=create` deduping looks like).

## Happy path walkthrough

### §14.6 HTTP API (when none of the surfaces fit)

**Default (one endpoint; reads need no idempotency header):**

```bash
curl https://api.nlqdb.com/v1/ask \
  -H "Authorization: Bearer sk_live_..." \
  -d '{"goal": "an orders tracker", "ask": "how many orders today"}'

→ 200 {
  "answer": "12 today",
  "data": [{"count": 12}],
  "session": { "db": "orders-tracker-a4f", "key": "pk_live_..." },
  "trace": { "engine": "postgres", "sql": "...", "ms": 41 }
}
```

The `session.db` and `session.key` come back so the caller *can* go DB-explicit on subsequent calls. They don't have to.

**Writes** (anything that mutates state) require `Idempotency-Key`:

```bash
curl https://api.nlqdb.com/v1/ask \
  -H "Authorization: Bearer sk_live_..." \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"ask": "add an order: alice, latte, 5.50"}'
```

The API **auto-classifies** the call; reads without a key succeed, writes without a key return `400 idempotency_required` with a curl snippet in the body showing the exact missing header. The user is never left guessing.

**Anonymous mode from curl** (no key, no sign-in):

```bash
curl https://api.nlqdb.com/v1/ask \
  -d '{"goal": "an orders tracker", "ask": "how many orders today"}'
→ 200 { …, "session": { "anonymous_token": "anon_…" } }
```

Subsequent calls pass `Authorization: Bearer anon_…` to reuse the session. 72h window same as the web.

### §15.3 Persona walkthrough — Priya, the Data-Curious PM

**Goal:** answer the conference-leads question for the 4pm exec sync.

| Time | Priya does | nlqdb does |
|---|---|---|
| 2:15pm | Drags the vendor's CSV onto `nlqdb.com`. Types *"how many of these are already in our users table"* | Uploads CSV as `conference-leads-q2`, joins against the read-only mirror of prod (already permissioned), returns the count and a preview |
| 2:18pm | *"…and which plan are they on"* | Adds the join, returns table |
| 2:20pm | *"break it down by acquisition channel"* | Adds the group-by, returns chart-ready data |
| 2:22pm | Clicks "Share result" on the answer | Generates a permalinkable, redacted-by-default link to drop in Slack |
| 4:00pm | Walks into the meeting with the answer | — |

**What Priya never did:** opened a data-request ticket, pinged an engineer, opened Excel, learned SQL, installed a BI tool, got prod credentials.

**Time saved on this one task:** ~1.5 days of waiting on engineering, plus ~30 minutes of Excel work.
