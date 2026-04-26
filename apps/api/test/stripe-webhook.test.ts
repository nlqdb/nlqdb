// Slice 7 — Stripe webhook handler unit tests.
//
// Stubs all I/O: Stripe signature verification, D1, R2, events queue.
// Runs in the unit project (no Miniflare) so iteration is sub-second.
// Integration coverage of `/v1/stripe/webhook` end-to-end (real D1 +
// Hono routing + R2 archive observation) is deferred — the wiring is
// thin (route → processWebhook), and unit coverage is comprehensive.

import { makeQueueEmitter } from "@nlqdb/events";
import { makeFakeQueue } from "@nlqdb/events/test";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { processWebhook, type WebhookSigner } from "../src/stripe/webhook.ts";

// -----------------------------------------------------------------------------
// Fake D1: just enough to drive the SQL the handler emits.

type StripeEventRow = {
  event_id: string;
  type: string;
  payload_r2_key: string | null;
  processed_at: number | null;
};
type CustomerRow = {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: number | null;
  cancel_at_period_end: number;
  price_id: string | null;
};

type FakeD1 = D1Database & {
  stripeEvents: Map<string, StripeEventRow>;
  customers: Map<string, CustomerRow>;
  // Force the next call whose SQL matches `failMatcher` to throw.
  // Cleared after one trigger.
  failNext?: { matcher: RegExp; error: Error };
};

function makeFakeD1(seed?: { customers?: CustomerRow[] }): FakeD1 {
  const stripeEvents = new Map<string, StripeEventRow>();
  const customers = new Map<string, CustomerRow>();
  for (const row of seed?.customers ?? []) {
    customers.set(row.user_id, row);
  }

  const triggerFailure = (sql: string): void => {
    if (fake.failNext?.matcher.test(sql)) {
      const err = fake.failNext.error;
      fake.failNext = undefined;
      throw err;
    }
  };

  const prepare = (sql: string): D1PreparedStatement => {
    let bound: unknown[] = [];
    const stmt: Partial<D1PreparedStatement> = {
      bind(...params: unknown[]) {
        bound = params;
        return stmt as D1PreparedStatement;
      },
      async first<T>() {
        triggerFailure(sql);
        if (/INSERT INTO stripe_events/i.test(sql)) {
          const [event_id, type, payload_r2_key] = bound as [string, string, string | null];
          if (stripeEvents.has(event_id)) return null;
          stripeEvents.set(event_id, {
            event_id,
            type,
            payload_r2_key,
            processed_at: null,
          });
          return { ok: 1 } as T;
        }
        if (/SELECT user_id FROM customers WHERE stripe_customer_id/i.test(sql)) {
          const [stripeCustomerId] = bound as [string];
          for (const row of customers.values()) {
            if (row.stripe_customer_id === stripeCustomerId) {
              return { user_id: row.user_id } as T;
            }
          }
          return null;
        }
        throw new Error(`unhandled SQL in fakeD1.first(): ${sql}`);
      },
      async run() {
        triggerFailure(sql);
        if (/INSERT INTO customers .*ON CONFLICT/is.test(sql)) {
          const [user_id, stripe_customer_id, stripe_subscription_id] = bound as [
            string,
            string,
            string | null,
          ];
          const existing = customers.get(user_id);
          if (existing) {
            existing.stripe_customer_id = stripe_customer_id;
            existing.stripe_subscription_id = stripe_subscription_id;
          } else {
            customers.set(user_id, {
              user_id,
              stripe_customer_id,
              stripe_subscription_id,
              status: "incomplete",
              current_period_end: null,
              cancel_at_period_end: 0,
              price_id: null,
            });
          }
          return makeRunResult();
        }
        if (/UPDATE customers SET[\s\S]*stripe_subscription_id/i.test(sql)) {
          const [
            stripe_subscription_id,
            status,
            current_period_end,
            cancel_at_period_end,
            price_id,
            user_id,
          ] = bound as [string, string, number | null, number, string | null, string];
          const existing = customers.get(user_id);
          if (existing) {
            existing.stripe_subscription_id = stripe_subscription_id;
            existing.status = status;
            existing.current_period_end = current_period_end;
            existing.cancel_at_period_end = cancel_at_period_end;
            existing.price_id = price_id;
          }
          return makeRunResult();
        }
        if (/UPDATE customers SET status = 'canceled'/i.test(sql)) {
          const [user_id] = bound as [string];
          const existing = customers.get(user_id);
          if (existing) existing.status = "canceled";
          return makeRunResult();
        }
        if (/UPDATE stripe_events SET processed_at/i.test(sql)) {
          const [event_id] = bound as [string];
          const existing = stripeEvents.get(event_id);
          if (existing) existing.processed_at = Math.floor(Date.now() / 1000);
          return makeRunResult();
        }
        throw new Error(`unhandled SQL in fakeD1.run(): ${sql}`);
      },
    };
    return stmt as D1PreparedStatement;
  };

  const fake = {
    stripeEvents,
    customers,
    failNext: undefined,
    prepare,
  } as unknown as FakeD1;
  return fake;
}

