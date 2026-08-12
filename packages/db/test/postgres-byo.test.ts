// Unit tests for `openByoPostgres` — the BYO Postgres postgres.js connection
// (`SK-DBCONN-002`). No live Postgres in the unit env, so the postgres.js `sql`
// tag is injected via the `driver` seam (`SK-DB-006` style): a fake that
// records the SQL / params it received and returns row arrays carrying
// postgres.js's `.count`. Proves the `$1`-parameterised introspection query
// maps to `sql.unsafe(text, params)`, the bounded runner wraps
// `SET LOCAL statement_timeout` + the user SQL in one transaction, results map
// to `{ rows, rowCount }`, and the socket is always closed.

import { describe, expect, it, vi } from "vitest";
import { openByoPostgres } from "../src/index.ts";
import type { Row } from "../src/types.ts";

type Recorded = { text: string; params?: unknown[] };

// A postgres.js-shaped `sql` fake. `unsafe`/tx.`unsafe` resolve to a row array
// with a `.count` property, exactly like a postgres.js `Result`.
function fakeDriver(rowsFor?: (text: string) => Row[]) {
  const calls: Recorded[] = [];
  let ended = false;
  const result = (rows: Row[]) => Object.assign([...rows], { count: rows.length });
  const unsafe = async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    return result(rowsFor ? rowsFor(text) : []);
  };
  const sql = {
    unsafe,
    begin: async <T>(cb: (tx: { unsafe: typeof unsafe }) => Promise<T>) => cb({ unsafe }),
    end: async () => {
      ended = true;
    },
  };
  return {
    driver: () => sql as never,
    calls,
    wasEnded: () => ended,
  };
}

describe("openByoPostgres", () => {
  it("query() sends the $1-parameterised text + params to sql.unsafe and maps rows + rowCount", async () => {
    const fake = fakeDriver((text) =>
      text.includes("SELECT one") ? [{ table_name: "t", column_name: "c" }] : [],
    );
    const conn = openByoPostgres("postgres://u:p@byo.example.com:5432/shop", {
      driver: fake.driver,
    });

    const out = await conn.query("SELECT one WHERE n = $1", ["public"]);
    expect(out.rows).toEqual([{ table_name: "t", column_name: "c" }]);
    expect(out.rowCount).toBe(1);
    expect(fake.calls[0]).toEqual({ text: "SELECT one WHERE n = $1", params: ["public"] });
  });

  it("query() defaults missing params to an empty array (never undefined)", async () => {
    const fake = fakeDriver();
    const conn = openByoPostgres("postgres://u:p@byo.example.com/shop", { driver: fake.driver });
    await conn.query("SELECT 1", []);
    expect(fake.calls[0]?.params).toEqual([]);
  });

  it("query() pre-flight aborts on an already-aborted signal — no query issued", async () => {
    const fake = fakeDriver();
    const conn = openByoPostgres("postgres://u:p@byo.example.com/shop", { driver: fake.driver });
    await expect(conn.query("SELECT 1", [], AbortSignal.abort())).rejects.toThrow();
    expect(fake.calls).toHaveLength(0);
  });

  it("runBounded() sets SET LOCAL statement_timeout then the user SQL in one transaction", async () => {
    const fake = fakeDriver((text) => (text.startsWith("SELECT *") ? [{ id: 1 }, { id: 2 }] : []));
    const conn = openByoPostgres("postgres://u:p@byo.example.com/shop", { driver: fake.driver });

    const out = await conn.runBounded("SELECT * FROM t", "10s");
    expect(fake.calls.map((c) => c.text)).toEqual([
      "SET LOCAL statement_timeout = '10s'",
      "SELECT * FROM t",
    ]);
    expect(out.rows).toEqual([{ id: 1 }, { id: 2 }]);
    expect(out.rowCount).toBe(2);
  });

  it("close() ends the underlying connection", async () => {
    const fake = fakeDriver();
    const conn = openByoPostgres("postgres://u:p@byo.example.com/shop", { driver: fake.driver });
    await conn.close();
    expect(fake.wasEnded()).toBe(true);
  });

  it("close() swallows an end() failure (never turns a good query into an error)", async () => {
    const badSql = {
      unsafe: async () => Object.assign([] as Row[], { count: 0 }),
      begin: vi.fn(),
      end: async () => {
        throw new Error("socket already gone");
      },
    };
    const conn = openByoPostgres("postgres://u:p@byo.example.com/shop", {
      driver: () => badSql as never,
    });
    await expect(conn.close()).resolves.toBeUndefined();
  });
});
