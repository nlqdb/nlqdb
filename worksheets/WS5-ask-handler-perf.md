# WS5 — `/v1/ask` handler perf + cap-accounting fixes

**Branch:** `claude/ws5-ask-handler-perf` off `origin/main` (PR #146 / SK-ASK-014 already landed in `132768c`).
**SK-ID:** none new — three small refactors using existing seams (SK-DB-010 engine override, SK-ANON-007 cap accounting).
**Hard deps:** PR #146 merged. **Soft deps:** none. Parallel-safe with WS4 / WS6 / WS7; minor merge with WS8.

## Goal

Three independent fixes against the post-146 `apps/api/src/index.ts`. CF Workers wall-time analytics show `/v1/ask kind=create` requests at p50 8-14s. CPU is < 200 ms — the rest is awaited I/O. Two of the three fixes here address that; the third is a correctness bug in cap accounting that bites the **(WS8)** SK-ANON-012 follow-on.

### Fix A — Parallelize the prelude KV+D1 reads

Post-PR #146, the routeAsk prelude does:

```ts
const listPromise = listDatabasesForTenant(c.env.DB, principal.id);   // fires
const recentTablesStore = makeRecentTablesStore(c.env.KV);
const recentTables = await recentTablesStore.load(principal.id);      // awaited sequentially
```

The D1 read and the KV read are independent — they should `Promise.all`. ~50-100 ms saved on cold path.

### Fix B — Skip `classifyEngine` LLM call for anonymous principals

Phase 0/1 ships postgres only (SK-DB-002). `classifyEngine` is the cheap-tier LLM call inside `orchestrateDbCreate` step 0 — it costs ~500-1000 ms per anon create for zero useful information. The SK-DB-010 override seam already exists: pass `engine: "postgres"` on `DbCreateArgs` and `classifyEngine` is skipped (orchestrate.ts:101-106 enforces this contract; engine-classify.test.ts locks the no-mock-call assertion).

The fix is a one-line argument in `runCreatePath()`:

```ts
const result = await orchestrateDbCreate(createDeps, {
  goal: parsed.body.goal,
  tenantId: principal.id,
  engine: parsed.body.engine ?? (principal.kind === "anon" ? "postgres" : undefined),
  secretRef,
});
```

Authenticated users still get the classifier (they may have BYO Phase-4 engines later); anon stays pinned to postgres.

### Fix C — Move `recordCreate()` to after successful provision

`index.ts:373` (in `checkAnonCreateGate`) increments the per-IP create counter BEFORE the orchestrator runs. A failed create (LLM returns `ambiguous_goal`, `plan_invalid`, compile error, etc.) burns the user's per-hour cap. With WS8's SK-ANON-012 lowering the cap to 1 per device, this becomes load-bearing: a single typo-driven failure locks the user out without ever producing a DB.

Move the `recordCreate()` call from inside `checkAnonCreateGate` to after `result.ok === true` in `runCreatePath()` (and in the speculative-create commit branch). Failed creates do not consume the cap.

## Pre-read (mandatory)

- `CLAUDE.md` — root, §2 P5 (simplify), §8 (quality gates)
- `docs/features/ask-pipeline/FEATURE.md` — SK-ASK-009 + SK-ASK-014 (post-146 routing)
- `docs/features/hosted-db-create/FEATURE.md` — SK-HDC-001, SK-DB-010 (engine override seam)
- `docs/features/anonymous-mode/FEATURE.md` — SK-ANON-007 (cap mechanic this fix corrects)
- `apps/api/src/index.ts` — the entire `/v1/ask` handler (~lines 215-700 post-146)
- `apps/api/src/anon-rate-limit.ts` — `recordCreate` semantics
- `apps/api/src/db-create/orchestrate.ts` — `args.engine` override (line ~101)
- `apps/api/src/db-create/engine-classify.test.ts` — locks the no-mock-call contract when engine is set

## Files to modify

| Path | Change |
|---|---|
| `apps/api/src/index.ts` | (A) Replace sequential `listPromise` / `recentTablesStore.load` with `Promise.all`. (B) Add `engine` arg to both `orchestrateDbCreate` call sites (`runCreatePath` and the speculative path). (C) Split `checkAnonCreateGate` into `peekAnonCreateGate` (peek + challenge, no record) and `commitAnonCreate(ip)` (record only). Move the `commit` call to after `result.ok === true` in `runCreatePath`; for the speculative path, commit only on `reconciled.kind === "committed"`. |
| `apps/api/src/db-create/speculative.ts` | If the speculative-create handle exposes a post-commit hook, wire `commitAnonCreate` there; otherwise pass a callback through `reconcileSpeculativeCreate`. |

## Implementation notes

1. **Promise.all ordering.** `routeAsk` consumes `recentTables`; `listDatabasesForTenant`'s output gates `routeAsk.dbs`. Both reads are independent of each other, but `routeAsk` waits on both. Confirm via grep that no caller of `recentTables` runs before the await is needed.

   ```ts
   const recentTablesStore = makeRecentTablesStore(c.env.KV);
   const [recentTables] = await Promise.all([
     recentTablesStore.load(principal.id),
     // listPromise is awaited inside routePromise — kicking it via
     // a no-op .then() here primes the request without changing the
     // routePromise shape.
   ]);
   ```

   The cleaner refactor: fire `listPromise` first (unawaited; routeAsk awaits it), then `Promise.all` the KV read with anything else cold. Concretely the two reads can simply be kicked off in the same statement:

   ```ts
   const listPromise = listDatabasesForTenant(c.env.DB, principal.id);
   const recentTablesPromise = recentTablesStore.load(principal.id);
   // ...later:
   const recentTables = await recentTablesPromise;
   ```

2. **`engine` override for anon — narrow contract.** Pass `"postgres"` literally. Do NOT add a new constant or an "anonDefaultEngine" helper. SK-DB-002 pins Phase-0/1 to postgres; if that ever changes the override moves with the constant.

3. **Cap split semantics.** `peekAnonCreateGate` returns the same `Response | null` shape as today's `checkAnonCreateGate` minus the `recordCreate` side effect. `commitAnonCreate(ip)` is a one-line wrapper around `anonLimiter.recordCreate(ip)` for symmetry. **Auth'd principals: no-op** — both halves return early if `principal.kind !== "anon"`.

4. **Speculative-create + commit.** When the speculative path commits (`reconciled.kind === "committed"`), the orchestrator already produced an `ok` result. Commit the cap there. When it rolls back, do NOT commit — the rolled-back path falls through to the regular dispatch which may take another orchestrator pass (which will commit only on its own success).

5. **OTel spans.** No new spans. The existing `nlqdb.ask.outcome` attribute now also takes values `create_cap_committed_post_provision` (and equivalents) so the operator dashboard can verify the move landed. Optional — only if PERFORMANCE.md §3.2 wants it.

6. **No new branches in the orchestrator.** Per SK-ANON-006 the orchestrator stays free of `principal.kind` checks. All anon-conditional code lives in the route handler.

## Tests required

- `route-ask` tests stay green (no API change to the routing primitives).
- New unit test: `peekAnonCreateGate` returns the right verdict but does NOT call `recordCreate` (mock the limiter, assert call count).
- New unit test: `runCreatePath` happy-path calls `commitAnonCreate(ip)` exactly once when `result.ok === true`.
- New unit test: `runCreatePath` failure path (orchestrator returns `infer_failed`) does NOT call `commitAnonCreate`.
- New unit test: speculative-create committed path calls `commitAnonCreate`; rolled-back path does not.
- New unit test: when `principal.kind === "anon"`, `orchestrateDbCreate` is called with `engine: "postgres"` (regression for fix B). Existing engine-classify mock assertions stay intact.
- New unit test: route-handler prelude fires both `listDatabasesForTenant` and `recentTablesStore.load` in parallel (assert via timing or by checking both promises are pending before either resolves; or simpler — assert both are called before any await).

## Acceptance criteria

- [ ] `bun run typecheck && bun run lint && bun run test` green.
- [ ] Wall-time on a fresh anon create (cold worker, against a Neon dev branch) is ≥ 600 ms faster than baseline. Measure with the same `workersInvocationsAdaptive` GraphQL query the design doc used.
- [ ] No double-counting: integration test that fires three failed creates (intentionally `ambiguous_goal`) followed by a successful one — only the success increments the counter.
- [ ] No regression in `engine-classify.test.ts` (the no-mock-call contract when engine is set).
- [ ] PR description includes the before/after p50 wall-time numbers.

## Out of scope

- Lowering the cap from 5/hr to 1/device — that's WS8 (SK-ANON-012). This worksheet only **moves** the existing accounting, doesn't change the limit.
- Switching the cap key from IP to anon-bearer hash — also WS8.
- Neon batch provisioner — that's WS6.

## Conflict notes for merge

WS5 and WS8 both touch `index.ts`. WS5 lands first (mechanical refactors); WS8 rebases its diff on top. The `peekAnonCreateGate` / `commitAnonCreate` split this worksheet introduces is **load-bearing for WS8** (which switches the peek verdict from a 429 to a 401 `auth_required`).

## Sources

- [Neon serverless driver — Cloudflare Workers guide](https://neon.com/docs/guides/cloudflare-workers) (latency profile motivating fix A)
- Internal: `docs/performance.md §2.3` (prelude budget owner)
