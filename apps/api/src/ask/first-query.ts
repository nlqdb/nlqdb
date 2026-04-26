// First-query tracker. KV-backed flag, set the first time a user
// successfully completes a `/v1/ask` request. The orchestrator emits
// the `nlqdb.events.emit` span + a `user.first_query` event when this
// flag was previously absent (PERFORMANCE §4 row 6 + IMPLEMENTATION
// §4 line 451).
//
// Concurrency note: two near-simultaneous first requests can both see
// the flag as absent and both emit the event. Both writes succeed
// idempotently. The slight over-count is acceptable for a Phase-0
// product metric — the alternative (D1 + transaction) is more
// machinery than the signal warrants.

const KEY_PREFIX = "first_query:";
// One year — long enough that we're not re-firing the event every 60s
// when a user goes quiet. KV maximum TTL is well above this.
const FLAG_TTL_SECONDS = 365 * 24 * 60 * 60;

export type FirstQueryStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
};

export type FirstQueryTracker = {
  // Returns true if this is the user's first query (event should fire);
  // false if the flag was already present.
  markIfFirst(userId: string): Promise<boolean>;
};

export function makeFirstQueryTracker(store: FirstQueryStore): FirstQueryTracker {
  return {
    async markIfFirst(userId) {
      const key = `${KEY_PREFIX}${userId}`;
      const seen = await store.get(key);
      if (seen) return false;
      await store.put(key, "1", { expirationTtl: FLAG_TTL_SECONDS });
      return true;
    },
  };
}
