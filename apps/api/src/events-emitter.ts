// Extracted from `ask/build-deps.ts` so callers that can't import
// `cloudflare:workers` at top level (notably the gate middleware
// exercised by unit-pool tests) still have access.

import { type EventEmitter, makeNoopEmitter, makeQueueEmitter } from "@nlqdb/events";

export function buildEventEmitter(queue: Queue | undefined): EventEmitter {
  return queue ? makeQueueEmitter(queue) : makeNoopEmitter();
}
