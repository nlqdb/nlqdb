import { describe, expect, it, vi } from "vitest";
import { buildPayload, publishToLogSnag } from "../src/sinks/logsnag.ts";

describe("buildPayload", () => {
  it("maps user.first_query into the LogSnag shape", () => {
    const out = buildPayload("nlqdb", {
      name: "user.first_query",
      userId: "u_1",
      dbId: "db_1",
    });
    expect(out).toMatchObject({
      project: "nlqdb",
      channel: "users",
      event: "First Query",
      user_id: "u_1",
      tags: { "db-id": "db_1" },
    });
  });

  it("maps user.registered into the LogSnag shape", () => {
    const out = buildPayload("nlqdb", {
      name: "user.registered",
      userId: "u_2",
      email: "x@y.com",
    });
    expect(out).toMatchObject({
      project: "nlqdb",
      channel: "users",
      event: "Registered",
      user_id: "u_2",
      tags: { email: "x@y.com" },
    });
  });

  it("maps billing.subscription_created into the LogSnag shape", () => {
    const out = buildPayload("nlqdb", {
      name: "billing.subscription_created",
      userId: "u_3",
      customerId: "cus_x",
      subscriptionId: "sub_abc",
      priceId: "price_pro",
    });
    expect(out).toMatchObject({
      project: "nlqdb",
      channel: "billing",
      event: "Subscription Created",
      user_id: "u_3",
      tags: {
        "customer-id": "cus_x",
        "subscription-id": "sub_abc",
        "price-id": "price_pro",
      },
    });
  });

  it("maps feature.requested.ddl_via_ask onto the demand-signal channel (SK-EVENTS-010)", () => {
    const out = buildPayload("nlqdb", {
      name: "feature.requested.ddl_via_ask",
      principalId: "anon:abc",
      surface: "hero",
      rejectReason: "drop_statement",
    });
    expect(out).toMatchObject({
      project: "nlqdb",
      channel: "demand-signal",
      event: "DDL via /v1/ask",
      notify: false,
      user_id: "anon:abc",
      tags: { surface: "hero", "reject-reason": "drop_statement" },
    });
  });

  it("maps feature.requested.heavier_tier onto the demand-signal channel (SK-EVENTS-010)", () => {
    const out = buildPayload("nlqdb", {
      name: "feature.requested.heavier_tier",
      principalId: "u_5",
      surface: "chat",
    });
    expect(out).toMatchObject({
      project: "nlqdb",
      channel: "demand-signal",
      event: "Heavier tier requested",
      notify: false,
      user_id: "u_5",
      tags: { surface: "chat" },
    });
  });

  it("maps feature.requested.early_access onto the #north-star channel (GLOBAL-027 / SK-GATE-006)", () => {
    const out = buildPayload("nlqdb", {
      name: "feature.requested.early_access",
      principalId: "anon:abc",
      surface: "hero",
    });
    expect(out).toMatchObject({
      project: "nlqdb",
      channel: "north-star",
      event: "Early-access requested",
      notify: false,
      user_id: "anon:abc",
      tags: { surface: "hero" },
    });
  });

  it("maps home.surface_wishlist onto the demand-signal channel with surface tag (SK-EVENTS-011)", () => {
    const out = buildPayload("nlqdb", {
      name: "home.surface_wishlist",
      principalId: "wl:abcd1234",
      surface: "vscode",
    });
    expect(out).toMatchObject({
      project: "nlqdb",
      channel: "demand-signal",
      event: "Wishlist click",
      notify: false,
      user_id: "wl:abcd1234",
      tags: { surface: "vscode" },
    });
  });

  it("maps feature.eval.weekly onto north-star with per-lane EA tags (SK-QUAL-002)", () => {
    const out = buildPayload("nlqdb", {
      name: "feature.eval.weekly",
      runId: "2026-05-18T04:00:00Z",
      dataset: "bird-mini-dev-sqlite",
      questionCount: 500,
      laneExecutionAccuracy: { free: 0.42, frontier: 0.66 },
      freeVsFrontierDelta: 0.24,
    });
    expect(out).toMatchObject({
      project: "nlqdb",
      channel: "north-star",
      event: "Eval weekly",
      notify: false,
      tags: {
        dataset: "bird-mini-dev-sqlite",
        run: "2026-05-18T04:00:00Z",
        "ea-free": "42.00",
        "ea-frontier": "66.00",
      },
    });
    expect(out.description).toContain("24.00 pts");
  });

  it("maps feature.eval.regression with notify=true and trigger tag (SK-QUAL-002)", () => {
    const out = buildPayload("nlqdb", {
      name: "feature.eval.regression",
      runId: "2026-05-18T04:00:00Z",
      dataset: "bird-mini-dev-sqlite",
      lane: "free",
      deltaPp: -0.07,
      trigger: "threshold",
      pValue: null,
    });
    expect(out).toMatchObject({
      project: "nlqdb",
      channel: "north-star",
      event: "Eval regression",
      notify: true,
      tags: {
        dataset: "bird-mini-dev-sqlite",
        run: "2026-05-18T04:00:00Z",
        lane: "free",
        trigger: "threshold",
      },
    });
  });

  it("includes p-value in description when trigger is mcnemar", () => {
    const out = buildPayload("nlqdb", {
      name: "feature.eval.regression",
      runId: "2026-05-18T04:00:00Z",
      dataset: "bird-mini-dev-sqlite",
      lane: "frontier",
      deltaPp: -0.03,
      trigger: "mcnemar",
      pValue: 0.0123,
    });
    expect(out.description).toContain("mcnemar");
    expect(out.description).toContain("p=0.0123");
  });

  it("maps billing.subscription_canceled into the LogSnag shape", () => {
    const out = buildPayload("nlqdb", {
      name: "billing.subscription_canceled",
      userId: "u_4",
      customerId: "cus_y",
      subscriptionId: "sub_def",
      priceId: "price_pro",
    });
    expect(out).toMatchObject({
      project: "nlqdb",
      channel: "billing",
      event: "Subscription Canceled",
      user_id: "u_4",
      tags: {
        "customer-id": "cus_y",
        "subscription-id": "sub_def",
        "price-id": "price_pro",
      },
    });
  });
});

