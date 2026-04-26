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
      fetchMock,
    );
    const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;
    expect(url).toBe("https://api.logsnag.com/v1/log");
    const headers = init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer tok_abc");
    expect(headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toMatchObject({
      project: "nlqdb",
      event: "First Query",
    });
  });

  it("throws on non-2xx responses (so the consumer retries)", async () => {
    const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429 }));
    await expect(
      publishToLogSnag(
        { token: "tok_abc", project: "nlqdb" },
        { name: "user.first_query", userId: "u_1", dbId: "db_1" },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/logsnag 429/);
  });
});
