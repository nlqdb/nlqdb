import { describe, expect, it } from "vitest";
import { makeNoopEmitter, makeQueueEmitter } from "../src/index.ts";
import { makeFakeQueue } from "../src/test.ts";

describe("makeQueueEmitter", () => {
  it("wraps the event in an envelope with a stable id for one-shot user events", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);

    await emitter.emit({ name: "user.first_query", userId: "u_1", dbId: "db_1" });

    expect(queue.sent).toHaveLength(1);
    const env = queue.sent[0]!;
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
