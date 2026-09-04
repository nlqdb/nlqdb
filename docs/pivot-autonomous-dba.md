# Pivot — "nlqdb — your autonomous DBA" (execution plan)

Canonical decision: [`GLOBAL-041`](./decisions/GLOBAL-041-autonomous-dba.md).
This file is the **execution plan**: what is built, what is missing, the
build order (§4), and what the docs pivot (§5) already did. Founder rule
applied throughout: **a decision is archived or deleted and the new stance
written clean — never left as a tombstone.**

## 1. Why now — the evidence (2026-09-03 audit)

1. **Usage:** 133 `/v1/ask` queries ever, platform-wide; 0 in the last 10 days.
2. **Memory pivot:** 32 lifetime memory writes / 22 recalls, all from 2 internal agents; nothing in 15 days.
3. **Audience:** ~3–4 genuine human pageloads a day; 0 registered strangers.
4. **Story drift:** README "analytical memory for AI agents" · web hero + `llms.txt` same · coming-soon "a database you talk to" — three public surfaces, three stories.
5. **Readiness gap:** schema designed once at create and never touched; `/v1/ask` rejects `CREATE`/`ALTER`; only FK indexes ever built; zero `pg_stat_*` / `EXPLAIN` use; the workload-analyser cron writes a `pg_add_column_suggestion` row that contains no suggestion and a ClickHouse placeholder pipe (`SELECT 1 AS placeholder WHERE 0 = 1`).
6. **Cost of the bet:** widen-on-write ≈ 2–4 weeks on existing plumbing; inspection + index + dashboard + apply ≈ 6–10 weeks of new subsystem.

## 2. The bet

A developer builds a real app from day one **without doing data modeling**.
The autonomous DBA infers the schema from inserts and reads (first insert
creates the shape, later inserts/reads evolve it), evolves the logical schema
in both directions (add / drop / rename / retype — every change versioned and
previewed), optimizes continuously (statistics, plans, hot fingerprints →
indexes, physical layout, engine placement), and shows all of it in a
transparent dashboard (where data lives, which engines, usage and cost,
recommendations) with **1-click apply and undo**. It **acts**. The LLM bet
"great on free LLMs ⇒ invincible on frontier" (`GLOBAL-026`) stands.

**What NL→SQL becomes:** the interface. `/v1/ask` is how an app that never
modeled its data reads and writes it; BIRD/Spider accuracy and the
free-vs-frontier delta stay measured as the *interface* KPI, but the
headline engine KPIs are the three in `GLOBAL-041` (first-insert inference
rate, evolution-without-user-action rate, optimizer yield).

**Lanes:** Marketing (ICP mining, acquisition, `/vs` · `/solve` · blog, GTM
metrics, stranger-test, `/reach`) is kept as a separate lane — not the bet.
Agent-memory pivot = prior bet, archived; rails kept only as far as EK needs
them. EK = the first app built on the DBA, gated on Phase A (`SK-EKP-005`).

## 3. Built vs missing

| Capability | Built today | Missing for the bet |
|---|---|---|
| Schema inference | LLM designs a schema **once** at create from the goal (`apps/api/src/db-create/infer-schema.ts`, `compile-ddl.ts`, presets) | inference from the **first insert** and from reads; anything after create |
| Schema evolution | `SK-SCHEMA-008` designs widen-on-write but it is unbuilt; `sql-validate.ts` rejects `CREATE`/`ALTER` on `/v1/ask` (counted only as demand signal); `sql-validate-ddl.ts` `checkAlterTable` allows `AT_AddConstraint` only; `schema_hash` / `schema_text` never rewritten after create (`db-registry.ts`) | add on write; drop / rename / retype from usage; version + preview + undo |
| Optimizer | FK indexes at create; workload-analyser cron (`workload-analyser/analyse.ts`, `cron.ts`) reads `query_log` fingerprints, writes an empty `pg_add_column_suggestion` audit row + a placeholder Tinybird pipe | `pg_stat_*` / `pg_stat_statements` collection; `EXPLAIN` on hot fingerprints; recommendation generator; index build; layout changes |
| Dashboard + apply | none (admin GTM dashboard only) | proposals API, `/app/dba` page, 1-click apply, undo |
| Engine placement | multi-engine adapter (Postgres, ClickHouse/Tinybird), `engine-classify` at create, BYO connect | live per-table placement with dual-read verification and cutover |
| Reusable plumbing | typed-plan compiler + Zod validator, `libpg_query` re-validation, plan cache `(schema_hash, query_hash)`, D1 registry, Neon provisioner with `SK-HDC-010` timeouts (30 s DDL / 600 s index), idempotency, OTel, demand-signal, diff preview (`GLOBAL-023`) | — |

## 4. Build order

### Phase A — widen-on-write (2–4 weeks)

Goal: KPI 1 (first-insert inference rate) live and ≥ 95 % on a dogfood workload.

