// Recent-tables MRU + libpg_query extraction tests. Stub Storage
// asserts the LRU contract; live libpg_query (via the wasm-shim
// alias in vitest.config.ts) asserts the table-name walker on
// representative SQL shapes.

import { describe, expect, it, vi } from "vitest";
import type { KVStore } from "../kv-store.ts";
import {
  extractTables,
  makeRecentTablesStore,
  type RecentTable,
  tablesFromSchemaText,
} from "./recent-tables.ts";

function makeStore(): KVStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value) {
      data.set(key, value);
    },
  };
}

describe("makeRecentTablesStore", () => {
  it("load() on an unknown principal returns []", async () => {
    const store = makeRecentTablesStore(makeStore());
    expect(await store.load("user:u_1")).toEqual([]);
  });

  it("touch() with empty tables is a no-op (no KV write)", async () => {
    const kv = makeStore();
    const store = makeRecentTablesStore(kv);
    await store.touch("user:u_1", "db_1", "db-1", []);
    expect(kv.data.size).toBe(0);
  });

  it("round-trips: touch → load returns entries in touchedAt desc order", async () => {
    vi.useFakeTimers();
    try {
      const store = makeRecentTablesStore(makeStore());
      vi.setSystemTime(1_000);
      await store.touch("user:u_1", "db_1", "db-1", ["alpha"]);
      vi.setSystemTime(2_000);
      await store.touch("user:u_1", "db_1", "db-1", ["beta"]);
      vi.setSystemTime(3_000);
      await store.touch("user:u_1", "db_1", "db-1", ["gamma"]);

      const loaded = await store.load("user:u_1");
      expect(loaded.map((e) => e.table)).toEqual(["gamma", "beta", "alpha"]);
      expect(loaded.every((e) => e.dbId === "db_1" && e.slug === "db-1")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("dedupes by (dbId, table): a re-touched entry is one row with the new touchedAt", async () => {
    vi.useFakeTimers();
    try {
      const store = makeRecentTablesStore(makeStore());
      vi.setSystemTime(1_000);
      await store.touch("user:u_1", "db_1", "db-1", ["foo"]);
      vi.setSystemTime(5_000);
      await store.touch("user:u_1", "db_1", "db-1", ["foo"]);

      const loaded = await store.load("user:u_1");
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toMatchObject({ dbId: "db_1", table: "foo", touchedAt: 5_000 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("caps at 100 entries; the 101st touch evicts the oldest by touchedAt", async () => {
    vi.useFakeTimers();
    try {
      const store = makeRecentTablesStore(makeStore());
      for (let i = 0; i < 100; i++) {
        vi.setSystemTime(1_000 + i);
        await store.touch("user:u_1", "db_1", "db-1", [`t${i}`]);
      }
      // Sanity: 100 entries, oldest is t0.
      let loaded = await store.load("user:u_1");
      expect(loaded).toHaveLength(100);
      expect(loaded[loaded.length - 1]?.table).toBe("t0");

      vi.setSystemTime(2_000);
      await store.touch("user:u_1", "db_1", "db-1", ["new"]);
      loaded = await store.load("user:u_1");
      expect(loaded).toHaveLength(100);
      expect(loaded[0]?.table).toBe("new");
      // t0 (oldest) is gone.
      expect(loaded.some((e) => e.table === "t0")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("multi-db: tables from different dbIds coexist (same table name allowed)", async () => {
    const store = makeRecentTablesStore(makeStore());
    await store.touch("user:u_1", "db_a", "a", ["users"]);
    await store.touch("user:u_1", "db_b", "b", ["users"]);
    const loaded = await store.load("user:u_1");
    expect(loaded).toHaveLength(2);
    expect(new Set(loaded.map((e) => e.dbId))).toEqual(new Set(["db_a", "db_b"]));
  });

  it("isolates per-principal: u_1's entries are invisible to u_2", async () => {
    const store = makeRecentTablesStore(makeStore());
    await store.touch("user:u_1", "db_1", "db-1", ["foo"]);
    expect(await store.load("user:u_2")).toEqual([]);
    expect(await store.load("anon:abcdef")).toEqual([]);
  });

  it("touch() swallows KV.put failure (does not throw to caller)", async () => {
    const kv: KVStore = {
      async get() {
        return null;
      },
      async put() {
        throw new Error("KV down");
      },
    };
    const store = makeRecentTablesStore(kv);
    await expect(store.touch("user:u_1", "db_1", "db-1", ["foo"])).resolves.toBeUndefined();
  });

  it("touch() recovers from corrupted KV value (not JSON)", async () => {
    const kv = makeStore();
    kv.data.set("recent_tables:user:u_1", "{not json");
    const store = makeRecentTablesStore(kv);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(7_000);
      await store.touch("user:u_1", "db_1", "db-1", ["foo"]);
      const loaded = await store.load("user:u_1");
      expect(loaded).toEqual<RecentTable[]>([
        { dbId: "db_1", slug: "db-1", table: "foo", touchedAt: 7_000 },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("writes the 90-day TTL on every touch", async () => {
    let captured: { expirationTtl?: number } | undefined;
    const kv: KVStore = {
      async get() {
        return null;
      },
      async put(_k, _v, opts) {
        captured = opts;
      },
    };
    const store = makeRecentTablesStore(kv);
    await store.touch("user:u_1", "db_1", "db-1", ["foo"]);
    expect(captured?.expirationTtl).toBe(90 * 24 * 60 * 60);
  });
});

describe("extractTables", () => {
  it("SELECT FROM users → ['users']", () => {
    expect(extractTables("SELECT * FROM users")).toEqual(["users"]);
  });

  it("INSERT INTO foo SELECT FROM bar → ['foo','bar']", () => {
    const out = extractTables("INSERT INTO foo SELECT * FROM bar");
    expect(new Set(out)).toEqual(new Set(["foo", "bar"]));
  });

  it("UPDATE … FROM joined → both target and source", () => {
    const out = extractTables(
      "UPDATE orders SET total = 0 FROM customers WHERE orders.cust = customers.id",
    );
    expect(new Set(out)).toEqual(new Set(["orders", "customers"]));
  });

  it("DELETE FROM users WHERE id IN (subquery)", () => {
    const out = extractTables("DELETE FROM users WHERE id IN (SELECT user_id FROM banned)");
    expect(new Set(out)).toEqual(new Set(["users", "banned"]));
  });

  it("join trees: SELECT FROM a JOIN b ON … JOIN c ON …", () => {
    const out = extractTables("SELECT * FROM a JOIN b ON a.id = b.a_id JOIN c ON b.id = c.b_id");
    expect(new Set(out)).toEqual(new Set(["a", "b", "c"]));
  });

  it("subqueries: SELECT FROM (SELECT FROM inner) o", () => {
    const out = extractTables("SELECT * FROM (SELECT id FROM inner_t) o");
    expect(out).toEqual(["inner_t"]);
  });

  it("CTE aliases are excluded; real tables inside the CTE body are kept", () => {
    const out = extractTables(
      "WITH cte AS (SELECT id FROM real_table) SELECT * FROM cte JOIN other ON cte.id = other.cte_id",
    );
    expect(new Set(out)).toEqual(new Set(["real_table", "other"]));
    expect(out).not.toContain("cte");
  });

  it("nested CTEs: every WITH alias is excluded", () => {
    const out = extractTables(
      "WITH a AS (SELECT 1), b AS (SELECT * FROM a) SELECT * FROM b JOIN events ON b.id = events.b_id",
    );
    expect(new Set(out)).toEqual(new Set(["events"]));
    expect(out).not.toContain("a");
    expect(out).not.toContain("b");
  });

  it("returns [] on parse failure (does not throw)", () => {
    expect(extractTables("THIS IS NOT SQL :")).toEqual([]);
  });

  it("returns [] for non-allowlisted statements (CREATE/DROP/etc)", () => {
    // The orchestrator's SQL allowlist would already reject these,
    // but defensive belt-and-braces: the walker only contributes tables
    // for SELECT/INSERT/UPDATE/DELETE statement bodies.
    expect(extractTables("CREATE TABLE foo (id int)")).toEqual([]);
  });
});

describe("tablesFromSchemaText (SK-ASK-018)", () => {
  it("extracts unquoted, schema-qualified table names from compiled DDL", () => {
    const ddl = [
      'CREATE TABLE "factory_management_a723a5"."employees" (id int);',
      'CREATE TABLE "factory_management_a723a5"."shifts" (id int);',
      "CREATE INDEX idx_shifts ON shifts (id);",
    ].join("\n");
    expect(tablesFromSchemaText(ddl)).toEqual(["employees", "shifts"]);
  });

  it("dedupes repeated CREATE TABLE entries", () => {
    const ddl = "CREATE TABLE a (id int);\nCREATE TABLE IF NOT EXISTS A (id int);";
    expect(tablesFromSchemaText(ddl)).toEqual(["a"]);
  });

  it("returns [] when no CREATE TABLE is present", () => {
    expect(tablesFromSchemaText("")).toEqual([]);
    expect(tablesFromSchemaText("CREATE INDEX foo ON bar(x);")).toEqual([]);
  });
});
