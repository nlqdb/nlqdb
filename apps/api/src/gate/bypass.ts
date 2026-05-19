// `SK-GATE-003` bypass primitives. Two invariants worth knowing:
//
//   - Codes hashed at rest (`sha256(code).slice(0,32)`). A KV listing
//     leak doesn't reveal plaintext.
//   - Constant timing: an absent invite header still issues a KV read
//     against a fixed decoy key, so an attacker can't probe by timing.
//
// Both primitives are fail-closed: KV errors are caught here and the
// outcome reports `{hit: false, error}` instead of throwing. Cloudflare's
// post-June-2026 KV-incident guidance is to handle KV exceptions inside
// middleware rather than crash the request
// (https://blog.cloudflare.com/workers-kv-restoring-reliability/).

import { sha256Hex } from "../principal.ts";

const ALLOWLIST_PREFIX = "gate:user:";
const INVITE_PREFIX = "gate:invite:";
const INVITE_TIMING_DECOY_KEY = `${INVITE_PREFIX}__decoy__`;

export type BypassReadOutcome = {
  hit: boolean;
  error?: string;
};

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

export async function isInviteValid(
  kv: KVNamespace,
  inviteHeader: string | null | undefined,
): Promise<BypassReadOutcome> {
  const code = (inviteHeader ?? "").trim();
  if (!code) {
    // Decoy read exists for timing shape, not correctness — swallow.
    try {
      await kv.get(INVITE_TIMING_DECOY_KEY);
    } catch {}
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
