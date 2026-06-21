# E-04 — TTL + cron sweep (`expires_at` on memory rows)

**Status:** 🟡 sweep core shipped (run 39) — cron wiring (infra) + read-side RLS clause (E-03-gated) remain
**Sequence:** Engine 4 of 7 · **Risk:** low · **Runs:** 1 · **Prereqs:** E-01 ✅ · **Gate:** none

**Progress (run 39, SK-PIVOT-011):** the deterministic, offline-tested sweep
core shipped — `apps/api/src/memory/expire.ts`: `buildExpirySweep(nowMs)` (the
parameterised `DELETE FROM facts WHERE expires_at IS NOT NULL AND expires_at <
$1 RETURNING id`, `facts`-only, cutoff bound so it's deterministic in tests) +
`orchestrateSweep(deps, dbs)` (filters to memory-preset DBs via
`isAgentMemoryV1Db`, sweeps each with the injected exec, **isolates a per-DB
failure** so the rest still sweep, aggregates the `expiredRows` count the metric
will report). Staged ahead of the two non-pure halves — the scheduled Worker
that drives it (cron schedule = infra) and the read-side TTL *invisibility*
clause on E-03's `facts` RLS policy (E-03-gated). Same shape as E-02
(`buildRememberInsert` shipped ahead of its e2e wiring). 7 unit cases; no prod
path imports it yet, so engine/chain/scorer/baselines are untouched.

## Goal

Give agents the "explicit forget" semantics Mem0/Zep advertise: a memory row
can carry an `expires_at`; a Worker cron sweeps expired rows. Closes a
checkable row on the WS-06 capability matrix that today nlqdb genuinely
doesn't have.

## Scorecard number it moves

`Pivot:` boolean "TTL parity with Mem0/Zep" — flips one matrix cell from
"—" to "✓" honestly. Onboarding (agent-builder reader sees the
explicit-forget story closed).

## Read first

- `apps/events-worker/AGENTS.md` — the cron Worker pattern (we already run
  a scheduled job for events)
- `docs/features/observability/FEATURE.md` — span/metric for the sweep
- `docs/performance.md` — free-tier budget; the sweep must stay inside it

## Mechanism

- **TTL is a `facts`-only concern.** Only `facts` carries an `expires_at`
  column in the shipped E-01 DDL — `episodes` are an append-only conversation
  log and `entities` are long-lived, so neither expires. `nlqdb_remember`
  accepts `ttlSeconds` only for `kind: fact` (rejected on episode/entity at
  validation, GLOBAL-012); when present the insert sets `expires_at = NOW() +
  ttlSeconds * INTERVAL '1 second'` (already shipped in `buildRememberInsert`,
  E-02).
- A scheduled Cloudflare Worker (daily, low-rate) runs
  `DELETE FROM facts WHERE expires_at < NOW()` for every memory-preset DB,
  scoped per-DB so failure is isolated. **`facts` only** — `episodes` /
  `entities` have no `expires_at` to sweep.
- Queries see only non-expired `facts` via the **`agent_isolation` RLS policy**
  (E-03 / SK-PIVOT-009) on the `facts` table gaining an `AND (expires_at IS
  NULL OR expires_at > NOW())` clause in its `USING` expression — *not* a
  compile-layer predicate (the read path is free-form LLM SQL; there is nothing
  to inject into). A clean add on the per-table `facts` policy E-03 creates;
  the `episodes` / `entities` policies are unchanged.

## Steps

1. Migration: confirm `expires_at` exists on `facts` (it does, from E-01's
   DDL). `episodes` / `entities` intentionally have no such column.
2. RLS addition: extend E-03's `agent_isolation` `USING` clause with
   `AND (expires_at IS NULL OR expires_at > NOW())` **on the `facts` policy
   only** (no compile-layer / `sql-validate` change — RLS, not
   query-rewriting).
3. **Sweep core ✅ (run 39)** — `buildExpirySweep` + `orchestrateSweep` (pure,
   per-DB failure isolation, count aggregation). **Remaining:** a new cron
   Worker (or new schedule on `events-worker`) — daily 03:00 UTC — drives
   `orchestrateSweep` over the tenant's memory DBs and emits the
   `nlqdb.memory.expire` span + `nlqdb.memory.expired_rows_total` counter from
   the returned `SweepSummary.expiredRows`. The schedule + exec adapter are
   infra (Neon-reachable Worker), so they land with the deploy.
4. CLI parity (SK-CLI): `nlq remember --ttl 7d` shorthand for `ttlSeconds`
   (**already shipped**, SK-CLI-018; rejected by the server on `--kind
   episode|entity`).
5. Tests: TTL respected on read (`facts` with `expires_at < NOW()` invisible
   even before sweep); sweep deletes the right `facts` rows; no other DB
   touched. Write-side `ttlSeconds` validation (facts-only) is covered now in
   `remember.test.ts`.

## Done when

- [ ] `ttl_seconds` end-to-end (remember → read invisible after expiry → sweep deletes).
- [ ] Sweep emits OTel + metric; isolated per DB.
- [ ] WS-06 matrix flips the TTL/forget cell honestly.
- [ ] Engine INDEX tracker + status ticked.

## Artifact

A short post: "How nlqdb handles agent-memory expiry" → `distribution-queue.md`.

## Rollback

Disable the scheduled sweep; the `expires_at` column + the
`agent_isolation` RLS `USING` TTL clause remain (no data loss; rows simply linger).
