// Per-email magic-link send throttle. Closes the gap left by Better
// Auth's per-IP rate limit: one attacker, many target inboxes.
//
// Counter keyed by SHA-256(email lowercased) so plaintext addresses
// never reach KV. Storage + race semantics are inherited from
// `makeKvThrottle` — see `lib/kv-throttle.ts` for the fail-open and
// TOCTOU notes.

import { makeKvThrottle, type Throttle } from "../lib/kv-throttle.ts";

export type MagicLinkThrottleConfig = {
  max: number;
  windowSeconds: number;
};

export type MagicLinkThrottle = {
  tryConsume(emailHash: string): Promise<boolean>;
  rollback(emailHash: string): Promise<void>;
};

export function makeMagicLinkThrottle(
  kv: KVNamespace,
  config: MagicLinkThrottleConfig,
): MagicLinkThrottle {
  const throttle: Throttle = makeKvThrottle(kv, {
    prefix: "mlt:",
    max: config.max,
    windowSeconds: config.windowSeconds,
  });
  return {
    tryConsume: (emailHash) => throttle.tryConsume(emailHash),
    rollback: (emailHash) => throttle.rollback(emailHash),
  };
}

export async function hashEmail(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
