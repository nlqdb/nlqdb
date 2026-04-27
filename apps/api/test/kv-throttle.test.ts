// Unit tests for the shared per-key throttle. Covers the three
// outcomes that matter — consumed below limit, blocked at limit,
// fail-open when KV throws — plus the boundary case of corrupted
// counter values.

import { describe, expect, it, vi } from "vitest";
import { makeKvThrottle } from "../src/lib/kv-throttle.ts";

function fakeKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const kv = {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
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
});