1. `kind=extend` typed plan in the `/v1/ask` orchestrator (`apps/api/src/ask/orchestrate.ts`, `route-ask.ts`, `types.ts`): a write whose fields are not in the observed schema routes to extend, never to `schema_mismatch`.
2. Extend prompt in the typed-plan layer (`packages/llm` prompts): emits `{ add_columns[], create_tables[] }` with types inferred from the values — JSON, never DDL text (`GLOBAL-037` schema-only egress holds).
3. `apps/api/src/db-create/compile-write-ddl.ts`: deterministic compiler for `ALTER TABLE … ADD COLUMN … NULL` and `CREATE TABLE … + RLS` (mirrors `compile-ddl.ts`; the only emitter of widen DDL).
4. `sql-validate-ddl.ts`: widen `checkAlterTable` to accept `AT_AddColumn` (nullable, no default expression) alongside `AT_AddConstraint`.
5. Single Neon transaction: widen DDL + `INSERT` commit or roll back together (`db-create/pg-client.ts`; `SK-HDC-010` 30 s timeout applies).
6. Rewrite `schema_text` and `schema_hash` in D1 after commit (`db-registry.ts`); old plan-cache entries evict by miss (`SK-SCHEMA-005` stands).
7. Diff preview + trace for the extend step on every surface (`GLOBAL-023`); `GLOBAL-003` parity — no new verb: SDK / CLI / MCP / `<nlq-data>` render the extend trace and the KPI counters (`asks_extend_ok` / `asks_extend_failed`, `SK-GTM-011` shape).
8. E2E walk (`tests/e2e`): fresh DB → first insert with an unseen field → row lands, schema shows the column, plan cache still hits for unchanged queries.

### Phase B — inspection + index + dashboard + apply (6–10 weeks)

Goal: KPIs 2 and 3 live; the DBA acts.

1. **Collect:** per-tenant-schema `pg_stat_user_tables`, `pg_stat_user_indexes`, and `pg_stat_statements` (extension availability on Neon free verified first — `P2`), sampled by the scheduled worker into D1 (`apps/api/src/scheduled/**`).
2. **Explain:** `EXPLAIN (FORMAT JSON)` on hot fingerprints, joined to SQL text through the plan cache key `(schema_hash, query_hash)` → compiled SQL; seq-scan on large table, missing index, unused index, wrong type, cold table on the analytical engine are the v1 signals.
3. **Propose:** recommendation generator → typed proposals (`create_index`, `drop_index`, `retype_column`, `drop_column`, `rename_column`, `move_to_engine`) in a D1 `dba_proposals` table with before/after diff, expected effect, and the inverse operation recorded at proposal time. Replaces the empty `pg_add_column_suggestion` row.
4. **Apply / undo:** typed proposal → DDL compiler → execution under `SK-HDC-010` (600 s for `CREATE INDEX CONCURRENTLY`); undo = recorded inverse; logical changes bump `schema_hash`; every apply carries `Idempotency-Key` (`GLOBAL-005`) and an OTel span (`GLOBAL-014`).
5. **API:** `GET /v1/dba/proposals`, `POST /v1/dba/proposals/:id/apply`, `POST …/undo` via `@nlqdb/sdk` (`GLOBAL-001`), `nlq dba …` verbs, MCP `nlqdb_dba_*` tools — one PR per `GLOBAL-003`.
6. **Dashboard:** `/app/dba` — where data lives (tables × engine), usage and cost bottom line, proposals with 1-click apply/undo, applied-history with the measured p95 delta (KPI 3). Honest progress per `P6`.
7. **Autonomy dial:** default = auto-apply physical, non-destructive proposals (index create); logical drop/retype = propose, 1-click apply. Founder may widen later.
8. E2E: seeded slow workload → proposal appears → apply → p95 delta recorded → undo restores.

### Phase C — engine placement / migration (later)

Per-table placement decisions from the same proposal pipeline (`move_to_engine`), dual-read verification, reversible cutover — on the existing `engine-migration` feature. Starts only after Phase B KPIs clear their floors.

## 5. Docs pivot — executed in PR #1097 (2026-09-04)

Founder decisions (all five, one word each): EK = first app built **on** the
DBA (kept, gated on Phase A); `GLOBAL-036` released → deleted;
`memory-architecture-research.md` released → archived; `agent-chat` /
`mcp-integrations` → archived; ICP trackers keep their D4 exemption.

- **Archived** (`git mv`, no live links in): `docs/archive/prior-bet/` — the
  agent-memory worksheets (messaging / engine / dogfood), `agent-chat`,
  `mcp-integrations`, the moat-framing, memory-quality-landscape,
  memory-architecture and language-tutor research; `docs/archive/dead-research/`
  — otel-grafana pivot, phase-1 exit criteria, LLM-credits plan, free-stack
  kit (×2), ICP evidence 2026-05, distribution-queue archive, help
  interceptor, the 2026-06 UX review, blindspot analysis, pricing source of
  truth, the fable recommendation, the byo-connect OAuth proposal (shipped
  as `SK-DBCONN-003`). Reach worksheets re-homed to `docs/research/reach/`.
- **Deleted / rewritten clean:** `GLOBAL-004` (evolves both directions),
  `GLOBAL-017` (one way per operation), `GLOBAL-006` (amended), `GLOBAL-036`
  and `GLOBAL-027` (deleted; the no-gate rule lives in `GLOBAL-007`);
  `SK-SCHEMA-003/004/007` → `SK-SCHEMA-009`; `SK-DB-008` deleted;
  `SK-MULTIENG-003`, `SK-MIGRATE-003`, `SK-EKP-005` rewritten;
  `SK-PIVOT-007/013/014` deleted; `architecture.md` §0 / §8 restated.
- **Compass:** `GLOBAL-025` engine pillar = the three `GLOBAL-041` KPIs;
  scorecard weekly focus = Phase A / KPI 1; phase-plan Phase 2 / 3 gates in
  Phase A / B terms; one story on README, web hero, `llms.txt`, coming-soon.
- **Loops:** `/daily` lever order = engine KPIs → UX flow → meta, self-contained;
  `/ek` paused until Phase A; `/reach` repointed and reworded; `/weekly`,
  `/review`, `/founder-summary` untouched.
