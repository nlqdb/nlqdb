---
name: engine-migration
description: Phase 3: auto-migrate Postgres ↔ Mongo / Redis / etc. when usage signals a fit.
when-to-load:
  globs:
    - packages/db/**
  topics: [engine-migration, phase-3]
---

# Feature: Engine Migration

**One-liner:** Phase 3: auto-migrate Postgres ↔ Mongo / Redis / etc. when usage signals a fit.
**Status:** planned (Phase 3)
**Owners (code):** `packages/db/**` (Migration Orchestrator lands as a sibling module — exact path TBD)
**Cross-refs:** docs/architecture.md §10 §2.2 (Migration Orchestrator + Workload Analyzer) · docs/architecture.md §10 §2.5 (Phase 2 exit criteria — auto-migration is the gate) · docs/architecture.md §10 (open design questions) · docs/architecture.md §10 §6 (Phase 3 — the engine, the moat)

## Touchpoints — read this skill before editing

- `packages/db/**`

## Decisions

_No decisions are firm yet — engine-migration is Phase 3 and the open
questions below must be answered before code lands. The skill exists
now so the `SK-MIGRATE-NNN` ID prefix is reserved and `_index.md` is
comprehensive (per `docs/skill-conventions.md §6`)._

The shape of the feature is sketched in `docs/architecture.md §10 §2.2`:
**shadow-write to the new engine while reads stay on the old; backfill
in parallel; dual-read verification on a sample of production reads;
atomic cutover via a per-db routing pointer; rollback is a pointer
flip.** This is the *direction*, not a decided design — every choice
in the open-questions list is still open.

## Open questions / known unknowns

These must be resolved before the first migration ships. Each one
becomes one or more `SK-MIGRATE-NNN` decisions when answered.

### Trigger and policy

- **Confidence threshold** for the Workload Analyzer to recommend a
  migration. `docs/architecture.md §10 §2.2` calls for "confidence > threshold"
  but pins no number. What does the threshold sweep look like on the
  held-out benchmark from §2.5?
- **Sustained-window length** ("hours, not minutes" per `docs/architecture.md §10
  §2.2`). 24h? 72h? What's the right window size before we believe a
  workload signature is real and not a one-off batch?
- **Cost/latency win threshold.** What's the minimum projected gain
  before we move? Migrations have cost (engineer attention if anything
  goes wrong, dual-read CPU, brief routing latency); we need a number,
  not a vibe.
- **Per-tier policy.** Free / Hobby / Pro: do all tiers get auto-
  migration? `docs/architecture.md §10 §6` lists Pro tier in Phase 3 — does free-
  tier auto-migrate at all, or do we restrict to paid?
- **User opt-out.** `docs/architecture.md §10 §8` open question: "When (if ever)
  do we allow users to write their own migration triggers? ('Always
  keep in Redis.')" — likely yes as an override, not as a default
  surface; concrete API shape undecided.

### Mechanism

- **Shadow-write path.** Where in the request lifecycle does the
  shadow write happen — in the executor, in the orchestrator, or in a
  separate background fan-out worker? Latency budget for the primary
  write must not move.
- **Backfill throttling.** What's the rate limit on backfill against
  the source DB? How do we measure "current load" to throttle against?
- **Dual-read sampling rate.** What percentage of production reads run
  on both engines during verification? `docs/architecture.md §10 §2.2` says "a
  sample" — concrete number TBD.
- **Divergence handling.** Any divergence "blocks cutover and pages"
  per `docs/architecture.md §10 §2.2`. What's the page recipient (on-call only?
  feature owner?), and what's the auto-rollback contract — does
  divergence rewind the shadow-write, or freeze it for analysis?
- **Atomic cutover** via a per-db routing pointer. Where does the
  pointer live (D1 row? KV? a Durable Object?), and what's the
  consistency guarantee on the flip — strict linearizability, or
  best-effort with an in-flight bridge window?
- **Rollback procedure.** Pointer flip is the happy-path rollback;
  what about post-cutover detection of a regression? Do we keep the
  source engine warm for some grace window, and how long?

### Schema mapping

- **Postgres ↔ Mongo translation.** Phase 2 exit gate names PG ↔ Redis
  and PG ↔ DuckDB explicitly. PG ↔ Mongo is mentioned but not
  prioritized; do JSONB rows map 1:1 to documents, or do we re-shape?
- **Index translation.** Each engine has its own index DSL; the
  Migration Orchestrator must translate, not just dump rows.
- **Constraint translation.** Foreign keys, NOT NULL, CHECK
  constraints — Mongo has none of these natively, Redis has none.
  Where do they live post-migration (validator? application layer?
  shadow PG?), and how does the user notice if they're effectively
  weakened?

### Verification

- **Held-out benchmark.** Phase 2 exit gate (`docs/architecture.md §10 §2.5`):
  "Workload Analyzer's decisions beat a human DBA on a held-out
  benchmark (we'll build it)." Benchmark composition, scoring rubric,
  and human-DBA baselines are all TBD.
- **Chaos testing.** `docs/architecture.md §10 §7` ("Risks, honestly") names
  "cross-engine migration corrupts data" as a Medium risk; the
  mitigation is "dual-read verification, staged rollout, chaos tests,
  reversible cutover." Chaos-test protocol undecided.
- **Restore drill cadence.** Weekly automated restore + diff is the
  cross-phase always-on practice (`docs/architecture.md §10 §8`); is the
  same cadence enough for engine-migration verification, or do we
  need tighter loops during a live migration?

### User experience

- **Trace surface.** `docs/architecture.md §10 §2.2`: "The user sees a single
  subtle line in their trace: `engine: postgres → redis (migrated 2h
  ago)`. Nothing more, unless they ask." The "ask" path is undefined —
  what does the deeper view show?
- **Notification policy.** Do we email the user when their DB
  migrates? (Probably no; migrations are infrastructure, not user
  events. But a security-style audit log entry probably yes.)
- **Tier-up triggered by migration.** If a workload pushes a free-tier
  DB onto an engine the free tier doesn't include (e.g. ClickHouse),
  does the system migrate and bill, or surface a "upgrade to keep
  performance" path? Pricing interaction with migration is open.

### Cross-phase concerns

- **Plan-cache invalidation on migration.** `GLOBAL-006` keys plans by
  `(schema_hash, query_hash)` — `engine` is not in the key. After a
  migration, are old plans still valid (probably no for Mongo /
  Redis), or do we need an `engine` dimension in the key? See
  `SK-PLAN-NNN` once the plan-cache skill is populated.
- **Schema widening across engines.** `GLOBAL-004` ("schemas only
  widen") was specified for Postgres semantics; widening rules across
  Mongo / Redis are TBD. A document that gains a nested field in Mongo
  is "widening"; is the schema-hash bumped the same way?
- **Idempotency-store consistency during migration.** `GLOBAL-005`
  records `(user_id, idempotency_key)` against a bounded-TTL store;
  during cutover, do dual-write idempotency stores risk byte-exact
  replays diverging on the new engine?

## Phase-3 entry checklist (provisional)

Ahead of the first SK-MIGRATE decision, these need to land:

1. The held-out benchmark exists and has a human-DBA baseline.
2. Phase 2's PG-only auto-migration scaffold (shadow-write + dual-read
   in single-engine) is wired and battle-tested.
3. `docs/architecture.md §10 §2.5` Phase 2 exit gate is met:
   - Auto-migration between at least PG ↔ Redis and PG ↔ DuckDB in
     prod with zero user-visible downtime across 100+ migrations.
   - Workload Analyzer beats a human DBA on the held-out benchmark.
   - p99 latency under the *current* engine within 1.3× of hand-
     written queries.
   - Verified weekly restore drill.
4. Multi-engine-adapter (`SK-MULTIENG-NNN`) decisions are firm — the
   target engine has to exist before we can migrate to it.

## Source pointers

- `docs/architecture.md §10 §2.1` — architecture diagram (Query Planner → Query
  Log → Workload Analyzer → Migration Orchestrator → Shadow + Cutover)
- `docs/architecture.md §10 §2.2` — Migration Orchestrator subsection
- `docs/architecture.md §10 §2.3` — engine selection heuristics (the "rule" the
  analyzer is learning)
- `docs/architecture.md §10 §2.5` — Phase 2 exit criteria (gates Phase 3 work)
- `docs/architecture.md §10 §7` — risks (data corruption, abstraction tax,
  migration cost)
- `docs/architecture.md §10 §6` — Phase 3 slice list (Query Log →
  Workload Analyzer → Migration Orchestrator + Redis as second engine
  + DuckDB as third)
- `docs/architecture.md §10` — open design questions
