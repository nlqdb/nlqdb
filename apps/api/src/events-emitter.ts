// Extracted from `ask/build-deps.ts` so callers that can't import
// `cloudflare:workers` at top level (notably the gate middleware
// exercised by unit-pool tests) still have access.

import { type EventEmitter, makeNoopEmitter, makeQueueEmitter } from "@nlqdb/events";

/**
 * Preview versions (`NODE_ENV=preview`, `wrangler versions upload`) inherit
 * prod's `EVENTS_QUEUE`, so a review walk would page the founder and spend
 * prod's LogSnag quota (`SK-EVENTS-006`): they emit nothing.
 */
export function buildEventEmitter(env: {
  EVENTS_QUEUE?: Queue | undefined;
  NODE_ENV?: string | undefined;
}): EventEmitter {
  return env.EVENTS_QUEUE && env.NODE_ENV !== "preview"
    ? makeQueueEmitter(env.EVENTS_QUEUE)
    : makeNoopEmitter();
}
