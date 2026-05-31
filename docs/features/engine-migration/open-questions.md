# Engine Migration — open questions / known unknowns

Open questions split out of [`FEATURE.md`](./FEATURE.md) under D4 (20 KB
cap). Each becomes a follow-up `SK-MIGRATE-NNN` block in `FEATURE.md`
when answered. Cross-engine items are additionally gated on
`docs/phase-plan.md §5` (held-out benchmark + dual-read + Phase 2 exit
metrics) and on `SK-MULTIENG-NNN` for the target engine.

## Intra-engine

### Routing through Pipes (deferred from W5)

- **Read-path routing.** v1 creates Pipes but `/v1/ask` does not route through them. Next SK-MIGRATE picks up adapter-side Pipe lookup by `(schema_hash, query_hash)` and the dispatch decision (always-Pipe / A-B / flag).
- **Pipe deletion lifecycle.** Cold-Pipe drop trigger (cron pass? on-demand?) and inactivity threshold undecided.

### Index advisory follow-ups (from `SK-MIGRATE-007`)

- **Auto-apply.** Whether nlqdb ever runs `CREATE INDEX CONCURRENTLY` itself (user opt-in) or stays advisory permanently; the ground truth from advisory rows is the input.
- **Existing-index de-dup.** Suppressing a suggestion already covered by an existing index (needs a `pg_indexes` read at plan time or promote time).
- **Cost/benefit annotation.** Whether to attach an estimated selectivity / rows-scanned figure to each suggestion, or ship raw DDL only.

## Cross-engine migration (PG ↔ ClickHouse, later PG ↔ Redis / Mongo)

- **Shadow-write path.** Where the shadow write happens (executor / orchestrator / fan-out worker) without moving the primary-write latency budget.
- **Backfill throttling.** Rate limit on backfill against the source DB; how to measure current load.
- **Dual-read sampling rate.** Concrete percentage TBD (`docs/phase-plan.md §5` says "a sample").
- **Divergence handling.** Page recipient + auto-rollback contract (rewind vs freeze) undecided.
- **Atomic cutover.** Per-db routing pointer location (D1 / KV / Durable Object) and flip-consistency guarantee undecided.
- **Rollback procedure.** Post-cutover regression detection; source-engine warm grace window length.

## Schema mapping (cross-engine)

- **PG → ClickHouse translation.** First migration pair; workload-analyser-driven MV path is the principal target (see `SK-MULTIENG-003`). PG ↔ Redis / Mongo deferred.
- **Index translation.** Per-engine index DSLs; the Orchestrator must translate, not just dump rows. (Distinct from `SK-MIGRATE-007`, which is intra-engine PG index *advisory* — this is cross-engine index *translation* during a migration.)
- **Constraint translation.** FK / NOT NULL / CHECK absent natively on Mongo / Redis; location post-migration (validator / app / shadow PG) undecided.

## Verification

- **Held-out benchmark.** Composition, scoring rubric, human-DBA baselines all TBD (Phase 2 exit gate).
- **Chaos testing.** Protocol for "cross-engine migration corrupts data" mitigation undecided.
- **Restore drill cadence.** Whether weekly is enough during a live migration, or tighter loops, undecided.

## User experience (cross-engine)

- **Notification policy.** Email on migration? Probably no for infra events; audit-log-style entry probably yes.
- **Tier-up triggered by migration.** Free-tier DB pushed onto an engine the tier doesn't include — migrate and bill, or surface upgrade path? Pricing interaction open.

## Cross-phase concerns

- **Plan-cache key on cross-engine migration.** `GLOBAL-006` keys plans by `(schema_hash, query_hash)` with no `engine` dimension. Whether old plans survive a Mongo / Redis migration, or the key needs widening, is open.
- **Schema widening across engines.** `GLOBAL-004` was specified for Postgres semantics; Mongo / Redis widening rules TBD.
- **Idempotency-store consistency during migration.** Dual-write idempotency under cutover; replay divergence risk on the new engine.
