// Test helpers for `@nlqdb/events`. Use `makeFakeQueue()` to build a
// queue stub with an in-memory `sent` array — assertions drive off
// that. Mirrors the pattern in `@nlqdb/otel/test`.

import type { EventEnvelope } from "./types.ts";

export type FakeQueue = {
  send(message: EventEnvelope): Promise<void>;
  sent: EventEnvelope[];
  // Set to a thrown error and the next `send()` rejects with it.
  // Cleared after one use, so the next call succeeds.
  failNext?: Error;
};

export function makeFakeQueue(): FakeQueue {
  const queue: FakeQueue = {
    sent: [],
    async send(message) {
      if (queue.failNext) {
        const err = queue.failNext;
        queue.failNext = undefined;
        throw err;
      }
      queue.sent.push(message);
    },
  };
  return queue;
}
