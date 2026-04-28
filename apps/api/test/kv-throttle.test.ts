// Unit tests for the shared per-key throttle. Covers the three
// outcomes that matter — consumed below limit, blocked at limit,
// fail-open when KV throws — plus the boundary case of corrupted
// counter values.

import { describe, expect, it, vi } from "vitest";
import { makeKvThrottle } from "../src/lib/kv-throttle.ts";

// Type the `put` stub to take the same 3-arg signature as
// `KVNamespace.put` — `(key, value, options?)`. Without the third
// param the inferred `mock.calls` tuple is `[k, v]` and tests that
// assert on `call[2]` (the `{ expirationTtl }` options bag) fail to
// compile with TS2493.
type PutOptions = { expirationTtl?: number };

function fakeKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const kv = {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string, _opts?: PutOptions) => {
      store.set(k, v);
    }),
    delete: vi.fn(async (k: string) => {
      store.delete(k);
    }),
  };
  return { kv: kv as unknown as KVNamespace, store, raw: kv };
}

const cfg = { prefix: "t:", max: 3, windowSeconds: 60 };

describe("makeKvThrottle", () => {
  it("returns true and increments while under the limit", async () => {
    const { kv, store } = fakeKv();
    const throttle = makeKvThrottle(kv, cfg);
    expect(await throttle.tryConsume("a")).toBe(true);
    expect(await throttle.tryConsume("a")).toBe(true);
    expect(await throttle.tryConsume("a")).toBe(true);
    expect(store.get("t:a")).toBe("3");
  });

  it("returns false at and after the limit; counter does not increment", async () => {
    const { kv, store } = fakeKv({ "t:a": "3" });
    const throttle = makeKvThrottle(kv, cfg);
    expect(await throttle.tryConsume("a")).toBe(false);
    expect(await throttle.tryConsume("a")).toBe(false);
    expect(store.get("t:a")).toBe("3");
  });

  it("isolates counters by key", async () => {
    const { kv } = fakeKv({ "t:a": "3" });
    const throttle = makeKvThrottle(kv, cfg);
    expect(await throttle.tryConsume("a")).toBe(false);
    expect(await throttle.tryConsume("b")).toBe(true);
  });

  it("isolates counters by prefix (two limiters do not interfere)", async () => {
    const { kv, store } = fakeKv();
    const limiterA = makeKvThrottle(kv, { prefix: "a:", max: 1, windowSeconds: 60 });
    const limiterB = makeKvThrottle(kv, { prefix: "b:", max: 1, windowSeconds: 60 });
    expect(await limiterA.tryConsume("k")).toBe(true);
    expect(await limiterA.tryConsume("k")).toBe(false);
    expect(await limiterB.tryConsume("k")).toBe(true);
    expect(store.get("a:k")).toBe("1");
    expect(store.get("b:k")).toBe("1");
  });

  it("treats a corrupted counter value as zero", async () => {
    const { kv } = fakeKv({ "t:a": "not-a-number" });
    const throttle = makeKvThrottle(kv, cfg);
    expect(await throttle.tryConsume("a")).toBe(true);
  });

  it("fails open when KV.get throws", async () => {
    const { kv, raw } = fakeKv();
    raw.get.mockRejectedValueOnce(new Error("kv down"));
    const throttle = makeKvThrottle(kv, cfg);
    expect(await throttle.tryConsume("a")).toBe(true);
  });

  it("fails open when KV.put throws (still returns true)", async () => {
    const { kv, raw } = fakeKv();
    raw.put.mockRejectedValueOnce(new Error("kv down"));
    const throttle = makeKvThrottle(kv, cfg);
    expect(await throttle.tryConsume("a")).toBe(true);
  });

  it("floors a sub-60s window to KV's 60s minimum on the put TTL", async () => {
    const { kv, raw } = fakeKv();
    const throttle = makeKvThrottle(kv, { prefix: "t:", max: 3, windowSeconds: 30 });
    await throttle.tryConsume("a");
    expect(raw.put).toHaveBeenCalledWith("t:a", "1", { expirationTtl: 60 });
  });

  it("refreshes the TTL on every successful consume (fixed-window with renewal)", async () => {
    // The docstring is clear that the window EXPIRY slides per write
    // but the counter BASE doesn't decay — pin both halves of that
    // claim here so a future "real sliding window" rewrite must
    // either delete this test or change its assertions.
    const { kv, raw } = fakeKv();
    const throttle = makeKvThrottle(kv, cfg);
    await throttle.tryConsume("a");
    await throttle.tryConsume("a");
    await throttle.tryConsume("a");
    const putCalls = raw.put.mock.calls;
    expect(putCalls).toHaveLength(3);
    // Every put refreshes the TTL — sliding expiry, not sliding counter.
    for (const call of putCalls) {
      expect(call[2]).toEqual({ expirationTtl: 60 });
    }
    // Counter incremented monotonically, never decayed.
    expect(putCalls.map((c) => c[1])).toEqual(["1", "2", "3"]);
  });

  describe("rollback", () => {
    it("decrements a previously-consumed counter by one", async () => {
      const { kv, store, raw } = fakeKv();
      const throttle = makeKvThrottle(kv, cfg);
      await throttle.tryConsume("a");
      await throttle.tryConsume("a");
      expect(store.get("t:a")).toBe("2");
      await throttle.rollback("a");
      expect(store.get("t:a")).toBe("1");
      // Rollback re-puts with the same TTL so an in-flight window
      // doesn't get artificially extended.
      const lastPut = raw.put.mock.calls.at(-1);
      expect(lastPut?.[2]).toEqual({ expirationTtl: 60 });
    });

    it("frees a slot so the bucket can re-consume after rollback", async () => {
      const { kv } = fakeKv();
      const throttle = makeKvThrottle(kv, { prefix: "t:", max: 2, windowSeconds: 60 });
      expect(await throttle.tryConsume("a")).toBe(true);
      expect(await throttle.tryConsume("a")).toBe(true);
      expect(await throttle.tryConsume("a")).toBe(false);
      await throttle.rollback("a");
      expect(await throttle.tryConsume("a")).toBe(true);
    });

    it("is a no-op when the key is absent or zero", async () => {
      const { kv, store, raw } = fakeKv();
      const throttle = makeKvThrottle(kv, cfg);
      await throttle.rollback("never-consumed");
      expect(store.has("t:never-consumed")).toBe(false);
      expect(raw.put).not.toHaveBeenCalled();
    });

    it("treats a corrupted counter as zero and does not write", async () => {
      const { kv, raw } = fakeKv({ "t:a": "garbage" });
      const throttle = makeKvThrottle(kv, cfg);
      await throttle.rollback("a");
      expect(raw.put).not.toHaveBeenCalled();
    });

    it("never throws when KV.get fails", async () => {
      const { kv, raw } = fakeKv();
      raw.get.mockRejectedValueOnce(new Error("kv down"));
      const throttle = makeKvThrottle(kv, cfg);
      await expect(throttle.rollback("a")).resolves.toBeUndefined();
    });

    it("never throws when KV.put fails", async () => {
      const { kv, raw } = fakeKv({ "t:a": "2" });
      raw.put.mockRejectedValueOnce(new Error("kv down"));
      const throttle = makeKvThrottle(kv, cfg);
      await expect(throttle.rollback("a")).resolves.toBeUndefined();
    });
  });
});
