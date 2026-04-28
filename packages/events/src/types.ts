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
// `billing.subscription_created`). Domains today: `user`, `billing`.

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
    };

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
