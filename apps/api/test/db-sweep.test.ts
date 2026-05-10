// Sweep behaviour for SK-ANON-002 / SK-ANON-012:
//   • Age sweep: only anon rows past TTL are evicted; authed rows
//     and recent anon rows untouched.
//   • Cap sweep: oldest-by-`last_queried_at` removed first; authed
//     rows never touched even if they outnumber the cap.
//   • The two sweeps compose: a cap sweep runs against the
//     post-age count, not the pre-age one.
//
// Uses an in-memory D1 stand-in keyed by id, sufficient for the
// SQL surface this module relies on (LIKE pattern, ORDER BY, LIMIT,
// RETURNING). Real D1 tested by the integration harness (apps/api).

import { describe, expect, it } from "vitest";
import { sweepAnonDatabases } from "../src/db-sweep/sweep.ts";

type Row = {
  id: string;
  tenant_id: string;
  last_queried_at: number;
  created_at: number;
};

function makeStubD1(initial: Row[]): D1Database {
  let rows = [...initial];

  function isAnon(t: string): boolean {
    return t.startsWith("anon:");
  }

  return {
    prepare(sql: string) {
      const params: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          params.push(...args);
          return stmt;
        },
        async run() {
          return { success: true, meta: {} };
        },
        async first<T>() {
          if (sql.includes("SELECT COUNT(*)")) {
            const n = rows.filter((r) => isAnon(r.tenant_id)).length;
            return { n } as unknown as T;
          }
          return null;
        },
        async all<T>() {
          if (sql.includes("DELETE FROM databases") && sql.includes("last_queried_at <")) {
            const cutoff = params[1] as number;
            const evicted = rows.filter((r) => isAnon(r.tenant_id) && r.last_queried_at < cutoff);
            rows = rows.filter((r) => !evicted.includes(r));
            return { results: evicted as unknown as T[], success: true, meta: {} };
          }
          if (sql.includes("DELETE FROM databases") && sql.includes("ORDER BY")) {
            const limit = params[1] as number;
            const candidates = rows
              .filter((r) => isAnon(r.tenant_id))
              .sort((a, b) =>
                a.last_queried_at - b.last_queried_at !== 0
                  ? a.last_queried_at - b.last_queried_at
                  : a.created_at - b.created_at,
              );
            const evicted = candidates.slice(0, limit);
            rows = rows.filter((r) => !evicted.includes(r));
            return { results: evicted as unknown as T[], success: true, meta: {} };
          }
          return { results: [] as T[], success: true, meta: {} };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
}

const NOW = 2_000_000_000; // fixed clock — easier to reason about than Date.now()
const TTL = 90 * 24 * 60 * 60;

describe("sweepAnonDatabases — age", () => {
  it("evicts anon rows past TTL but leaves recent ones", async () => {
    const d1 = makeStubD1([
      { id: "db_old", tenant_id: "anon:aaa", last_queried_at: NOW - TTL - 10, created_at: 0 },
      { id: "db_fresh", tenant_id: "anon:bbb", last_queried_at: NOW - 60, created_at: 0 },
    ]);
    const r = await sweepAnonDatabases(d1, { now: () => NOW * 1000 });
    expect(r.evictedByAge.map((x) => x.id)).toEqual(["db_old"]);
    expect(r.evictedByCap).toEqual([]);
    expect(r.totalAnonAfter).toBe(1);
  });

  it("never touches authed rows even if their last_queried_at is ancient", async () => {
    const d1 = makeStubD1([
      { id: "db_authed", tenant_id: "user_42", last_queried_at: 0, created_at: 0 },
      { id: "db_anon_old", tenant_id: "anon:aaa", last_queried_at: NOW - TTL - 1, created_at: 0 },
    ]);
    const r = await sweepAnonDatabases(d1, { now: () => NOW * 1000 });
    expect(r.evictedByAge.map((x) => x.id)).toEqual(["db_anon_old"]);
    expect(r.evictedByCap).toEqual([]);
  });
});

describe("sweepAnonDatabases — cap", () => {
  // Timestamps inside the TTL window so age-sweep doesn't evict them
  // — only the cap-sweep should bite.
  const T1 = NOW - 100;
  const T2 = NOW - 80;
  const T3 = NOW - 60;
  const T4 = NOW - 40;

  it("evicts oldest-by-last_queried_at when over cap", async () => {
    const d1 = makeStubD1([
      { id: "db_a", tenant_id: "anon:1", last_queried_at: T1, created_at: T1 },
      { id: "db_b", tenant_id: "anon:2", last_queried_at: T2, created_at: T2 },
      { id: "db_c", tenant_id: "anon:3", last_queried_at: T3, created_at: T3 },
      { id: "db_d", tenant_id: "anon:4", last_queried_at: T4, created_at: T4 },
    ]);
    const r = await sweepAnonDatabases(d1, { now: () => NOW * 1000, countCap: 2 });
    expect(r.evictedByAge).toEqual([]);
    expect(r.evictedByCap.map((x) => x.id).sort()).toEqual(["db_a", "db_b"]);
    expect(r.totalAnonAfter).toBe(2);
  });

  it("does NOT evict authed rows even when total exceeds cap", async () => {
    const d1 = makeStubD1([
      { id: "db_anon_old", tenant_id: "anon:1", last_queried_at: T1, created_at: T1 },
      { id: "db_user_a", tenant_id: "user_a", last_queried_at: T1 - 10, created_at: T1 - 10 },
      { id: "db_user_b", tenant_id: "user_b", last_queried_at: T1 - 5, created_at: T1 - 5 },
    ]);
    const r = await sweepAnonDatabases(d1, { now: () => NOW * 1000, countCap: 0 });
    expect(r.evictedByCap.map((x) => x.id)).toEqual(["db_anon_old"]);
    // user_a / user_b must survive — older than the anon row but
    // not anon-tagged.
  });

  it("no-op when under cap", async () => {
    const d1 = makeStubD1([
      { id: "db_a", tenant_id: "anon:1", last_queried_at: T1, created_at: T1 },
    ]);
    const r = await sweepAnonDatabases(d1, { now: () => NOW * 1000, countCap: 10 });
    expect(r.evictedByCap).toEqual([]);
    expect(r.totalAnonAfter).toBe(1);
  });
});

describe("sweepAnonDatabases — composition", () => {
  it("cap sweep runs against the post-age count", async () => {
    // Two old (will be evicted by age), three recent (one evicted by cap=2).
    const d1 = makeStubD1([
      { id: "old1", tenant_id: "anon:1", last_queried_at: 0, created_at: 0 },
      { id: "old2", tenant_id: "anon:2", last_queried_at: 0, created_at: 0 },
      { id: "fresh1", tenant_id: "anon:3", last_queried_at: NOW - 100, created_at: 100 },
      { id: "fresh2", tenant_id: "anon:4", last_queried_at: NOW - 50, created_at: 200 },
      { id: "fresh3", tenant_id: "anon:5", last_queried_at: NOW - 10, created_at: 300 },
    ]);
    const r = await sweepAnonDatabases(d1, { now: () => NOW * 1000, countCap: 2 });
    expect(r.evictedByAge.map((x) => x.id).sort()).toEqual(["old1", "old2"]);
    // After age, 3 anon rows remain. Cap=2 → evict the oldest of the
    // fresh ones (fresh1).
    expect(r.evictedByCap.map((x) => x.id)).toEqual(["fresh1"]);
    expect(r.totalAnonAfter).toBe(2);
  });
});
