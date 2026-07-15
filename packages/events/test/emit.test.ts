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

  it("generates a unique id per emission for feature.destructive.* (volume; every preview/commit counts, SK-TRUST-004)", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);
    // Same principal + surface, two preview hops — must NOT collapse, or the
    // retry rate (1 − committed/preview_rendered) undercounts the numerator.
    await emitter.emit({
      name: "feature.destructive.preview_rendered",
      principalId: "u_1",
      surface: "chat",
    });
    await emitter.emit({
      name: "feature.destructive.preview_rendered",
      principalId: "u_1",
      surface: "chat",
    });
    await emitter.emit({
      name: "feature.destructive.committed",
      principalId: "u_1",
      surface: "chat",
    });
    expect(queue.sent).toHaveLength(3);
    const ids = queue.sent.map((e) => e.id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(/^evt\./);
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
    await emitter.emit({
      name: "feature.requested.larger_account",
      principalId: "u_1",
      surface: "chat",
    });

    const today = new Date().toISOString().slice(0, 10);
    expect(queue.sent[0]?.id).toBe(`feature.requested.ddl_via_ask.anon:abc.${today}`);
    expect(queue.sent[1]?.id).toBe(`feature.requested.heavier_tier.u_1.${today}`);
    expect(queue.sent[2]?.id).toBe(`feature.requested.larger_account.u_1.${today}`);
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

  it("keys pricing.page_viewed by (name, principalId, utcDay) so unique-per-day is the unit (SK-EVENTS-012)", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);

    await emitter.emit({ name: "pricing.page_viewed", principalId: "u_9", email: "f@nlqdb.com" });
    await emitter.emit({
      name: "pricing.page_viewed",
      principalId: "pv:abcd1234abcd1234",
      email: null,
    });

    const today = new Date().toISOString().slice(0, 10);
    expect(queue.sent[0]?.id).toBe(`pricing.page_viewed.u_9.${today}`);
    expect(queue.sent[1]?.id).toBe(`pricing.page_viewed.pv:abcd1234abcd1234.${today}`);
  });

  it("keys pricing.plan_selected by (name, principalId, plan, utcDay) so Hobby + Pro stay distinct (SK-EVENTS-012)", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);

    await emitter.emit({
      name: "pricing.plan_selected",
      principalId: "u_9",
      plan: "hobby",
      email: "f@nlqdb.com",
    });
    await emitter.emit({
      name: "pricing.plan_selected",
      principalId: "u_9",
      plan: "pro",
      email: "f@nlqdb.com",
    });

    const today = new Date().toISOString().slice(0, 10);
    expect(queue.sent[0]?.id).toBe(`pricing.plan_selected.u_9.hobby.${today}`);
    expect(queue.sent[1]?.id).toBe(`pricing.plan_selected.u_9.pro.${today}`);
  });

  it("keys feature.eval.weekly by (name, dataset, runId) so workflow retries dedupe (SK-QUAL-002)", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);

    await emitter.emit({
      name: "feature.eval.weekly",
      runId: "2026-05-18T04:00:00Z",
      dataset: "bird-mini-dev-sqlite",
      questionCount: 500,
      laneExecutionAccuracy: { free: 0.42 },
      freeVsFrontierDelta: null,
    });

    expect(queue.sent[0]?.id).toBe("feature.eval.weekly.bird-mini-dev-sqlite.2026-05-18T04:00:00Z");
  });

  it("keys feature.eval.regression by (run, lane, trigger) so threshold + mcnemar stay distinct", async () => {
    const queue = makeFakeQueue();
    const emitter = makeQueueEmitter(queue);

    await emitter.emit({
      name: "feature.eval.regression",
      runId: "2026-05-18T04:00:00Z",
      dataset: "bird-mini-dev-sqlite",
      lane: "free",
      deltaPp: -0.07,
      trigger: "threshold",
      pValue: null,
    });
    await emitter.emit({
      name: "feature.eval.regression",
      runId: "2026-05-18T04:00:00Z",
      dataset: "bird-mini-dev-sqlite",
      lane: "free",
      deltaPp: -0.07,
      trigger: "mcnemar",
      pValue: 0.02,
    });

    expect(queue.sent[0]?.id).toBe(
      "feature.eval.regression.bird-mini-dev-sqlite.2026-05-18T04:00:00Z.free.threshold",
    );
    expect(queue.sent[1]?.id).toBe(
      "feature.eval.regression.bird-mini-dev-sqlite.2026-05-18T04:00:00Z.free.mcnemar",
    );
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
