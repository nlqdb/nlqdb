import { describe, expect, it } from "vitest";
import { GLOBAL_ANON_LIMITS, makeGlobalAnonLimiter } from "../src/anon-global-cap.ts";

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

describe("global anon limiter — peek / record", () => {
  it("admits the first call with all three windows green", async () => {
    const limiter = makeGlobalAnonLimiter(fakeKv());
    const peek = await limiter.peek();
    expect(peek.ok).toBe(true);
    if (peek.ok) {
      expect(peek.count).toBe(0);
      expect(peek.limit).toBeGreaterThan(0);
      expect(peek.resetAt).toBeGreaterThan(0);
    }
  });

  it("trips on the hour bucket first when 100 records have been logged", async () => {
    const limiter = makeGlobalAnonLimiter(fakeKv());
    for (let i = 0; i < GLOBAL_ANON_LIMITS.hour; i++) {
      await limiter.record();
    }
    const peek = await limiter.peek();
    expect(peek.ok).toBe(false);
    if (!peek.ok) {
      expect(peek.window).toBe("hour");
      expect(peek.limit).toBe(GLOBAL_ANON_LIMITS.hour);
      expect(peek.count).toBeGreaterThanOrEqual(GLOBAL_ANON_LIMITS.hour);
    }
  });

  it("emits limit + count + resetAt on every verdict", async () => {
    const limiter = makeGlobalAnonLimiter(fakeKv());
    await limiter.record();
    await limiter.record();
    const peek = await limiter.peek();
    expect(peek.ok).toBe(true);
    if (peek.ok) {
      expect(peek.count).toBe(2);
      expect(peek.resetAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    }
  });

  it("counter is global — not scoped to anything", async () => {
    // Mirror the design intent: ALL anon calls share the bucket.
    // The limiter's API has no per-IP / per-token shape, so this
    // test asserts the absence rather than the presence — and a
    // future regression that adds an `ip` parameter would make
    // this fail to compile.
    const limiter = makeGlobalAnonLimiter(fakeKv());
    const a = limiter.record;
    const b = limiter.peek;
    expect(a.length).toBe(0);
    expect(b.length).toBe(0);
  });
});

describe("global anon limiter — record persists across instances on the same KV", () => {
  it("two limiter instances over the same KV see each other's writes", async () => {
    const kv = fakeKv();
    const a = makeGlobalAnonLimiter(kv);
    const b = makeGlobalAnonLimiter(kv);
    await a.record();
    await a.record();
    const peek = await b.peek();
    expect(peek.ok).toBe(true);
    if (peek.ok) expect(peek.count).toBe(2);
  });
});
