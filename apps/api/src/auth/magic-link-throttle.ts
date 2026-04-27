// Per-email magic-link send throttle backed by KV. Closes the gap left
// by Better Auth's per-IP rate limit: one attacker, many target inboxes.
// Counters are keyed by SHA-256(email lowercased) so plaintext addresses
// never reach KV.

const KEY_PREFIX = "mlt:";

export type MagicLinkThrottleConfig = {
  max: number;
  windowSeconds: number;
};

export type MagicLinkThrottle = {
  tryConsume(emailHash: string): Promise<boolean>;
};

export function makeMagicLinkThrottle(
  kv: KVNamespace,
  config: MagicLinkThrottleConfig,
): MagicLinkThrottle {
  return {
    async tryConsume(emailHash: string): Promise<boolean> {
      const key = `${KEY_PREFIX}${emailHash}`;
      const raw = await kv.get(key);
      const count = raw ? Number.parseInt(raw, 10) : 0;
      if (count >= config.max) return false;
      // KV `expirationTtl` is per-write, not per-key. Increment by
      // re-writing with the same TTL — the window slides on each
      // successful send, which is what we want for this defensive
      // limit. KV reads are eventually consistent so concurrent sends
      // can race past the cap; the breach is bounded (max+isolates),
      // acceptable for a defense-in-depth check.
      await kv.put(key, String(count + 1), { expirationTtl: config.windowSeconds });
      return true;
    },
  };
}

export async function hashEmail(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
