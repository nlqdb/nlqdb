import type { ProductEvent } from "@nlqdb/events";
import { describe, expect, it, vi } from "vitest";
import { buildPayload, isLogSnagRouted, publishToLogSnag } from "../src/sinks/logsnag.ts";

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
    expect(out?.description).toContain("mcnemar");
    expect(out?.description).toContain("p=0.0123");
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

  it("maps billing.payment_failed onto the billing channel with notify (SK-STRIPE-011)", () => {
    const out = buildPayload("nlqdb", {
      name: "billing.payment_failed",
      userId: "u_5",
      customerId: "cus_z",
      customerEmail: "payer@example.com",
      invoiceId: "in_5",
      amountDue: 2500,
      currency: "usd",
      attemptCount: 3,
      hostedInvoiceUrl: "https://pay.stripe.com/in_5",
    });
    expect(out).toMatchObject({
      project: "nlqdb",
      channel: "billing",
      event: "Payment Failed",
      notify: true,
      user_id: "u_5",
      tags: {
        "customer-id": "cus_z",
        "invoice-id": "in_5",
        "attempt-count": "3",
        "amount-due-minor": "2500",
        currency: "usd",
        "invoice-url": "https://pay.stripe.com/in_5",
      },
    });
  });

  it("omits invoice-url tag when hostedInvoiceUrl is null", () => {
    const out = buildPayload("nlqdb", {
      name: "billing.payment_failed",
      userId: "u_6",
      customerId: "cus_w",
      customerEmail: null,
      invoiceId: "in_6",
      amountDue: 1000,
      currency: "usd",
      attemptCount: 1,
      hostedInvoiceUrl: null,
    });
    expect(out?.tags).not.toHaveProperty("invoice-url");
  });

  it("pushes the day's first user.auth_failed and keeps the rest as silent rows (SK-EVENTS-006)", () => {
    const failed = {
      name: "user.auth_failed",
      email: "x@y.com",
      emailHash: "abc",
      path: "/api/auth/magic-link/verify",
      status: 500,
    } as const;
    expect(buildPayload("nlqdb", { ...failed, firstToday: true })).toMatchObject({
      channel: "users",
      event: "Sign-in failed",
      notify: true,
      tags: { email: "x@y.com", path: "/api/auth/magic-link/verify", status: "500" },
    });
    expect(buildPayload("nlqdb", { ...failed, firstToday: false })).toMatchObject({
      notify: false,
    });
  });

  it("pages a first db.adopted; a replay is not LogSnag-routed (SK-EVENTS-014)", () => {
    const adopted = { name: "db.adopted", userId: "u_1", dbId: "db_sales_ab12cd" } as const;
    expect(buildPayload("nlqdb", { ...adopted, replay: false })).toMatchObject({
      channel: "activation",
      notify: true,
      user_id: "u_1",
    });
    expect(isLogSnagRouted({ ...adopted, replay: true })).toBe(false);
  });

  it("routes only pages to LogSnag: every aggregate signal stays in PostHog (SK-EVENTS-006)", () => {
    const aggregates: ProductEvent[] = [
      {
        name: "feature.requested.ddl_via_ask",
        principalId: "a",
        surface: "hero",
        rejectReason: "drop_statement",
      },
      { name: "feature.requested.heavier_tier", principalId: "a", surface: "chat" },
      { name: "feature.requested.larger_account", principalId: "a", surface: "chat" },
      { name: "feature.destructive.preview_rendered", principalId: "a", surface: "chat" },
      { name: "feature.destructive.committed", principalId: "a", surface: "cli" },
      { name: "home.surface_wishlist", principalId: "wl:a", surface: "vscode" },
      { name: "pricing.page_viewed", principalId: "a", email: null },
      { name: "pricing.plan_selected", principalId: "a", plan: "hobby", email: null },
      {
        name: "db.created",
        dbId: "db_1",
        principalId: "a",
        anon: true,
        engine: "postgres",
        preset: false,
        tableCount: 3,
        synthetic: false,
      },
      {
        name: "feature.eval.weekly",
        runId: "r",
        dataset: "bird-mini-dev-sqlite",
        questionCount: 1,
        laneExecutionAccuracy: { free: 0.5 },
        freeVsFrontierDelta: null,
      },
      // SK-EVENTS-015: browser clicks are PostHog only.
      { name: "solve.try_query_clicked", principalId: "pv:a", slug: "s", goal: "g" },
      { name: "onboarding.landing_viewed", principalId: "pv:a", surface: "hero" },
    ];
    for (const event of aggregates) {
      expect(isLogSnagRouted(event)).toBe(false);
      expect(buildPayload("nlqdb", event)).toBeNull();
    }
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
