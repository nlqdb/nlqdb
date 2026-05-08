// Product-event schema. Discriminated union — `name` is the
// dispatch key in `apps/events-worker/src/sinks/`. Adding a new event:
//
//   1. Add a variant here.
//   2. Add a sink (or extend an existing sink's `handle()` switch) in
//      apps/events-worker/src/sinks/<name>.ts.
//   3. Producers can call `events.emit({ name, ... })` immediately —
//      consumer dispatch is the only place that needs to know the new
//      shape.
//
// Convention: `name` is `<domain>.<verb_noun>` (e.g. `user.first_query`,
// `billing.subscription_created`, `ask.completed`). Domains today:
// `user`, `billing`, `ask`.

// `ask.completed` carries the anonymised fingerprint of a successful
// `/v1/ask` resolution — the input W5's daily reshape consumes off the
// Tinybird `query_log` Data Source. No SQL text, no values, no PII;
// `query_hash` is sufficient for de-duplication of recurring patterns.
export type AskCompletedEvent = {
  name: "ask.completed";
  dbId: string;
  schemaHash: string;
  queryHash: string;
  // Anonymised fingerprint of the planned SQL — distinct from
  // `queryHash` (which is over the user's goal). Same goal can produce
  // structurally different plans across schema_hashes / model versions;
  // capturing both gives the analyser dedup at goal- and at plan-shape-
  // level.
  planShape: string;
  engine: "postgres" | "clickhouse";
  ms: number;
  rowsReturned: number;
  // Unix-ms at orchestrator success. Distinct from `EventEnvelope.ts`
  // (producer enqueue time) — the analyser needs the `/v1/ask` end
  // timestamp, not the queue-publish timestamp, for accurate p99
  // bucketing.
  ts: number;
};

export type ProductEvent =
  | { name: "user.first_query"; userId: string; dbId: string }
  | { name: "user.registered"; userId: string; email: string }
  | { name: "user.waitlist_joined"; emailHash: string; source: string }
  | {
      name: "billing.subscription_created";
      userId: string;
      customerId: string;
      subscriptionId: string;
      priceId: string;
    }
  | {
      name: "billing.subscription_canceled";
      userId: string;
      customerId: string;
      subscriptionId: string;
      priceId: string;
    }
  | AskCompletedEvent;

// Envelope wrapping the event with producer-side metadata. The consumer
// reads `id` for idempotency keys (passed to LogSnag) and `ts` for late-
// arrival debugging.
export type EventEnvelope = {
  // Stable per-emission id. `${name}.${userId}.${day}` for one-shot
  // user events; `crypto.randomUUID()` otherwise. Producer decides.
  id: string;
  // Unix-ms at producer time.
  ts: number;
  event: ProductEvent;
};
