// Two bypass primitives, both KV-backed (`SK-GATE-003`):
//
//   1. Per-user allowlist — `gate:user:<principal.id>` for design
//      partners with an account. `principal.id` carries the
//      account-tenant for `user` / `sk_live` / `sk_mcp` / `pk_live`
//      principals; `anon` principals are skipped here (their id is a
//      hashed bearer token, never an allowlist key).
//
//   2. Per-code invite — header `X-Invite-Code: <code>` is looked
//      up at `gate:invite:<sha256(code).slice(0,32)>`. Codes are
//      never stored plaintext. The lookup runs unconditionally on
//      every request (`null` code triggers a fixed-key noop read)
//      so the response timing doesn't reveal whether the header was
//      present — a small but cheap defence against probing.
//
// Both reads run in parallel from `middleware.ts` via `Promise.all`.
// KV errors are caught and logged here — the gate is fail-closed:
// a KV outage means we cannot prove a bypass, so the caller falls
// through to the 403 progress body. This matches Cloudflare's
// post-June-2026 KV-incident guidance to handle KV exceptions
// explicitly rather than letting them propagate out of middleware
// (see `blog.cloudflare.com/workers-kv-restoring-reliability/`).

import { sha256Hex } from "../principal.ts";

const ALLOWLIST_PREFIX = "gate:user:";
const INVITE_PREFIX = "gate:invite:";

// Fixed-shape key so `kv.get` is called on every request even when
// no invite header is present. Empty hash slot the bypass set will
// never populate — guarantees a miss with the same KV round-trip
// shape as a real lookup.
const INVITE_TIMING_DECOY_KEY = `${INVITE_PREFIX}__decoy__`;

export type BypassReadOutcome = {
  /** True when the lookup confirmed a bypass. False on miss OR on KV error. */
  hit: boolean;
  /** Set on KV exception — surfaces in the span so operators can see KV trouble. */
  error?: string;
};

/**
 * Check the per-user allowlist. Returns `{hit: true}` when the principal is bypassed.
 * `null` principalId (anon, no account) short-circuits to a miss without a KV read.
 * KV errors are caught — see module header.
 */
export async function isUserAllowlisted(
  kv: KVNamespace,
  principalId: string | null,
): Promise<BypassReadOutcome> {
  if (!principalId) return { hit: false };
  try {
    const value = await kv.get(`${ALLOWLIST_PREFIX}${principalId}`);
    return { hit: value !== null };
  } catch (err) {
    return { hit: false, error: (err as Error).message };
  }
}

/**
 * Check the invite code KV set. Returns `{hit: true}` when the header
 * matches a valid stored hash. A null / empty header still issues a KV
 * read against a decoy key to keep timing constant. KV errors are
 * caught — see module header.
 */
export async function isInviteValid(
  kv: KVNamespace,
  inviteHeader: string | null | undefined,
): Promise<BypassReadOutcome> {
  const code = (inviteHeader ?? "").trim();
  if (!code) {
    try {
      await kv.get(INVITE_TIMING_DECOY_KEY);
    } catch {
      // Swallowed deliberately — the decoy read exists for timing
      // shape, not correctness. If KV is down we still return a miss.
    }
    return { hit: false };
  }
  try {
    const hash = await sha256Hex(code, 32);
    const value = await kv.get(`${INVITE_PREFIX}${hash}`);
    return { hit: value !== null };
  } catch (err) {
    return { hit: false, error: (err as Error).message };
  }
}
