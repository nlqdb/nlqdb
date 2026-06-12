// Unit tests for the Stripe Checkout Session creation module.
// Stubs all I/O (Stripe SDK). No Miniflare required.

import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CheckoutDeps, createCheckoutSession } from "../src/stripe/checkout.ts";

// Minimal Stripe checkout.sessions.create stub.
function makeStubDeps(
  overrides: Partial<CheckoutDeps> & {
    stripeCreateFn?: (
      params: Stripe.Checkout.SessionCreateParams,
      options?: Stripe.RequestOptions,
    ) => Promise<Partial<Stripe.Checkout.Session>>;
  } = {},
): CheckoutDeps & {
  stripeCreateFn: (
    params: Stripe.Checkout.SessionCreateParams,
    options?: Stripe.RequestOptions,
  ) => Promise<Partial<Stripe.Checkout.Session>>;
} {
  const stripeCreateFn =
    overrides.stripeCreateFn ??
    (async () => ({
      id: "cs_test_abc",
      url: "https://checkout.stripe.com/pay/cs_test_abc",
    }));

  const deps: CheckoutDeps = {
    stripeSecretKey: overrides.stripeSecretKey ?? "sk_test_key",
    priceIdHobby: overrides.priceIdHobby ?? "price_hobby_test",
    priceIdPro: overrides.priceIdPro ?? "price_pro_test",
    userId: overrides.userId ?? "user_123",
    userEmail: overrides.userEmail !== undefined ? overrides.userEmail : "user@example.com",
    existingStripeCustomerId:
      overrides.existingStripeCustomerId !== undefined ? overrides.existingStripeCustomerId : null,
    idempotencyKey: overrides.idempotencyKey !== undefined ? overrides.idempotencyKey : null,
  };

  return { ...deps, stripeCreateFn };
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
    params: Stripe.Checkout.SessionCreateParams,
    options?: Stripe.RequestOptions,
  ) => Promise<Partial<Stripe.Checkout.Session>>,
): void {
  vi.mocked(newStripeClient).mockReturnValue({
    checkout: {
      sessions: {
        create: createFn as unknown as Stripe["checkout"]["sessions"]["create"],
      },
    },
  } as unknown as Stripe);
}

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with checkout URL for hobby plan", async () => {
    const { stripeCreateFn, ...deps } = makeStubDeps();
    mockStripeClient(stripeCreateFn);

    const result = await createCheckoutSession(
      deps,
      "hobby",
      "https://app.nlqdb.com/app?checkout=success",
      "https://nlqdb.com/pricing",
    );

    expect(result.status).toBe(200);
    if (result.status !== 200) throw new Error("expected 200");
    expect(result.body.url).toBe("https://checkout.stripe.com/pay/cs_test_abc");
  });

  it("passes client_reference_id as userId", async () => {
    let capturedParams: Stripe.Checkout.SessionCreateParams | undefined;
    const { ...deps } = makeStubDeps({
      stripeCreateFn: async (params) => {
        capturedParams = params;
        return { id: "cs_test_abc", url: "https://checkout.stripe.com/pay/cs_test_abc" };
      },
    });
    mockStripeClient(deps.stripeCreateFn);
    await createCheckoutSession(
      deps,
      "hobby",
      "https://app.nlqdb.com/app?checkout=success",
      "https://nlqdb.com/pricing",
    );
    expect(capturedParams?.client_reference_id).toBe("user_123");
    expect(capturedParams?.mode).toBe("subscription");
    // Carried onto the subscription too, so customer.subscription.created
    // can resolve the user even if it beats checkout.session.completed
    // (SK-STRIPE-012 — Stripe doesn't guarantee webhook ordering).
    expect(capturedParams?.subscription_data?.metadata).toEqual({ nlqdb_user_id: "user_123" });
  });

  it("uses pro price ID for pro plan", async () => {
    let capturedParams: Stripe.Checkout.SessionCreateParams | undefined;
    const deps = makeStubDeps({
      stripeCreateFn: async (params) => {
        capturedParams = params;
        return { id: "cs_test_pro", url: "https://checkout.stripe.com/pay/cs_test_pro" };
      },
    });
    mockStripeClient(deps.stripeCreateFn);

    await createCheckoutSession(
      deps,
      "pro",
      "https://app.nlqdb.com/app?checkout=success",
      "https://nlqdb.com/pricing",
    );

    expect(capturedParams?.line_items).toEqual([{ price: "price_pro_test", quantity: 1 }]);
  });

  it("forwards idempotency key to Stripe", async () => {
    let capturedOptions: Stripe.RequestOptions | undefined;
    const deps = makeStubDeps({
      idempotencyKey: "idem-key-123",
      stripeCreateFn: async (_params, options) => {
        capturedOptions = options;
        return { id: "cs_test_abc", url: "https://checkout.stripe.com/pay/cs_test_abc" };
      },
    });
    mockStripeClient(deps.stripeCreateFn);

    await createCheckoutSession(
      deps,
      "hobby",
      "https://app.nlqdb.com/app?checkout=success",
      "https://nlqdb.com/pricing",
    );

    expect(capturedOptions?.idempotencyKey).toBe("idem-key-123");
  });

  it("returns 503 plan_not_configured when hobby price ID is empty", async () => {
    const deps = makeStubDeps({ priceIdHobby: "" });
    mockStripeClient(deps.stripeCreateFn);

    const result = await createCheckoutSession(
      deps,
      "hobby",
      "https://app.nlqdb.com/app?checkout=success",
      "https://nlqdb.com/pricing",
    );

    expect(result.status).toBe(503);
    if (result.status !== 503) throw new Error("expected 503");
    expect(result.body.error).toBe("plan_not_configured");
  });

  it("returns 503 plan_not_configured when pro price ID is empty", async () => {
    const deps = makeStubDeps({ priceIdPro: "" });
    mockStripeClient(deps.stripeCreateFn);

    const result = await createCheckoutSession(
      deps,
      "pro",
      "https://app.nlqdb.com/app?checkout=success",
      "https://nlqdb.com/pricing",
    );

    expect(result.status).toBe(503);
    if (result.status !== 503) throw new Error("expected 503");
    expect(result.body.error).toBe("plan_not_configured");
  });

  it("returns 500 internal when Stripe API throws", async () => {
    const deps = makeStubDeps({
      stripeCreateFn: async () => {
        throw new Error("stripe network error");
      },
    });
    mockStripeClient(deps.stripeCreateFn);

    const result = await createCheckoutSession(
      deps,
      "hobby",
      "https://app.nlqdb.com/app?checkout=success",
      "https://nlqdb.com/pricing",
    );

    expect(result.status).toBe(500);
    if (result.status !== 500) throw new Error("expected 500");
    expect(result.body.error).toBe("internal");
  });

  it("returns 500 when session URL is missing", async () => {
    const deps = makeStubDeps({
      stripeCreateFn: async () => ({ id: "cs_test_no_url", url: null }),
    });
    mockStripeClient(deps.stripeCreateFn);

    const result = await createCheckoutSession(
      deps,
      "hobby",
      "https://app.nlqdb.com/app?checkout=success",
      "https://nlqdb.com/pricing",
    );

    expect(result.status).toBe(500);
  });

  it("reuses the existing Stripe customer on re-subscribe and drops customer_email", async () => {
    let capturedParams: Stripe.Checkout.SessionCreateParams | undefined;
    const deps = makeStubDeps({
      existingStripeCustomerId: "cus_existing_123",
      stripeCreateFn: async (params) => {
        capturedParams = params;
        return { id: "cs_test_abc", url: "https://checkout.stripe.com/pay/cs_test_abc" };
      },
    });
    mockStripeClient(deps.stripeCreateFn);

    await createCheckoutSession(
      deps,
      "hobby",
      "https://app.nlqdb.com/app?checkout=success",
      "https://nlqdb.com/pricing",
    );

    expect(capturedParams?.customer).toBe("cus_existing_123");
    // automatic_tax needs the address written back to the existing customer.
    expect(capturedParams?.customer_update).toEqual({ address: "auto" });
    // Stripe forbids customer + customer_email together.
    expect(capturedParams).not.toHaveProperty("customer_email");
  });

  it("sends customer_email (no customer) for a first-time subscriber", async () => {
    let capturedParams: Stripe.Checkout.SessionCreateParams | undefined;
    const deps = makeStubDeps({
      stripeCreateFn: async (params) => {
        capturedParams = params;
        return { id: "cs_test_abc", url: "https://checkout.stripe.com/pay/cs_test_abc" };
      },
    });
    mockStripeClient(deps.stripeCreateFn);

    await createCheckoutSession(
      deps,
      "hobby",
      "https://app.nlqdb.com/app?checkout=success",
      "https://nlqdb.com/pricing",
    );

    expect(capturedParams?.customer_email).toBe("user@example.com");
    expect(capturedParams).not.toHaveProperty("customer");
    expect(capturedParams).not.toHaveProperty("customer_update");
  });

  it("omits customer_email when userEmail is null", async () => {
    let capturedParams: Stripe.Checkout.SessionCreateParams | undefined;
    const deps = makeStubDeps({
      userEmail: null,
      stripeCreateFn: async (params) => {
        capturedParams = params;
        return { id: "cs_test_abc", url: "https://checkout.stripe.com/pay/cs_test_abc" };
      },
    });
    mockStripeClient(deps.stripeCreateFn);

    await createCheckoutSession(
      deps,
      "hobby",
      "https://app.nlqdb.com/app?checkout=success",
      "https://nlqdb.com/pricing",
    );

    expect(capturedParams).not.toHaveProperty("customer_email");
  });
});
