// KV-backed per-user rate limiter for `/v1/ask` (DESIGN §4.2 /
// IMPLEMENTATION §8 / PLAN §11.5 — "per-IP + per-account rate limits
// Day 1"). Fixed-window counter: each user gets N requests per W
// seconds, keyed by `ratelimit:<userId>:<windowStart>`.
//
// Why fixed window vs token bucket: KV's eventual consistency makes a
// real token bucket fragile, and we don't need burst-smoothness for
// /v1/ask — the bound is "stop a single user from exhausting the
// daily LLM RPD on their own". A leaky-bucket implementation can
// land if the metric ever shows users hitting the cap legitimately.

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_SECONDS = 60;

export type RateLimitStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
};

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

export function makeRateLimiter(store: RateLimitStore, opts: RateLimitOptions = {}): RateLimiter {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const windowSeconds = opts.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

  return {
    async check(userId) {
      const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
      const key = `ratelimit:${userId}:${windowStart}`;
      const raw = await store.get(key);
      const current = raw ? Number.parseInt(raw, 10) || 0 : 0;
      if (current >= limit) {
        return { allowed: false, count: current, limit };
      }
      // Cloudflare KV minimum TTL is 60s. Set the entry's TTL to the
      // window length (or 60, whichever is greater) so it auto-expires.
      const expirationTtl = Math.max(windowSeconds, 60);
      await store.put(key, String(current + 1), { expirationTtl });
      return { allowed: true, count: current + 1, limit };
    },
  };
}
