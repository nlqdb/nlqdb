---
name: sql-allowlist
description: Safety boundary on LLM-generated SQL — what is allowed to execute.
when-to-load:
  globs:
    - apps/api/src/ask/sql-validate.ts
    - apps/api/src/ask/orchestrate.ts
  topics: [sql-allowlist, validation, safety, sanitization]
---

# Feature: SQL Allowlist

**One-liner:** Safety boundary on LLM-generated SQL — what is allowed to execute.
**Status:** implemented
**Owners (code):** `apps/api/src/ask/sql-validate.ts` (called from `apps/api/src/ask/orchestrate.ts`)
**Cross-refs:** docs/architecture.md §3.6.5 (validator architecture) · docs/research-receipts.md §1, §10 (Replit incident, Postgres-specific guardrails) · docs/performance.md §2.1 stage 8 / §2.2 stage 8 (parse + schema-fit budget — 5 ms p50 / 20 ms p99) · §3.1 (`nlqdb.sql.validate` span) · §4 Slice 6 · GLOBAL-015 (see governing GLOBALs section) · `docs/features/hosted-db-create/FEATURE.md` (Phase 1 — owns the parallel DDL-path validator at `apps/api/src/ask/sql-validate-ddl.ts`; SK-HDC-006 splits the two validator files deliberately)

## Touchpoints — read this feature before editing

- `apps/api/src/ask/sql-validate.ts`
- `apps/api/src/ask/orchestrate.ts` (the only caller of `validateSql`)

## Decisions

### SK-SQLAL-001 — Layered guardrails, three-stage validation

- **Decision:** SQL validation is three independent stages — (1) leading-verb regex gate, (2) `node-sql-parser` AST parse, (3) AST walk for embedded rejected verbs and DELETE-without-WHERE. All three must pass; any one rejects.
- **Core value:** Bullet-proof, Simple
- **Why:** The Replit incident (`docs/research-receipts.md §1`) had three guardrails active and still lost data — single-rule validation is not enough. A regex-only gate misses CTE-embedded DROPs (`WITH x AS (DROP TABLE foo) SELECT 1`); an AST-only gate misses Postgres-specific destructive variants the parser doesn't recognise (`DROP MATERIALIZED VIEW`, `VACUUM`). Layering catches each other's blind spots.
- **Consequence in code:** `validateSql()` in `sql-validate.ts` runs all three stages in order. Adding a new dangerous verb means adding it to BOTH `LEADING_VERB_REJECT` and `EMBEDDED_REJECT` — never one without the other. Reviewers reject any PR that bypasses a stage on perceived performance grounds.
- **Alternatives rejected:**
  - Regex-only — false-passes CTE-embedded destructive statements.
  - AST-only — node-sql-parser silently shrugs on PG-specific destructive variants; we'd ship false-passes.
  - Single library (e.g. libpg_query) — bigger bundle, weaker for our specific DML/DDL split, doesn't compose with our embedded-verb walk.

### SK-SQLAL-002 — Allowed-verb whitelist; everything else rejected by default

