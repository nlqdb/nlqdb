# GLOBAL-041 — nlqdb is an autonomous DBA; NL→SQL is the interface, not the product

- **Decision:** nlqdb's product bet is **"nlqdb — your autonomous DBA."** A
  developer builds a real app from day one **without doing data modeling**.
  The autonomous DBA:
  1. **Infers the schema from inserts and reads.** The first insert creates
     the shape; later inserts and reads evolve it. No `CREATE TABLE`, no
     model file, no schema step.
  2. **Evolves the logical schema in both directions** — add, drop, rename,
     retype — as usage changes. Every change is versioned and previewed
     (diff before apply, [`GLOBAL-023`](./GLOBAL-023-trust-ux-baseline.md)).
  3. **Optimizes continuously.** It inspects the database (statistics,
     plans, hot query fingerprints), builds indexes, restructures physical
     layout, and places data on the right engine.
  4. **Shows everything in a transparent dashboard** — where data lives,
     which engines, bottom-line usage and cost, recommendations — with
     **one-click apply and undo**.
  It **acts**; it does not merely recommend. **Structured writes are inferred
  deterministically** — `insert(table, rows)` maps JSON values to columns
  with **no model call on the write path**. NL (`/v1/ask`) is the interface
  for reads, chat writes and the DBA's proposals, not what nlqdb sells; the
  LLM's judgement (better types, renames, enums, indexes) runs **async** and
  lands as proposals with 1-click apply/undo. The LLM bet stands — great on
  free LLMs ⇒ invincible on frontier LLMs
  ([`GLOBAL-026`](./GLOBAL-026-llm-strategy-byollm-hosted-premium.md)) — and
  is spent on the DBA's judgement, never on parsing a write.
  **The whole company works on Phase A through rateme12** (revised by the
  founder 2026-10-14): Phase A is measured on the
  [`GLOBAL-042`](./GLOBAL-042-dogfood-iteration-loop.md) rateme12 build's
  own writes, and the first users are ten builders the founder recruits by
  hand — love over reach ([`END_GOAL.md`](../END_GOAL.md)).

- **Core value:** Goal-first, Effortless UX, Bullet-proof, Simple, Honest latency

