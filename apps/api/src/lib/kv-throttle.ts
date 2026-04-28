// Per-key fixed-window throttle backed by Cloudflare KV.
//
// Used by every defensive limiter that doesn't go through Better Auth's
// rate-limit plumbing — magic-link send (per-email), waitlist signup
// (per-IP), and any future low-traffic endpoint that needs a counter
// without wiring a Durable Object.
//
// Semantics — fixed-window with renewing TTL:
// The counter increments per consume; the KV `expirationTtl` is
// re-set to `windowSeconds` on every put. This means the window
// EXPIRY slides, but the counter BASE does not — three hits in
// quick succession followed by silence will only reset to zero
// after `windowSeconds` of idle. Under sustained traffic the
// counter never decays, which is functionally equivalent to a
// fixed-window-with-renewal, NOT a true sliding window. For
// defense-in-depth this is fine; if you need real sliding-window
// semantics, store timestamps and bucket-decay in a Durable
// Object instead.
//
// Race-window honesty:
// KV reads are eventually consistent, so N concurrent isolates can
// each observe `count<max` and each write `count+1` — at the edge,
// "N" can be on the order of CF colos under a coordinated burst
// (roughly tens, not hundreds in practice). The breach for a
// 3-per-window limiter under colo-spread abuse is therefore closer
// to 3×colo-count than 3×2. For low-traffic defensive limiters
// (waitlist signup, magic-link send) that's still well below an
// abuse-relevant threshold; for anything where exact-count matters,
// use a Durable Object.

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
  // Decrement a previously-consumed counter, e.g. after the operation
  // the consume was guarding (sending a magic-link email) failed at a
  // downstream service. Best-effort: a corrupted or already-expired
  // value is treated as zero so we never go negative. Never throws.
  rollback(key: string): Promise<void>;
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
    async rollback(key: string): Promise<void> {
      const fullKey = `${config.prefix}${key}`;
      let count = 0;
      try {
        const raw = await kv.get(fullKey);
        count = raw ? Number.parseInt(raw, 10) : 0;
        if (Number.isNaN(count)) count = 0;
      } catch {
        return;
      }
      if (count <= 0) return;
      try {
        // Always re-put rather than delete, so callers don't need a
        // KV.delete capability in their fake namespace and the TTL
        // continues ticking off the original consume time.
        await kv.put(fullKey, String(count - 1), { expirationTtl: ttl });
      } catch {
        // Best-effort. Worst case: the user spends a counter slot
        // they shouldn't have — strictly safer than not rolling back.
      }
    },
  };
}
