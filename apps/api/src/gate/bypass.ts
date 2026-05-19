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
// A KV miss is the only "no bypass" outcome; KV errors propagate to
// the caller's catch (which treats them as no-bypass and closes the
// gate — fail-safe).

import { sha256Hex } from "../principal.ts";

const ALLOWLIST_PREFIX = "gate:user:";
const INVITE_PREFIX = "gate:invite:";

// Fixed-shape key so `kv.get` is called on every request even when
// no invite header is present. Empty hash slot the bypass set will
// never populate — guarantees a miss with the same KV round-trip
// shape as a real lookup.
const INVITE_TIMING_DECOY_KEY = `${INVITE_PREFIX}__decoy__`;

/**
 * Check the per-user allowlist. Returns true when the principal is bypassed.
 * `null` principalId (anon, no account) short-circuits to false without a KV read.
 */
export async function isUserAllowlisted(
  kv: KVNamespace,
  principalId: string | null,
): Promise<boolean> {
  if (!principalId) return false;
  const value = await kv.get(`${ALLOWLIST_PREFIX}${principalId}`);
  return value !== null;
}

/**
 * Check the invite code KV set. Returns true when the header matches
 * a valid stored hash. A null / empty header still issues a KV read
 * against a decoy key to keep timing constant.
 */
export async function isInviteValid(
  kv: KVNamespace,
  inviteHeader: string | null | undefined,
): Promise<boolean> {
  const code = (inviteHeader ?? "").trim();
  if (!code) {
    // Decoy read — same KV round-trip shape as the real path.
    await kv.get(INVITE_TIMING_DECOY_KEY);
    return false;
  }
  const hash = await sha256Hex(code, 32);
  const value = await kv.get(`${INVITE_PREFIX}${hash}`);
  return value !== null;
}
