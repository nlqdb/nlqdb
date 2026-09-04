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
  It **acts**; it does not merely recommend. NL→SQL (`/v1/ask`) is the
  interface the app talks to its database through — not what nlqdb sells.
  The LLM bet stands: great on free LLMs ⇒ invincible on frontier LLMs
  ([`GLOBAL-026`](./GLOBAL-026-llm-strategy-byollm-hosted-premium.md)).

- **Core value:** Goal-first, Effortless UX, Bullet-proof, Simple, Honest latency

- **Why:** Two prior bets produced no users. Live usage 2026-09-03: 133
  queries ever platform-wide, 0 in the last 10 days; memory tools 32
  lifetime writes / 22 recalls, all from 2 internal agents, none in 15
  days; ~3–4 genuine human pageloads a day; 0 registered strangers. Three
  public surfaces told three stories (README "analytical memory for AI
  agents", coming-soon "a database you talk to", web hero agent memory).
  Meanwhile what every developer still does by hand — model the data,
  migrate it, index it, watch it — is exactly what the existing plumbing
  (typed-plan compiler, `libpg_query` validator, plan cache, workload
  analyser, multi-engine adapter) was built to automate and never finished:
  the schema is designed once by the LLM at create and never touched again;
  only FK indexes are ever created; the analyser cron writes an empty
  suggestion row. "Autonomous DBA" is the original idea, it is what the
  scaffolding is for, and no NL→SQL wrapper or vector memory store occupies
  the category. NL→SQL stays as the interface because an app whose data
  was never modeled by hand has no other way to address it.

- **Consequence in code & docs:**
  - **North-star KPIs (added to the engine pillar of
    [`GLOBAL-025`](./GLOBAL-025-north-star.md); the free-vs-frontier
    delta stays as the *interface* KPI, no longer the headline):**
    1. **First-insert inference rate** — share of writes that reference a
       table or field the DB has not yet observed and that land with no
       user action (no error, no `nlq new`, no manual DDL). Numerator /
       denominator are two non-saturating counters on the `/v1/ask` write
       path (same shape as `SK-GTM-011`). Floor: ≥ 95 % at Phase A exit,
       ≥ 99 % at Phase B exit.
    2. **Evolution-without-user-action rate** — share of detected shape
       changes (new field, retype, drop, rename) absorbed by the DBA —
       applied, or proposed and applied in one click — versus those that
       ended in an error or a fresh DB. Floor: ≥ 90 % at Phase B exit;
       `nlq new` for a schema break counts as a miss.
    3. **Optimizer yield** — proposals applied per active DB per 30 days
       + p95 latency delta of the affected fingerprint, 7 days after vs
       7 days before apply. Floor: ≥ 1 applied / active DB / month, median
       p95 improvement ≥ 20 %, 0 regressions > 10 % not auto-undone.
  - Every change the DBA makes is a **versioned, previewable, undoable
    proposal** with an OTel span (`GLOBAL-014`) and an `Idempotency-Key`
    on apply (`GLOBAL-005`). Physical reshapes never bump `schema_hash`
    (the surviving half of the old widen rule); logical drop/rename/retype
    do, and the plan cache evicts by miss — no cache walk.
  - **Executed in PR #1097:** `GLOBAL-004` and `GLOBAL-017` rewritten,
    `GLOBAL-006` amended, `GLOBAL-036` deleted; `SK-SCHEMA-003/004/007`
    replaced by `SK-SCHEMA-009`, `SK-DB-008` deleted, `SK-MULTIENG-003`
    and `SK-MIGRATE-003` rewritten, `SK-PIVOT-007/013/014` deleted;
    `architecture.md` §0 / §8 restated. Prior-bet docs live under
    `docs/archive/` (nothing there is canonical).
  - **Unchanged:** `GLOBAL-026` (LLM lanes), `GLOBAL-013` (strict $0), the
    infrastructure, and the **marketing lane** (ICP mining, acquisition,
    comparison / solve / blog pages, GTM metrics, stranger-test, `/reach`)
    — kept as a separate lane, not the product bet. The agent-memory pivot
    is archived; its rails survive only as far as the expert-knowledge
    platform needs them — EK is the first app built on the DBA, gated on
    Phase A (`SK-EKP-005`).
  - Execution order, archive/delete batches, and the compass rewrites live
    in [`docs/pivot-autonomous-dba.md`](../pivot-autonomous-dba.md).

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
