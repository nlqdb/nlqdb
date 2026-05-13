import { describe, expect, it } from "vitest";
import { makeNoopEmitter, makeQueueEmitter } from "../src/index.ts";
import { makeFakeQueue } from "../src/test.ts";

describe("makeQueueEmitter", () => {
  it("wraps the event in an envelope with a stable id for one-shot user events", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);

    await emitter.emit({ name: "user.first_query", userId: "u_1", dbId: "db_1" });

    expect(queue.sent).toHaveLength(1);
    const env = queue.sent[0];
    if (!env) throw new Error("expected one envelope on the queue");
    expect(env.id).toBe("user.first_query.u_1");
    expect(env.event).toEqual({ name: "user.first_query", userId: "u_1", dbId: "db_1" });
    expect(typeof env.ts).toBe("number");
  });

  it("uses subscriptionId for billing.subscription_created defaultId", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);

    await emitter.emit({
      name: "billing.subscription_created",
      userId: "u_1",
      customerId: "cus_x",
      subscriptionId: "sub_abc",
      priceId: "price_pro",
    });

    expect(queue.sent[0]?.id).toBe("billing.subscription_created.sub_abc");
  });

  it("uses subscriptionId for billing.subscription_canceled defaultId", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);

    await emitter.emit({
      name: "billing.subscription_canceled",
      userId: "u_1",
      customerId: "cus_x",
      subscriptionId: "sub_abc",
      priceId: "price_pro",
    });

    expect(queue.sent[0]?.id).toBe("billing.subscription_canceled.sub_abc");
  });

  it("respects an explicit id override", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);

    await emitter.emit(
      { name: "user.registered", userId: "u_2", email: "x@y.com" },
      { id: "explicit-key" },
    );

    expect(queue.sent[0]?.id).toBe("explicit-key");
  });

  it("generates a unique id per emission for ask.completed (high-volume; legitimate repeats)", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);
    const event = {
      name: "ask.completed" as const,
      dbId: "db_1",
      schemaHash: "schema_v1",
      queryHash: "qh_1",
      planShape: "ps_1",
      engine: "postgres" as const,
      orchestratorMs: 100,
      rowsReturned: 5,
      ts: 1700000000000,
    };

    await emitter.emit(event);
    await emitter.emit(event);

    expect(queue.sent).toHaveLength(2);
    const [first, second] = queue.sent;
    if (!first || !second) throw new Error("expected two envelopes on the queue");
    expect(first.id).not.toBe(second.id);
    expect(first.id).toMatch(/^evt\./);
    expect(second.id).toMatch(/^evt\./);
  });

  it("keys feature.requested.* events by (name, principalId, utcDay) so daily dedup collapses (SK-EVENTS-010)", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);

    await emitter.emit({
      name: "feature.requested.ddl_via_ask",
      principalId: "anon:abc",
      surface: "hero",
      rejectReason: "drop_statement",
    });
    await emitter.emit({
      name: "feature.requested.heavier_tier",
      principalId: "u_1",
      surface: "chat",
    });

    const today = new Date().toISOString().slice(0, 10);
    expect(queue.sent[0]?.id).toBe(`feature.requested.ddl_via_ask.anon:abc.${today}`);
    expect(queue.sent[1]?.id).toBe(`feature.requested.heavier_tier.u_1.${today}`);
  });

  it("keys feature.requested.notify_paid by (name, principalId, cta, utcDay) so surface clicks stay distinct (SK-EVENTS-011)", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);

    await emitter.emit({
      name: "feature.requested.notify_paid",
      principalId: "anon:abc",
      surface: "hero",
      cta: "db_create_success",
    });
    await emitter.emit({
      name: "feature.requested.notify_paid",
      principalId: "anon:abc",
      surface: "hero",
      cta: "rate_limit",
    });

    const today = new Date().toISOString().slice(0, 10);
    expect(queue.sent[0]?.id).toBe(
      `feature.requested.notify_paid.anon:abc.db_create_success.${today}`,
    );
    expect(queue.sent[1]?.id).toBe(`feature.requested.notify_paid.anon:abc.rate_limit.${today}`);
    expect(queue.sent[0]?.id).not.toBe(queue.sent[1]?.id);
  });

  it("keys home.surface_wishlist by (name, principalId, surface, utcDay) so VSCode + Slack stay distinct (SK-EVENTS-011)", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);

    await emitter.emit({
      name: "home.surface_wishlist",
      principalId: "wl:abcd1234",
      surface: "vscode",
    });
    await emitter.emit({
      name: "home.surface_wishlist",
      principalId: "wl:abcd1234",
      surface: "slack",
    });

    const today = new Date().toISOString().slice(0, 10);
    expect(queue.sent[0]?.id).toBe(`home.surface_wishlist.wl:abcd1234.vscode.${today}`);
    expect(queue.sent[1]?.id).toBe(`home.surface_wishlist.wl:abcd1234.slack.${today}`);
  });

  it("swallows queue.send failures (emit is non-fatal)", async () => {
    const queue = makeFakeQueue();
    queue.failNext = new Error("queue full");
    const emitter = makeQueueEmitter(queue);

    await expect(
      emitter.emit({ name: "user.first_query", userId: "u_1", dbId: "db_1" }),
    ).resolves.toBeUndefined();
    expect(queue.sent).toHaveLength(0);
  });
});

describe("makeNoopEmitter", () => {
  it("returns void without throwing", async () => {
    const emitter = makeNoopEmitter();
    await expect(
      emitter.emit({ name: "user.first_query", userId: "u_1", dbId: "db_1" }),
    ).resolves.toBeUndefined();
  });
});
