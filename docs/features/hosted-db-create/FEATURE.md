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

**Cross-refs:** docs/architecture.md §3.6.1–§3.6.8 (canonical) · docs/phase-plan.md §2 (Phase 1 slice — sub-modules, anonymous-db lifecycle, exit gate) · docs/research-receipts.md §1 (Replit incident → layered guardrails), §2 (Cortex Analyst + SchemaAgent → typed plans), §7 (dbId resolution → merged `routeAsk`, confidence floor + visible `selected_db` echo — SK-ASK-009), §8 (semantic-layer-at-create moat) · GLOBAL-005, GLOBAL-014, GLOBAL-017, GLOBAL-020 (see governing-GLOBALs section below)

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

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-HDC-NNN`
(the `docs/decisions/`-for-GLOBALs pattern, per `feature-conventions.md §4a`;
sharded because the inline bodies pushed this file past CLAUDE.md `D4`'s 20 KB
cap). The list below is the index; open the linked file for the full five-field
block.

- [**SK-HDC-001**](decisions/SK-HDC-001-one-classifier-routed-endpoint.md) — One classifier-routed endpoint: `/v1/ask` does create, query, and write; there is no `/v1/db/new`.
- [**SK-HDC-002**](decisions/SK-HDC-002-typed-schemaplan-deterministic-compiler.md) — LLM emits a typed `SchemaPlan`; a deterministic compiler (our code) emits the SQL — the LLM never authors DDL.
- [**SK-HDC-003**](decisions/SK-HDC-003-defense-in-depth-zod-libpgquery.md) — Defense in depth: Zod over the plan + libpg_query parse over the compiled DDL, in series.
- [**SK-HDC-004**](decisions/SK-HDC-004-semantic-layer-at-create-time.md) — Semantic layer (`metrics` + `dimensions`) is generated at create-time, in the same plan.
- [**SK-HDC-005**](decisions/SK-HDC-005-dbid-resolution-superseded.md) — *(superseded by SK-ASK-009)* `dbId` resolution: deterministic fast-path then cheap-tier LLM, confidence floor + visible echo.
- [**SK-HDC-006**](decisions/SK-HDC-006-two-validator-paths.md) — Two validator paths: read/write allowlist vs DDL allowlist + libpg_query parse; kept separate, never merged.
- [**SK-HDC-007**](decisions/SK-HDC-007-provisioner-abstraction-split.md) — Provisioner abstraction split now: `provisionDb(plan)` vs `registerByoDb(connection_url, plan)`.
- [**SK-HDC-008**](decisions/SK-HDC-008-create-rate-caps-pow.md) — Per-IP and per-account rate caps on create; hashcash PoW on signup if abused.
- [**SK-HDC-009**](decisions/SK-HDC-009-sql-injection-defenses.md) — SQL injection defense at the executor: identifiers asserted, literals escaped, values parameterised.
- [**SK-HDC-010**](decisions/SK-HDC-010-ddl-statement-timeout.md) — DDL transaction has a 30 s statement timeout, 600 s for index DDL.
- [**SK-HDC-011**](decisions/SK-HDC-011-drop-schema-and-registry-rollback.md) — `dropSchemaAndRegistry` is the idempotent, best-effort, paired Postgres + D1 rollback primitive.
- [**SK-HDC-012**](decisions/SK-HDC-012-batched-neon-transaction.md) — Provisioner batches DDL + RLS + sample inserts in a single Neon HTTP transaction.
- [**SK-HDC-013**](decisions/SK-HDC-013-waituntil-tail-steps.md) — Tail steps (recent-tables MRU, table-card embed) run via `ctx.waitUntil`, off the response path.
- [**SK-HDC-014**](decisions/SK-HDC-014-neon-keep-warm-cron.md) — Neon Free-tier keep-warm cron `*/4 13-21 * * 1-5` UTC (one `SELECT 1`).
- [**SK-HDC-015**](decisions/SK-HDC-015-pk-auto-defaults.md) — Compiler auto-generates defaults for single-column integer/uuid primary keys.
- [**SK-HDC-016**](decisions/SK-HDC-016-delete-database.md) — `DELETE /v1/databases/:id` reuses `dropSchemaAndRegistry`; UI gates with typed-name confirmation.
- [**SK-HDC-017**](decisions/SK-HDC-017-provision-sqlstate-fidelity.md) — Provisioner maps SQLSTATE classes and pins the raw SQLSTATE on the failure span.
- [**SK-HDC-018**](decisions/SK-HDC-018-sample-insert-graceful-degradation.md) — A constraint-violating sample row degrades to an un-seeded DB, never a 500.
- [**SK-HDC-019**](decisions/SK-HDC-019-deterministic-sample-row-salvage.md) — Pre-validate sample rows and drop only the uninsertable ones, salvaging the rest.
- [**SK-HDC-020**](decisions/SK-HDC-020-agent-memory-preset.md) — Opt-in `agent_memory_v1` schema preset on the create path.

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

Phase 1 emits an auto-generated `metrics`/`dimensions` baseline at create time (see `SK-HDC-004` in the Decisions index). Phase 2 makes that baseline **editable, OSI-compatible, and source-controlled**. Full plan, deferred decisions, and promotion path: [`docs/future/semantic-layer.md`](../../future/semantic-layer.md).

When Phase 2 ships, decisions from that doc promote into `SK-HDC-NNN` blocks here (semantic.yml shape, registry layout) and into sibling features (`SK-PLAN-NNN` for cache fingerprint, `SK-SQLALLOW-NNN` for semantic-aware allow-list, `SK-CLI-NNN` for `nlq semantic init`).
