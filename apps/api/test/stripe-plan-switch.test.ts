// Unit tests for the Stripe Billing Portal plan-switch deep link
// (SK-STRIPE-015). Stubs all I/O (Stripe SDK). No Miniflare required.
//
// The module caches the ensured configuration id in module scope, so each test
// calls `vi.resetModules()` and re-imports both the client mock and the module
// under test from the same fresh registry — that resets the cache and keeps the
// mocked `newStripeClient` identity in sync with the freshly-imported module.

import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanSwitchDeps } from "../src/stripe/plan-switch.ts";

function makeStubDeps(overrides: Partial<PlanSwitchDeps> = {}): PlanSwitchDeps {
  return {
    stripeSecretKey: overrides.stripeSecretKey ?? "sk_test_key",
    stripeCustomerId: overrides.stripeCustomerId ?? "cus_test_123",
    subscriptionId: overrides.subscriptionId ?? "sub_test_123",
    priceIdHobby: overrides.priceIdHobby ?? "price_hobby",
    priceIdPro: overrides.priceIdPro ?? "price_pro",
    userId: overrides.userId ?? "user_123",
    idempotencyKey: overrides.idempotencyKey !== undefined ? overrides.idempotencyKey : null,
  };
}

vi.mock("../src/stripe/client.ts", () => ({
  newStripeClient: vi.fn(),
  stripe: { webhooks: { constructEventAsync: vi.fn() } },
  cryptoProvider: undefined,
}));

type Stub = {
  configList: ReturnType<typeof vi.fn>;
  configCreate: ReturnType<typeof vi.fn>;
  priceRetrieve: ReturnType<typeof vi.fn>;
  sessionCreate: ReturnType<typeof vi.fn>;
};

// Fresh module registry + wired mock. Returns the module fn and the stub spies.
async function setup(over: Partial<Stub> = {}) {
  vi.resetModules();
  const stub: Stub = {
    configList: over.configList ?? vi.fn(async () => ({ data: [] })),
    configCreate: over.configCreate ?? vi.fn(async () => ({ id: "bpc_new" })),
    priceRetrieve:
      over.priceRetrieve ?? vi.fn(async (id: string) => ({ id, product: `prod_for_${id}` })),
    sessionCreate:
      over.sessionCreate ??
      vi.fn(async () => ({ id: "bps_test", url: "https://billing.stripe.com/session/bps_test" })),
  };
  const { newStripeClient } = await import("../src/stripe/client.ts");
  vi.mocked(newStripeClient).mockReturnValue({
    billingPortal: {
      configurations: { list: stub.configList, create: stub.configCreate },
      sessions: { create: stub.sessionCreate },
    },
    prices: { retrieve: stub.priceRetrieve },
  } as unknown as Stripe);
  const { createPlanSwitchSession } = await import("../src/stripe/plan-switch.ts");
  return { createPlanSwitchSession, stub };
}

const RETURN_URL = "https://app.nlqdb.com/app/billing";

describe("createPlanSwitchSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a subscription_update flow session and returns its URL", async () => {
    const { createPlanSwitchSession, stub } = await setup();

    const result = await createPlanSwitchSession(makeStubDeps(), RETURN_URL);

    expect(result.status).toBe(200);
    if (result.status !== 200) throw new Error("expected 200");
    expect(result.body.url).toBe("https://billing.stripe.com/session/bps_test");

    const params = stub.sessionCreate.mock.calls[0]![0];
    expect(params.customer).toBe("cus_test_123");
    expect(params.configuration).toBe("bpc_new");
    expect(params.return_url).toBe(RETURN_URL);
    expect(params.flow_data.type).toBe("subscription_update");
    expect(params.flow_data.subscription_update.subscription).toBe("sub_test_123");
    expect(params.flow_data.after_completion.redirect.return_url).toBe(RETURN_URL);
  });

  it("ensures a config with subscription_update enabled + both plan products", async () => {
    const { createPlanSwitchSession, stub } = await setup();

    await createPlanSwitchSession(makeStubDeps(), RETURN_URL);

    const cfg = stub.configCreate.mock.calls[0]![0];
    expect(cfg.metadata.nlqdb_managed).toBe("plan-switch");
    expect(cfg.features.subscription_update.enabled).toBe(true);
    expect(cfg.features.subscription_update.products).toEqual([
      { product: "prod_for_price_hobby", prices: ["price_hobby"] },
      { product: "prod_for_price_pro", prices: ["price_pro"] },
    ]);
  });

  it("reuses an existing tagged configuration instead of creating one", async () => {
    const { createPlanSwitchSession, stub } = await setup({
      configList: vi.fn(async () => ({
        data: [{ id: "bpc_existing", metadata: { nlqdb_managed: "plan-switch" } }],
      })),
    });

    await createPlanSwitchSession(makeStubDeps(), RETURN_URL);

    expect(stub.configCreate).not.toHaveBeenCalled();
    expect(stub.sessionCreate.mock.calls[0]![0].configuration).toBe("bpc_existing");
  });

  it("forwards the idempotency key to the session create", async () => {
    const { createPlanSwitchSession, stub } = await setup();

    await createPlanSwitchSession(makeStubDeps({ idempotencyKey: "idem-1" }), RETURN_URL);

    expect(stub.sessionCreate.mock.calls[0]![1]?.idempotencyKey).toBe("idem-1");
  });

  it("returns 500 internal when Stripe throws", async () => {
    const { createPlanSwitchSession } = await setup({
      sessionCreate: vi.fn(async () => {
        throw new Error("stripe boom");
      }),
    });

    const result = await createPlanSwitchSession(makeStubDeps(), RETURN_URL);
    expect(result.status).toBe(500);
    if (result.status !== 500) throw new Error("expected 500");
    expect(result.body.error).toBe("internal");
  });
});
