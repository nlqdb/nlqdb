// Unit tests for the Stripe Billing Portal session creation module.
// Stubs all I/O (Stripe SDK). No Miniflare required.

import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type PortalDeps, createPortalSession } from "../src/stripe/portal.ts";

function makeStubDeps(overrides: Partial<PortalDeps> = {}): PortalDeps {
  return {
    stripeSecretKey: overrides.stripeSecretKey ?? "sk_test_key",
    stripeCustomerId: overrides.stripeCustomerId ?? "cus_test_123",
    userId: overrides.userId ?? "user_123",
    idempotencyKey: overrides.idempotencyKey !== undefined ? overrides.idempotencyKey : null,
  };
}

// Patch newStripeClient to return a stub Stripe instance.
vi.mock("../src/stripe/client.ts", () => {
  return {
    STRIPE_API_VERSION: "2026-04-22.dahlia",
    newStripeClient: vi.fn(),
    stripe: { webhooks: { constructEventAsync: vi.fn() } },
    cryptoProvider: undefined,
  };
});

import { newStripeClient } from "../src/stripe/client.ts";

function mockStripeClient(
  createFn: (
    params: Stripe.BillingPortal.SessionCreateParams,
    options?: Stripe.RequestOptions,
  ) => Promise<Partial<Stripe.BillingPortal.Session>>,
): void {
  vi.mocked(newStripeClient).mockReturnValue({
    billingPortal: {
      sessions: {
        create: createFn as unknown as Stripe["billingPortal"]["sessions"]["create"],
      },
    },
  } as unknown as Stripe);
}

describe("createPortalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the portal URL", async () => {
    mockStripeClient(async () => ({
      id: "bps_test_abc",
      url: "https://billing.stripe.com/session/bps_test_abc",
    }));

    const result = await createPortalSession(makeStubDeps(), "https://app.nlqdb.com/app");

    expect(result.status).toBe(200);
    if (result.status !== 200) throw new Error("expected 200");
    expect(result.body.url).toBe("https://billing.stripe.com/session/bps_test_abc");
  });

  it("passes the customer id and server-derived return_url", async () => {
    let captured: Stripe.BillingPortal.SessionCreateParams | undefined;
    mockStripeClient(async (params) => {
      captured = params;
      return { id: "bps_test_abc", url: "https://billing.stripe.com/session/bps_test_abc" };
    });

    await createPortalSession(
      makeStubDeps({ stripeCustomerId: "cus_specific" }),
      "https://app.nlqdb.com/app",
    );

    expect(captured?.customer).toBe("cus_specific");
    expect(captured?.return_url).toBe("https://app.nlqdb.com/app");
  });

  it("forwards the idempotency key to Stripe", async () => {
    let capturedOptions: Stripe.RequestOptions | undefined;
    mockStripeClient(async (_params, options) => {
      capturedOptions = options;
      return { id: "bps_test_abc", url: "https://billing.stripe.com/session/bps_test_abc" };
    });

    await createPortalSession(
      makeStubDeps({ idempotencyKey: "idem-key-123" }),
      "https://app.nlqdb.com/app",
    );

    expect(capturedOptions?.idempotencyKey).toBe("idem-key-123");
  });

  it("omits the idempotency key when none is provided", async () => {
    let capturedOptions: Stripe.RequestOptions | undefined;
    mockStripeClient(async (_params, options) => {
      capturedOptions = options;
      return { id: "bps_test_abc", url: "https://billing.stripe.com/session/bps_test_abc" };
    });

    await createPortalSession(makeStubDeps({ idempotencyKey: null }), "https://app.nlqdb.com/app");

    expect(capturedOptions?.idempotencyKey).toBeUndefined();
  });

  it("returns 500 internal when Stripe API throws", async () => {
    mockStripeClient(async () => {
      throw new Error("stripe network error");
    });

    const result = await createPortalSession(makeStubDeps(), "https://app.nlqdb.com/app");

    expect(result.status).toBe(500);
    if (result.status !== 500) throw new Error("expected 500");
    expect(result.body.error).toBe("internal");
  });
});
