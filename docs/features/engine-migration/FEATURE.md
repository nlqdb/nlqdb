---
name: engine-migration
description: Phase 3 reshape loop — intra-engine Pipe creation today; cross-engine PG ↔ ClickHouse / Redis migration deferred.
when-to-load:
  globs:
    - apps/api/src/workload-analyser/**
    - packages/db/src/clickhouse-tinybird/pipe-management.ts
    - packages/db/**
  topics: [engine-migration, workload-analyser, phase-3]
---

# Feature: Engine Migration

**One-liner:** Phase 3 reshape loop — daily workload analyser creates Tinybird Pipes for hot ClickHouse fingerprints and writes advisory audit rows for hot Postgres ones; cross-engine migration still planned.
**Status:** partial — intra-engine reshape live (`SK-MIGRATE-001..006`) + PG index advisory designed (`SK-MIGRATE-007`, not yet built); cross-engine migration (PG ↔ ClickHouse / Redis / Mongo) still planned.
**Owners (code):** `apps/api/src/workload-analyser/**`, `packages/db/src/clickhouse-tinybird/pipe-management.ts`, `apps/api/migrations/0008_workload_analyser_audit.sql`
**Cross-refs:** `multi-engine-adapter/FEATURE.md` `SK-MULTIENG-003` (the rule this feature operationalises) · `events-pipeline/FEATURE.md` `SK-EVENTS-009` (the `query_log` Data Source the analyser reads) · `plan-cache/FEATURE.md` `SK-PLAN-002` (cache key must outlive reshape) · `docs/phase-plan.md §5` (Migration Orchestrator + Workload Analyzer) · `docs/phase-plan.md §5` (Phase 3 exit criteria — auto-migration is the gate) · `docs/performance.md §3.1` (`nlqdb.workload_analyser.*` spans)

## Touchpoints — read this feature before editing

- `apps/api/src/workload-analyser/**` (cron, analyser, policy, wiring)
- `packages/db/src/clickhouse-tinybird/pipe-management.ts` (Tinybird Pipes management API owner per `GLOBAL-021`)
- `apps/api/wrangler.toml` `[triggers] crons` block
- `apps/api/src/index.ts` `scheduled()` handler
- `apps/api/migrations/0008_workload_analyser_audit.sql`

## Decisions

### SK-MIGRATE-001 — Daily 04:00 UTC cron; all tiers in scope (no per-tier gating in v1)

- **Decision:** The workload analyser runs once per day at 04:00 UTC via a Cloudflare Workers Cron trigger on `apps/api`. Every ClickHouse-backed and Postgres-backed user DB is in scope regardless of tier (Free, Hobby, Pro).
- **Core value:** Simple, Bullet-proof, Honest latency
- **Why:** One schedule means one set of dashboards, one set of OTel spans, one operator runbook. 04:00 UTC sits in the cross-region quiet window between US and EU traffic peaks. Tier-gating the analyser would force two code paths (with/without analyser) and two performance stories — premature optimisation given Tinybird Free's write budget already absorbs the reshape volume Phase 1 will produce.
- **Consequence in code:** `apps/api/wrangler.toml` declares exactly one `[triggers] crons = ["0 4 * * *"]`. The `scheduled()` handler in `apps/api/src/index.ts` dispatches to `runWorkloadAnalyser(env)` and `ctx.waitUntil`s the result. Tier checks (`databases.tier`, `users.tier`) do not appear in `apps/api/src/workload-analyser/**`. Reviewers reject any tier gate added inside the analyser hot path — adding one is a new SK-MIGRATE supersession block.
- **Alternatives rejected:**
  - Hourly cadence — burns Tinybird Free's 1k reads/day budget chasing high-frequency churn that the sustained-window in `SK-MIGRATE-002` already filters out.
  - Free-tier opt-out — Free is where the architecture-is-hidden thesis pays off; gating analysis there leaves the headline feature half-implemented.
  - On-demand reshape (run when a query is hot) — couples request latency to the cron path; defeats `Honest latency`.

### SK-MIGRATE-002 — Promotion thresholds: ≥25 calls AND p99 ≥500ms AND ≥1 distinct UTC-day across a 7-day window

- **Decision:** A `(db_id, schema_hash, query_hash)` fingerprint is promoted to a reshape proposal only when **all three** thresholds are met across the trailing 7 days of `query_log` rows: call count ≥25, p99 `orchestrator_ms` ≥500, distinct UTC-day count ≥1. Thresholds are pinned constants in `apps/api/src/workload-analyser/policy.ts`. The "distinct users ≥1" recommendation is operationalised as distinct UTC-day count because `query_log` carries `db_id` + `ts` but no `user_id` (the W4 contract is anonymised by design — see `events-pipeline/FEATURE.md` `SK-EVENTS-009`); within a single `db_id` the row stream is one tenant by construction, so day-spread is the closest available proxy for "this is a real workload, not a single self-loop".
- **Core value:** Bullet-proof, Honest latency, Free
- **Why:** A 7-day window survives one-shot batch jobs and aligns with the `query_log` Data Source's daily partitioning (90-day TTL). ≥25 calls is above the long-tail noise floor where chance fluctuations dominate. The p99 floor (≥500ms) targets queries where a Pipe materialisation actually changes user-perceived latency — sub-500ms tails don't pay back the cron's complexity. Distinct-day ≥1 catches empty-window edge cases and reserves room to bump the threshold to ≥2 in a future SK-MIGRATE supersession (which would filter single-day batch loads). The conjunctive (`AND`) combiner beats `OR`: any single signal can fire on a backfill / load-test / forgotten dashboard, but all three together is a real workload pattern.
- **Consequence in code:** `policy.ts` exports the four named constants (`WINDOW_DAYS=7`, `MIN_CALLS=25`, `MIN_P99_MS=500`, `MIN_DISTINCT_DAYS=1`). `analyseQueryLog(rows, policy)` is a pure function — no `Date.now()`, no environment access, no I/O — so unit tests pin behaviour against fixed-frame fixtures. Changing a threshold = a code edit + a new SK-MIGRATE supersession block; reviewers reject env-var knobs.
- **Alternatives rejected:**
  - OR'd combiner (any of the three) — hot-cold conflation; one-shot loads trip it.
  - Higher call floor (e.g. ≥100/day) — locks out Phase-1 traffic shapes where 25 calls/week is "real".
  - p50 latency floor — dashboards live or die on the tail; p99 is the right discriminator.
  - Env-var thresholds — a knob that's easy to nudge silently is the wrong shape for a feature whose correctness rides on staying inside `GLOBAL-004`.

### SK-MIGRATE-003 — Reshape kinds in v1: `clickhouse_pipe_create` (acts) + `pg_add_column_suggestion` (advisory)

- **Decision:** Two reshape kinds ship in v1. `clickhouse_pipe_create` mutates Tinybird — a Pipe is created against the `(schema_hash, query_hash)` fingerprint via the management API. `pg_add_column_suggestion` is advisory only — an audit row is written with the fingerprint plus stats; no Postgres DDL runs.
- **Core value:** Bullet-proof, Simple
- **Why:** ClickHouse via Tinybird supports a non-destructive create-Pipe operation that doesn't touch live data — the upside is bounded, the downside is "an unused Pipe sits in the workspace". Postgres' equivalents (ALTER TABLE ADD COLUMN, materialised view, index) all touch the live table; auto-issuing them on a cron without a human review is the wrong shape for a Phase 3 v1. The audit row is enough to surface the suggestion to operators while we learn what the analyser actually proposes on real workloads. PG-side automation lands in a later SK-MIGRATE once the proposal generator has ground truth to be evaluated against.
- **Consequence in code:** The cron's switch on `proposal.kind` has exactly two arms — no registry, no plugin shape (per P5). Adding a third kind = a new arm and a new SK-MIGRATE supersession. The audit row's `after_json` is non-null for `clickhouse_pipe_create` (carries the Pipe name) and null for `pg_add_column_suggestion`. Reviewers reject any path that issues PG DDL from the cron in v1.
- **Alternatives rejected:**
  - Auto-DDL on Postgres — risks ALTER TABLE under load on a Phase-1 shared Neon branch (`SK-DB-007`); operator review gate is the right cost in v1.
  - Postgres-side as a separate feature — the analyser already touches Postgres-backed DBs to read `query_log` fingerprints; threading the advisory output through the same audit table costs one extra D1 row per hot fingerprint and zero new infra.
  - Single ClickHouse-only kind — drops the only PG-side visibility surface and silently loses information about hot PG queries.

### SK-MIGRATE-004 — `schema_hash` is invariant across reshape; tests assert before/after byte-equality

- **Decision:** Pipe creation MUST NOT change the logical schema or bump `schema_hash`. The cron records the DB's `schema_hash` before each reshape and asserts equality after the reshape lands. Any divergence aborts the reshape and surfaces in the audit row's `reasoning`.
- **Core value:** Bullet-proof, Fast
- **Why:** This is the operationalisation of `GLOBAL-004` and `SK-MULTIENG-003` for the analyser. Bumping `schema_hash` on physical reshape would invalidate every cached plan whose key contains it (`GLOBAL-006`) — every analyser tick would force the LLM to replan every cached query. The whole reason the analyser is permitted to mutate physical layout is that it doesn't touch the logical surface; if a future Pipe SQL ever references a wider field set than the existing logical schema, the reshape is wrong and aborts.
- **Consequence in code:** `apps/api/src/workload-analyser/cron.ts` re-reads the DB's `schema_hash` from D1 after every successful Pipe creation. A mismatch records `reasoning="schema_hash_drift_aborted"` and rolls back the Pipe (best-effort `dropPipe`). Tests in `apps/api/test/workload-analyser/` assert byte-equality of `schema_hash` across the reshape — a failed assertion is a reviewer-blocker, not a flake.
- **Alternatives rejected:**
  - Bump `schema_hash` and call the reshape "logical too" — destroys the plan-cache, defeats the analyser thesis.
  - Skip the equality check (trust the Pipe creation) — would let a silent semantic drift through; the assertion is cheap and catches bugs in the Pipe SQL builder.
  - Per-engine `schema_hash` rules — fragments `GLOBAL-004`, harder to audit.

### SK-MIGRATE-005 — Audit row per reshape; `/v1/ask` surfaces a one-line `pipe_advisory` when within 24h

- **Decision:** Every reshape (kind ∈ {`clickhouse_pipe_create`, `pg_add_column_suggestion`}) writes one row to D1's `workload_analyser_runs` table with full before/after snapshots and a one-sentence `reasoning`. When `/v1/ask` resolves a `(db_id, query_hash)` for which an audit row was written within the last 24h, the response carries a `pipe_advisory` field — surfaces render it as one line in the trace ("pipe: <name> (created Nh ago)").
- **Core value:** Honest latency, Effortless UX
- **Why:** The audit table is the operational source of truth (operators query it directly). The `/v1/ask` field is a forward-compat hook so the user-visible signal lands the day read-path routing through Pipes does; if we waited to wire the trace until routing existed, every later worksheet would have to revisit `/v1/ask`. **Caveat:** in v1 Pipe creation does not change the read path — the trace line advertises a Pipe that was created but isn't yet on the hot path. That's a deliberate forward-compat trade: the line is honest about creation time, and the routing-through-Pipe step is an explicit later SK-MIGRATE.
- **Consequence in code:** `OrchestrateDeps.lookupPipeAdvisory?(dbId, queryHash) → Promise<PipeAdvisory | null>` — orchestrate calls it once after `queryHash` lands and folds the result onto `AskResult.pipe_advisory` when non-null. SSE mode emits a `pipe_advisory` event before `plan_pending`. Tests stub the dep; production wires it to a D1 query against `workload_analyser_runs` with a 24h window. The single extra D1 read per `/v1/ask` is counted in `docs/performance.md §2.1` headroom (D1 warm read p99 ≈ 30ms).
- **Alternatives rejected:**
  - Defer the trace until routing lands — every later PR has to relitigate the orchestrator surface; one small forward-compat field is cheaper.
  - Surface via OTel only (no user-visible field) — operators see it, users don't; the architecture-is-hidden thesis is about the user signal.
  - Trace toggle (opt-in via header / query param) — the field is small and absent-when-no-row, no toggle needed.

### SK-MIGRATE-006 — Best-effort with per-day idempotency; failures log + roll back the partial Pipe; next cron retries

- **Decision:** Pipe-create failures roll back any partial Tinybird state (best-effort `dropPipe`), record the failure on the audit row's `reasoning`, increment the failures OTel counter, and the analyser moves on to the next proposal. Idempotency is enforced at the audit-row level: a UNIQUE INDEX on `(db_id, query_hash, run_date)` guarantees a re-run within the same UTC day is a no-op. Tomorrow's cron retries any failed proposal.
- **Core value:** Bullet-proof, Honest latency, Simple
- **Why:** Tinybird's Pipe API is mostly idempotent on the create path (a duplicate POST returns the existing Pipe), but partial failures (network mid-create, 5xx after the server-side commit) leave ambiguous state. Best-effort rollback narrows the window where a half-created Pipe sits in the workspace. Per-day idempotency on the audit row prevents the analyser from spamming the table on repeated proposals for the same fingerprint within a single day; cross-day retries are the recovery path. Continuing past a single failure (rather than aborting the whole cron) prevents one wedged DB from blocking analyses for every other DB.
- **Consequence in code:** Each proposal runs inside `try { create } catch { dropPipe-best-effort; auditRow(reasoning=err.code); failuresCounter++ }`. The cron's outer loop swallows per-DB and per-proposal errors. Migration `0008_workload_analyser_audit.sql` adds `CREATE UNIQUE INDEX idx_workload_runs_unique ON workload_analyser_runs (db_id, query_hash, run_date)`. `INSERT … ON CONFLICT DO NOTHING` is the audit-write shape — no UPSERT (same-day re-run is a no-op, not a refresh).
- **Alternatives rejected:**
  - Abort the whole cron on first failure — one bad DB poisons the rest.
  - Retry inside the cron — ties up the cron's wall-clock and produces the same wedged state if the upstream is genuinely down. Tomorrow is always a better retry boundary.
  - Cross-day idempotency — would suppress recovery from a transient day-1 failure; per-day is the right grain.

### SK-MIGRATE-007 — `pg_index_suggestion` advisory reshape kind; candidates captured at plan time, promoted by the daily cron

- **Decision:** A third reshape kind, `pg_index_suggestion`, ships advisory-only. Index *candidates* are extracted at plan time in the `/v1/ask` pipeline — where the full planned SQL is in hand — as an anonymisation-safe access descriptor `{table, equalityCols[], rangeCols[], orderByCols[]}` derived from the plan's WHERE / JOIN / ORDER BY clauses (column identifiers only, never values). Candidates are written to a D1 `index_candidates` table keyed by `(db_id, schema_hash, index_signature)`. The daily cron promotes a candidate to a `pg_index_suggestion` audit row only when its backing `(db_id, schema_hash, query_hash)` fingerprint clears the **same** `SK-MIGRATE-002` thresholds. The audit row's `after_json` carries the proposed `CREATE INDEX CONCURRENTLY …` DDL text. nlqdb never executes the DDL.
- **Core value:** Bullet-proof, Honest latency, Effortless UX
- **Why:** An index suggestion needs column-level predicate data; `query_log` carries only hashes under `events-pipeline` `SK-EVENTS-009`, so the cron alone cannot derive one. Capturing the access descriptor at plan time reads SQL already in memory — zero new exposure of the `query_log` contract, and the identifiers are the user's own schema on their own `db_id` (no values, no cross-tenant data). Promoting through the existing thresholds surfaces only genuinely hot patterns, reusing the one tuned policy. Advisory-only matches `SK-MIGRATE-003`: issuing PG DDL under load on a shared Neon branch (`SK-DB-007`) is the wrong shape for a cron; an operator (later, the user) reviews it. The suggestion names `CONCURRENTLY` — the only lock-safe way to build an index on a live table.
- **Consequence in code:** The plan emit point in `apps/api/src/ask/**` extracts the access descriptor and writes an `index_candidates` row (idempotent on `index_signature`). `apps/api/migrations/0009_index_candidates.sql` adds the table. `analyse.ts` gains a `pg_index_suggestion` variant of `ReshapeProposal` and joins promoted fingerprints to their candidates; `cron.ts`'s `dispatchReshape` switch gains a third arm `dispatchPgIndexSuggestion` that writes the audit row only (no Tinybird call). `/v1/ask`'s advisory hook (`SK-MIGRATE-005`) generalises `pipe_advisory` to also surface `index_advisory` within the 24h window. Reviewers reject any path that issues `CREATE INDEX` from the cron — the kind is advisory by definition; auto-apply is a future SK-MIGRATE.
- **Alternatives rejected:**
  - Widen `query_log` with a structured access-pattern column (Approach A) — modifies the most sensitive contract in the system (`SK-EVENTS-009`) to move work into the cron that the ask pipeline can already do for free with the real SQL in hand.
  - Derive columns from `plan_shape` — a SHA-256; opaque by design, no column data.
  - Auto-apply from the cron — even a concurrent build consumes IO and a brief lock on a shared Neon branch; advisory-first until there is ground truth, mirroring `SK-MIGRATE-003`.
  - A separate `index-advisor` feature — the analyser already owns hot-fingerprint detection, thresholds, the audit table, and the `/v1/ask` advisory surface; a third kind is one switch arm, not new infra (P5).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-004** — Logical schemas widen; physical layout reshapes freely.
  - *In this feature:* `SK-MIGRATE-004` is the assertion that the cron honours the rule on every Pipe creation — `schema_hash` is re-read after the reshape and equality is asserted. Drift aborts the reshape.
- **GLOBAL-006** — Plans content-addressed by `(schema_hash, query_hash)`.
  - *In this feature:* Pipe creation MUST NOT bump `schema_hash`; the analyser is the only writer of physical reshape under the cache-key invariant.
- **GLOBAL-013** — $0/month free tier; ≤ 3 MiB Workers bundle.
  - *In this feature:* one Tinybird read per DB-day on the free tier (≤ 1k reads/day budget); pipe-management adds zero new dependencies (plain `fetch` + the existing OTel wrapper).
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* every Tinybird Pipes-management call emits a `db.query` span (`db.system=other_sql`, `db.operation.name ∈ {PIPE_CREATE, PIPE_DROP, PIPE_GET}`); the cron emits `nlqdb.workload_analyser.run` (parent) and `nlqdb.workload_analyser.reshape` (per proposal).
- **GLOBAL-021** — Each external system has one canonical owning module.
  - *In this feature:* all Tinybird HTTP — read of `query_log` and Pipes management — flows through `packages/db/src/clickhouse-tinybird/`. The analyser imports typed methods (`createPipe` / `dropPipe` / `getPipe` / the existing `createTinybirdAdapter`); no `fetch(...tinybird...)` call sits in `apps/api/src/workload-analyser/`.

## Open questions / known unknowns

Open after `SK-MIGRATE-001..007` — intra-engine (Pipe read-path routing, Pipe deletion lifecycle, `SK-MIGRATE-007` index-advisory follow-ups: auto-apply / existing-index de-dup / cost-benefit annotation) and cross-engine (migration mechanics, cross-engine schema & index translation, verification, UX, cross-phase). Full list in [`open-questions.md`](./open-questions.md); each becomes a follow-up SK-MIGRATE block when answered.

## Phase-3 cross-engine entry checklist

`SK-MIGRATE-001..006` cover intra-engine reshape v1; `SK-MIGRATE-007` adds the PG index advisory (design landed, build pending). Cross-engine migration is gated on `docs/phase-plan.md §5` (held-out benchmark + dual-read + Phase 2 exit metrics) and on `SK-MULTIENG-NNN` for the target engine.

## Source pointers

- `docs/phase-plan.md §5` and §7 — Migration Orchestrator design, engine-selection heuristics, Phase-2 exit criteria, Phase-3 slice list, risks
- `infrastructure/tinybird/datasources/query_log.datasource` — read schema the analyser consumes
