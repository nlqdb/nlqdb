---
name: hosted-db-create
description: Hosted db.create — typed-plan SchemaPlan, deterministic DDL compiler, Zod + libpg_query validation, provisioner, semantic layer at create-time.
when-to-load:
  globs:
    - apps/api/src/db-create/**
    - apps/api/src/ask/route-ask.ts
    - apps/api/src/ask/sql-validate-ddl.ts
    - packages/llm/src/prompts/schema-inference.ts
  topics: [db.create, typed-plan, schema-inference, schema-plan, provisioner, semantic-layer, ddl, classifier, dbid-resolution]
---

# Feature: Hosted db.create

**One-liner:** Goal-string in, working multi-table Postgres database out — typed-plan pipeline, deterministic DDL compiler, semantic layer auto-generated at create-time.
**Status:** partial (pipeline implemented; `embedTableCards` is a no-op stub pending pgvector slice)
**Owners (code):**
- `apps/api/src/db-create/**` (orchestrator, infer-schema, compile-ddl, neon-provision)
- `apps/api/src/ask/route-ask.ts` (merged kind + dbId classifier on the `/v1/ask` entry — SK-ASK-009)
- `apps/api/src/ask/sql-validate-ddl.ts` (DDL-path validator, separate from the read/write allowlist)
- `packages/llm/src/prompts/schema-inference.ts` (typed-plan prompt)

**Cross-refs:** docs/architecture.md §3.6.1–§3.6.8 (canonical) · docs/phase-plan.md §2 (Phase 1 slice — sub-modules, anonymous-db lifecycle, exit gate) · docs/research-receipts.md §1 (Replit incident → layered guardrails), §2 (Cortex Analyst + SchemaAgent → typed plans), §7 (per-surface dbId resolution, with confidence-gated LLM pick + visible echo on REST + chat — SK-HDC-005), §8 (semantic-layer-at-create moat) · GLOBAL-005, GLOBAL-014, GLOBAL-017, GLOBAL-020 (see governing-GLOBALs section below)

**Sibling features to read alongside:**
- `docs/features/ask-pipeline/FEATURE.md` — the classifier branches off the existing `/v1/ask` orchestrator; this feature owns the `kind=create` arm
- `docs/features/db-adapter/FEATURE.md` — the provisioner uses the adapter; SK-DB-007 (schema-per-DB tenancy) and SK-DB-008 (ALTER TABLE ADD COLUMN NULL) constrain what we emit
- `docs/features/llm-router/FEATURE.md` — the classifier and schema-inference are LLM calls; provider routing + cost accounting belongs there
- `docs/features/sql-allowlist/FEATURE.md` — owns the read/write validator; SK-HDC-006 here owns the DDL-path validator that sits next to it

## Touchpoints — read this feature before editing

- `apps/api/src/db-create/**` (canonical implementation: orchestrator + sub-modules)
- `apps/api/src/ask/route-ask.ts` (merged cheap-tier classifier; routes `kind=create` here — SK-ASK-009)
- `apps/api/src/ask/sql-validate-ddl.ts` (DDL validator path; split from read/write allowlist)
- `apps/api/src/ask/orchestrate.ts` (the consumer that delegates `kind=create` to this feature)
- `packages/llm/src/prompts/schema-inference.ts` (the typed-plan prompt)
- `packages/db/src/types.ts` (`SchemaPlan` lives near the adapter types)

## Decisions

### SK-HDC-001 — One classifier-routed endpoint: `/v1/ask` does create, query, and write

- **Decision:** There is no `/v1/db/new`. `POST /v1/ask` accepts a `goal`, a cheap classifier-tier LLM call decides `kind ∈ {"create" | "query" | "write"}`, and `kind=create` routes to the typed-plan pipeline owned by this feature. `kind=query` and `kind=write` continue to use the existing read/write orchestrator.
- **Core value:** Simple, Goal-first
- **Why:** `GLOBAL-017` says one way to do each thing. No persona ever woke up wanting to "create a database" (`docs/runbook.md §10`); they want a meal-planner, an agent that remembers, a number for the 4pm sync. A separate "create" endpoint forces every surface to add a "are you starting fresh?" branch — exactly the DB-first framing `docs/architecture.md §0.1` rejects. Folding create into `/v1/ask` lets `<nlq-data>` work with no `db=` attribute, lets MCP work with no setup tool, and keeps the SDK / CLI / MCP surface symmetric.
- **Consequence in code:** The `/v1/ask` handler runs the classifier first; `kind=create` calls `db-create/orchestrate.ts`, `kind=query`/`kind=write` call the existing `ask/orchestrate.ts`. New endpoints for create are rejected at review. Surfaces (`<nlq-data>`, CLI, MCP, SDK) never branch on "create vs query" — they pass the goal and the API decides. Post-create, the orchestrator pushes `plan.tables[].name` to the principal's recent-tables MRU per `SK-ASK-012`. Surfaces render `displayName(dbId)` for human-readable names; `slug` stays for URL/technical contexts.
- **Alternatives rejected:**
  - `/v1/db/new` separate endpoint — forces every surface to add a "is this a new db?" branch; contradicts `GLOBAL-017` and the goal-first framing in `docs/architecture.md §0.1`.
  - Heuristic in the surface ("if no `db=`, call create") — pushes routing logic to N surfaces; drifts; the LLM classifier stays in one place.

### SK-HDC-002 — LLM emits a typed `SchemaPlan`; our deterministic compiler emits SQL

- **Decision:** The schema-inference LLM call returns a typed JSON object (`SchemaPlan { tables[], columns[], foreign_keys[], metrics[], dimensions[], sample_rows[] }`) with structured-output enforced. The LLM **never emits raw DDL**. A deterministic compiler (our code, not the LLM) emits `CREATE TABLE` / `CREATE INDEX` / FK constraint statements from the validated plan.
- **Core value:** Bullet-proof, Simple
- **Why:** This collapses the prompt-injection surface from "what SQL string can the LLM compose" to "what shape can the LLM force into a plan" — much smaller, much easier to enumerate. It matches the [Cortex Analyst](https://www.snowflake.com/en/engineering-blog/cortex-analyst-text-to-sql-accuracy-bi/) and [SchemaAgent](https://arxiv.org/html/2503.23886) lessons in `docs/research-receipts.md §2`. It is also a hard precondition for the layered-guardrails posture (`docs/research-receipts.md §1`, the Replit-incident lesson): no LLM-authored DDL ever reaches the executor.
- **Consequence in code:** `apps/api/src/db-create/infer-schema.ts` returns a `SchemaPlan` validated by Zod (`packages/db/src/types.ts`). `apps/api/src/db-create/compile-ddl.ts` is the only file that emits DDL strings; PRs that add LLM-authored SQL anywhere on the create path fail review. New `SchemaPlan` fields require a Zod schema update first — the compiler refuses to consume fields the validator doesn't know about.
- **Alternatives rejected:**
  - LLM emits SQL directly — every prompt-injection vector becomes "compose SQL." Replit's incident is the named example; we don't replicate it.
  - LLM emits an intermediate SQL-like DSL — same surface area as SQL, just less testable. Typed JSON has a finite, validated grammar.

### SK-HDC-003 — Defense in depth: Zod over the plan + libpg_query parse over the compiled DDL

- **Decision:** Every create runs **two** validators in series: (1) Zod over the `SchemaPlan` rejects identifier collisions, reserved-word use, cross-tenant FK refs, and per-tenant table-count caps; (2) libpg_query parses the compiler's output and rejects anything containing `DROP / TRUNCATE / GRANT / REVOKE / pg_catalog / information_schema` — even though our compiler authored the SQL.
- **Core value:** Bullet-proof
- **Why:** Layered guardrails is the explicit lesson from `docs/research-receipts.md §1` (the Replit incident): AST-level reject-list, role isolation, RLS, statement timeout, transactional wrapper. None of these alone suffices. The Zod layer catches plan-shape errors (LLM hallucination); libpg_query catches compiler regressions (our bugs). Skipping either gives us one bug away from a bad statement reaching the executor.
- **Consequence in code:** `apps/api/src/db-create/orchestrate.ts` calls Zod-validate before compile, and libpg_query parse-validate after compile, before the provisioner sees the SQL. Both layers are exhaustively tested. PRs that bypass either layer fail review. The libpg_query parse catches `EXPLAIN ANALYZE` (executes), multi-statement strings, and DDL-verb leaks the same way the read/write allowlist does (`SK-SQLAL-*`) — same primitives, separate validator instance because the allowed-verb set is different (`SK-HDC-006`).
- **Alternatives rejected:**
  - Trust the typed plan — works until the compiler regresses; the parse layer is cheap (libpg_query is fast).
  - Trust the parser only — Zod catches plan-shape problems libpg_query can't (cross-tenant FK refs, reserved words) because they parse fine but are semantically wrong.

### SK-HDC-004 — Semantic layer (`metrics` + `dimensions`) is generated at create-time, in the same plan

- **Decision:** The `SchemaPlan` carries `metrics` (named aggregations: `monthly_revenue := SUM(amount) WHERE status='paid' GROUP BY month`) and `dimensions` (named filterable attributes: `customer_segment := CASE WHEN ltv > 5000 THEN 'enterprise' ELSE 'smb' END`). The schema-inference call generates them in the same pass that designs the tables, and the provisioner persists them alongside the schema. They are not optional and not deferred to a later "semantic config" step.
- **Core value:** Creative, Goal-first
- **Why:** No other shipped NL-Q product auto-creates the database — but every shipped enterprise NL-Q product (Cortex Semantic View, Power BI Q&A model, ThoughtSpot Worksheet, Tableau Pulse Metrics, dbt MetricFlow, Cube) depends on a curated semantic layer to give accurate answers. Because we own the schema-creation moment, we generate the semantic layer for free — the runtime gets the dbt/Cube/Cortex pattern without the user ever writing one. Deferring it means competing with the same teams on the same ground (`docs/research-receipts.md §8`).
- **Consequence in code:** The `SchemaPlan` Zod schema includes `metrics` and `dimensions` as required arrays (empty allowed; absent rejected). Phase 2's user-editable `semantic.yml` (see [§ Semantic layer — Phase 2 design](#semantic-layer--phase-2-design) below) reads from this baseline — the auto-generated version is the seed, not a placeholder. The `/v1/ask` planner consumes `metrics`/`dimensions` for query routing; PRs that ignore them fail review.
- **Alternatives rejected:**
  - Generate schema first, semantic layer later — splits the moment we have the goal in hand; second LLM call costs more and may disagree with the first.
  - Skip semantic generation, rely on the planner to infer at query time — every query repeats the same inference; latency and cost both go up; accuracy is worse without the named-metric grounding.

### SK-HDC-005 — `dbId` resolution: deterministic fast-path then cheap-tier LLM, with confidence floor + visible echo

**Status:** superseded by SK-ASK-009 (`ask-pipeline/FEATURE.md`). Body: [`decisions/SK-HDC-005-dbid-resolution-superseded.md`](decisions/SK-HDC-005-dbid-resolution-superseded.md).

### SK-HDC-006 — Two validator paths: read/write (allowlist) vs DDL (allowlist + libpg_query parse)

- **Decision:** Two distinct SQL validators, exhaustively tested, non-overlapping. The **read/write** path (`apps/api/src/ask/sql-validate.ts`, `sql-allowlist` feature) allows `SELECT / INSERT / UPDATE / DELETE / WITH / EXPLAIN / SHOW`, rejects `CREATE / ALTER / DROP / TRUNCATE / GRANT / REVOKE / VACUUM` + `EXPLAIN ANALYZE`. The **DDL** path (`apps/api/src/ask/sql-validate-ddl.ts`, this feature) allows the compiler's `CREATE TABLE / CREATE INDEX / FK constraints`, rejects the same destructive verbs (`DROP / TRUNCATE / GRANT / REVOKE / pg_catalog / information_schema`).
- **Core value:** Bullet-proof, Simple
- **Why:** The LLM never has DDL rights through `/v1/ask`'s read/write path. The only legitimate `CREATE` comes from this feature's typed-plan compiler — which is our code, not the LLM. Two validators (instead of one with conditional verb sets) make each one trivially auditable: every line of the read/write validator says "no DDL"; every line of the DDL validator says "compiler-shaped DDL only." A reviewer asking "could the LLM ever execute `DROP`?" reads one short file and is done.
- **Consequence in code:** The two validator files share the libpg_query primitives but ship as separate exports. PRs that try to "merge them for DRY" are rejected — duplication is the point. Both validators are called from the orchestrators (read/write from `ask/orchestrate.ts`, DDL from `db-create/orchestrate.ts`); neither orchestrator ever calls the other's validator. Cross-link enforced in `sql-allowlist/FEATURE.md` SK-SQLAL-*.
- **Alternatives rejected:**
  - One validator with verb-set parameter — the conditional becomes the audit risk; "trust me, in DDL mode it allows CREATE" is exactly the kind of branch we're trying to remove.
  - Drop the DDL validator (compiler is trusted) — defeats `SK-HDC-003`'s defense-in-depth lesson. Compiler bugs happen.

### SK-HDC-007 — Provisioner abstraction split now: `provisionDb(plan)` vs `registerByoDb(connection_url, plan)`

- **Decision:** The Phase 1 provisioner is split into two functions from day one: `provisionDb(plan)` creates a Postgres schema on the shared Neon branch (Phase 1 default per `SK-DB-007`); `registerByoDb(connection_url, plan)` is a stub (throws `NotImplementedError`) until the BYO Postgres workstream lands per [`SK-DB-011`](../db-adapter/decisions/SK-DB-011-byo-postgres-promoted.md). Both share the same executor + validator path. The split lives in code from the first commit even though only `provisionDb` is wired.
- **Core value:** Simple, Bullet-proof
- **Why:** BYO Postgres (`docs/architecture.md §3.6.7`) is decided shape — separate endpoint, introspect via `pg_catalog`, secret-at-rest as encrypted blob, validator inheritance. If we don't split now, BYO work becomes "rebuild the pipeline." Splitting day one means BYO is a single function-body fill-in. The cost today is two function names and an unused export.
- **Consequence in code:** `apps/api/src/db-create/orchestrate.ts` accepts an injected `provision: ProvisionFn`. Phase 1 wires `provisionDb`; the BYO PR wires `registerByoDb` for `POST /v1/db/connect`. Tests inject fakes through the seam (mirrors `SK-DB-006`'s `query` injection). PRs folding the two functions back into one are rejected. The `PgClient` seam carries `query` + `transaction` (latter added by `SK-HDC-012`); `registerByoDb` inherits both when the BYO PR lands.
- **Alternatives rejected:**
  - Single `provision(plan, opts)` with `byo: true` flag — same conditional-as-audit-risk problem as SK-HDC-006; the BYO path needs a different role grant model and a different secret-handling path that don't belong behind a flag.
  - Defer the split — proven pattern: deferred splits never get done before the PR becomes a rewrite.

### SK-HDC-008 — Per-IP and per-account rate caps on create; PoW on signup if abused

- **Decision:** Hosted db.create is rate-limited at two layers: **per-IP** at 5 creates/hour for anonymous/un-authed callers; **per-account** at 20 creates/day for authed callers. If a wave of anonymous creates hits the per-IP bucket, signup adds a [hashcash-style](https://en.wikipedia.org/wiki/Hashcash) Proof-of-Work challenge before the create proceeds. These caps live in the rate-limit middleware (`SK-RL-*` ownership) but are surfaced here because their values are tuned to the create cost (Neon DDL + LLM call ≈ 800ms + $0.0005 to us at the classifier tier).
- **Core value:** Bullet-proof, Free
- **Why:** Without caps, a single botnet can exhaust our Neon DDL budget and our classifier-tier credits in minutes. The numbers come from `docs/phase-plan.md §8`'s free-tier abuse rules, which budget 200 launch-day signups against the DDL execution rate. PoW on signup is the [Hashcash](https://en.wikipedia.org/wiki/Hashcash) tradition: it costs an attacker N×CPU per request while costing legitimate users 200ms. Card-on-file would be cheaper to enforce but contradicts `GLOBAL-013` (free tier, no card).
- **Consequence in code:** `apps/api/src/ask/classifier.ts` checks `kind=create` against the per-IP/per-account limiter before calling `db-create/orchestrate.ts`. Limit values are configured in `apps/api/wrangler.toml` (so they can be tuned without code change). On 429, the response includes the standard `X-RateLimit-*` headers (`SK-RL-*`). PoW is wired only when the per-IP bucket trips system-wide for >5min — not on every signup.
- **Alternatives rejected:**
  - Card-on-file gate before create — kills `GLOBAL-013` ("$0/month for the free tier"); kills the `<nlq-data>` anonymous flow.
  - Single global rate limit — mis-incentivises one abuser to cap everyone; per-IP isolation is the standard pattern.
  - Captcha — bad UX (anonymous embed flow has no place to put it); PoW is invisible to the user when off, transparent when on.

### SK-HDC-009 — SQL injection: identifiers asserted, literals escaped, values parameterised

- **Decision:** The provisioner is the last-mile defense against SQL injection in the create path, even though the LLM-emitted plan is Zod-validated upstream (SK-HDC-002) and the compiled DDL is libpg_query-parsed (SK-HDC-003). Three rules at the executor level:
  1. **Identifiers** (schema, table, column, role names) MUST pass an `assertSafeIdentifier` regex check (`^[a-zA-Z_][a-zA-Z0-9_]*$`, length ≤ 63) before being interpolated into a double-quoted form. A rejected identifier throws — no fallback "sanitize and continue" path exists.
  2. **Values** (sample-row column values) MUST be passed as parameters (`$1, $2, …`) — never string-interpolated. Sample-row INSERTs use the parameterised form unconditionally.
  3. **Literals** (the tenant_id embedded in `CREATE POLICY USING (... = '<tenant_id>')`, where Postgres DDL accepts no parameters) MUST be passed through `escapeSqlLiteral` (single-quote doubling, the canonical Postgres escape) before interpolation. The surrounding `'…'` quotes plus the doubled internal `''` together prevent literal-breakout.
- **Core value:** Bullet-proof
- **Why:** Zod and libpg_query are upstream guards — they catch *plan-shape* and *parser-level* problems but not the executor's own string-handling. A compiler regression emitting an unquoted identifier, or a validator missing an exotic Unicode quote variant, slips through both upper layers; the executor's checks catch them. The identifier whitelist is intentionally narrower than Postgres allows (no quoted/Unicode names) so the regex is auditable in one line. Mirrors the layered-guardrails posture from `docs/research-receipts.md §1` (the Replit incident) — no layer alone suffices, and the executor's check is the one the user's data physically traverses.
- **Consequence in code:** `apps/api/src/db-create/neon-provision.ts` exports nothing that bypasses these checks: `assertSafeIdentifier` + `escapeSqlLiteral` are local helpers called on every interpolation site. Tests under `provisionDb — input validation (SK-HDC-009)` cover the malicious-identifier paths (quote-injection in `dbId` / table / column, plus the 63-char limit). A new interpolation site that skips the helpers fails review. Where `$1` placeholders work they MUST be used; the only literal-interpolation site is `CREATE POLICY USING` (Postgres DDL accepts no parameters there).
- **Alternatives rejected:**
  - Trust the upstream Zod + libpg_query layers — defeats the layered-guardrails posture; one upstream regression and the executor sends bad SQL to Neon.
  - Use Postgres's `quote_ident()` / `format()` server-side — requires shipping the raw identifier to the server, which is exactly the surface we're trying to remove. The check belongs at the boundary, not after the wire crossing.
  - Allow quoted identifiers with embedded characters (the full Postgres identifier grammar) — auditability cost outweighs the (zero) benefit; we control the upstream compiler and never need exotic identifier shapes.

### SK-HDC-010 — DDL transaction has a 30 s statement timeout, 600 s for index DDL

- **Decision:** Immediately after `BEGIN`, the provisioner issues `SET LOCAL statement_timeout = '30s'`. DDL statements matching `/\bindex\b/i` are bracketed with a per-statement bump to `'600s'` and reset to `'30s'` after. `SET LOCAL` is transaction-scoped and resets on `COMMIT` / `ROLLBACK`.
- **Core value:** Bullet-proof
- **Why:** A server-side `statement_timeout` catches pathological DDL expressions — e.g., a schema with a circular FK reference — that parse and validate correctly but hang at execution time. 30 s is generous for `CREATE TABLE` / `ALTER TABLE` (typical: <100 ms) but short enough to prevent a stuck connection from holding the Worker open until isolate death. `CREATE INDEX` against a populated table is the carve-out: it can run for minutes, and capping at 30 s would surface as `ddl_execution_failed` on benign large-table cases.
- **Consequence in code:** `apps/api/src/db-create/neon-provision.ts` sets the 30 s default after `BEGIN`, then bumps to 600 s around any DDL statement containing the word `index` (word-boundary match, so `idx_user_id` does not trigger). Neither value is configurable.
- **Alternatives rejected:**
  - Session-level `SET statement_timeout` — leaks into subsequent requests on a pooled connection.
  - Single 30 s ceiling for everything — bites on legitimate `CREATE INDEX` against a populated table.
  - Single 600 s ceiling for everything — defeats the guard for the 99 % case.
  - Trust the Worker CPU limit alone — hard kill, no `finally`, worse error surface.
  - Configurable via wrangler.toml — adds operator surface for a value that doesn't need tuning at Phase 1 scale.

### SK-HDC-011 — `dropSchemaAndRegistry` is the rollback primitive (idempotent, best-effort, paired Postgres + D1)

- **Decision:** `apps/api/src/db-create/neon-provision.ts` exports `dropSchemaAndRegistry(tracer, pg, d1, dbId, schemaName)`. It runs `DROP SCHEMA "<schemaName>" CASCADE` then `DELETE FROM databases WHERE id = ?`. Both legs are idempotent and best-effort: a missing schema or row is not an error. Today's only caller is `provisionDb`'s registry-insert-failed branch — kept exported so future automated sweeps or operator tooling can reuse it. Any future compensation path MUST call this primitive rather than inlining its own DROP+DELETE.
- **Core value:** Simple, Bullet-proof
- **Why:** Compensation flows that undo a provisioned schema must share one primitive — divergence is how partial-rollback bugs land. Idempotency lets retries (operator intervention, future sweeps) call freely. Best-effort means a transient Postgres error doesn't strand the registry row in a half-rolled-back state — the orphan-schema sweep job picks up either side.
- **Consequence in code:** `provisionDb`'s registry-insert-failed branch (~line 237) calls `dropSchemaAndRegistry`. Tests cover: schema present + row present (full rollback), schema missing (DELETE still runs), row missing (DROP still runs), both missing (idempotent no-op). The function re-validates `schemaName` via `assertSafeIdentifier` at the boundary even though every callsite already validated upstream — `SK-HDC-009`'s defense-in-depth. PRs that introduce a parallel inline DROP+DELETE path fail review.
- **Alternatives rejected:** Inline the current callsite — sets up drift the moment a second callsite is added. Transactional rollback across PG + D1 — no two-phase commit primitive available; the orphan-schema-on-D1-failure pattern is the documented exit (`neon-provision.ts` header). Module-private — blocks the future-sweep / operator-tool reuse the export was extracted for.

### SK-HDC-012 — Provisioner batches DDL + RLS + sample inserts in a single Neon HTTP transaction

- **Decision:** `neon-provision.ts` builds the full provision statement list (`SET LOCAL`, `CREATE SCHEMA`, role + grant, compiled DDL, `ALTER ... ENABLE RLS`, `CREATE POLICY`, sample-row `INSERT`s) into a single `pg.transaction([...])` batch — one HTTP round-trip, one server-side `BEGIN/COMMIT`. Per-statement client `BEGIN/COMMIT/ROLLBACK` removed; the `information_schema.tables` populated guard dropped (a 6-hex collision surfaces as `42P06` → `schema_already_exists`, retried up to 3× with a fresh suffix). Cleanup `DROP SCHEMA` keeps its per-call `pg.query`.
- **Core value:** Honest latency, Bullet-proof
- **Why:** Neon HTTP is per-request stateless ([driver docs](https://neon.com/docs/serverless/serverless-driver)), so the legacy ~30-call `runQuery` loop added 4–8 s wire latency AND its `BEGIN/COMMIT` calls were no-ops — mid-batch failures left half-created schemas. PG transactional DDL guarantees full rollback of `CREATE SCHEMA / TABLE / POLICY / INSERT` (named exception: `CREATE INDEX CONCURRENTLY`, which the compiler doesn't emit). Batching restores speed AND atomicity.
- **Consequence in code:** `provisionDb` builds one `Array<PgTransactionStatement>` and awaits `deps.pg.transaction(stmts)`. `PgClient` seam gains `transaction(stmts)`; `buildPgClient` wires it through `sql.transaction(stmts.map(s => sql.query(s.sql, s.params)), { isolationMode: "ReadCommitted" })`. The `db.transaction` OTel span wraps a single HTTP call with `db.transaction.statement_count`. `safeRollback` removed. `orchestrateDbCreate` retries on `schema_already_exists` (max 3). Integration smoke-test `neon-provision.integration.test.ts` runs against a real Neon dev branch when `NEON_TEST_BRANCH_URL` is set, else skips. SK-DB-003 (one HTTP request per execute) preserved for read/write; only the provisioner batches.
- **Alternatives rejected:** Per-statement HTTP (preserves the bug; legacy `BEGIN/COMMIT` was a documentation lie). WebSocket Pool driver (adds ~200 ms TCP setup per cold worker; tracked as fallback if HTTP regresses). Hyperdrive (free-tier cost concern per `GLOBAL-013`).

### SK-HDC-013 — Tail steps (recent-tables MRU, table-card embed) run via `ctx.waitUntil`

- **Decision:** The orchestrator's two terminal side-effects — `recentTables.touch` and `embedTableCards` — fire into `c.executionCtx.waitUntil` instead of blocking the response. `DbCreateDeps.waitUntil` is the injection seam; when unset, the orchestrator falls back to inline-await so legacy test stubs keep working.
- **Core value:** Honest latency, Fast, Effortless UX
- **Why:** Trace `285b805cee6e2688768d9ffcd75a86fe` (2026-05-13) — `recentTables.touch` cost 124 ms post-COMMIT; `embedTableCards` is `noopEmbedTableCards` today but will become a real Workers AI + pgvector batch in the pgvector slice. Both produce UX-only side-effects (MRU = classifier context for the *next* `/v1/ask`; embedding = future RAG readiness). The response (`dbId`, `plan`, `sampleRows`, `pkLive`) doesn't reflect either; `waitUntil` is the canonical Workers hook for "complete before isolate freeze, but don't block the response."
- **Consequence in code:** `orchestrate.ts` steps 5b/6 wrap their promises in `deps.waitUntil(p.catch(() => undefined))`. `buildDbCreateDeps(envBindings, waitUntil?)` accepts the optional dep; the `/v1/ask kind=create` route passes `(p) => c.executionCtx.waitUntil(p as Promise<void>)`. Embed failures in the waitUntil path no longer surface `embed_failed` (response is already 200); the typed envelope survives only via the inline-await fallback. Child spans stay attached to the request trace because SK-OBS-010 propagates context through the waitUntil promise.
- **Alternatives rejected:** Keep awaiting inline (adds ~120-200 ms + future embed latency for zero user benefit); push only MRU and keep embed inline (forces a second revisit when pgvector lands); `setTimeout(0)` (doesn't survive isolate freeze on Workers).

### SK-HDC-014 — Neon Free-tier keep-warm cron `*/4 13-21 * * 1-5` UTC

- **Decision:** `apps/api/wrangler.toml` adds cron `*/4 13-21 * * 1-5`. The `scheduled()` handler dispatches on `controller.cron`: this cron issues one `SELECT 1` via `keepNeonWarm(databaseUrl)` (in `build-deps.ts` next to the `neon(...)` carve-out per GLOBAL-021). Errors logged, never re-thrown — a Neon outage mustn't surface as a cron failure or interfere with the 04:00 workload-analyser branch.
- **Core value:** Honest latency, Fast, Free
- **Why:** Trace `66fb421f92648b56f90ed1e5ab0c1e01` (2026-05-13) — `db.transaction` cost 6.8 s on the first anon `db.create` in 6 h, matching Neon's Free-tier 5-min compute auto-suspend cold-start ([Scale to Zero](https://neon.com/docs/introduction/scale-to-zero)). A 4-min interval keeps compute resident inside business hours. Budget: 8 h × 22 weekdays × 0.25 CU min ≈ **44 CU-h/month**, 56% under the [100 CU-h Free budget](https://neon.com/docs/introduction/plans).
- **Consequence in code:** `wrangler.toml` `[triggers].crons` lists both expressions. `NEON_KEEP_WARM_CRON` constant in `index.ts` mirrors the string so a typo surfaces as a no-match log line. `keepNeonWarm()` exported from `build-deps.ts` keeps the `@neondatabase/serverless` import in one file. Handler logs `neon_keepwarm_ok` with `elapsed_ms`. Dispatch is `controller.cron === NEON_KEEP_WARM_CRON`; analyser path is fall-through.
- **Alternatives rejected:** 13-h window `*/4 9-22 * * 1-5` (~71.5 CU-h/mo, only 29% headroom); 6-min interval (re-pays cold start every fire); always-on cron (busts budget ~2.6×); Neon Scale plan (kills `GLOBAL-013` no-card promise); logical replication keep-warm (over-engineered).

### SK-HDC-015 — Compiler auto-generates defaults for single-column integer/uuid primary keys

Full body: [`decisions/SK-HDC-015-pk-auto-defaults.md`](decisions/SK-HDC-015-pk-auto-defaults.md). Single-column int/uuid PKs with no LLM default get a compiler-applied identity / `gen_random_uuid()` default.

### SK-HDC-016 — `DELETE /v1/databases/:id` reuses `dropSchemaAndRegistry`; UI gates with typed-name confirmation

Full body: [`decisions/SK-HDC-016-delete-database.md`](decisions/SK-HDC-016-delete-database.md). User-delete shares the SK-HDC-011 rollback primitive; the chat surface gates it with a type-the-displayName confirm modal.

### SK-HDC-017 — Provisioner maps SQLSTATE classes and pins the raw SQLSTATE on the failure span

Full body: [`decisions/SK-HDC-017-provision-sqlstate-fidelity.md`](decisions/SK-HDC-017-provision-sqlstate-fidelity.md). A failed provision maps by SQLSTATE *class* (22/23 → `sample_insert_failed`, 42 → `ddl_execution_failed`, 42P06 → `schema_already_exists`; classless → `transaction_failed`) + pins `db.transaction.error_sqlstate` on the span, so the FLOW-004 walker tells engine/data failures from infra.

### SK-HDC-018 — A constraint-violating sample row degrades to an un-seeded DB, never a 500

Full body: [`decisions/SK-HDC-018-sample-insert-graceful-degradation.md`](decisions/SK-HDC-018-sample-insert-graceful-degradation.md). On `sample_insert_failed` (SQLSTATE 22/23, per SK-HDC-017) the orchestrator retries the provision **once** with `sample_rows: []` — the invited stranger gets a working un-seeded DB instead of `HTTP 500`; each attempt stays atomic (SK-HDC-012 / GLOBAL-033 untouched). Seed-quality lift: `SK-LLM-033`. The deterministic salvage that keeps the *valid* rows when only some fail is `SK-HDC-019`.

### SK-HDC-019 — Pre-validate sample rows and drop only the uninsertable ones, salvaging the rest

Full body: [`decisions/SK-HDC-019-deterministic-sample-row-salvage.md`](decisions/SK-HDC-019-deterministic-sample-row-salvage.md). Before provisioning, `pruneUninsertableSampleRows(plan)` (pure, `db-create/sample-rows.ts`) drops only the rows that provably can't insert against the plan's own constraints (unknown table/column, NOT-NULL gap, uncoercible type, forward/dangling FK), cascading dropped parents to their children and keeping every coercible row. One bad row of N now seeds N−1 instead of 0; a clean plan is a no-op. The deterministic complement to SK-LLM-033's prompt and the salvage layer above SK-HDC-018's all-or-nothing floor; targets the `seeded_ok_ratio` (SK-STRG-008) empty-DB tail.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
  - *In this feature:* db.create is a mutation. The `(user_id, key)` store dedupes the entire pipeline — classifier + LLM call + DDL + provision — so a retried create returns the same `{ db, pk_live, rows, plan }` byte-for-byte and never double-allocates a Postgres schema. Anonymous-mode callers (no `user_id`) dedupe by `(anon_device_id, key)` from the 72h `localStorage` token (`SK-AUTH-*`).
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).
  - *In this feature:* the create path emits, per call: `llm.route` (cheap-tier kind + dbId — SK-ASK-009), `llm.schema_infer` (planner SchemaPlan), `db.transaction` (one span per provision — SK-HDC-012 batched HTTP call; on failure adds `db.transaction.error_sqlstate` per SK-HDC-017), and `db.query` only on the cleanup `DROP SCHEMA`. No per-statement `db.query` on the happy path. All match `docs/performance.md` §3 names; new spans land in the catalog before code.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
  - *In this feature:* SK-HDC-001 is the direct application of this GLOBAL on the create surface — `/v1/ask` does create, query, and write; there is no `/v1/db/new`. Phase 4's BYO connect *is* a separate endpoint (`POST /v1/db/connect` per `docs/architecture.md §3.6.7`) because it's an authoring action with different auth shape, not a data operation; SK-HDC-001 explicitly carves that exception.
- **GLOBAL-020** — No "pick a region", no config files in the first 60s.
  - *In this feature:* the create path is the load-bearing implementation of this GLOBAL. `<nlq-data goal="…">` with no `db=` and no key triggers anonymous create on first hit, returns rows, and stashes a 72h `localStorage` token — zero config, zero file, zero region picker. Anonymous-db lifecycle is owned by the `anonymous-mode` feature (90-day TTL, 10 MB per-db cap, pressure-sweep at 300 MB total per `docs/runbook.md`).

## Open questions / known unknowns

- **Classifier confidence threshold — Resolved** (`GLOBAL-033`): one env-tunable threshold gates create-vs-clarify (mirrors `SK-LLM-022`'s `0.75`); the low-confidence *response* stays per-surface (`SK-HDC-005`). One knob, per-surface routing.
- **`SchemaPlan` type breadth — native `enum` deferred to Phase 2** (resolved per `GLOBAL-033`). Phase 1 ships `text / int / numeric / timestamptz / uuid / boolean / jsonb`; a constrained category is `text` (optionally `+ CHECK`). Native `enum` needs its own decision (adding a value is `ALTER TYPE`, not the `ADD COLUMN` widen `SK-DB-008` allows) — **parked until** a goal needs it.
- **Multi-statement transactional boundary — Resolved** (`GLOBAL-033`): schema + sample rows + `databases` row commit atomically; embedding is decoupled (best-effort, retried, never rolls back a provision — a rate-limit can't cost the user their DB), and a constraint-violating seed row degrades to an un-seeded DB rather than a 500 (`SK-HDC-018`), each attempt still atomic.
- **Phase 4 BYO connect introspection cost — Resolved** (`GLOBAL-033`/`GLOBAL-026`): **absorb** the connect-time `pg_catalog` read + table-card embedding as onboarding cost; never bill the first connect. Gating first value behind cost is what the free chain forbids.

## Semantic layer — Phase 2 design

Phase 1 emits an auto-generated `metrics`/`dimensions` baseline at create time (see `SK-HDC-005` above). Phase 2 makes that baseline **editable, OSI-compatible, and source-controlled**. Full plan, deferred decisions, and promotion path: [`docs/future/semantic-layer.md`](../../future/semantic-layer.md).

When Phase 2 ships, decisions from that doc promote into `SK-HDC-NNN` blocks here (semantic.yml shape, registry layout) and into sibling features (`SK-PLAN-NNN` for cache fingerprint, `SK-SQLALLOW-NNN` for semantic-aware allow-list, `SK-CLI-NNN` for `nlq semantic init`).
