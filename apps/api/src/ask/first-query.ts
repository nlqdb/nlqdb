// First-query tracker. KV-backed flag; orchestrator pattern is
// emit-then-commit (UX > strict-once):
//
//   1. `notFiredYet(userId)` — KV read.
//   2. (caller emits the OTel event.)
//   3. `commit(userId)`     — KV write, swallowed by caller on failure.
//
// A commit failure means the next request re-emits — slight over-count
// is preferred to 500-ing a query the user already paid for in LLM
// tokens.

import type { KVStore } from "../kv-store.ts";

const KEY_PREFIX = "first_query:";
// One year — long enough that we're not re-firing the event every 60s
// when a user goes quiet. KV maximum TTL is well above this.
const FLAG_TTL_SECONDS = 365 * 24 * 60 * 60;

export type FirstQueryTracker = {
  // True if the flag is absent — i.e. the caller should emit the event
  // (and then call `commit` to record it).
  notFiredYet(userId: string): Promise<boolean>;
  // Records that the user has fired their first-query event.
  // Idempotent — safe to call multiple times for the same user.
  commit(userId: string): Promise<void>;
};

export function makeFirstQueryTracker(store: KVStore): FirstQueryTracker {
  return {
    async notFiredYet(userId) {
      const seen = await store.get(`${KEY_PREFIX}${userId}`);
      return seen === null;
    },
    async commit(userId) {
      await store.put(`${KEY_PREFIX}${userId}`, "1", { expirationTtl: FLAG_TTL_SECONDS });
    },
  };
}