- **Why:** Two prior bets produced no users. Live usage 2026-09-03: 133
  queries ever platform-wide, 0 in the last 10 days; memory tools 32
  lifetime writes / 22 recalls, all from 2 internal agents, none in 15
  days; ~3–4 genuine human pageloads a day; 0 registered strangers after
  10 weeks of daily acquisition work. Three public surfaces told three
  stories (README "analytical memory for AI agents", coming-soon "a database
  you talk to", web hero agent memory). Meanwhile what every developer still
  does by hand — model the data, migrate it, index it, watch it — is exactly
  what the existing plumbing (typed-plan compiler, `libpg_query` validator,
  plan cache, workload analyser, multi-engine adapter) was built to automate
  and never finished: the schema is designed once by the LLM at create and
  never touched again (`/v1/ask` rejects `CREATE`/`ALTER`); only FK indexes
  are ever created; zero `pg_stat_*` / `EXPLAIN` use; the analyser cron
  writes an empty suggestion row. "Autonomous DBA" is the original idea, it
  is what the scaffolding is for, and no NL→SQL wrapper or vector memory
  store occupies the category. NL→SQL stays as the interface because an app
  whose data was never modeled by hand has no other way to address it.
  Widen-on-write ≈ 2–4 weeks on existing plumbing; inspection + index +
  dashboard + apply ≈ 6–10 weeks of new subsystem.

- **Consequence in code & docs:**
  - **North-star KPIs** (the engine pillar of
    [`GLOBAL-025`](./GLOBAL-025-north-star.md); definitions and floors live
    only here):
    1. **First-insert inference rate** — share of writes that reference a
       table or field the DB has not yet observed and that land with no
       user action (no error, no `nlq new`, no manual DDL). Numerator /
       denominator are two non-saturating counters per write path, same
       shape as `SK-GTM-011`: `inserts_infer_ok` / `inserts_infer_failed`
       on the structured insert (the KPI), `asks_extend_ok` /
       `asks_extend_failed` on `/v1/ask` (reported, not gated). Floor:
       ≥ 95 % at Phase A exit, ≥ 99 % at Phase B exit.
    2. **Evolution-without-user-action rate** — share of detected shape
       changes (new field, retype, drop, rename) absorbed by the DBA —
       applied, or proposed and applied in one click — versus those that
       ended in an error or a fresh DB. Floor: ≥ 90 % at Phase B exit;
       `nlq new` for a schema break counts as a miss.
    3. **Optimizer yield** — proposals applied per active DB per 30 days
       + p95 latency delta of the affected fingerprint, 7 days after vs
       7 days before apply. Floor: ≥ 1 applied / active DB / month, median
       p95 improvement ≥ 20 %, 0 regressions > 10 % not auto-undone.
  - **Phase A workload — rateme12's own writes (the KPI 1 instrument).**
    Every structured insert `rateme12.nlqdb.com` makes through `@nlqdb/sdk`
    — the ~32 K-server registry import included — that carries a table or
    field the schema has not seen. The whole population counts; there is no
    sampling window. **Phase A exits when ≥ 95 % of such inserts — every one
    from the registry import through 14 cutover days, n reported — land with
    no user action AND the synchronous write path makes 0 LLM calls** (OTel:
    no `llm.*` span under an insert). The former ≥ 200 floor is dropped
    (2026-10-16): one app first-sees ~100 fields, and padding the count is
    the synthetic sample rejected below. A field is never pre-modeled to
    make the number look good. The `/daily` loop's own CI writes
    (`dogfood-write.yml`) stay as a regression canary, not the sample.
  - **Phase gates.** [`phase-plan.md`](../phase-plan.md) **Phase 2 exits on
    Phase A alone** — nothing else gates it: no BIRD/Spider floor, no
    MCP-host count, no CSV user test, no TTFV. **Phase 3 exits on Phase B**:
    KPI 1 ≥ 99 %, KPI 2 ≥ 90 %, KPI 3 at floor, **TTFV p50 ≤ 60 s** (moved
    here from the Phase 2 gate). Phase C (engine placement) starts only after
    Phase B clears.
  - **Acquisition is paused; one exception, the love gate.** This
    **supersedes the 2026-07-19 "operating focus is user acquisition"
    directive that lived in
    [`GLOBAL-038`](./GLOBAL-038-gtm-pmf-instrumentation.md)** — GLOBAL-038
    keeps the instrument (`/app/admin`, `gtm_snapshots`), not the focus. The
    `/reach` loop, the ICP-mining cron, the dev.to drip and new blog / `/vs` /
    `/solve` content commits stay stopped; existing pages stay live. **The
    exception:** once real rateme12 traffic runs on nlqdb (the cutover in
    the iteration brief), the founder recruits **~10 P1 solo builders by
    direct message** — never content or SEO — each building something small
    on the SDK. **Show HN opens on the love gate:** rateme12 served by nlqdb
    for 14 consecutive days with zero hand-written DDL **and ≥ 3 of the 10
    builders return unprompted in their second week** (a session with ≥ 1
    inferred table). Not on KPI 1 alone. The expert-knowledge platform stays
    gated on Phase A (`SK-EKP-005`).
  - **Depth only until the love gate opens.** No breadth work: no new or
    polished other-language SDKs, framework wrappers or premium-tier
    features; existing ones get fixes only.
  - **BIRD/Spider is a CI regression alarm, not a KPI.** The harness runs on
    a fixed sample and fails when accuracy drops **> 5 pp** below the last
    green run (`SK-QUAL-002`). No floor, no weekly re-measure lever, no
    scorecard target; a red alarm is a bug to fix like any red CI.
  - **Monetization:** the shipped premium tier
    ([`premium-tier`](../features/premium-tier/FEATURE.md) — Stripe +
    hosted-premium meter) stays as is. Pricing for the DBA product is decided
    after Phase B ships.
  - Every change the DBA makes is a **versioned, previewable, undoable
    proposal** with an OTel span (`GLOBAL-014`) and an `Idempotency-Key`
    on apply (`GLOBAL-005`). Physical reshapes never bump `schema_hash`;
    logical drop/rename/retype do, and the plan cache evicts by miss — no
    cache walk.
  - **Unchanged:** `GLOBAL-026` (LLM lanes), `GLOBAL-013` (strict $0), the
    infrastructure. The agent-memory pivot is archived; its rails survive
    only as far as the expert-knowledge platform needs them. Prior-bet docs
    live under `docs/archive/` (nothing there is canonical). Docs pivot
    executed in PR #1097 (2026-09-04); Q1–Q5 below resolved 2026-09-05.

- **Alternatives rejected:**
  - **Stay on agent memory** — 0 external usage after 10 weeks of daily
    loop; "GROUP BY your memory" is a feature any Postgres-backed memory
    layer can add.
  - **Stay on NL→SQL as the product** — a wrapper category with dozens of
    entrants; the same accuracy work is worth more as a DBA's interface.
  - **Recommend-only DBA** — every DB host ships an advisor tab nobody
    reads; the value is in acting, previewed and undoable.
  - **Widen-only evolution (keep GLOBAL-004 whole)** — forces `nlq new` on
    every real schema break, the exact modeling chore the bet removes.
  - **Keep acquisition running in parallel** — 10 weeks of channel work
    produced 0 strangers; the blocker is the product, and a second lane
    splits the one agent's runs.
  - **Keep BIRD/Spider as a phase floor** — gates the phase on an interface
    number the product bet does not move; the alarm keeps it from regressing.
  - **Synthetic Phase A workload** — a generated insert stream proves the
    extend path, not that a real writer never has to model.
  - **The loop's own run logs as the Phase A workload** (2026-09-05 →
    10-14) — mostly re-used fields: one 14-day window plus 3 days of a
    second yielded 12 samples (2 HIT / 10 MISS), ~0.5 a day against 200
    needed; the workload was designed by the thing under test.
  - **Keep the LLM on the structured write path** — every KPI-1 miss traced
    to the free-LLM plan stage on ~2 KB writes (truncation, timeouts,
    breakers), capped by free quotas the $0 policy cannot lift; a mapping
    from JSON values to columns needs no model.
  - **Gate first users on KPI 1 ≥ 190/200** — a reach-style gate that held
    user contact at zero for 122+ days and cannot produce the love signal
    `END_GOAL.md` says counts.

