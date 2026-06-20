# E-04 — TTL + cron sweep (`expires_at` on memory rows)

**Status:** ⬜ not started
**Sequence:** Engine 4 of 7 · **Risk:** low · **Runs:** 1 · **Prereqs:** E-01 ✅ · **Gate:** none

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
3. New cron Worker (or new schedule on `events-worker`) — daily 03:00 UTC.
   Batch `DELETE FROM facts WHERE expires_at < NOW() RETURNING count(*)` per
   memory DB; emit `nlqdb.memory.expire` span + a
   `nlqdb.memory.expired_rows_total` counter.
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
