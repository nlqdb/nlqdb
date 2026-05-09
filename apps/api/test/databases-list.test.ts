// Unit tests for `listDatabasesForTenant` and the `toSummary` mapper.
// D1 is stubbed at the prepared-statement level (matches the
// pattern in anon-adopt.test.ts) so the test asserts the SQL,
// parameter binding, and row → summary shape without Miniflare.

import { describe, expect, it, vi } from "vitest";
import { listDatabasesForTenant, toSummary } from "../src/databases/list.ts";

type Row = { id: string; engine: string; created_at: number };

function stubDb(rows: Row[]): {
  d1: D1Database;
  prepare: ReturnType<typeof vi.fn>;
  bind: ReturnType<typeof vi.fn>;
} {
  const all = vi.fn().mockResolvedValue({ results: rows });
  const bind = vi.fn().mockReturnValue({ all });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { d1: { prepare } as unknown as D1Database, prepare, bind };
}

describe("toSummary", () => {
  it("derives slug by stripping db_ prefix and turning underscores into dashes", () => {
    expect(
      toSummary({ id: "db_orders_tracker_a4fxyz", engine: "postgres", created_at: 1700000000 }),
    ).toEqual({
      id: "db_orders_tracker_a4fxyz",
      slug: "orders-tracker-a4fxyz",
      engine: "postgres",
      pkLive: null,
      lastQueriedAt: null,
      createdAt: 1700000000,
    });
  });

  it("keeps the raw id (minus prefix) when there are no underscores", () => {
    expect(toSummary({ id: "db_simple", engine: "postgres", created_at: 1 }).slug).toBe("simple");
  });

  it("survives ids that don't carry the db_ prefix", () => {
    expect(toSummary({ id: "legacy_id", engine: "postgres", created_at: 1 }).slug).toBe(
      "legacy-id",
    );
  });

  it("returns the engine column verbatim when allowed (clickhouse)", () => {
    expect(toSummary({ id: "db_events_a1", engine: "clickhouse", created_at: 1 }).engine).toBe(
      "clickhouse",
    );
  });

  it("falls back to postgres for legacy / unknown engine strings", () => {
    expect(toSummary({ id: "db_legacy_x", engine: "mysql", created_at: 1 }).engine).toBe(
      "postgres",
    );
    expect(toSummary({ id: "db_legacy_y", engine: "", created_at: 1 }).engine).toBe("postgres");
  });
});

describe("listDatabasesForTenant", () => {
  it("scopes by tenant_id and returns rows mapped to the SDK summary shape", async () => {
    const { d1, prepare, bind } = stubDb([
      { id: "db_meal_planner_7c2abc", engine: "postgres", created_at: 1700000200 },
      { id: "db_orders_tracker_a4fxyz", engine: "clickhouse", created_at: 1700000100 },
    ]);
    const out = await listDatabasesForTenant(d1, "user_1");
    expect(prepare).toHaveBeenCalledWith(
      "SELECT id, engine, created_at FROM databases WHERE tenant_id = ? ORDER BY created_at DESC",
    );
    expect(bind).toHaveBeenCalledWith("user_1");
    expect(out).toEqual([
      {
        id: "db_meal_planner_7c2abc",
        slug: "meal-planner-7c2abc",
        engine: "postgres",
        pkLive: null,
        lastQueriedAt: null,
        createdAt: 1700000200,
      },
      {
        id: "db_orders_tracker_a4fxyz",
        slug: "orders-tracker-a4fxyz",
        engine: "clickhouse",
        pkLive: null,
        lastQueriedAt: null,
        createdAt: 1700000100,
      },
    ]);
  });

  it("returns [] when the tenant has no databases", async () => {
    const { d1 } = stubDb([]);
    expect(await listDatabasesForTenant(d1, "user_1")).toEqual([]);
  });

  it("treats a missing `results` field as an empty list", async () => {
    const all = vi.fn().mockResolvedValue({});
    const bind = vi.fn().mockReturnValue({ all });
    const prepare = vi.fn().mockReturnValue({ bind });
    const d1 = { prepare } as unknown as D1Database;
    expect(await listDatabasesForTenant(d1, "user_1")).toEqual([]);
  });
});
