// SK-STRIPE-016 — the subscription handlers' ordering guard, run against the
// real migrations on in-memory SQLite (the fake D1 in stripe-webhook.test.ts
// can't execute the guard's WHERE clause).

import { makeQueueEmitter } from "@nlqdb/events";
import { makeFakeQueue } from "@nlqdb/events/test";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";
import { sqliteD1 } from "../src/db-connect/test-sqlite-d1.ts";
import { processWebhook } from "../src/stripe/webhook.ts";

const USER = "user_1";
const CUSTOMER = "cus_1";
let db: D1Database;
let seq = 0;

beforeEach(async () => {
  db = sqliteD1();
  await db
    .prepare(
      "INSERT INTO user (id, email, createdAt, updatedAt) VALUES (?, 'a@example.com', 'now', 'now')",
    )
    .bind(USER)
    .run();
});

function deliver(type: string, object: unknown): Promise<unknown> {
  seq += 1;
  const event = { id: `evt_${seq}`, type, created: 1_745_659_200 + seq, data: { object } };
  return processWebhook(
    {
      signer: { constructEventAsync: async () => event as unknown as Stripe.Event },
      webhookSecret: "whsec_test",
      db,
      events: makeQueueEmitter(makeFakeQueue()),
    },
    "{}",
    "sig",
  );
}

const sub = (id: string, status: string) => ({
  id,
  customer: CUSTOMER,
  status,
  cancel_at_period_end: false,
  metadata: { nlqdb_user_id: USER },
  items: { data: [{ price: { id: "price_pro" }, current_period_end: 1_748_251_200 }] },
});
const checkout = (subscription: string) => ({
  id: `cs_${subscription}`,
  client_reference_id: USER,
  customer: CUSTOMER,
  subscription,
});

async function row(): Promise<{ stripe_subscription_id: string; status: string }> {
  const r = await db
    .prepare("SELECT stripe_subscription_id, status FROM customers WHERE user_id = ?")
    .bind(USER)
    .first<{ stripe_subscription_id: string; status: string }>();
  if (!r) throw new Error("no customers row");
  return r;
}

describe("subscription webhook ordering (SK-STRIPE-016)", () => {
  beforeEach(async () => {
    await deliver("checkout.session.completed", checkout("sub_a"));
    await deliver("customer.subscription.created", sub("sub_a", "active"));
  });

  it("a late updated after deleted does not revive the canceled subscription", async () => {
    await deliver("customer.subscription.deleted", sub("sub_a", "canceled"));
    await deliver("customer.subscription.updated", sub("sub_a", "active"));
    expect(await row()).toEqual({ stripe_subscription_id: "sub_a", status: "canceled" });
  });

  it("an in-order updated still syncs the live subscription", async () => {
    await deliver("customer.subscription.updated", sub("sub_a", "past_due"));
    expect(await row()).toEqual({ stripe_subscription_id: "sub_a", status: "past_due" });
  });

  it("re-subscribe: the new subscription replaces the canceled one", async () => {
    await deliver("customer.subscription.deleted", sub("sub_a", "canceled"));
    await deliver("checkout.session.completed", checkout("sub_b"));
    expect(await row()).toEqual({ stripe_subscription_id: "sub_b", status: "incomplete" });
    await deliver("customer.subscription.created", sub("sub_b", "active"));
    expect(await row()).toEqual({ stripe_subscription_id: "sub_b", status: "active" });
  });

  it("re-subscribe with the new subscription's events before checkout completes", async () => {
    await deliver("customer.subscription.deleted", sub("sub_a", "canceled"));
    await deliver("customer.subscription.updated", sub("sub_b", "active"));
    await deliver("checkout.session.completed", checkout("sub_b"));
    expect(await row()).toEqual({ stripe_subscription_id: "sub_b", status: "active" });
  });

  it("a late event for the old subscription does not touch the new live one", async () => {
    await deliver("customer.subscription.deleted", sub("sub_a", "canceled"));
    await deliver("checkout.session.completed", checkout("sub_b"));
    await deliver("customer.subscription.created", sub("sub_b", "active"));
    await deliver("customer.subscription.deleted", sub("sub_a", "canceled"));
    await deliver("customer.subscription.updated", sub("sub_a", "active"));
    expect(await row()).toEqual({ stripe_subscription_id: "sub_b", status: "active" });
  });

  it("deleted before the subscription's created leaves it canceled", async () => {
    await deliver("customer.subscription.deleted", sub("sub_a", "canceled"));
    await deliver("customer.subscription.created", sub("sub_a", "active"));
    expect(await row()).toEqual({ stripe_subscription_id: "sub_a", status: "canceled" });
  });
});
