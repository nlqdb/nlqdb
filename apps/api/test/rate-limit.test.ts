// Rate-limiter unit tests with a stub Storage. Asserts the
// fixed-window-counter behaviour: count increments on each call,
// allow flips to deny once `limit` is reached, KV TTL is ≥ 60s
// (Cloudflare's minimum).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeRateLimiter, type RateLimitStore } from "../src/ask/rate-limit.ts";

function makeStore(): RateLimitStore & {
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

describe("makeRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows under-limit and increments the counter", async () => {
    const store = makeStore();
    const limiter = makeRateLimiter(store, { limit: 3, windowSeconds: 60 });
    expect(await limiter.check("u_1")).toEqual({ allowed: true, count: 1, limit: 3 });
    expect(await limiter.check("u_1")).toEqual({ allowed: true, count: 2, limit: 3 });
    expect(await limiter.check("u_1")).toEqual({ allowed: true, count: 3, limit: 3 });
  });

  it("denies once the limit is reached", async () => {
    const store = makeStore();
    const limiter = makeRateLimiter(store, { limit: 2, windowSeconds: 60 });
    await limiter.check("u_1");
    await limiter.check("u_1");
    expect(await limiter.check("u_1")).toEqual({ allowed: false, count: 2, limit: 2 });
  });

  it("isolates buckets by userId", async () => {
    const store = makeStore();
    const limiter = makeRateLimiter(store, { limit: 1, windowSeconds: 60 });
    expect((await limiter.check("u_1")).allowed).toBe(true);
    expect((await limiter.check("u_2")).allowed).toBe(true);
    expect((await limiter.check("u_1")).allowed).toBe(false);
  });

  it("rolls over when the window advances", async () => {
    const store = makeStore();
    const limiter = makeRateLimiter(store, { limit: 1, windowSeconds: 60 });
    expect((await limiter.check("u_1")).allowed).toBe(true);
    expect((await limiter.check("u_1")).allowed).toBe(false);
    vi.setSystemTime(new Date("2026-04-26T12:01:30Z")); // +90s = next minute bucket
    expect((await limiter.check("u_1")).allowed).toBe(true);
  });

  it("floors KV TTL at 60s even when window is shorter", async () => {
    const store = makeStore();
    const limiter = makeRateLimiter(store, { limit: 100, windowSeconds: 10 });
    await limiter.check("u_1");
    expect(store.puts[0]?.ttl).toBe(60);
  });
});
