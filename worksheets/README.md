# Worksheets — table-aware classifier rollout

Three parallel work-streams that together fix the
"insert red and blue tables" misclassification (`db_unreachable` on
`/v1/ask`) by giving the cheap-tier classifier table-level context.

| WS | Title | Owner branch (off `main`) | Hard deps | Soft deps |
|---|---|---|---|---|
| [WS1](./WS1-recent-tables-cache.md) | Per-principal recent-tables MRU cache | `claude/ws1-recent-tables` | none | none |
| [WS2](./WS2-merged-routeask.md) | Merge classify + disambiguate into `routeAsk` | `claude/ws2-routeask` | none | WS1 (consumes `RecentTable[]`) |
| [WS3](./WS3-speculative-create.md) | Speculative create on probable-0-dbs | `claude/ws3-speculative-create` | none | WS1 + WS2 (uses cache hint + new `routeAsk` output) |

**No hard ordering needed.** Each WS includes stub instructions for any
soft dep that hasn't merged yet. Land in any order; the last one to
merge resolves the small overlap in `apps/api/src/index.ts` (the
dbId-resolution prelude, ~lines 412–540).

## Shared decisions (settled before worksheets shipped)

- `LLMOperation.classify` is removed; new `route` op replaces it (WS2).
- MRU updates fire on cache-hit too — they track user activity, not LLM activity (WS1).
- Idempotency-Key dedupe entry is evicted on speculative rollback (WS3).
- All worksheet branches start from `origin/main`. SK-* IDs reserved here:
  - **SK-ASK-009** — merged `routeAsk` (WS2)
  - **SK-ASK-010** — recent-tables MRU (WS1)
  - **SK-ASK-011** — speculative create on probable-0-dbs (WS3)

## Skill prereads (mandatory)

Every worksheet's cold agent reads these before touching code:

- `CLAUDE.md` — root
- `docs/features/ask-pipeline/FEATURE.md`
- `docs/features/hosted-db-create/FEATURE.md`
- `docs/features/anonymous-mode/FEATURE.md`
- `docs/decisions/GLOBAL-022-recoverable-failures-retry-to-success.md`
- `docs/skill-conventions.md` (SK-* block format)

## Background — why this work

User typed *"insert red and blue tables"*; classifier picked `destructive`
(thinking SQL `INSERT`) → planner emitted `INSERT INTO red ...` against
non-existent tables → Postgres returned `42P01 undefined_table` →
orchestrator masked it as `db_unreachable`.

The fix is to give the classifier table-level context so ambiguous verbs
("insert / add / put") resolve correctly:

1. **WS1** caches the principal's 100 most-recent tables in KV.
2. **WS2** merges classify+disambiguate into one cheap-tier call that
   consumes the table list and returns `{kind, targetDbId, referencedTables}`.
3. **WS3** speculatively starts the create pipeline when the cache hints
   "probably 0 dbs," in parallel with the authoritative D1 listDb,
   reconciling on resolution.

Out of scope here: the deterministic schema-existence gate +
`GLOBAL-022` recoverable-retry path (the unhappy-path safety net).
Tracked separately; the architecture leaves room for it.
