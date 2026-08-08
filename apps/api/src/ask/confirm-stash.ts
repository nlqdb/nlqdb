// Server-side binding between a write preview and its commit (SK-TRUST-005).
// SK-TRUST-001 promises "the committed statement is the previewed statement" —
// but the `/v1/ask` confirm hop re-derives SQL from the goal, and the plan
// cache is exec-gated (SK-ASK-015) so a previewed write is never cached.
// Without a binding the confirm hop re-plans, and the (non-deterministic)
// planner can emit a different — or allowlist-rejected — statement than the
// one the user saw in the diff and approved (the "approve → That query was
// rejected" failure). This stash holds the exact validated preview SQL so the
// confirm hop runs THAT statement, never a re-plan.
//
// NOT the plan cache: that key is `(schema_hash, query_hash)` and shared
// across every DB with the same schema (SK-ASK-025), so stashing a write plan
// there would leak one tenant's write into another tenant's identical goal.
// This key is scoped to `(tenant, db, query_hash)` and holds only a preview
// awaiting its own owner's confirm. Short-lived: a preview the user never
// approves expires on its own.
//
// Pure storage (mirrors `plan-cache.ts`) — spans are emitted by the consumer
// (`orchestrate.ts`) so this stays unit-testable against a plain Map stub.

import type { KVStore } from "../kv-store.ts";

// Min Cloudflare KV TTL is 60s. A user approves a preview in seconds; 5
// minutes covers a distracted click without keeping stale writes around.
export const CONFIRM_STASH_TTL_SECONDS = 300;

const KEY_PREFIX = "confirm:";

// The validated preview, enough to exec + rebuild the response trace on
// confirm without re-planning.
export type StashedPlan = {
  sql: string;
  schemaHash: string;
  model: string;
  confidence: number;
};

export type ConfirmStash = {
  lookup(tenantId: string, dbId: string, queryHash: string): Promise<StashedPlan | null>;
  write(tenantId: string, dbId: string, queryHash: string, plan: StashedPlan): Promise<void>;
};

function key(tenantId: string, dbId: string, queryHash: string): string {
  return `${KEY_PREFIX}${tenantId}:${dbId}:${queryHash}`;
}

export function makeConfirmStash(store: KVStore): ConfirmStash {
  return {
    async lookup(tenantId, dbId, queryHash) {
      const raw = await store.get(key(tenantId, dbId, queryHash));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StashedPlan;
      } catch {
        // Corrupted entry — treat as no stash; the confirm hop falls back to
        // re-planning rather than throwing.
        return null;
      }
    },
    async write(tenantId, dbId, queryHash, plan) {
      await store.put(key(tenantId, dbId, queryHash), JSON.stringify(plan), {
        expirationTtl: CONFIRM_STASH_TTL_SECONDS,
      });
    },
  };
}
