// D1-backed rate limiter for `/v1/ask`. Bucket policy lives in
// `principal.ts::rateLimitBucketKey` (`SK-MCP-009`); this file stays
// principal-agnostic and keys by an opaque `bucketKey` string.
//
// D1 not KV: KV's 1k writes/day Free-tier ceiling blows at ~1k requests
// total; D1's 100k/day + atomic UPSERT-with-RETURNING gives 100×
// headroom and removes the KV read-then-write race.

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_SECONDS = 60;

export type RateLimitDecision = {
  allowed: boolean;
  count: number;
  limit: number;
  resetAt: number;
};

export type RateLimitOptions = {
  limit?: number;
  windowSeconds?: number;
};

export type RateLimiter = {
  check(bucketKey: string): Promise<RateLimitDecision>;
};

// Over-limit requests still increment; a conditional UPDATE would need a second SELECT.
const UPSERT_SQL = `
  INSERT INTO rate_limit_buckets (bucket_key, window_start, count)
  VALUES (?, ?, 1)
  ON CONFLICT(bucket_key, window_start)
  DO UPDATE SET count = count + 1
  RETURNING count
`;

export function makeRateLimiter(d1: D1Database, opts: RateLimitOptions = {}): RateLimiter {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const windowSeconds = opts.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

  return {
    async check(bucketKey) {
      const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
      const row = await d1
        .prepare(UPSERT_SQL)
        .bind(bucketKey, windowStart)
        .first<{ count: number }>();
      const count = row?.count ?? 1;
      const resetAt = windowStart + windowSeconds;
      return { allowed: count <= limit, count, limit, resetAt };
    },
  };
}
