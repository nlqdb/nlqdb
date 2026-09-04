# Pivot — "nlqdb — your autonomous DBA" (execution plan)

Canonical decision: [`GLOBAL-041`](./decisions/GLOBAL-041-autonomous-dba.md).
This file is the **execution plan**: what is built, what is missing, the
build order, and the archive / delete / rewrite batches that need one-word
founder approval. Nothing in §5–§8 has been moved or rewritten yet; each
group lands as its own PR once approved. Founder rule applied throughout:
**a decision is archived or deleted and the new stance written clean —
never "superseded".**

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
them. Expert-knowledge platform (EK) = pending founder decision (§9).

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

## 5. Docs to ARCHIVE or DELETE — approve by group

Nothing moved yet. Archive = `git mv` to `docs/archive/<group>/` with no forwarding stubs; delete = remove, git history keeps it.

- **A. Memory-pivot worksheets** — `docs/features/agent-memory-pivot/worksheets/**` (40 files: WS-01..14, `messaging-surface-map.md`, `dogfood/`, `engine/`, `reach/`). Archive. Feature doc + decisions handled in §6.
- **B. Planned features with zero code** — `docs/features/agent-chat/`, `docs/features/mcp-integrations/`. Archive or delete (§9, founder).
- **C. Pivot-only research** — `docs/research/deepseek-moat-framing.md`, `docs/research/agent-memory-quality-landscape.md`, `docs/future/language-tutor-assistant.md`; `docs/future/memory-architecture-research.md` only after the founder mandate is released (§9). Archive.
- **D. Dead research / stale trackers** — `docs/research/otel-grafana-pivot.md`, `phase-1-exit-criteria.md`, `llm-credits-plan.md`, `free-stack-kit.md` + `docs/future/free-stack-kit.md`, `docs/future/agent-prompting-help-interceptor.md`, `docs/research/icp-evidence-2026-05.md`, `docs/research/distribution-queue-archive.md`, `docs/reviews/ux-2026-06/`, `docs/blindspot-analysis.md`, `docs/pricing-source-of-truth.md`. Delete.
- **E. Conditional** — `docs/research/fable-recommendation.md` only after `/daily` is made self-contained; `docs/features/byo-connect/proposals/oauth-direct-connect/` only after verifying it shipped. Hold.
- **F. Marketing lane — keep** — `acquisition-channels*.md`, `automated-icp-validation-plan*.md`, `personas.md`, `launch-kit.md`, `email-and-marketing.md`, `distribution-queue.md`, `design-partners-autonomous.md`, `competitors.md`, `/vs` · `/solve` · blog data.

## 6. Decisions to DELETE + the clean stance that replaces each

| Delete | Clean stance | Lives in |
|---|---|---|
| `GLOBAL-004` "once observed, never removed" half | Logical schema evolves in both directions as versioned, previewed proposals; **physical layout reshapes freely without bumping `schema_hash`** (kept half) | rewrite `GLOBAL-004` in place to the physical-only rule; logical rule in `GLOBAL-041` |
| `GLOBAL-006` absolute "no invalidation" | Content addressing unchanged; a logical drop/rename/retype produces a new `schema_hash`, old entries evict by miss; still no TTL, no flush, no cache walk | `GLOBAL-006` (one sentence added) |
| `GLOBAL-017` two endpoints / two verbs | One way per operation; the DBA surface adds `/v1/dba/*`, `nlq dba`, `nlqdb_dba_*` as the one way to see and apply proposals | rewrite `GLOBAL-017` to "one way per operation" without the count |
| `GLOBAL-036` lead positioning = agent memory ("permanent") | Lead positioning = autonomous DBA, one story on every surface | `GLOBAL-041`; delete `GLOBAL-036` after founder release (§9) |
| `GLOBAL-027` index row marked "superseded" | already removed — row wording says so without the tombstone status | `docs/decisions.md` row → "removed" |
| `SK-SCHEMA-003` (ADD COLUMN NULL only) · `SK-SCHEMA-004` (vanished field = hard-stop) · `SK-SCHEMA-007` (no migrations tool; break = fresh DB) | Widen-on-write is the first evolution primitive (`SK-SCHEMA-008` stays); drop / rename / retype are proposals with preview + undo; a vanished field is absorbed as a detected drop, not an error | `schema-widening/FEATURE.md` (renamed scope: schema evolution) — new SK-SCHEMA IDs |
| `SK-DB-008` (same rule, third home) | adapter executes whatever DDL the compiler emits; no evolution policy in the adapter | delete; policy lives in schema-widening |
| `SK-MULTIENG-003` (physical state never surfaced) | physical state (engine, indexes, pipes) is **first-class dashboard data**; still never an input to `schema_hash` | `multi-engine-adapter/FEATURE.md` new SK |
| `SK-MIGRATE-003` (cron never issues PG DDL) | the DBA issues PG DDL through the proposal → apply path, previewed, undoable, under `SK-HDC-010` | `engine-migration/FEATURE.md` new SK |
| `SK-PIVOT-007` (evolve by version, never in place) | memory preset evolves like any schema — via proposals; archived with the pivot | `agent-memory-pivot` archived; EK inherits if kept (§9) |
| `architecture.md` §0 "Schemas only widen" bullet; §8 "not building: schema editor / migrations tool / dashboard" | §0: "Every schema and layout change is a versioned, previewed, undoable proposal"; §8: schema editor / migrations tool / BI product replaced by "the DBA's dashboard is the product surface; a manual query builder and a general BI tool are still not built" | `architecture.md` |

