// KV-backed plan cache for `/v1/ask`. Keyed by (schemaHash, queryHash)
// per docs/architecture.md §0.1 ("plans are content-addressed and cached per-schema-
// hash"). Hit-rate carries the cost story (PLAN line 394 / DESIGN line
// 591); the LLM router only fires on miss.
//
// Spans + metrics emitted by the consumer (orchestrate.ts) — this
// module is pure storage so it stays unit-testable against a plain
// Storage stub.

import type { KVStore } from "../kv-store.ts";
import type { CachedPlan } from "./types.ts";

// Min Cloudflare KV TTL is 60s; the plan cache is intentionally
// long-lived because plans are content-addressed (a schema/query hash
// change naturally evicts the old entry by missing). 30 days balances
// "warm cache after weeks of idle" against "free-tier KV churn caps".
export const PLAN_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

const KEY_PREFIX = "plan:";

export type PlanCache = {
  lookup(schemaHash: string, queryHash: string): Promise<CachedPlan | null>;
  write(schemaHash: string, queryHash: string, plan: CachedPlan): Promise<void>;
};

function key(schemaHash: string, queryHash: string): string {
  return `${KEY_PREFIX}${schemaHash}:${queryHash}`;
}

export function makePlanCache(store: KVStore): PlanCache {
  return {
    async lookup(schemaHash, queryHash) {
      const raw = await store.get(key(schemaHash, queryHash));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as CachedPlan;
      } catch {
        // Corrupted entry — treat as miss; next write overwrites.
        return null;
      }
    },
    async write(schemaHash, queryHash, plan) {
      await store.put(key(schemaHash, queryHash), JSON.stringify(plan), {
        expirationTtl: PLAN_CACHE_TTL_SECONDS,
      });
    },
  };
}

// SubtleCrypto SHA-256 → hex. Available in Workers, Node ≥18, browsers.
export async function hashGoal(goal: string): Promise<string> {
  const data = new TextEncoder().encode(goal.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
