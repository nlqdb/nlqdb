// `memoResolveDb` (efficiency): one `/v1/ask` resolves the pinned DB twice —
// the routeAsk table-context seed (SK-ASK-018) and the orchestrator exec read —
// so the per-request memo must collapse identical `(id, tenantId)` reads to a
// single D1 point-read while keeping distinct keys (and tenants) separate.

import { describe, expect, it, vi } from "vitest";
import { memoResolveDb } from "./db-registry.ts";

function fakeD1(firstImpl: () => Promise<unknown>) {
  const first = vi.fn(firstImpl);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return { d1: { prepare } as unknown as D1Database, prepare, first };
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
