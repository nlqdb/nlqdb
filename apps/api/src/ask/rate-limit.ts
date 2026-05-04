// D1-backed per-user rate limiter for `/v1/ask` (docs/architecture.md §4.2 /
// IMPLEMENTATION §8 / PLAN §11.5 — "per-IP + per-account rate limits
// Day 1"). Fixed-window counter, atomic UPSERT-with-RETURNING.
//
// Why D1 not KV: KV writes are 1k/day on Free; one rate-limit `put`
// per `/v1/ask` exhausts that at ~1k requests total. D1 writes are
// 100k/day on Free — 100× headroom — and SQLite UPSERT lets us
// increment + read the resulting count in a single atomic round-trip,
// avoiding the read-then-write race the KV version had.
//
// Per-IP rate-limit (companion to per-account, per IMPLEMENTATION §8)
// lands when anonymous mode does — that's the surface that needs it.
// Until then, every request is gated by `requireSession` so per-account
// is sufficient.

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_SECONDS = 60;

export type RateLimitDecision = {
  allowed: boolean;
  // Current count after this request (allowed) / observed count
  // (denied). Useful for surfacing in 429 responses.
  count: number;
  limit: number;
};

export type RateLimitOptions = {
  limit?: number;
  windowSeconds?: number;
};

export type RateLimiter = {
  check(userId: string): Promise<RateLimitDecision>;
};

// Atomically increments the (user_id, window_start) counter and
// returns the new count. SQLite UPSERT semantics: insert with count=1
// on first hit, increment on conflict. RETURNING surfaces the post-
// increment count so the caller can decide allow/deny.
//
// Over-limit requests still increment — the second over-limit hit
// just bumps the count from N+1 to N+2, both deny. Harmless; avoids
// a conditional UPDATE that'd require a second SELECT to read state.
const UPSERT_SQL = `
  INSERT INTO rate_limit_buckets (user_id, window_start, count)
  VALUES (?, ?, 1)
  ON CONFLICT(user_id, window_start)
  DO UPDATE SET count = count + 1
  RETURNING count
`;

export function makeRateLimiter(d1: D1Database, opts: RateLimitOptions = {}): RateLimiter {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const windowSeconds = opts.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

  return {
    async check(userId) {
      const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
      const row = await d1.prepare(UPSERT_SQL).bind(userId, windowStart).first<{ count: number }>();
      const count = row?.count ?? 1;
      return { allowed: count <= limit, count, limit };
    },
  };
}