function makeRunResult<T>(): D1Result<T> {
  return {
    success: true,
    results: [] as T[],
    meta: { duration: 0, last_row_id: 0, changes: 0, served_by: "test", internal_stats: null },
  } as unknown as D1Result<T>;
}

// -----------------------------------------------------------------------------
// Fake R2: collects puts, optional failure injection.

type FakeR2 = R2Bucket & {
  puts: { key: string; body: string }[];
  failNextPut?: Error;
};

function makeFakeR2(): FakeR2 {
  const fake: Partial<FakeR2> = {
    puts: [],
    async put(key: string, body: ArrayBuffer | string | ReadableStream | null) {
      if (fake.failNextPut) {
        const err = fake.failNextPut;
        fake.failNextPut = undefined;
        throw err;
      }
      fake.puts!.push({ key, body: String(body) });
      return {} as R2Object;
    },
  };
  return fake as FakeR2;
}

// -----------------------------------------------------------------------------
// Stripe.Event fixtures. We cast `as unknown as Stripe.Event` (and
// similar) — the SDK's full Event type has many nested required fields
// we don't read, and stamping them out per fixture would make the
// tests unreadable.

function makeEventStub(overrides: {
  id?: string;
  type: string;
  object: unknown;
  created?: number;
}): Stripe.Event {
  return {
    id: overrides.id ?? "evt_test_default",
    object: "event",
    api_version: "2024-06-20",
    created: overrides.created ?? 1745659200,
    data: { object: overrides.object },
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type: overrides.type,
  } as unknown as Stripe.Event;
}