describe("publishToLogSnag", () => {
  it("POSTs to the LogSnag endpoint with bearer auth", async () => {
    const fetchMock: typeof fetch = vi.fn(
      async () => new Response("{}", { status: 200 }),
    ) as unknown as typeof fetch;
    await publishToLogSnag(
      { token: "tok_abc", project: "nlqdb" },
      { name: "user.first_query", userId: "u_1", dbId: "db_1" },
      "user.first_query.u_1",
      fetchMock,
    );
    const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    expect(calls).toHaveLength(1);
    const firstCall = calls[0];
    if (!firstCall) throw new Error("expected logsnag fetch call");
    const [url, init] = firstCall;
    expect(url).toBe("https://api.logsnag.com/v1/log");
    const headers = init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer tok_abc");
    expect(headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toMatchObject({
      project: "nlqdb",
      event: "First Query",
      event_id: "user.first_query.u_1",
    });
  });

  it("throws on non-2xx responses (so the consumer retries)", async () => {
    const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429 }));
    await expect(
      publishToLogSnag(
        { token: "tok_abc", project: "nlqdb" },
        { name: "user.first_query", userId: "u_1", dbId: "db_1" },
        "user.first_query.u_1",
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/logsnag 429/);
  });

  it("omits event_id when the envelope id is undefined (test/dev path)", async () => {
    const fetchMock: typeof fetch = vi.fn(
      async () => new Response("{}", { status: 200 }),
    ) as unknown as typeof fetch;
    await publishToLogSnag(
      { token: "tok_abc", project: "nlqdb" },
      { name: "user.first_query", userId: "u_1", dbId: "db_1" },
      undefined,
      fetchMock,
    );
    const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    const firstCall = calls[0];
    if (!firstCall) throw new Error("expected logsnag fetch call");
    const body = JSON.parse(firstCall[1].body as string) as Record<string, unknown>;
    expect("event_id" in body).toBe(false);
  });
});
