# WS6 — Neon transaction-batch provisioner

**Branch:** `claude/ws6-neon-batch` off `origin/main` (PR #146 / SK-ASK-014 already landed in `132768c`).
**SK-ID reserved:** `SK-HDC-012` — Provisioner batches DDL+RLS+sample-rows into a single Neon HTTP transaction.
**Hard deps:** none. **Soft deps:** none. Parallel-safe.

## Goal

`apps/api/src/db-create/build-deps.ts:93-101` documents the live bug:

> KNOWN INTEGRATION CAVEAT: Neon HTTP is per-request stateless. Sequential `BEGIN; ...; COMMIT;` calls each become a separate HTTP round-trip with no shared transaction.

The provisioner runs ~30 sequential `pg.query()` calls (BEGIN, SET LOCAL, CREATE SCHEMA, role/grant, CREATE TABLE × K, ENABLE RLS × K, CREATE POLICY × K, INSERT × M, COMMIT). Each is its own HTTP round-trip on Neon's serverless driver (~150-300 ms each on cold path), so provision alone takes 4-8 seconds AND the BEGIN/COMMIT is effectively decorative — there is no transactional atomicity.

The Neon serverless driver exposes `sql.transaction([...])` which sends all statements in **one HTTP request** wrapped in a server-side `BEGIN/COMMIT`. The README example shows only SELECTs, but Postgres transactional-DDL semantics ([PostgreSQL wiki — Transactional DDL](https://wiki.postgresql.org/wiki/Transactional_DDL_in_PostgreSQL:_A_Competitive_Analysis)) confirm that CREATE SCHEMA / TABLE / POLICY / INSERT are all transactional, with only `CREATE INDEX CONCURRENTLY` excluded (which our compiler doesn't emit).

This worksheet:

1. **Verifies** the batch semantics with an integration test against a real Neon dev branch.
2. **Switches** `neon-provision.ts` to a single `sql.transaction([...])` batch.

Expected savings: ~4-6 s on the create hot path. Atomic semantics restored as a bonus (today's "transaction" is fake).

## Pre-read (mandatory)

- `CLAUDE.md` — root, P2 (web-research current best practices), §2 P5
- `docs/features/hosted-db-create/FEATURE.md` — SK-HDC-003 (defense-in-depth), SK-HDC-007 (provisioner abstraction), SK-HDC-010 (statement timeouts), SK-HDC-011 (dropSchemaAndRegistry rollback primitive)
- `docs/features/db-adapter/FEATURE.md` — SK-DB-003 (one HTTP request per execute — this worksheet supersedes that *for the provisioner only*, not the read/write path)
- `apps/api/src/db-create/neon-provision.ts` — the file being rewritten
- `apps/api/src/db-create/build-deps.ts` — `buildPgClient` and the caveat comment
- [Neon serverless driver docs](https://neon.com/docs/serverless/serverless-driver) — `transaction()` function signature
- [Neon serverless driver GitHub](https://github.com/neondatabase/serverless) — `transaction()` example
- [Neon serverless CONFIG.md](https://github.com/neondatabase/serverless/blob/main/CONFIG.md) — `isolationMode`, `readOnly`, `deferrable` options
- [PostgreSQL Wiki — Transactional DDL](https://wiki.postgresql.org/wiki/Transactional_DDL_in_PostgreSQL:_A_Competitive_Analysis) — what's transactional, what isn't
- [Neon + Cloudflare Workers guide](https://neon.com/docs/guides/cloudflare-workers) — driver versions, gotchas

## Step 1 — Integration smoke test (gates the migration)

**File:** `apps/api/src/db-create/neon-provision.integration.test.ts` (new — not run in CI; manual + a tagged GH Action step).

The test runs against a **disposable Neon dev branch** (env var `NEON_TEST_BRANCH_URL`) and asserts:

- A batch with `["SET LOCAL statement_timeout = '30s'", "CREATE SCHEMA test_ws6", "CREATE TABLE test_ws6.t (id int)", "INSERT INTO test_ws6.t VALUES (1)"]` executes successfully in one HTTP round-trip (assert via response timing: < 500 ms total when individual statements are < 300 ms).
- The schema + table + row exist after the batch.
- A batch that includes a deliberately broken statement (`CREATE TABLE test_ws6.fail (1invalid)`) rolls back **everything** — `test_ws6` schema is gone after the failure.
- `SET LOCAL statement_timeout` inside the batch is honored (smoke: a batch containing `SET LOCAL statement_timeout = '100ms'; SELECT pg_sleep(1)` rejects within ~150 ms).
- RLS DDL works in a batch: `CREATE TABLE`, `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY` all in one batch — table exists with RLS enabled.

**If any of these fail**, do NOT proceed to Step 2. Open an issue, document what failed, and fall back to the WebSocket Pool driver path (covered in the *Fallback* section below).

The test file should:

- Clean up by dropping `test_ws6*` schemas at start AND end (idempotent — must not fail if schema is absent).
- Be self-contained: no shared fixtures across other tests.
- Skip cleanly if `NEON_TEST_BRANCH_URL` is unset (so CI without secrets passes the unit-test job).

## Step 2 — Provisioner rewrite

**File:** `apps/api/src/db-create/neon-provision.ts` (extensive rewrite of `provisionDb`).

### New shape

Today's `provisionDb` does N sequential `runQuery` calls inside a `tracer.startActiveSpan("db.transaction", ...)` block. The new shape builds a single statement array (with parameterized values for sample-row inserts) and calls `sql.transaction(statements, { isolationMode: "ReadCommitted" })`:

```ts
// pseudo-code; real impl preserves param binding for sample-row inserts
const statements: Array<NeonQueryPromise> = [
  sql`SET LOCAL statement_timeout = '30s'`,
  sql`CREATE SCHEMA ${sql.unsafe(quotedSchema)}`,
  sql`SELECT 1 FROM information_schema.tables WHERE table_schema = ${schemaName} LIMIT 1`,
  // role: DO $$ ... $$ block (no IF NOT EXISTS for CREATE ROLE)
  sql`DO $$ ... $$`,
  sql`GRANT USAGE ON SCHEMA ${sql.unsafe(quotedSchema)} TO ${sql.unsafe(quotedRole)}`,
  // per-table DDL — concatenate compiled DDL strings (already validated by SK-HDC-003)
  ...args.ddl.map(stmt => sql.unsafe(stmt)),
  // per-table RLS
  ...args.plan.tables.flatMap(t => [
    sql`ALTER TABLE ${sql.unsafe(`"${schemaName}"."${t.name}"`)} ENABLE ROW LEVEL SECURITY`,
    sql.unsafe(`CREATE POLICY tenant_isolation ON "${schemaName}"."${t.name}" USING (current_setting('app.tenant_id', true) = '${tenantLiteral}')`),
  ]),
  // sample inserts — keep parameterized
  ...args.plan.sample_rows.map(row => buildInsertSql(sql, schemaName, row)),
];

const result = await sql.transaction(statements, {
  isolationMode: "ReadCommitted",
});
```

### Index DDL caveat (SK-HDC-010)

Today's loop bumps `statement_timeout` to 600s for `CREATE INDEX` statements specifically. The batch can interleave: `SET LOCAL` for the index, then the index, then `SET LOCAL` back. `SET LOCAL` inside a batch transaction scopes correctly because the whole batch is one server-side transaction. Verify in Step 1's smoke test — if the timeout doesn't scope as expected, batch only the non-index DDL and run `CREATE INDEX` statements outside the batch (one round-trip each, but indexes are rare on first provision).

### The populated-schema guard

Today's flow does `CREATE SCHEMA IF NOT EXISTS` followed by `SELECT 1 FROM information_schema.tables` to detect a collision (two tenants minting the same id). In the batch, this becomes a problem: the `SELECT 1` result is available only after the batch completes, but we'd want to abort if it's non-empty.

**Resolution:** drop `IF NOT EXISTS` and let the un-guarded `CREATE SCHEMA` fail with `42P06 duplicate_schema` on a collision. The batch transaction rolls back atomically (no half-created schema). The D1 idempotency gate at the top of `provisionDb` (line 69-75) already catches the prior-run case; this collision can only fire on a true id-suffix collision (1 in 16^6 ≈ 1 in 16M). Cheaper to retry-on-collision in the orchestrator (regenerate suffix, re-batch) than to keep the in-band guard.

If the SK-HDC-007 contract demands the existing reason code `"schema_already_exists"`, parse the Postgres error and map `42P06` → `"schema_already_exists"`. The orchestrator already handles that reason; no caller change needed.

### Rollback semantics

Neon's `transaction()` wraps everything in a server-side `BEGIN/COMMIT`. Any statement failure rolls back the whole batch. `safeRollback` becomes unnecessary — there's nothing to roll back client-side. **Remove** `safeRollback` and the explicit `ROLLBACK` calls; the `try/catch` simplifies to one catch that maps Postgres errors to the existing `ProvisionFailureReason` union.

### `db.transaction` span

Keep the span, but it now wraps one HTTP call instead of N. Span attributes:

- `db.transaction.statement_count` — batch size
- `db.transaction.batch_call` — `true` (vs the old `false` legacy provisioning path, if we keep it as a feature flag)

### Feature flag (optional, recommended)

Wrap the new path in an env-based feature flag (`PROVISION_BATCH_MODE`: `on` / `off`). Default `on` after Step 1 passes; allows quick rollback to per-statement mode if production reveals an issue. Remove the flag two weeks post-deploy.

## SK-HDC-012 block to add (paste into `docs/features/hosted-db-create/FEATURE.md`, after SK-HDC-011)

```markdown
### SK-HDC-012 — Provisioner batches DDL + RLS + sample inserts in a single Neon HTTP transaction

- **Decision:** `apps/api/src/db-create/neon-provision.ts` builds the full provision statement list (`SET LOCAL`, `CREATE SCHEMA`, role + grant, compiled DDL, `ALTER ... ENABLE RLS`, `CREATE POLICY`, sample-row `INSERT`s) into a single `sql.transaction([...], { isolationMode: "ReadCommitted" })` batch. One HTTP round-trip from the Worker to Neon; one server-side `BEGIN/COMMIT`. Per-statement client-side `BEGIN/COMMIT/ROLLBACK` calls are removed.
- **Core value:** Honest latency, Bullet-proof
- **Why:** Neon HTTP is per-request stateless ([driver docs](https://neon.com/docs/serverless/serverless-driver)), so the old sequential `runQuery` loop (~30 HTTP round trips) added ~4-8s of wire latency AND its `BEGIN/COMMIT` calls were no-ops — a failed mid-batch statement left the schema half-created. Postgres transactional DDL ([PostgreSQL wiki](https://wiki.postgresql.org/wiki/Transactional_DDL_in_PostgreSQL:_A_Competitive_Analysis)) guarantees full rollback of `CREATE SCHEMA / TABLE / POLICY / INSERT` in one transaction, with `CREATE INDEX CONCURRENTLY` as the named exception (our compiler doesn't emit `CONCURRENTLY`). Batching restores both speed AND atomicity in one move.
- **Consequence in code:** `provisionDb` builds one `Array<NeonQueryPromise>` and awaits `sql.transaction(arr, opts)`. The integration test in `neon-provision.integration.test.ts` smoke-tests DDL + RLS + INSERT batching against a real Neon dev branch on every CI release-gate run; a failure there blocks the merge. `safeRollback` is removed. The orchestrator retries on `42P06 duplicate_schema` (rare 1-in-16M suffix collision) by regenerating `randomSuffix()`; the in-band `SELECT 1 FROM information_schema.tables` guard is dropped. SK-DB-003 ("one HTTP request per execute") is preserved for the read/write path; only the provisioner takes this batch-shortcut.
- **Alternatives rejected:**
  - Keep per-statement HTTP — preserves the bug forever; today's `BEGIN/COMMIT` is a documentation lie.
  - Switch the entire app to Neon WebSocket Pool — adds TCP setup per cold worker (~200 ms first call, free after); fine, but a bigger refactor than the provisioner needs, and WebSockets have their own CF Workers gotchas (compatibility mode, hibernation).
  - Hyperdrive — Cloudflare's pooler is the obvious "next" answer for production but is a free-tier cost concern (GLOBAL-013) and adds a dependency this skill should land independently of.
```

## Files to create

| Path | Purpose |
|---|---|
| `apps/api/src/db-create/neon-provision.integration.test.ts` | Step 1 smoke test, real Neon branch. Skipped when `NEON_TEST_BRANCH_URL` is unset. |

## Files to modify

| Path | Change |
|---|---|
| `apps/api/src/db-create/neon-provision.ts` | Rewrite `provisionDb`. Remove `runQuery` loop, remove `safeRollback`, remove the `SELECT 1` guard, build one batch. Drop `BEGIN/COMMIT/ROLLBACK` literals. Keep the `db.transaction` OTel span (now wraps the single HTTP call). Map `42P06` → `schema_already_exists`. |
| `apps/api/src/db-create/orchestrate.ts` | If `provisionDb` returns `schema_already_exists`, retry with a fresh `randomSuffix()` (max 3 attempts). Today's behavior errors out — change is acceptable because the collision is 1 in 16M and the new retry is bounded. |
| `apps/api/src/db-create/build-deps.ts` | Update the `buildPgClient` doc comment. Remove the "KNOWN INTEGRATION CAVEAT" block — it no longer applies. Add an SK-HDC-012 reference. |
| `apps/api/src/db-create/neon-provision.test.ts` | Update mock `PgClient` to expect `transaction()` calls instead of `query()`. Existing scenarios (ddl_execution_failed, sample_insert_failed) re-expressed as transaction-level failures. |
| `docs/features/hosted-db-create/FEATURE.md` | Add SK-HDC-012. Update SK-HDC-007's *Consequence in code* with a cross-ref. |
| `docs/features/db-adapter/FEATURE.md` | Add a one-line *Consequence in code* note under SK-DB-003: "Exception: the create-time provisioner batches via `sql.transaction([...])` per SK-HDC-012." |
| `docs/performance.md §3.1` | Update `db.transaction` span row: now wraps a single HTTP call. Update the latency expectation from N×RTT to 1×RTT. |

## Implementation notes

1. **`sql.unsafe` use is intentional.** The compiled DDL strings have already passed `validateCompiledDdl` (SK-HDC-003 layer 2) — they're our own compiler's output, libpg_query parse-validated. The `sql.unsafe` escape hatch is the documented Neon pattern for concatenating pre-validated SQL into a query template.

2. **Sample-row inserts STAY parameterized.** Per SK-HDC-009 point 2, INSERT values use `$N` params. The batch still parameterizes; only DDL uses `sql.unsafe`.

3. **`isolationMode: "ReadCommitted"`** matches Postgres default. We don't need stricter — there's no concurrent reader on a schema being created.

4. **`fetchOptions` cannot be per-statement** ([CONFIG.md](https://github.com/neondatabase/serverless/blob/main/CONFIG.md)). One AbortSignal applies to the whole batch. The route handler's `ctx.executionCtx` already provides the lifetime guard; nothing to wire.

5. **Error mapping.** Neon's `transaction()` rejects with a `NeonDbError` that carries `code` (Postgres SQLSTATE) and `severity`. Map:
   - `42P06` (`duplicate_schema`) → `schema_already_exists`
   - `42P07` (`duplicate_table`) → `ddl_execution_failed`
   - `42501` (`insufficient_privilege`) → `ddl_execution_failed` with `details`
   - everything else → `transaction_failed`
6. **No new branches in the orchestrator beyond the retry-on-collision.** Per CLAUDE.md §2 P5, the retry is one `for (let i = 0; i < 3; i++) { ... if (result.ok || result.error.reason !== "schema_already_exists") return; }` block.

7. **CF Workers nodejs_compat / WASM caveat.** `sql.transaction` runs on the same fetch primitives as `sql.query`. No new compat flags needed. The libpg_query WASM polyfill in `ensureLibpgWasmGlobals` is unaffected.

## Fallback path (if Step 1 fails)

If the smoke test reveals that Neon HTTP `transaction()` doesn't actually support DDL — or that `SET LOCAL` doesn't scope correctly — switch to the Neon WebSocket Pool driver path:

- `import { Pool } from '@neondatabase/serverless'` — same package, different transport.
- One Pool per worker instance, reused across requests (CF Workers WebSocket hibernation handles the idle case).
- `await pool.transaction(async (client) => { await client.query("BEGIN"); ... })` — interactive transaction, real BEGIN/COMMIT on a persistent connection.

Expected latency: TCP+SSL setup ~200 ms on cold worker, < 50 ms per statement thereafter. For a 30-statement provision: ~200 ms + ~1.5 s vs the HTTP batch's single ~500 ms — slower than the batch path but still 3-5× faster than today's per-statement HTTP.

Document the fallback in SK-HDC-012's *Alternatives rejected* as the recovery path; rewrite SK-HDC-012 to reflect the WebSocket Pool decision if that's where we land.

## Tests required

- All existing `neon-provision.test.ts` scenarios pass against the new transaction-based implementation. Mock `PgClient.transaction` instead of `PgClient.query`.
- Integration test (Step 1) — gated by `NEON_TEST_BRANCH_URL` secret; runs in a dedicated CI job.
- Orchestrator retry-on-collision: stub `provisionDb` to return `schema_already_exists` once then succeed; assert the second call sees a different `randomSuffix()`.
- Span instrumentation: `db.transaction` span has `db.transaction.statement_count` and `db.transaction.batch_call=true` attributes.

## Acceptance criteria

- [ ] Step 1 smoke test passes against a real Neon dev branch — DDL, RLS, INSERT all batch, full rollback on error, `SET LOCAL` scopes correctly.
- [ ] `bun run typecheck && bun run lint && bun run test` green (unit tests use mock `PgClient`).
- [ ] Wall-time on a fresh anon create (cold worker, against the same Neon dev branch) is ≥ 3 s faster than baseline. Measure with `workersInvocationsAdaptive` over a 30-min window.
- [ ] SK-HDC-012 documented in `docs/features/hosted-db-create/FEATURE.md`. SK-HDC-007 and SK-DB-003 cross-refs updated. `build-deps.ts` "KNOWN INTEGRATION CAVEAT" comment removed.
- [ ] `db.transaction` OTel span attributes documented in `docs/performance.md §3.1`.
- [ ] PR description names which fallback (HTTP-batch / WebSocket Pool) shipped and why.

## Out of scope

- Hyperdrive integration (a separate, larger decision; tracked in `docs/future/`).
- Switching the read/write `/v1/ask` path to batched/pooled transport — SK-DB-003 still governs read/write. This worksheet is provisioner-only.
- Cross-tenant DDL — not a thing today.

## Sources

- [Neon serverless driver docs — transaction()](https://neon.com/docs/serverless/serverless-driver)
- [Neon serverless driver GitHub README](https://github.com/neondatabase/serverless)
- [Neon serverless CONFIG.md](https://github.com/neondatabase/serverless/blob/main/CONFIG.md)
- [Neon serverless issue #31 — transactions over HTTP](https://github.com/neondatabase/serverless/issues/31)
- [Neon + Cloudflare Workers guide](https://neon.com/docs/guides/cloudflare-workers)
- [PostgreSQL Wiki — Transactional DDL](https://wiki.postgresql.org/wiki/Transactional_DDL_in_PostgreSQL:_A_Competitive_Analysis)
- [Choosing your Neon connection method](https://neon.com/docs/connect/choose-connection)