## 7. Compass docs to rewrite — one story

| Doc | Change |
|---|---|
| `GLOBAL-025` | engine pillar = schema inference + evolution + optimizer (the three `GLOBAL-041` KPIs, headline) with NL→SQL accuracy as the interface KPI; data-engine table folded in; drop the "Phase 3 ≥ 100 auto-migrations" gate |
| `docs/scorecard.md` | weekly focus → KPI 1 instrument + Phase A; retire the `SK-PIVOT-016` dogfood gate and the memory-quality proxy rows; keep funnel / ops / E2E rows |
| `docs/phase-plan.md` | Phase 2 "agent memory" → Phase A; Phase 3 → Phase B; exit gates = `GLOBAL-041` KPI floors |
| `docs/architecture.md` §0 header quote, §0 widen bullet, §8 | per §6; §1 already rewritten in this PR |
| README H1 · web hero (`apps/web/src/pages/index.astro`) · `llms.txt.ts` · `apps/coming-soon/index.html` · JSON-LD | one story: "nlqdb — your autonomous DBA". The claim is *no data modeling by you* — there IS a well-designed schema; the DBA infers, evolves, and optimizes it. Never phrase it as the absence of a schema |
| `CLAUDE.md` | §1 done in this PR; §5 rows: `schema-widening` → schema evolution, `engine-migration` → optimizer/proposals, `agent-memory-pivot` row → archived, add `apps/api/src/dba/**` → new `docs/features/autonomous-dba/FEATURE.md`; P1/§10 wording "supersede" → "archive or delete" |
| `docs/competitors.md` | threat matrix re-cut against DB-host advisors and schema tools, not memory layers |

## 8. Loops

- **`/daily`** — rewrite lever order to the `GLOBAL-041` KPIs: (1) KPI 1–3 instruments and Phase A/B slices, (2) real UX-flow quality, (3) marketing-lane levers when no engine lever is pullable; drop the dogfood-gate focus and the acquisition-first order (2026-07-19).
- **`/ek`** — pause until the EK decision (§9); no runs until then.
- **`/reach`** — keep unchanged (marketing lane).
- **`/weekly`** — reads the new scorecard focus; no other change.

## 9. Founder decisions required before execution

One word each; nothing in §5–§8 moves until answered.

1. **EK:** first real app built *on* the autonomous DBA (dogfood) — or archive?
2. **`GLOBAL-036`** "the reposition is permanent" clause: release, so the GLOBAL can be deleted?
3. **`docs/future/memory-architecture-research.md`** founder mandate: release, so it can be archived (group C)?
4. **`agent-chat` / `mcp-integrations`** (founder-signed 2026-08-19, zero code): archive or delete?
5. **ICP trackers' D4 exemption** (`GLOBAL-028`/`029`, append-only over 20 KB): keep as-is for the marketing lane, or cap?
