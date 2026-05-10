// Anonymous-mode database sweep (SK-ANON-002 / SK-ANON-012).
//
// Two eviction policies, both running in the daily cron
// (`apps/api/src/index.ts` `scheduled()`):
//
//   1. AGE — anon DBs whose `last_queried_at < now - 90 days`
//      (`SK-ANON-002` retention promise; user-facing "72h to keep
//      it" is the under-promise, server retention is the actual
//      ceiling).
//   2. CAP — when the total count of anon DBs exceeds
//      `ANON_DB_COUNT_CAP`, evict oldest-by-`last_queried_at`
//      until back under cap. Cap is on COUNT, not bytes — Neon Free
//      sizing is byte-based but D1's per-tenant row count is the
//      cheaper proxy. Phase 2 can switch to bytes if usage warrants.
//
// Postgres-side cleanup (DROP SCHEMA on each evicted DB) is NOT in
// this sweep yet — it requires the connection_secret_ref + Neon HTTP
// round-trip per row, which the daily cron's 30-second budget can't
// reliably absorb under load. The D1 row deletion is the user-facing
// truth (the row is what `listDatabasesForTenant` reads, what
// `resolveDb` looks up, what the surface renders); orphan Postgres
// schemas are operator-cleanup territory per `docs/runbook.md §9`.
// A follow-up PR can wire a per-DB schema-drop step using the
// existing `db-create/neon-provision.ts` adapter.
//
// Authed user DBs are NEVER touched here. The sweep's WHERE clauses
// pin to `tenant_id LIKE 'anon:%'` — the principal-id prefix from
// `SK-ANON-008`. Authed `tenant_id` values are user UUIDs; the
// pattern excludes them by construction.

const ANON_TENANT_LIKE = "anon:%";

// 90 days from `last_queried_at`. Promise is 72h; server keeps 90d.
export const ANON_DB_TTL_SECONDS = 90 * 24 * 60 * 60;

// Hard cap on anon-DB row count in D1. Picked an order of magnitude
// below Neon Free's per-branch limit so we have headroom for the
// authed tier alongside. Tunable from the cron call site if a
// product run gets aggressive about anon volume.
export const ANON_DB_COUNT_CAP = 1000;

export type SweepEvictedRow = {
  id: string;
  tenant_id: string;
};

export type SweepResult = {
  evictedByAge: SweepEvictedRow[];
  evictedByCap: SweepEvictedRow[];
  // Snapshot of the post-sweep anon-DB count, so the cron can log /
  // alert on it. Drift between expected (cap) and actual signals a
  // sweep miss (e.g. partial DELETE from D1).
  totalAnonAfter: number;
};

export type SweepOptions = {
  ttlSeconds?: number;
  countCap?: number;
  // Test seam — clamps `Date.now()` so age-eviction is deterministic.
  now?: () => number;
};

export async function sweepAnonDatabases(
  d1: D1Database,
  opts: SweepOptions = {},
): Promise<SweepResult> {
  const ttl = opts.ttlSeconds ?? ANON_DB_TTL_SECONDS;
  const cap = opts.countCap ?? ANON_DB_COUNT_CAP;
  const now = Math.floor((opts.now?.() ?? Date.now()) / 1000);

  // 1. Age-based eviction. `last_queried_at` was backfilled to
  //    `updated_at` in migration 0009; rows that have never been
  //    touched still have a defensible timestamp.
  const ageRes = await d1
    .prepare(
      `DELETE FROM databases
       WHERE tenant_id LIKE ?
         AND last_queried_at < ?
       RETURNING id, tenant_id`,
    )
    .bind(ANON_TENANT_LIKE, now - ttl)
    .all<SweepEvictedRow>();
  const evictedByAge = ageRes.results ?? [];

  // 2. Cap-based eviction. Count after the age sweep so a single
  //    cron run does both passes consistently. If the cap is
  //    already met by the age sweep, this is a no-op.
  const countRow = await d1
    .prepare("SELECT COUNT(*) AS n FROM databases WHERE tenant_id LIKE ?")
    .bind(ANON_TENANT_LIKE)
    .first<{ n: number }>();
  const remaining = countRow?.n ?? 0;

  let evictedByCap: SweepEvictedRow[] = [];
  if (remaining > cap) {
    const overflow = remaining - cap;
    // Evict the oldest by `last_queried_at`. The two-step structure
    // (subquery picks ids, outer DELETE removes them) is required
    // because D1 / SQLite doesn't support `DELETE … LIMIT`. The
    // partial index `idx_databases_anon_last_queried` keeps the
    // ORDER BY scan cheap.
    const capRes = await d1
      .prepare(
        `DELETE FROM databases
         WHERE id IN (
           SELECT id FROM databases
           WHERE tenant_id LIKE ?
           ORDER BY last_queried_at ASC, created_at ASC
           LIMIT ?
         )
         RETURNING id, tenant_id`,
      )
      .bind(ANON_TENANT_LIKE, overflow)
      .all<SweepEvictedRow>();
    evictedByCap = capRes.results ?? [];
  }

  return {
    evictedByAge,
    evictedByCap,
    totalAnonAfter: remaining - evictedByCap.length,
  };
}
