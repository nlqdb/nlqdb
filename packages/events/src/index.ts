// @nlqdb/events — producer SDK for product events.
//
// Two emitters:
//   • makeQueueEmitter(queue) — Cloudflare Queues binding. Production.
//   • makeNoopEmitter()       — discards everything. For tests + any
//                               environment where the EVENTS_QUEUE
//                               binding isn't present (local wrangler
//                               dev without --remote).
//
// The `emit()` interface is shared so call-sites don't branch.
//
// Telemetry: a span `nlqdb.events.enqueue` wraps each send. Failures
// are recorded but NOT thrown — emit is "fire-and-forget" by contract
// (the consumer worker handles delivery retries; if the queue write
// itself fails, we log + drop, since blocking the request on event
// emission would be the bigger UX failure).

import { type Span, SpanStatusCode, trace } from "@opentelemetry/api";
import type { EventEnvelope, ProductEvent } from "./types.ts";

export type { EventEnvelope, ProductEvent } from "./types.ts";

export interface EventEmitter {
  emit(event: ProductEvent, options?: EmitOptions): Promise<void>;
}

export type EmitOptions = {
  // Override the auto-generated envelope id. Use this when the same
  // logical event might be emitted multiple times and you want the
  // consumer to dedupe (LogSnag accepts an `event_id` for idempotency).
  id?: string;
};

// Cloudflare Queues binding shape. We only depend on the `.send()`
// method — typing it narrowly here so consumers don't need
// `@cloudflare/workers-types` transitively. The return type is
// `Promise<unknown>` rather than `Promise<void>` so the production
// `Queue.send()` (which resolves to `QueueSendResponse`) is assignable
// without casting at the call site.
export interface QueueLike {
  send(message: EventEnvelope): Promise<unknown>;
}

export function makeQueueEmitter(queue: QueueLike): EventEmitter {
  const tracer = trace.getTracer("@nlqdb/events");
  return {
    async emit(event, options) {
      await tracer.startActiveSpan("nlqdb.events.enqueue", async (span: Span) => {
        span.setAttribute("nlqdb.event.type", event.name);
        const envelope: EventEnvelope = {
          id: options?.id ?? defaultId(event),
          ts: Date.now(),
          event,
        };
        try {
          await queue.send(envelope);
        } catch (err) {
          // Non-fatal: producer failure shouldn't 500 the request.
          // The OTel span carries the diagnostic; the request continues.
          const error = err instanceof Error ? err : new Error(String(err));
          span.recordException(error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        } finally {
          span.end();
        }
      });
    },
  };
}

export function makeNoopEmitter(): EventEmitter {
  return { emit: async () => {} };
}

// Auto-generated id strategy: tries to be stable for the events that
// fire at most once per user (so LogSnag dedupes naturally if a retry
// produces a duplicate enqueue). Falls back to a per-call random id
// when the event has no stable scope.
function defaultId(event: ProductEvent): string {
  switch (event.name) {
    case "user.first_query":
      return `${event.name}.${event.userId}`;
    case "user.registered":
      return `${event.name}.${event.userId}`;
    case "user.waitlist_joined":
      return `${event.name}.${event.emailHash}`;
    case "billing.subscription_created":
      return `${event.name}.${event.subscriptionId}`;
    case "billing.subscription_canceled":
      return `${event.name}.${event.subscriptionId}`;
    default: {
      const _exhaustive: never = event;
      return `evt.${crypto.randomUUID()}`;
    }
  }
}
