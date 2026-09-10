// `memoResolveDb` (efficiency): one `/v1/ask` resolves the pinned DB twice —
// the routeAsk table-context seed (SK-ASK-018) and the orchestrator exec read —
// so the per-request memo must collapse identical `(id, tenantId)` reads to a
// single D1 point-read while keeping distinct keys (and tenants) separate.

import { describe, expect, it, vi } from "vitest";
import { memoResolveDb, rewriteWidenedSchema } from "./db-registry.ts";

function fakeD1(firstImpl: () => Promise<unknown>) {
  const first = vi.fn(firstImpl);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return { d1: { prepare } as unknown as D1Database, prepare, first };
}

// A D1 stub whose UPDATE `.run()` reports `meta.changes`, and that records the
// prepared SQL + bound params so the CAS shape is assertable.
function fakeD1Update(changes: number) {
  let sql = "";
  let params: unknown[] = [];
  const run = vi.fn(async () => ({ success: true, meta: { changes } }));
  const bind = vi.fn((...args: unknown[]) => {
    params = args;
    return { run };
  });
  const prepare = vi.fn((text: string) => {
    sql = text;
    return { bind };
  });
  return {
    d1: { prepare } as unknown as D1Database,
    run,
    get sql() {
      return sql;
    },
    get params() {
      return params;
    },
  };
}

const row = {
  id: "db_1",
  tenant_id: "user_1",
  engine: "postgres",
  connection_secret_ref: "DATABASE_URL",
  schema_hash: "h",
  schema_text: "CREATE TABLE campaigns (id int);",
  connection_blob: null,
};

describe("memoResolveDb", () => {
  it("reads D1 once for repeated identical (id, tenantId) calls", async () => {
    const { d1, first } = fakeD1(async () => row);
    const resolve = memoResolveDb(d1);
    const [a, b] = await Promise.all([resolve("db_1", "user_1"), resolve("db_1", "user_1")]);
    expect(first).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a?.id).toBe("db_1");
    // A later call still returns the cached record without a second read.
    await resolve("db_1", "user_1");
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("keys on both id and tenantId — different tenant is a separate read", async () => {
    const { d1, first } = fakeD1(async () => row);
    const resolve = memoResolveDb(d1);
    await resolve("db_1", "user_1");
    await resolve("db_1", "user_2");
    expect(first).toHaveBeenCalledTimes(2);
  });
});

describe("rewriteWidenedSchema (GLOBAL-041 Phase A step 6, SK-SCHEMA-011)", () => {
  const args = {
    id: "db_1",
    tenantId: "user_1",
    expectedHash: "oldhash",
    schemaText: "CREATE TABLE t (id int);\nALTER TABLE t ADD COLUMN note TEXT;",
    schemaHash: "newhash",
  };

  it("compare-and-swaps on the observed hash and reports updated on a hit", async () => {
    const fake = fakeD1Update(1);
    const res = await rewriteWidenedSchema(fake.d1, args);
    expect(res.updated).toBe(true);
    // CAS: the WHERE clause pins the observed hash so a concurrent widen can't
    // be clobbered, and new values are bound before the identity + expected hash.
    expect(fake.sql).toMatch(/UPDATE databases SET schema_hash = \?, schema_text = \?/);
    expect(fake.sql).toMatch(/WHERE id = \? AND tenant_id = \? AND schema_hash = \?$/);
    expect(fake.params).toEqual(["newhash", args.schemaText, "db_1", "user_1", "oldhash"]);
    expect(fake.run).toHaveBeenCalledTimes(1);
  });

  it("reports not-updated when the CAS matched no row (a concurrent widen won)", async () => {
    const { d1 } = fakeD1Update(0);
    const res = await rewriteWidenedSchema(d1, args);
    expect(res.updated).toBe(false);
  });
});
