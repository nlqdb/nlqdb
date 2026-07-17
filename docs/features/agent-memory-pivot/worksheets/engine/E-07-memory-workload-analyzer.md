# E-07 — Workload-analyzer rule for memory DBs

**Status:** ⬜ not started
**Sequence:** Engine 7 of 8 · **Risk:** med · **Runs:** multi · **Prereqs:** E-01 ✅; depends on `multi-engine-adapter` / `engine-migration` features (Phase 3) · **Gate:** waits on Phase-3 multi-engine landing

## Goal

Connect the wedge to the **engine north-star data-engine pillar**
(GLOBAL-025). The Workload Analyzer that motivates Phase 3 needs a memory-DB
rule: as a memory DB accumulates facts, its workload tilts from `INSERT` +
narrow recall toward analytical aggregation — the exact shape ClickHouse
exists for. This worksheet adds the rule so the moat compounds: nlqdb
doesn't just *say* it's the analytical-memory layer, it **moves your memory
to the right engine when you need it**.

## Why this is the last engine slice

- Multi-engine adapter + workload analyzer + migration orchestrator are
  Phase 3 (`docs/phase-plan.md §5`); this slice lands once they do.
- It's gated on Phase 3 anyway — it can be **specced now** but not shipped
  before the underlying machinery.
- Until then, E-07 is the **documentation** that the data-engine pillar
  has a memory-shaped first customer.

## Scorecard number it moves

`Pivot:` boolean "memory workload rule specced" (now) → "memory workload
rule live" (Phase 3). Engine north-star data-engine pillar gets a concrete
first-mover use case.

## Read first

- `docs/features/multi-engine-adapter/FEATURE.md`
- `docs/features/engine-migration/FEATURE.md`
- `docs/decisions/GLOBAL-025-north-star.md` — engine-quality data-engine layer
- `apps/api/src/workload-analyser/**` (when it lands)
- `packages/db/src/clickhouse-tinybird/pipe-management.ts`

## The rule (specced now)

A memory DB enters the migration-candidate set when **both**:
- `facts` row count ≥ `MEMORY_TO_CLICKHOUSE_FACTS_THRESHOLD` (initial
  guess: 1M), **and**
- last-30d query mix has analytical share (`GROUP BY` / window /
  aggregation) ≥ 50% by count.

Recommended target: ClickHouse via Tinybird. Migration plan:
- Migrate `facts` and `episodes` (the high-volume rows) to ClickHouse.
- Keep `entities` + `entity_facts` (low-volume, mutation-heavy) in
  Postgres.
- Cross-engine read verification per `engine-migration` SK rules.

## Steps

1. **Now — spec only.** Append the rule above as `SK-MULTIENG-*` (in
   `multi-engine-adapter/FEATURE.md`) and an `SK-ENGMIG-*` (in
   `engine-migration/FEATURE.md`) cross-ref. Update the Phase 3 exit gate
   to include "memory-DB rule has a passing dual-read verification."
2. **Once Phase 3 ships — implement.** Workload-analyser classifier
   detects memory presets via `schema_hash` lineage; migration orchestrator
   handles the split layout (Postgres for low-volume, ClickHouse for
   high-volume); cross-engine read returns identical rows.
3. Acceptance: the memory rule is **the first Phase 3 auto-migration**
   landed (proof point for the data-engine pillar).

## Done when

**Spec phase (this round):**
- [ ] Rule documented as `SK-MULTIENG-*` + `SK-ENGMIG-*` with the threshold
      values, target engine, layout split.
- [ ] Phase 3 exit gate updated to include the memory-DB migration.

**Implementation phase (Phase 3, separately):**
- [ ] Workload-analyser classifier flags memory DBs that meet the rule.
- [ ] Auto-migration succeeds with dual-read verification == 100%.
- [ ] One real memory DB migrated; user-visible downtime = 0.

## Artifact

A "how nlqdb scales agent memory automatically" doc page →
`distribution-queue.md` (queued for after the Phase-3 implementation).

## Rollback

Spec is documentation only — revertable by removing the decisions. The
implementation phase is gated by the existing Phase-3 rollback machinery
(dual-read divergence pages on-call; failed cutover blocks rollover).
