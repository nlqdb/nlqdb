// D1-backed rate limiter tests. Hits real D1 via Miniflare with
// per-test isolated storage, so atomicity assertions are meaningful
// (the migration's UPSERT-with-RETURNING actually fires).

import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeRateLimiter } from "../src/ask/rate-limit.ts";

describe("makeRateLimiter (D1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows under-limit and increments the counter atomically", async () => {
    const limiter = makeRateLimiter(env.DB, { limit: 3, windowSeconds: 60 });
    // 2026-04-26T12:00:00Z is on a minute boundary, so windowStart =
    // that timestamp and resetAt = windowStart + 60s.
    const resetAt = Math.floor(Date.now() / 1000 / 60) * 60 + 60;
    expect(await limiter.check("u_1")).toEqual({ allowed: true, count: 1, limit: 3, resetAt });
    expect(await limiter.check("u_1")).toEqual({ allowed: true, count: 2, limit: 3, resetAt });
    expect(await limiter.check("u_1")).toEqual({ allowed: true, count: 3, limit: 3, resetAt });
  });

  it("denies once the limit is reached", async () => {
    const limiter = makeRateLimiter(env.DB, { limit: 2, windowSeconds: 60 });
    await limiter.check("u_2");
    await limiter.check("u_2");
    const denied = await limiter.check("u_2");
    expect(denied.allowed).toBe(false);
    expect(denied.count).toBeGreaterThan(2);
  });

  it("isolates buckets by userId", async () => {
    const limiter = makeRateLimiter(env.DB, { limit: 1, windowSeconds: 60 });
    expect((await limiter.check("u_a")).allowed).toBe(true);
    expect((await limiter.check("u_b")).allowed).toBe(true);
    expect((await limiter.check("u_a")).allowed).toBe(false);
  });

  it("rolls over when the window advances", async () => {
    const limiter = makeRateLimiter(env.DB, { limit: 1, windowSeconds: 60 });
    expect((await limiter.check("u_3")).allowed).toBe(true);
    expect((await limiter.check("u_3")).allowed).toBe(false);
    vi.setSystemTime(new Date("2026-04-26T12:01:30Z")); // +90s = next minute bucket
    expect((await limiter.check("u_3")).allowed).toBe(true);
  });

  it("survives concurrent requests without lost increments (UPSERT atomicity)", async () => {
    const limiter = makeRateLimiter(env.DB, { limit: 10, windowSeconds: 60 });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => limiter.check("u_concurrent")),
    );
    const counts = results.map((r) => r.count).sort((a, b) => a - b);
    expect(counts).toEqual([1, 2, 3, 4, 5]);
    expect(results.every((r) => r.allowed)).toBe(true);
  });
});
