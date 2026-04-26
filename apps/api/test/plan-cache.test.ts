// Plan-cache unit tests. Pure storage stub — no Miniflare KV needed.
// Covers the (schemaHash, queryHash) keying scheme, JSON serialisation,
// TTL pass-through, and corrupted-entry recovery.

import { beforeEach, describe, expect, it } from "vitest";
import {
  hashGoal,
  makePlanCache,
  PLAN_CACHE_TTL_SECONDS,
  type PlanCacheStore,
} from "../src/ask/plan-cache.ts";
import type { CachedPlan } from "../src/ask/types.ts";

function makeStubStore(): PlanCacheStore & {
  data: Map<string, string>;
  puts: { key: string; value: string; ttl?: number }[];
} {
  const data = new Map<string, string>();
  const puts: { key: string; value: string; ttl?: number }[] = [];
  return {
    data,
    puts,
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value, opts) {
      data.set(key, value);
      puts.push({ key, value, ttl: opts?.expirationTtl });
    },
  };
}

describe("plan cache", () => {
  let store: ReturnType<typeof makeStubStore>;

  beforeEach(() => {
    store = makeStubStore();
  });

  it("lookup() returns null when the key is absent", async () => {
    const cache = makePlanCache(store);
    expect(await cache.lookup("schema_a", "query_a")).toBeNull();
  });

  it("write() then lookup() round-trips a plan", async () => {
    const cache = makePlanCache(store);
    const plan: CachedPlan = { sql: "SELECT 1", schemaHash: "schema_a", createdAt: 1234 };
    await cache.write("schema_a", "query_a", plan);
    expect(await cache.lookup("schema_a", "query_a")).toEqual(plan);
  });

  it("write() applies the long TTL so the cache survives multi-day idle", async () => {
    const cache = makePlanCache(store);
    await cache.write("s", "q", { sql: "x", schemaHash: "s", createdAt: 0 });
    expect(store.puts).toHaveLength(1);
    expect(store.puts[0]?.ttl).toBe(PLAN_CACHE_TTL_SECONDS);
  });

  it("keys are scoped by both schemaHash AND queryHash (no collisions across schemas)", async () => {
    const cache = makePlanCache(store);
    await cache.write("schema_a", "q", { sql: "A", schemaHash: "schema_a", createdAt: 0 });
    await cache.write("schema_b", "q", { sql: "B", schemaHash: "schema_b", createdAt: 0 });
    expect((await cache.lookup("schema_a", "q"))?.sql).toBe("A");
    expect((await cache.lookup("schema_b", "q"))?.sql).toBe("B");
  });

  it("lookup() returns null on a corrupted entry instead of throwing", async () => {
    const cache = makePlanCache(store);
    store.data.set("plan:s:q", "this is not json");
    expect(await cache.lookup("s", "q")).toBeNull();
  });
});

describe("hashGoal", () => {
  it("returns a 64-char hex SHA-256", async () => {
    const h = await hashGoal("the 5 most-loved coffee shops in Berlin");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalises whitespace + case so equivalent goals share a key", async () => {
    const a = await hashGoal("  Find COFFEE shops  ");
    const b = await hashGoal("find coffee shops");
    expect(a).toBe(b);
  });
});
