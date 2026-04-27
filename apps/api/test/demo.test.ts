import { describe, expect, it } from "vitest";
import { buildDemoResult, makeRateLimiter } from "../src/demo.ts";

describe("buildDemoResult", () => {
  it("returns the orders fixture by default", () => {
    const result = buildDemoResult("show me anything");
    expect(result.kind).toBe("ok");
    expect(result.rows.length).toBe(6);
    expect(result.rows[0]).toHaveProperty("drink");
    expect(result.sql).toContain("orders");
  });

  it("matches the memory fixture", () => {
    const result = buildDemoResult("a memory store for my AI agent");
    expect(result.rows[0]).toHaveProperty("thread_id");
    expect(result.sql).toContain("agent_memory");
  });

  it("matches the CRM fixture", () => {
    const result = buildDemoResult("a CRM for two-person startups");
    expect(result.rows[0]).toHaveProperty("company");
    expect(result.sql).toContain("contacts");
  });

  it("matches the leaderboard fixture", () => {
    const result = buildDemoResult("a leaderboard for our internal hackathon");
    expect(result.rows[0]).toHaveProperty("score");
  });

  it("matches the feedback fixture", () => {
    const result = buildDemoResult("a feedback inbox with auto-tags");
    expect(result.rows[0]).toHaveProperty("tags");
  });

  it("echoes the goal in the summary", () => {
    const result = buildDemoResult("a CRM for two-person startups");
    expect(result.summary).toContain("two-person startups");
  });

  it("filters rows when the goal contains a column value (orders / americano)", () => {
    const result = buildDemoResult("show me americano");
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]).toMatchObject({ drink: "americano" });
    expect(result.rowCount).toBe(1);
    expect(result.sql).toContain("LIKE '%americano%'");
    expect(result.summary.toLowerCase()).toContain("americano");
  });

  it("filters CRM contacts by status (warm)", () => {
    const result = buildDemoResult("CRM contacts that are warm");
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.length).toBeLessThan(5);
    for (const row of result.rows) {
      expect(row).toMatchObject({ status: "warm" });
    }
    expect(result.summary.toLowerCase()).toContain("warm");
  });

  it("returns the unfiltered fixture when no token in goal matches any row value", () => {
    const result = buildDemoResult("hi");
    expect(result.rows.length).toBe(6);
    expect(result.summary).not.toContain("Filtered to");
  });
});

describe("makeRateLimiter", () => {
  // Minimal in-memory KV double — only the get/put surface the limiter
  // touches. The TTL is honored by clearing on a second run; a real
  // CF KV simulation isn't worth the bytes here.
  function fakeKv(): KVNamespace {
    const store = new Map<string, string>();
    return {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value);
      },
      delete: async (key: string) => {
        store.delete(key);
      },
      // Unused surfaces — typed-stub them.
      list: async () => ({ keys: [], list_complete: true, cursor: "" }),
      getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
    } as unknown as KVNamespace;
  }

  it("admits up to 10 requests in a window then 429s", async () => {
    const limiter = makeRateLimiter(fakeKv());
    for (let i = 0; i < 10; i++) {
      const v = await limiter.hit("1.2.3.4");
      expect(v.ok, `attempt ${i}`).toBe(true);
    }
    const blocked = await limiter.hit("1.2.3.4");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfter).toBe(60);
    }
  });

  it("scopes counters per IP", async () => {
    const limiter = makeRateLimiter(fakeKv());
    for (let i = 0; i < 10; i++) {
      await limiter.hit("1.1.1.1");
    }
    const otherIp = await limiter.hit("9.9.9.9");
    expect(otherIp.ok).toBe(true);
  });
});
