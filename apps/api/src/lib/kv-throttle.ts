// Per-key sliding-window throttle backed by Cloudflare KV.
//
// Used by every defensive limiter that doesn't go through Better Auth's
// rate-limit plumbing — magic-link send (per-email), waitlist signup
// (per-IP), and any future low-traffic endpoint that needs a counter
// without wiring a Durable Object.
//
// Race-window honesty:
// KV reads are eventually consistent, so two concurrent calls for the
// same key can both observe `count=N` and both write `N+1` — the
// breach is bounded to ~max-per-isolate-pair, not unbounded. That's
// fine for defense-in-depth limits (real abuse is per-window, not
// per-millisecond burst); use a Durable Object if you need exactly-once
// counting.
//
// `expirationTtl` is per-write, so each successful consume slides the
// window forward. Choosing this over fixed-window because real abusers
// pause and retry, and the slide makes "wait it out" cheaper for the
// limiter (the entry decays naturally) than for the abuser (each
// retry resets their cooldown).

const KV_MIN_TTL_SECONDS = 60;

export type ThrottleConfig = {
  // Key prefix in KV (e.g. "wl:rate:", "mlt:"). Keep distinct per
  // limiter so two unrelated limiters don't share a counter.
  prefix: string;
  // Hits permitted per `windowSeconds` before consume returns false.
  max: number;
  // Window length in seconds. Floored to KV's 60s minimum.
  windowSeconds: number;
};

export type Throttle = {
  // Returns `true` if the call is within the limit (and increments the
  // counter); `false` if the limit is exhausted (counter unchanged).
  // Never throws — KV outage degrades to "fail open" because the
  // throttle is always defense-in-depth, never the only protection.
  tryConsume(key: string): Promise<boolean>;
};

export function makeKvThrottle(kv: KVNamespace, config: ThrottleConfig): Throttle {
  const ttl = Math.max(config.windowSeconds, KV_MIN_TTL_SECONDS);
  return {
    async tryConsume(key: string): Promise<boolean> {
      const fullKey = `${config.prefix}${key}`;
      let count = 0;
      try {
        const raw = await kv.get(fullKey);
        count = raw ? Number.parseInt(raw, 10) : 0;
        if (Number.isNaN(count)) count = 0;
      } catch {
        // KV read failure → fail open. Defensive limiter, not the
        // only protection.
        return true;
      }
      if (count >= config.max) return false;
      try {
        await kv.put(fullKey, String(count + 1), { expirationTtl: ttl });
      } catch {
        // KV write failure → still allow the request. Same rationale.
      }
      return true;
    },
  };
}