- **Decision:** The `/v1/ask` read/write path allows exactly seven leading verbs: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `WITH`, `EXPLAIN`, `SHOW`. Everything else (including `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `GRANT`, `REVOKE`, `VACUUM`) is rejected with an attributed reason code.
- **Core value:** Bullet-proof, Simple
- **Why:** A whitelist fails closed — a verb we forgot about is rejected, not allowed. The LLM has zero legitimate reason to emit DDL via `/v1/ask`: the only legitimate `CREATE` comes from §3.6.2's typed-plan compiler (our own code, separate path). Rejecting `CREATE` here is correct, not a regression.
- **Consequence in code:** `ALLOWED_LEADING` is a closed set in `sql-validate.ts`. New allowed verbs require a PR + decision update. Each rejected leading verb maps to a specific `SqlRejectReason` so the caller can render an actionable error (per `GLOBAL-012`).
- **Alternatives rejected:**
  - Blacklist-only — every new Postgres release adds verbs we'd have to discover and block.
  - Allow DDL through `/v1/ask` if the user has the role — couples authz to validation; our model is "different paths for different intents" (`SK-SQLAL-006`).

### SK-SQLAL-003 — EXPLAIN ANALYZE rejected; plain EXPLAIN and SHOW short-circuit

- **Decision:** `EXPLAIN ANALYZE …` and `EXPLAIN (ANALYZE …) …` are rejected (matched by `EXPLAIN_ANALYZE` regex) because they execute the wrapped statement on Postgres. Plain `EXPLAIN` and `SHOW` skip AST parsing entirely — they are read-only by definition.
- **Core value:** Bullet-proof, Simple
- **Why:** `EXPLAIN ANALYZE` over a DML inner statement runs the DML — that is exactly the destructive-side-effect surface we are guarding. Conversely, `node-sql-parser` returns "not supported" for plain `EXPLAIN`/`SHOW`, so demanding a parse for them would force false-rejects on safe statements.
- **Consequence in code:** The `EXPLAIN_ANALYZE` regex must match before the SHOW/EXPLAIN short-circuit, in that order, and must be tested against a **comment-collapsed** view of the SQL — a comment wedged between `EXPLAIN` and `ANALYZE` (`EXPLAIN /*c*/ ANALYZE DELETE …`) is whitespace to Postgres, so a comment-blind regex lets the destructive form smuggle past into the `explain` short-circuit (same class as `SK-TRUST-001`). Future short-circuits for other leading verbs require the same "is this read-only by definition" justification.
- **Alternatives rejected:**
  - Treat `EXPLAIN` like any other DML — false-rejects safe debug queries and forces users into raw-SQL escape (`GLOBAL-015`) for read-only introspection.
  - Allow `EXPLAIN ANALYZE` because "advanced users want it" — same destructive surface as the underlying DML; counterexamples in the wild include `EXPLAIN ANALYZE DELETE …`.

### SK-SQLAL-004 — DELETE without WHERE rejected at AST walk

- **Decision:** `DELETE` without a `where` clause is rejected with `delete_without_where` — both at the top level and inside CTEs (`WITH x AS (DELETE FROM foo) SELECT 1`, which Postgres happily executes as a destructive DELETE).
- **Core value:** Bullet-proof
- **Why:** Mass deletes are the highest-impact accident the LLM could produce. The CTE-embedded form is non-obvious — operators reading the SQL miss it; the validator is the one place that won't.
- **Consequence in code:** `walkForRejected()` in `sql-validate.ts` flags `type === "delete"` nodes without `where`, gated on `from`/`table`/`name` presence to distinguish a real statement from a hypothetical expression node sharing the type string.
- **Alternatives rejected:**
  - Allow DELETE without WHERE if the table is "small" — we don't know table sizes at validate time, and "small now, big tomorrow" makes the rule meaningless.
  - Confirm-then-delete UX prompt — fine for the surface UX (DESIGN §9: "Destructive plans show a diff, require second Enter"), but doesn't replace a server-side validator. Both layers must hold.

### SK-SQLAL-005 — Parse failure rejects, never falls through to allow

- **Decision:** If `node-sql-parser.astify()` throws on a statement that passed the leading-verb gate, the validator rejects with `parse_failed`. Earlier behaviour was "allow on parse failure"; tightened so layered defense actually holds.
- **Core value:** Bullet-proof
- **Why:** A parse failure means the LLM produced something we cannot reason about — that is the worst time to give the benefit of the doubt. Falling through to allow defeats the purpose of the AST stage.
- **Consequence in code:** The `try/catch` around `parser.astify()` returns `{ ok: false, reason: "parse_failed" }` on any throw. Any future "soft mode" that allows on parse failure must be a separate, documented escape hatch (and currently doesn't exist).
- **Alternatives rejected:**
  - Allow on parse failure to maximise availability — trades safety for uptime; wrong way round for this layer.
  - Try a second parser as fallback — adds bundle weight (`GLOBAL-013`) and another false-pass surface; defer until measured need.

### SK-SQLAL-006 — Two distinct validator paths: read/write vs DDL

- **Decision:** `apps/api/src/ask/sql-validate.ts` validates `/v1/ask` read/write plans only. DDL (CREATE TABLE / CREATE INDEX / FK constraints) flows through a separate validator at the create path (DESIGN §3.6.2): a Zod check on `SchemaPlan` plus `libpg_query` parse on the compiled DDL. The two paths share the layered-guardrails principle but not the validator code.
- **Core value:** Simple, Bullet-proof
- **Why:** The two paths have different threat models. Read/write reasons about LLM-emitted SQL (untrusted source); DDL reasons about our compiler-emitted SQL (trusted source — but we still parse-check for compiler bugs). One validator trying to do both ends up doing each badly.
- **Consequence in code:** This file rejects `CREATE` outright — that is correct behaviour, not a bug. Anyone touching `sql-validate.ts` who thinks "we should also handle CREATE here" needs to instead extend the create-path validator. PRs that move DDL handling into this file will be rejected.
- **Alternatives rejected:**
  - Single unified validator — couples threat models, makes the allow-set fight itself.
  - Validator-per-feature explosion — overkill; two paths cover the threat surface.

### SK-SQLAL-007 — Out-of-scope guardrails live in other layers

- **Decision:** Role-level isolation (`pg_read_all_data`, `search_path` scoping), Row-Level Security policies, statement timeout, EXPLAIN cost cap, and the transactional wrapper are NOT enforced by `sql-validate.ts`. They live at the Neon connection pool, the per-schema provisioner, and the executor (`apps/api/src/ask/orchestrate.ts`) respectively.
- **Core value:** Bullet-proof, Simple
- **Why:** Validation is one layer of layered defense (`SK-SQLAL-001`); coupling it to runtime concerns (timeouts, transactions) blurs the boundary and makes both layers harder to reason about. Each layer has one job.
- **Consequence in code:** A reviewer asking "why doesn't sql-validate enforce timeouts?" gets pointed here. Statement timeout / cost cap / transactional wrapper remain the executor's job (still unwired — tracked in `db-adapter`). Side-effecting function rejection moved *into* the validator in `SK-SQLAL-008` (it's a parse-time decision, not a runtime one).
- **Alternatives rejected:**
  - Move timeout enforcement into the validator — the validator runs at parse time, before execution, with no executor context.
  - Move RLS into application code — defeats the purpose of RLS (database-enforced).

### SK-SQLAL-008 — Side-effecting functions rejected at the AST walk

- **Decision:** `validateSql()` rejects a closed set of side-effecting functions anywhere in the AST with reason `disallowed_function`: the `pg_sleep*` family (connection-pinning DoS), `dblink*` (network egress), `lo_import` / `lo_export` / `pg_read_file` / `pg_read_binary_file` / `pg_ls_dir` / `pg_stat_file` (server-side file IO), and `pg_logical_emit_message`. `COPY ... FROM PROGRAM` is already rejected one layer earlier — `copy` is not in `ALLOWED_LEADING`.
- **Core value:** Bullet-proof
- **Why:** `pg_sleep(3600)` is callable by *any* role and pins a connection for the duration — a trivial DoS — and the statement-timeout layer that was supposed to bound it is still unwired (`db-adapter` open question). The file-IO functions are blocked at the PG level by Neon's non-superuser role, but listing them here makes the reject *attributed* (`disallowed_function`) rather than surfacing as an opaque Postgres permission error, and holds the layered-guardrails line (`SK-SQLAL-001`) if a future engine or BYO connection runs as a more privileged role. Resolved per `GLOBAL-033` (security trade-off → layered guardrails) — was previously an open question relying on a single control.
- **Consequence in code:** `DISALLOWED_FUNCTIONS` is a closed set in `sql-validate.ts`; `walkForRejected()` tests every `type:"function"`/`"aggr_func"` node's name against it via `containsDisallowedFunction` (recurses string leaves under `name` so it's robust to node-sql-parser's version-dependent name shape). Adding a dangerous function = one line in the set + a test row.
- **Alternatives rejected:**
  - Rely on Neon's non-superuser role alone — misses `pg_sleep` (any role can call it) and breaks the moment a more-privileged engine/connection is added.
  - Rely on a statement timeout — not wired, and a timeout still wastes the connection for its duration.

### SK-SQLAL-009 — Multi-statement input rejected

- **Decision:** A statement that `node-sql-parser` parses into more than one sibling statement is rejected with `multi_statement`, before the per-statement walk.
- **Core value:** Bullet-proof, Simple
- **Why:** `SELECT 1; DELETE FROM x WHERE id=1` parses as two statements; the per-statement walk clears each (the DELETE *has* a WHERE), so a benign-looking lead statement smuggles a second one past the guardrails. A plan is exactly one statement — rejecting `>1` is fail-closed and matches the `architecture.md §3.6.5` "multi-statement rejected" contract that was previously only asserted in prose. Resolved per `GLOBAL-033` (security trade-off → fail-closed).
- **Consequence in code:** `validateSql()` returns `{ ok:false, reason:"multi_statement" }` when `asts.length > 1`. (`WITH … SELECT` is a single statement and is unaffected.)
- **Alternatives rejected:**
  - Trust the per-statement walk to catch everything — it only catches *rejected* patterns; two benign statements both pass.
  - A leading-`;`-count regex — string-level counting trips on semicolons inside string literals; the parser's statement split is authoritative.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-015** — Power users always have an escape hatch.
  - *In this feature:*
    **Interaction note:** `/v1/run` ships in Phase 2 (`apps/api/src/run/orchestrate.ts`, backing CLI `nlq run` + SDK `client.runSql()`). It reuses this validator unchanged — `/v1/run` skips the LLM, not the validator. The orchestrator calls `validateSql()` at the same point `/v1/ask` does; pk_live keys reject writes one step earlier at the leading-verb gate (`SK-APIKEYS-003`). Future work that loosens this needs to update both this feature and `GLOBAL-015` in the same PR.
- **GLOBAL-033** — Resolution defaults (close open questions from the values).

## Open questions / known unknowns

- **Parked until `semantic.yml` ships (Phase 2):** semantic-aware allow-list — an optional pass (DESIGN §17) verifying referenced columns belong to dimensions/metrics declared in `semantic.yml`, failing with `semantic_violation` instead of leaking schema. Plan-cache key construction folds in the semantic.yml fingerprint when this lands.
