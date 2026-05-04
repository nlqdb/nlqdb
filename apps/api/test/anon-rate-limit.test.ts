import { describe, expect, it } from "vitest";
import { makeAnonRateLimiter } from "../src/anon-rate-limit.ts";

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
    list: async () => ({ keys: [], list_complete: true, cursor: "" }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

describe("anon rate-limiter — checkQuery", () => {
  it("admits up to 30/min per IP", async () => {
    const limiter = makeAnonRateLimiter(fakeKv());
    for (let i = 0; i < 30; i++) {
      const v = await limiter.checkQuery("1.2.3.4");
      expect(v.ok, `attempt ${i}`).toBe(true);
    }
    const blocked = await limiter.checkQuery("1.2.3.4");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfter).toBe(60);
  });

  it("scopes the query bucket per IP", async () => {
    const limiter = makeAnonRateLimiter(fakeKv());
    for (let i = 0; i < 30; i++) await limiter.checkQuery("1.1.1.1");
    const otherIp = await limiter.checkQuery("9.9.9.9");
    expect(otherIp.ok).toBe(true);
  });

  it("returns limit + count + resetAt on every verdict (SK-RL-004 parity)", async () => {
    const limiter = makeAnonRateLimiter(fakeKv());
    const ok = await limiter.checkQuery("1.2.3.4");
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.limit).toBe(30);
      expect(ok.count).toBe(1);
      expect(ok.resetAt).toBeGreaterThan(0);
    }
    for (let i = 0; i < 29; i++) await limiter.checkQuery("1.2.3.4");
    const blocked = await limiter.checkQuery("1.2.3.4");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.limit).toBe(30);
      expect(blocked.count).toBeGreaterThanOrEqual(30);
      expect(blocked.resetAt).toBeGreaterThan(0);
    }
  });
});

describe("anon rate-limiter — peekCreate / recordCreate", () => {
  it("first two creates need no challenge", async () => {
    const limiter = makeAnonRateLimiter(fakeKv());
    const peek0 = await limiter.peekCreate("1.2.3.4");
    expect(peek0.ok).toBe(true);
    if (peek0.ok) expect(peek0.needsChallenge).toBe(false);
    await limiter.recordCreate("1.2.3.4");
    const peek1 = await limiter.peekCreate("1.2.3.4");
    expect(peek1.ok).toBe(true);
    if (peek1.ok) expect(peek1.needsChallenge).toBe(false);
    await limiter.recordCreate("1.2.3.4");
    const peek2 = await limiter.peekCreate("1.2.3.4");
    expect(peek2.ok).toBe(true);
    if (peek2.ok) expect(peek2.needsChallenge).toBe(false);
  });

  it("flips to needsChallenge after 3 creates in the burst window", async () => {
    const limiter = makeAnonRateLimiter(fakeKv());
    for (let i = 0; i < 3; i++) await limiter.recordCreate("1.2.3.4");
    const peek = await limiter.peekCreate("1.2.3.4");
    expect(peek.ok).toBe(true);
    if (peek.ok) expect(peek.needsChallenge).toBe(true);
  });

  it("returns ip_create_cap after 5 creates in the hour", async () => {
    const limiter = makeAnonRateLimiter(fakeKv());
    for (let i = 0; i < 5; i++) await limiter.recordCreate("1.2.3.4");
    const peek = await limiter.peekCreate("1.2.3.4");
    expect(peek.ok).toBe(false);
    if (!peek.ok) {
      expect(peek.reason).toBe("ip_create_cap");
      expect(peek.retryAfter).toBe(60 * 60);
      expect(peek.limit).toBe(5);
      expect(peek.count).toBeGreaterThanOrEqual(5);
      expect(peek.resetAt).toBeGreaterThan(0);
    }
  });

  it("scopes create counters per IP", async () => {
    const limiter = makeAnonRateLimiter(fakeKv());
    for (let i = 0; i < 5; i++) await limiter.recordCreate("1.1.1.1");
    const otherIp = await limiter.peekCreate("9.9.9.9");
    expect(otherIp.ok).toBe(true);
    if (otherIp.ok) expect(otherIp.needsChallenge).toBe(false);
  });

  it("emits limit + count + resetAt on every verdict (SK-RL-004 parity)", async () => {
    const limiter = makeAnonRateLimiter(fakeKv());
    const fresh = await limiter.peekCreate("1.2.3.4");
    expect(fresh.ok).toBe(true);
    if (fresh.ok) {
      expect(fresh.limit).toBe(5);
      expect(fresh.count).toBe(0);
      expect(fresh.resetAt).toBeGreaterThan(0);
    }
  });
});
