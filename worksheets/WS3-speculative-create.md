# WS3 — Speculative create on probable-0-dbs

**Branch:** `claude/ws3-speculative-create` off `origin/main`
**SK-ID reserved:** `SK-ASK-011`
**Hard deps:** none. **Soft deps:** WS1 (`loadRecentTables`) + WS2 (`routeAsk` output shape).

## Goal

When the cached signal suggests "this principal has 0 dbs," kick off the
db.create pipeline immediately, in parallel with the authoritative D1
`listDatabasesForTenant`. Reconcile when the D1 read lands: 0 dbs →
commit; >0 dbs → rollback (DROP SCHEMA + DELETE registry row + evict
idempotency entry) and route to disambiguate.

## Pre-read (mandatory)

- `apps/api/src/db-create/orchestrate.ts` — the create pipeline you wrap
- `apps/api/src/db-create/neon-provision.ts` — `dropSchemaBestEffort` (private; you'll expose it) + the registry-insert-failed compensation flow
- `apps/api/src/index.ts` lines ~412–540 — the prelude where speculation slots in (this is also WS2's territory; coordinate at merge)
- `apps/api/src/ask/disambiguate-db.ts` — pattern for KV-cached optional pre-LLM short-circuit
- `docs/features/ask-pipeline/FEATURE.md` SK-ASK-003
- `docs/features/hosted-db-create/FEATURE.md` SK-HDC-001..010 (especially SK-HDC-007 the provisioner abstraction)
- `docs/decisions/GLOBAL-005-idempotency-key.md` (you evict the dedupe entry on rollback)
- `docs/decisions/GLOBAL-014-otel-span.md`
- `docs/performance.md §3.1, §3.2`

## Interface contracts

### Trigger predicate (pure)

```ts
// apps/api/src/ask/route-hint.ts

import type { RecentTable } from "./recent-tables.ts";  // WS1; see soft-dep stub

// Returns true when the cached signals suggest the principal has 0 dbs
// and the goal is plausibly a create. Defensive false-positives are
// fine (we just speculate and roll back); false-negatives lose the win.
export function probablyZeroDbs(recentTables: RecentTable[], goal: string): boolean;
```

Heuristic: `recentTables.length === 0` AND no slug-substring hint in `goal`. Unit-tested in isolation.

### Speculative create primitive

```ts
// apps/api/src/db-create/speculative.ts

export type SpeculativeHandle = {
  result: Promise<DbCreateResult>;        // the normal create outcome
  rollback(idempotencyKey?: string): Promise<void>;  // post-COMMIT compensation; idempotent
};

export function startSpeculativeCreate(
  deps: DbCreateDeps & { idempotencyStore?: IdempotencyStore },
  args: DbCreateArgs,
): SpeculativeHandle;
```

`rollback()`:
1. If `result` hasn't resolved yet, await it (we don't try to abort mid-create).
2. If create failed, no-op (nothing to roll back).
3. If create succeeded, run `DROP SCHEMA "<schemaName>" CASCADE` + `DELETE FROM databases WHERE id = ?` (mirrors `dropSchemaAndRegistry` — see file changes).
4. If `idempotencyKey` provided, delete the dedupe entry so retries take the disambiguate path.
5. Wrapped in `nlqdb.create.speculative.rollback` span; counter `nlqdb.create.speculative.rollback_total{principal_kind, reason}` increments.

### Reconciler

```ts
// apps/api/src/ask/reconcile-speculative.ts

export type ReconcileInput = {
  speculative: SpeculativeHandle;
  authoritativeDbs: DatabaseSummaryRow[];
  goal: string;
  principal: Principal;
  idempotencyKey?: string;
};

export async function reconcileSpeculativeCreate(
  input: ReconcileInput,
): Promise<{ kind: "committed"; result: DbCreateResult } | { kind: "rolled_back"; dbs: DatabaseSummaryRow[] }>;
```

The handler then either returns the create response (committed) or hands `dbs` to the disambiguate path (rolled-back).

## Soft-dep stubs (if WS1 / WS2 not merged yet)

- **WS1 not merged:** the trigger predicate's `recentTables` arg is always `[]`. `probablyZeroDbs([], goal)` returns `true` for any goal whose words don't appear in any db slug — degrades to "always speculate when no slug hint." Fine; just slightly more rollback churn until WS1 lands.
- **WS2 not merged:** the reconciler still works against today's `classifyKind` + `disambiguateDb` output. The dispatch is "if classifier says create AND speculation is committed, return its result; if rolled back, fall through to disambiguate as today."

## Files to create

| Path | Purpose |
|---|---|
| `apps/api/src/ask/route-hint.ts` | Pure trigger predicate |
| `apps/api/src/ask/route-hint.test.ts` | Vitest |
| `apps/api/src/db-create/speculative.ts` | Handle + rollback |
| `apps/api/src/db-create/speculative.test.ts` | Vitest covering commit + rollback + idempotency eviction |
| `apps/api/src/ask/reconcile-speculative.ts` | Commit/rollback dispatcher |
| `apps/api/src/ask/reconcile-speculative.test.ts` | Vitest |

## Files to modify

| Path | Change |
|---|---|
| `apps/api/src/db-create/neon-provision.ts` | Promote `dropSchemaBestEffort` to a named export `dropSchemaAndRegistry(deps, dbId, schemaName)` that does both `DROP SCHEMA CASCADE` and `DELETE FROM databases WHERE id = ?`. The existing private `dropSchemaBestEffort` becomes a callsite of the new export. |
| `apps/api/src/index.ts` | Add the speculation branch to the prelude. When `probablyZeroDbs(recentTables, goal)`, kick off `startSpeculativeCreate` before awaiting the route/classify result. After `listDatabasesForTenant` lands, call `reconcileSpeculativeCreate`. (Coordinates with WS2's rewrite of the same region.) |
| `docs/features/ask-pipeline/FEATURE.md` | Add SK-ASK-011 block (template below). |
| `docs/features/hosted-db-create/FEATURE.md` | Add `SK-HDC-NNN` for the rollback primitive — see template. Pick the next free SK-HDC-NNN (last is SK-HDC-010 at time of writing). |
| `docs/performance.md §3.1` | Add `nlqdb.create.speculative` parent + `.rollback` child span rows. |
| `docs/performance.md §3.2` | Add metric rows: `nlqdb.create.speculative.start_total`, `.commit_total`, `.rollback_total{reason}`, histogram `nlqdb.create.speculative.overhead_ms`. |
| `packages/otel/**` | Add metric helpers if not already present (`createSpeculativeStartCounter`, `createSpeculativeRollbackCounter`, `createSpeculativeOverheadHistogram`). |

## Implementation notes

1. **No mid-create abort.** Postgres transactions on Workers can't be cancelled cleanly across an LLM-tier latency window. Rollback waits for `result` to resolve, then compensates if it succeeded.
2. **Idempotency eviction.** Per GLOBAL-005 the dedupe entry stores the response. On rollback, delete the entry (`Idempotency-Key`-keyed KV record); subsequent retry runs the disambiguate path. Confirm the dedupe-store interface; if it doesn't expose a delete primitive, add one as part of this WS.
3. **pgvector cleanup.** `embedTableCards` is currently a no-op (`build-deps.ts:77`). When real embedding lands, table-card rows live in pgvector tables; if those are inside the schema, `DROP SCHEMA CASCADE` covers them. If global, add explicit cleanup. **Document this assumption** in the SK-* block so the embedding PR remembers.
4. **pkLive note.** Today the provisioner returns `pkLive: null` (api-keys subsystem not wired). When that lands, rollback must also revoke the minted key. **Flag in SK-* alternatives.**
5. **Race resolution.** `listDatabasesForTenant` is a single D1 query (~10–30 ms); the create pipeline is ~800 ms. listDb almost always lands first. The reconciler awaits both; commit/rollback decision is deterministic at that point.
6. **Optimization (deferred).** Could check `listDb` mid-create (before `provision()` step 5) to abort earlier. Skip — rare rollback case doesn't justify the complexity.
7. **No new conditional branches in the orchestrator.** Per SK-ANON-006, no `if (kind === "anon")`. The cache key, principal id, and metrics all flow through unchanged. Anon and authed principals get the same rollback treatment.

## SK-ASK-011 block (paste into `docs/features/ask-pipeline/FEATURE.md` Decisions, after SK-ASK-010)

```markdown
### SK-ASK-011 — Speculative create on probable-0-dbs (cache-stale defense)

- **Decision:** When `probablyZeroDbs(recentTables, goal)` returns true on `/v1/ask`, the handler kicks off `startSpeculativeCreate` in parallel with the authoritative `listDatabasesForTenant` D1 read. The reconciler commits the create when D1 confirms 0 dbs; on D1 returning ≥ 1 dbs, the reconciler issues `DROP SCHEMA CASCADE` + `DELETE FROM databases` + evicts the request's `Idempotency-Key` dedupe entry, then routes the request through the disambiguate path.
- **Core value:** Bullet-proof, Fast
- **Why:** A stale or empty cache (`recentTables` is the most likely culprit) can falsely suggest 0 dbs. Pure serial "list-then-create" loses the create-pipeline parallelism on the genuine cold-start path. Speculating preserves cold-start latency while making the duplicate-create case impossible — the rollback closes the hole even when the cache lies. `Idempotency-Key` eviction prevents a retry from returning a rolled-back create response.
- **Consequence in code:** Three small modules: `apps/api/src/ask/route-hint.ts` (predicate), `apps/api/src/db-create/speculative.ts` (handle + rollback), `apps/api/src/ask/reconcile-speculative.ts` (dispatcher). Each function ≤ 30 lines; PRs that fold them back into a single function fail review. Spans `nlqdb.create.speculative.{start,commit,rollback}` and metric `nlqdb.create.speculative.overhead_ms` (per `GLOBAL-014`) drive a dashboard alert at rollback rate > 0.1 % / hour.
- **Alternatives rejected:**
  - Trust the cache only — duplicate creates on stale cache; user-visible bug.
  - Always serial — biggest cold-start latency hit; create is the slowest step (~800 ms).
  - Defer the create's COMMIT until reconcile — holds a Postgres connection across LLM-tier latency; Workers can't sustain that pattern.
  - Skip Idempotency-Key eviction — retry returns the rolled-back response; dedupe store lies.

**Open follow-ups (track in skill Open questions):**
- pgvector card cleanup on rollback when embedding lands (today `embedTableCards` is no-op).
- pk_live revocation on rollback when the api-keys subsystem ships.
```

## SK-HDC-NNN block (paste into `docs/features/hosted-db-create/FEATURE.md` Decisions, next free number)

```markdown
### SK-HDC-NNN — `dropSchemaAndRegistry` is the single rollback primitive (idempotent, best-effort, paired Postgres + D1)

- **Decision:** `apps/api/src/db-create/neon-provision.ts` exports `dropSchemaAndRegistry(deps, dbId, schemaName)`. It runs `DROP SCHEMA "<schemaName>" CASCADE` followed by `DELETE FROM databases WHERE id = ?`. Both steps are idempotent and best-effort: a missing schema or row is not an error. SK-ASK-011's speculative rollback and the existing registry-insert-failed compensation both call this primitive.
- **Core value:** Simple, Bullet-proof
- **Why:** Two callsites that both compensate "we provisioned a schema and need to undo it" must use the same primitive — divergence here is how partial-rollback bugs land. Idempotency means retries (manual operator intervention or future automated sweeps) can call this freely. Best-effort means a transient Postgres error doesn't strand the registry row in a half-rolled-back state — the orphan sweep job picks up either side.
- **Consequence in code:** Both `provisionDb`'s registry-insert-failed branch and `SpeculativeHandle.rollback()` call `dropSchemaAndRegistry`. Tests cover: schema present + row present (full rollback), schema missing (DELETE still runs), row missing (DROP still runs), both missing (no-op). PRs that introduce a third compensation path fail review.
- **Alternatives rejected:**
  - Inline both compensation flows — drift; the next bug is half-rollback because one callsite forgot the D1 delete.
  - Make rollback transactional across PG + D1 — no two-phase commit primitive in this stack; the existing provision flow already accepts the orphan-schema-on-D1-failure pattern (see `neon-provision.ts` header comment).
```

## Performance.md additions

§3.1 — add rows:

| `nlqdb.create.speculative.start` | parent span; speculative create kicked off (label `principal_kind`). |
| `nlqdb.create.speculative.rollback` | child; rollback path (label `reason`). |

§3.2 — add rows:

| `nlqdb.create.speculative.start_total` | counter (label `principal_kind`). |
| `nlqdb.create.speculative.commit_total` | counter (label `principal_kind`). |
| `nlqdb.create.speculative.rollback_total` | counter (labels `principal_kind`, `reason ∈ {"dbs_appeared"}`). |
| `nlqdb.create.speculative.overhead_ms` | histogram of `(speculative_done_ts - authoritative_done_ts)`. Negative = win; positive = pure overhead. |

Alert: rollback rate > 0.1 % / hour sustained → cache or trigger heuristic regression.

## Tests required

- **Predicate:** `probablyZeroDbs([], "create a tracker")` → true.
- **Predicate:** `probablyZeroDbs([{table:"users",...}], "show users")` → false.
- **Speculative commit path:** dbs=0 from D1, create succeeds → reconciler returns `committed`.
- **Speculative rollback path:** dbs=[…1 entry…], create succeeded → reconciler calls `rollback`, returns `rolled_back` with the dbs list.
- **Rollback idempotency:** calling rollback twice runs DROP/DELETE only once (or both no-ops; either is acceptable).
- **Idempotency eviction:** rollback with `idempotencyKey` set → dedupe entry deleted from KV.
- **Create failure during speculation:** speculative `result` rejects → reconciler propagates as a normal create failure, no rollback work.
- **D1 read fails:** reconciler still has speculative result; for safety, either commit (cache was probably right) or rollback. **Decision:** rollback — fail safe. Test it.
- **Metrics:** `start_total` increments on every speculative kick; `commit_total` on commit; `rollback_total{reason="dbs_appeared"}` on dbs-found rollback.

## Acceptance criteria

- [ ] Three small modules shipped with full test coverage; each function ≤ 30 lines.
- [ ] `dropSchemaAndRegistry` exported and used from both compensation sites in `neon-provision.ts`.
- [ ] `apps/api/src/index.ts` adds the speculation branch in the prelude.
- [ ] SK-ASK-011 + SK-HDC-NNN added; `docs/performance.md §3.1, §3.2` updated.
- [ ] Idempotency-Key dedupe store exposes a delete primitive (add if missing).
- [ ] `bun run typecheck && bun run lint && bun run test` green.
- [ ] Bundle delta ≤ 3 KB compressed.
- [ ] Manual smoke: type "make me an orders tracker" on a fresh anon principal → speculative commits; type same on a principal with 1 db → speculative rolls back.

## Out of scope

- The MRU cache (WS1).
- The merged routeAsk classifier (WS2).
- pgvector card cleanup (deferred until real embedding lands).
- pk_live revocation (deferred until api-keys subsystem ships).
- Mid-create abort optimization (rare case; complexity not justified).
