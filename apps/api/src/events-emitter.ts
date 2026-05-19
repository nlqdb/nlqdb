// Tiny factory for the @nlqdb/events EventEmitter — separated from
// `ask/build-deps.ts` (which imports `cloudflare:workers` at top
// level and therefore can't be loaded by the unit-pool vitest project).
//
// Production wires the `EVENTS_QUEUE` binding; unit / integration tests
// and any environment with the binding unset get a no-op emitter so no
// queue mock is needed. Used by `orchestrateAsk`, the Stripe webhook,
// and `gate/middleware.ts`.

import { type EventEmitter, makeNoopEmitter, makeQueueEmitter } from "@nlqdb/events";

export function buildEventEmitter(queue: Queue | undefined): EventEmitter {
  return queue ? makeQueueEmitter(queue) : makeNoopEmitter();
}