function makeSubscription(overrides: {
  id?: string;
  customer: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  priceId?: string;
  currentPeriodEnd?: number;
}): Stripe.Subscription {
  return {
    id: overrides.id ?? "sub_test",
    customer: overrides.customer,
    status: overrides.status ?? "active",
    cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
    items: {
      data: [
        {
          id: "si_test",
          price: { id: overrides.priceId ?? "price_pro" },
          current_period_end: overrides.currentPeriodEnd ?? 1748251200,
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

// -----------------------------------------------------------------------------
// Common deps factory.

function makeDeps(overrides?: { signer?: WebhookSigner; db?: FakeD1; r2?: FakeR2 }): {
  deps: Parameters<typeof processWebhook>[0];
  db: FakeD1;
  r2: FakeR2;
  queue: ReturnType<typeof makeFakeQueue>;
  signer: WebhookSigner;
} {
  const queue = makeFakeQueue();
  const events = makeQueueEmitter(queue);
  const db = overrides?.db ?? makeFakeD1();
  const r2 = overrides?.r2 ?? makeFakeR2();
  const signer = overrides?.signer ?? {
    constructEventAsync: vi.fn(),
  };
  return {
    deps: {
      signer,
      webhookSecret: "whsec_test",
      db,
      r2,
      events,
    },
    db,
    r2,
    queue,
    signer,
  };
}

// =============================================================================

describe("processWebhook — signature verification", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const { deps } = makeDeps();
    const result = await processWebhook(deps, "{}", null);
    expect(result).toEqual({
      status: 400,
      body: { error: "invalid_signature" },
    });
  });

  it("returns 400 when constructEventAsync throws (bad signature)", async () => {
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockRejectedValue(new Error("bad sig")),
    };
    const { deps } = makeDeps({ signer });
    const result = await processWebhook(deps, "{}", "invalid-sig");
    expect(result).toEqual({
      status: 400,
      body: { error: "invalid_signature" },
    });
  });
});

describe("processWebhook — idempotency", () => {
  it("processes a new event and returns duplicate=false", async () => {
    const event = makeEventStub({
      id: "evt_1",
      type: "customer.subscription.updated",
      object: makeSubscription({ customer: "cus_1" }),
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const { deps, db } = makeDeps({ signer });
    const result = await processWebhook(deps, "{}", "sig");
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ received: true, duplicate: false });
    expect(db.stripeEvents.get("evt_1")).toMatchObject({
      event_id: "evt_1",
      type: "customer.subscription.updated",
      processed_at: expect.any(Number),
    });
  });

  it("returns duplicate=true on retry without re-dispatching", async () => {
    const event = makeEventStub({
      id: "evt_dupe",
      type: "customer.subscription.deleted",
      object: makeSubscription({ id: "sub_dupe", customer: "cus_dupe" }),
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const { deps, db, queue } = makeDeps({
      signer,
      db: makeFakeD1({
        customers: [
          {
            user_id: "u_1",
            stripe_customer_id: "cus_dupe",
            stripe_subscription_id: "sub_dupe",
            status: "active",
            current_period_end: 1748251200,
            cancel_at_period_end: 0,
            price_id: "price_pro",
          },
        ],
      }),
    });

    const first = await processWebhook(deps, "{}", "sig");
    expect(first.body).toMatchObject({ duplicate: false });
    expect(db.customers.get("u_1")?.status).toBe("canceled"); // first dispatch fired
    expect(queue.sent).toHaveLength(1); // billing.subscription_canceled emitted

    // Reset customer status to verify second call doesn't re-dispatch.
    db.customers.get("u_1")!.status = "active";
    const second = await processWebhook(deps, "{}", "sig");
    expect(second.body).toMatchObject({ duplicate: true });
    expect(db.customers.get("u_1")?.status).toBe("active"); // unchanged
    expect(queue.sent).toHaveLength(1); // still 1 — no re-emit
  });

  it("leaves processed_at NULL when dispatch throws (queryable as 'stuck')", async () => {
    const sub = makeSubscription({ id: "sub_disp_fail", customer: "cus_disp_fail" });
    const event = makeEventStub({
      id: "evt_disp_fail",
      type: "customer.subscription.updated",
      object: sub,
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = makeFakeD1({
      customers: [
        {
          user_id: "u_disp_fail",
          stripe_customer_id: "cus_disp_fail",
          stripe_subscription_id: null,
          status: "active",
          current_period_end: null,
          cancel_at_period_end: 0,
          price_id: "price_pro",
        },
      ],
    });
    // Simulate D1 outage on the dispatch's customer UPDATE.
    db.failNext = {
      matcher: /UPDATE customers SET[\s\S]*stripe_subscription_id/i,
      error: new Error("d1 outage during dispatch"),
    };
    const { deps } = makeDeps({ signer, db });
    const result = await processWebhook(deps, "{}", "sig");
    // 200 — dispatch errors don't 5xx (the row is recorded).
    expect(result.status).toBe(200);
    // The row exists, but processed_at stays NULL so it surfaces as
    // 'stuck' in `WHERE processed_at IS NULL` queries / future sweeper.
    expect(db.stripeEvents.get("evt_disp_fail")?.processed_at).toBeNull();
    error.mockRestore();
  });

  it("returns 500 + records counter on genuine D1 INSERT failure", async () => {
    const event = makeEventStub({
      id: "evt_fail",
      type: "customer.subscription.created",
      object: makeSubscription({ customer: "cus_x" }),
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const db = makeFakeD1();
    db.failNext = {
      matcher: /INSERT INTO stripe_events/i,
      error: new Error("D1 unreachable"),
    };
    const { deps } = makeDeps({ signer, db });
    const result = await processWebhook(deps, "{}", "sig");
    expect(result).toEqual({ status: 500, body: { error: "internal" } });
  });
});

describe("processWebhook — R2 archive", () => {
  it("returns archive promise on result when R2 binding is present", async () => {
    const event = makeEventStub({
      id: "evt_archive",
      type: "customer.subscription.updated",
      object: makeSubscription({ customer: "cus_arch" }),
      created: 1745659200, // 2025-04-26 UTC
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const { deps, r2 } = makeDeps({ signer });
    const result = await processWebhook(deps, '{"raw":true}', "sig");
    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.archive).toBeDefined();
      await result.archive;
    }
    expect(r2.puts).toHaveLength(1);
    expect(r2.puts[0]?.key).toMatch(/^stripe-events\/\d{4}\/\d{2}\/\d{2}\/evt_archive\.json$/);
    expect(r2.puts[0]?.body).toBe('{"raw":true}');
  });

  it("omits archive promise when R2 binding is absent", async () => {
    const event = makeEventStub({
      id: "evt_no_r2",
      type: "customer.subscription.updated",
      object: makeSubscription({ customer: "cus_a" }),
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const { deps } = makeDeps({ signer });
    // Strip R2.
    const depsNoR2 = { ...deps, r2: undefined };
    const result = await processWebhook(depsNoR2, "{}", "sig");
    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.archive).toBeUndefined();
    }
  });

  it("does not throw when R2 put fails (best-effort)", async () => {
    const event = makeEventStub({
      id: "evt_r2_fail",
      type: "customer.subscription.updated",
      object: makeSubscription({ customer: "cus_r" }),
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const { deps, r2 } = makeDeps({ signer });
    r2.failNextPut = new Error("r2 down");
    const result = await processWebhook(deps, "{}", "sig");
    expect(result.status).toBe(200);
    if (result.status === 200 && result.archive) {
      await expect(result.archive).resolves.toBeUndefined();
    }
  });
});

describe("processWebhook — checkout.session.completed", () => {
  it("INSERTs a customers row with the user_id mapping", async () => {
    const session = {
      id: "cs_test",
      client_reference_id: "u_42",
      customer: "cus_42",
      subscription: "sub_42",
    } as unknown as Stripe.Checkout.Session;
    const event = makeEventStub({
      id: "evt_co",
      type: "checkout.session.completed",
      object: session,
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const { deps, db } = makeDeps({ signer });
    await processWebhook(deps, "{}", "sig");
    expect(db.customers.get("u_42")).toMatchObject({
      user_id: "u_42",
      stripe_customer_id: "cus_42",
      stripe_subscription_id: "sub_42",
      status: "incomplete",
    });
  });

  it("skips when client_reference_id is missing (logs warning)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const session = {
      id: "cs_orphan",
      client_reference_id: null,
      customer: "cus_orphan",
      subscription: "sub_orphan",
    } as unknown as Stripe.Checkout.Session;
    const event = makeEventStub({
      id: "evt_orphan",
      type: "checkout.session.completed",
      object: session,
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const { deps, db } = makeDeps({ signer });
    await processWebhook(deps, "{}", "sig");
    expect(db.customers.size).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("processWebhook — customer.subscription.created", () => {
  it("UPDATEs customers and emits billing.subscription_created", async () => {
    const sub = makeSubscription({
      id: "sub_99",
      customer: "cus_99",
      status: "active",
      priceId: "price_starter",
      currentPeriodEnd: 1750000000,
    });
    const event = makeEventStub({
      id: "evt_sub_created",
      type: "customer.subscription.created",
      object: sub,
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const { deps, db, queue } = makeDeps({
      signer,
      db: makeFakeD1({
        customers: [
          {
            user_id: "u_99",
            stripe_customer_id: "cus_99",
            stripe_subscription_id: null,
            status: "incomplete",
            current_period_end: null,
            cancel_at_period_end: 0,
            price_id: null,
          },
        ],
      }),
    });
    await processWebhook(deps, "{}", "sig");
    expect(db.customers.get("u_99")).toMatchObject({
      status: "active",
      stripe_subscription_id: "sub_99",
      current_period_end: 1750000000,
      price_id: "price_starter",
    });
    expect(queue.sent).toHaveLength(1);
    expect(queue.sent[0]?.event).toEqual({
      name: "billing.subscription_created",
      userId: "u_99",
      customerId: "cus_99",
      subscriptionId: "sub_99",
      priceId: "price_starter",
    });
    expect(queue.sent[0]?.id).toBe("billing.subscription_created.sub_99");
  });

  it("skips emit + UPDATE when no customers row matches the customer_id", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sub = makeSubscription({
      id: "sub_orphan",
      customer: "cus_no_user",
    });
    const event = makeEventStub({
      id: "evt_orphan_sub",
      type: "customer.subscription.created",
      object: sub,
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const { deps, queue } = makeDeps({ signer });
    const result = await processWebhook(deps, "{}", "sig");
    expect(result.status).toBe(200);
    expect(queue.sent).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("processWebhook — customer.subscription.updated", () => {
  it("UPDATEs customers but does NOT emit", async () => {
    const sub = makeSubscription({
      id: "sub_up",
      customer: "cus_up",
      status: "past_due",
      priceId: "price_pro",
    });
    const event = makeEventStub({
      id: "evt_up",
      type: "customer.subscription.updated",
      object: sub,
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const { deps, db, queue } = makeDeps({
      signer,
      db: makeFakeD1({
        customers: [
          {
            user_id: "u_up",
            stripe_customer_id: "cus_up",
            stripe_subscription_id: "sub_up",
            status: "active",
            current_period_end: 1748000000,
            cancel_at_period_end: 0,
            price_id: "price_pro",
          },
        ],
      }),
    });
    await processWebhook(deps, "{}", "sig");
    expect(db.customers.get("u_up")?.status).toBe("past_due");
    expect(queue.sent).toHaveLength(0); // updated never emits
  });
});

describe("processWebhook — customer.subscription.deleted", () => {
  it("UPDATEs status to canceled and emits billing.subscription_canceled", async () => {
    const sub = makeSubscription({
      id: "sub_kill",
      customer: "cus_kill",
      status: "canceled",
      priceId: "price_pro",
    });
    const event = makeEventStub({
      id: "evt_del",
      type: "customer.subscription.deleted",
      object: sub,
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const { deps, db, queue } = makeDeps({
      signer,
      db: makeFakeD1({
        customers: [
          {
            user_id: "u_kill",
            stripe_customer_id: "cus_kill",
            stripe_subscription_id: "sub_kill",
            status: "active",
            current_period_end: 1748000000,
            cancel_at_period_end: 0,
            price_id: "price_pro",
          },
        ],
      }),
    });
    await processWebhook(deps, "{}", "sig");
    expect(db.customers.get("u_kill")?.status).toBe("canceled");
    expect(queue.sent).toHaveLength(1);
    expect(queue.sent[0]?.event).toEqual({
      name: "billing.subscription_canceled",
      userId: "u_kill",
      customerId: "cus_kill",
      subscriptionId: "sub_kill",
      priceId: "price_pro",
    });
    expect(queue.sent[0]?.id).toBe("billing.subscription_canceled.sub_kill");
  });
});

describe("processWebhook — unhandled event types", () => {
  it("records the event in stripe_events but does not dispatch", async () => {
    const event = makeEventStub({
      id: "evt_unhandled",
      type: "invoice.payment_failed",
      object: { id: "in_1" },
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const { deps, db, queue } = makeDeps({ signer });
    const result = await processWebhook(deps, "{}", "sig");
    expect(result.status).toBe(200);
    expect(db.stripeEvents.get("evt_unhandled")).toBeDefined();
    expect(queue.sent).toHaveLength(0);
  });
});

describe("processWebhook — R2 key format", () => {
  it("uses date-partitioned UTC YYYY/MM/DD path", async () => {
    // 1745659200 UTC = 2025-04-26 08:00:00
    const event = makeEventStub({
      id: "evt_dt",
      type: "customer.subscription.updated",
      object: makeSubscription({ customer: "cus_dt" }),
      created: 1745659200,
    });
    const signer: WebhookSigner = {
      constructEventAsync: vi.fn().mockResolvedValue(event),
    };
    const { deps, r2 } = makeDeps({ signer });
    const result = await processWebhook(deps, "{}", "sig");
    if (result.status === 200 && result.archive) await result.archive;
    expect(r2.puts[0]?.key).toBe("stripe-events/2025/04/26/evt_dt.json");
  });
});