## Build order

### Phase A — widen-on-write (2–4 weeks)

Goal: KPI 1 ≥ 95 % on the rateme12 workload above, 0 LLM calls on the
write path. Steps 1–9 below shipped the `/v1/ask` extend path (live,
`SK-SCHEMA-008`/`-010`/`-011`); it stays as the chat write path. Remaining,
in order (revised 2026-10-14, 2026-10-16):

10. ✅ **Deterministic structured insert** (`SK-SCHEMA-012`, deployed
    2026-10-15; `nlq insert` + MCP `nlqdb_insert` 2026-10-17). Remaining:
    a rateme12-shaped live walk on prod.
11. **Keys and the change ledger** (revised 2026-10-16; keyed upsert
    per-row cast failures 2026-10-20 and per-row duplicates 2026-10-21, per `SK-SCHEMA-012`). `insert({ key })`
    creates a unique index on first use and upserts (`ON CONFLICT … DO
    UPDATE`); a row that fails (duplicate without `key`, value that won't
    cast) is returned per row while the rest land (`END_GOAL.md` edge
    states). One D1 `dba_changes` table (migration `0038`, shipped
    2026-10-21) records every committed DDL statement — insert widen, chat
    widen, key index, later proposals — with its inverse and origin,
    written after commit by `apps/api/src/dba-changes.ts`. Remaining: KPIs
    1–2 read from it and `/app/dba` v0 renders it. Phase B's proposals are
    rows of it, not a second table.
12. **Reads that don't spend the model.** SDK `ask()` makes one LLM call
    (no summary unless asked); an additive widen re-plans only queries over
    the widened table (amends `SK-SCHEMA-005` in that PR); `/v1/run` and
    `/v1/insert` emit the same query event the workload analyser reads, so
    an app's pinned SQL (`runSql` with `trace.sql`) stays visible to the
    optimizer.
13. **rateme12 §5b on `insert()`**, registry import included; hot reads
    pinned via `runSql`. The schema-comparison rubric (iteration brief §7)
    is written before cutover, then the cutover to real traffic.
