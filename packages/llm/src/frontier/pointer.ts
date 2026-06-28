// SK-FRONTIER-003 — the KV "active frontier tier" pointer. A single KV key
// names the currently usable tier id (or the sentinel `"none"`), so the
// selector dispatches STRAIGHT to the live tier in one O(1) KV read instead
// of paying real wall-clock walking already-exhausted keys (each a network
// round-trip + breaker trip) before falling through to the free chain.
//
// On a budget/quota exhaustion the caller advances the pointer to the next
// tier (or `"none"` once all are spent); a daily/cron reset restores it to
// the top tier. The pointer is advisory + self-healing: a stale `"none"`
// only costs a fall-through, never a wrong answer.
//
// "Redis key" → Cloudflare KV: the founder described this as a "Redis key",
// but nlqdb's key-value store IS Cloudflare KV (GLOBAL-013: no extra paid
// infra). This module talks to an injected minimal KV interface, so if a
// true Redis is ever introduced the binding swaps with no lane-logic change
// (FEATURE.md Open question — "Redis vs Cloudflare KV", defaulting to KV).

import type { FrontierTier } from "./tiers.ts";

// The KV key holding the active tier id (or `"none"`).
export const ACTIVE_TIER_KEY = "frontier:active_tier";

// Sentinel: the lane is fully exhausted ⇒ the selector returns `null`
// immediately (no provider call).
export const NO_ACTIVE_TIER = "none";

// Minimal injected KV interface — deliberately NOT Cloudflare's
// `KVNamespace` type (this package is zero-dep). `apps/api` wires
// `env.KV`, which satisfies this shape.
export type FrontierKv = {
  get(key: string): Promise<string | null>;
  put(key: string, val: string): Promise<void>;
};

// Read the active tier id. Defaults to the TOP tier id when unset — the
// ladder starts at its highest-quality tier on a fresh budget window.
// Callers that need the ladder to validate the id against pass `tiers`;
// when the pointer is unset we return `tiers[0]?.id` (or `"none"` when the
// ladder is empty — no keys configured).
export async function readActiveTier(kv: FrontierKv, tiers: FrontierTier[]): Promise<string> {
  const stored = await kv.get(ACTIVE_TIER_KEY);
  if (stored !== null) return stored;
  return tiers[0]?.id ?? NO_ACTIVE_TIER;
}

// Advance the pointer past `fromTierId` to the next tier in the ladder,
// writing `"none"` when `fromTierId` is the last (or unknown) tier. Returns
// the value written. Called on a budget/quota (429/insufficient_quota)
// exhaustion of the current tier.
export async function advanceActiveTier(
  kv: FrontierKv,
  tiers: FrontierTier[],
  fromTierId: string,
): Promise<string> {
  const idx = tiers.findIndex((t) => t.id === fromTierId);
  // Unknown id, or the last tier ⇒ the ladder is spent.
  const next = idx >= 0 && idx + 1 < tiers.length ? tiers[idx + 1]?.id : undefined;
  const value = next ?? NO_ACTIVE_TIER;
  await kv.put(ACTIVE_TIER_KEY, value);
  return value;
}

// Reset the pointer to the top tier (the daily/cron budget-window
// rollover). Writes `"none"` when no tier is configured.
export async function resetActiveTier(kv: FrontierKv, tiers: FrontierTier[]): Promise<void> {
  await kv.put(ACTIVE_TIER_KEY, tiers[0]?.id ?? NO_ACTIVE_TIER);
}
