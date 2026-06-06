import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { fetchBillingStatus, openBillingPortal } from "./billing.ts";

const originalFetch = globalThis.fetch;

function mockFetch(response: Response | (() => never)) {
  globalThis.fetch = (async () => {
    if (typeof response === "function") response();
    return response as Response;
  }) as typeof fetch;
}

let assigned: string | null = null;

beforeEach(() => {
  assigned = null;
  (globalThis as unknown as { window: unknown }).window = {
    location: {
      assign: (url: string) => {
        assigned = url;
      },
    },
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("fetchBillingStatus", () => {
  test("returns the parsed status on 200", async () => {
    mockFetch(
      new Response(JSON.stringify({ plan: "hobby", status: "active", manageable: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const status = await fetchBillingStatus("https://app.nlqdb.com/");
    expect(status?.plan).toBe("hobby");
    expect(status?.status).toBe("active");
  });

  test("returns null on a non-ok response (progressive enhancement)", async () => {
    mockFetch(new Response("nope", { status: 500 }));
    expect(await fetchBillingStatus("")).toBeNull();
  });

  test("returns null when fetch throws", async () => {
    mockFetch(() => {
      throw new Error("offline");
    });
    expect(await fetchBillingStatus("")).toBeNull();
  });
});

describe("openBillingPortal", () => {
  test("redirects to the Stripe URL on success", async () => {
    mockFetch(
      new Response(JSON.stringify({ url: "https://billing.stripe.com/s/123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    expect(await openBillingPortal("")).toBe("ok");
    expect(assigned).toBe("https://billing.stripe.com/s/123");
  });

  test("maps 404 to no_customer without redirecting", async () => {
    mockFetch(new Response("{}", { status: 404 }));
    expect(await openBillingPortal("")).toBe("no_customer");
    expect(assigned).toBeNull();
  });

  test("maps 503 to not_configured", async () => {
    mockFetch(new Response("{}", { status: 503 }));
    expect(await openBillingPortal("")).toBe("not_configured");
  });

  test("maps any other non-ok status to error", async () => {
    mockFetch(new Response("{}", { status: 500 }));
    expect(await openBillingPortal("")).toBe("error");
  });

  test("returns error when fetch throws", async () => {
    mockFetch(() => {
      throw new Error("offline");
    });
    expect(await openBillingPortal("")).toBe("error");
  });
});