14. **Async enrichment.** Deterministic rules first — ISO-8601 text →
    `timestamptz`, `*_id` matching a key → FK + index, low-cardinality
    text → enum — filed as proposals into `dba_changes`; the LLM only
    names things.

Original steps:

1. `kind=extend` typed plan in the `/v1/ask` orchestrator (`apps/api/src/ask/orchestrate.ts`, `route-ask.ts`, `types.ts`): a write whose fields are not in the observed schema routes to extend, never to `schema_mismatch`.
2. Extend prompt in the typed-plan layer (`packages/llm` prompts): emits `{ add_columns[], create_tables[] }` with types inferred from the values — JSON, never DDL text (`GLOBAL-037` schema-only egress holds).
3. `apps/api/src/db-create/compile-write-ddl.ts`: deterministic compiler for `ALTER TABLE … ADD COLUMN … NULL` and `CREATE TABLE … + RLS` (mirrors `compile-ddl.ts`; the only emitter of widen DDL).
4. `sql-validate-ddl.ts`: widen `checkAlterTable` to accept `AT_AddColumn` (nullable, no default expression) alongside `AT_AddConstraint`.
5. Single Neon transaction: widen DDL + `INSERT` commit or roll back together (`db-create/pg-client.ts`; `SK-HDC-010` 30 s timeout applies).
6. Rewrite `schema_text` and `schema_hash` in D1 after commit (`db-registry.ts`); old plan-cache entries evict by miss (`SK-SCHEMA-005` stands).
7. Diff preview + trace for the extend step on every surface (`GLOBAL-023`); `GLOBAL-003` parity — no new verb: SDK / CLI / MCP / `<nlq-data>` render the extend trace and the KPI counters.
8. Dogfood workload: `/daily` writes through `@nlqdb/sdk` — now a regression canary; the sample moved to rateme12 (step 13).
9. E2E walk (`tests/e2e`): fresh DB → first insert with an unseen field → row lands, schema shows the column, plan cache still hits for unchanged queries.

### Phase B — inspection + index + dashboard + apply (6–10 weeks)

Goal: KPIs 2 and 3 live; the DBA acts.

1. **Collect:** per-tenant-schema `pg_stat_user_tables`, `pg_stat_user_indexes`, and `pg_stat_statements` (extension availability on Neon free verified first — `P2`), sampled by the scheduled worker into D1 (`apps/api/src/scheduled/**`).
2. **Explain:** `EXPLAIN (FORMAT JSON)` on hot fingerprints, joined to SQL text through the plan cache key `(schema_hash, query_hash)`; seq-scan on large table, missing index, unused index, wrong type, cold table on the analytical engine are the v1 signals.
3. **Propose:** recommendation generator → typed proposals (`create_index`, `drop_index`, `retype_column`, `drop_column`, `rename_column`, `move_to_engine`) as rows of the `dba_changes` ledger (Phase A step 11) with before/after diff, expected effect, and the inverse operation recorded at proposal time. A rename is proposed only when no recorded fingerprint reads the old name. Replaces the empty `pg_add_column_suggestion` row.
4. **Apply / undo:** typed proposal → DDL compiler → execution under `SK-HDC-010` (600 s for `CREATE INDEX CONCURRENTLY`); undo = recorded inverse; logical changes bump `schema_hash`; every apply carries `Idempotency-Key` and an OTel span.
5. **API:** `GET /v1/dba/proposals`, `POST /v1/dba/proposals/:id/apply`, `POST …/undo` via `@nlqdb/sdk` (`GLOBAL-001`), `nlq dba …` verbs, MCP `nlqdb_dba_*` tools — one PR per `GLOBAL-003`.
6. **Dashboard:** `/app/dba` — where data lives (tables × engine), usage and cost bottom line, proposals with 1-click apply/undo, applied-history with the measured p95 delta (KPI 3). Honest progress per `P6`.
7. **Autonomy dial:** default = auto-apply physical, non-destructive proposals (index create); logical drop/retype = propose, 1-click apply. Founder may widen later.
8. E2E: seeded slow workload → proposal appears → apply → p95 delta recorded → undo restores.

### Phase C — engine placement / migration (later)

Per-table placement decisions from the same proposal pipeline (`move_to_engine`), dual-read verification, reversible cutover — on the existing `engine-migration` feature. Starts only after Phase B KPIs clear their floors.
