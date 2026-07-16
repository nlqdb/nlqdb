import { describe, expect, it } from "vitest";
import { createByollmProvider } from "../../src/providers/byollm.ts";
import type { RouteRequest } from "../../src/types.ts";
import { mockFetch, openAIChatResponse } from "../_fixtures.ts";

const base = {
  apiKey: "sk-user-byok",
  upstream: "openai",
  model: "gpt-5.2",
  accountId: "acc123",
  gatewayId: "gw456",
  userId: "user-A",
};

const routeReq: RouteRequest = { goal: "what tables?", dbs: [], recentTables: [] };

// Captures the request seen by the upstream so each test can assert on
// the exact URL / headers / body the gateway would receive.
function captureFetch() {
  const seen: { url: string; headers: Headers; body: unknown }[] = [];
  const fetch = mockFetch([
    {
      match: /gateway\.ai\.cloudflare\.com/,
      respond: async (req) => {
        seen.push({ url: req.url, headers: req.headers, body: await req.clone().json() });
        return openAIChatResponse(JSON.stringify({ sql: "SELECT 1" }));
      },
    },
  ]);
  return { fetch, seen };
}

describe("createByollmProvider", () => {
  it("targets the AI Gateway unified compat endpoint", async () => {
    const { fetch, seen } = captureFetch();
    await createByollmProvider(base).plan(
      { goal: "g", schema: "s", dialect: "postgres" },
      { fetch },
    );
    expect(seen[0]?.url).toBe(
      "https://gateway.ai.cloudflare.com/v1/acc123/gw456/compat/chat/completions",
    );
  });

  it("passes the user's own key through as Authorization Bearer", async () => {
    const { fetch, seen } = captureFetch();
    await createByollmProvider(base).plan(
      { goal: "g", schema: "s", dialect: "postgres" },
      { fetch },
    );
    expect(seen[0]?.headers.get("authorization")).toBe("Bearer sk-user-byok");
  });

  it("qualifies the model as <upstream>/<model> for every op", async () => {
    const { fetch, seen } = captureFetch();
    const provider = createByollmProvider(base);
    expect(provider.model("route")).toBe("openai/gpt-5.2");
    expect(provider.model("plan")).toBe("openai/gpt-5.2");
    await provider.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    expect((seen[0]!.body as { model: string }).model).toBe("openai/gpt-5.2");
  });

  it("namespaces the cache key per tenant (BYOLLM_<userId> prefix)", async () => {
    const { fetch, seen } = captureFetch();
    await createByollmProvider(base).plan(
      { goal: "g", schema: "s", dialect: "postgres" },
      { fetch },
    );
    const key = seen[0]?.headers.get("cf-aig-cache-key");
    expect(key).toMatch(/^BYOLLM_user-A_[0-9a-f]{64}$/);
  });

  it("isolates tenants: different userId → different cache key, same input → same key", async () => {
    const { fetch, seen } = captureFetch();
    const planReq = { goal: "g", schema: "s", dialect: "postgres" as const };
    await createByollmProvider(base).plan(planReq, { fetch });
    await createByollmProvider({ ...base, userId: "user-B" }).plan(planReq, { fetch });
    await createByollmProvider(base).plan(planReq, { fetch });

    const [a, b, aAgain] = seen.map((s) => s.headers.get("cf-aig-cache-key"));
    expect(a).not.toBe(b); // cross-tenant: no collision
    expect(a).toBe(aAgain); // same tenant + same prompt: cache hit
  });

  it("sends cf-aig-authorization only when a gateway token is set", async () => {
    const withToken = captureFetch();
    await createByollmProvider({ ...base, gatewayToken: "cf-tok" }).plan(
      { goal: "g", schema: "s", dialect: "postgres" },
      { fetch: withToken.fetch },
    );
    expect(withToken.seen[0]?.headers.get("cf-aig-authorization")).toBe("Bearer cf-tok");

    const noToken = captureFetch();
    await createByollmProvider(base).plan(
      { goal: "g", schema: "s", dialect: "postgres" },
      {
        fetch: noToken.fetch,
      },
    );
    expect(noToken.seen[0]?.headers.get("cf-aig-authorization")).toBeNull();
  });

  it("parses route/plan responses through the shared chat provider", async () => {
    const fetch = mockFetch([
      {
        match: /gateway\.ai\.cloudflare\.com/,
        respond: () =>
          openAIChatResponse(
            JSON.stringify({
              kind: "query",
              targetDbId: null,
              referencedTables: [],
              confidence: 0.9,
              reason: "ok",
            }),
          ),
      },
    ]);
    const res = await createByollmProvider(base).route(routeReq, { fetch });
    expect(res.kind).toBe("query");
  });

  it("fails loud on missing required config (GLOBAL-012)", () => {
    expect(() => createByollmProvider({ ...base, accountId: "" })).toThrow(/accountId/);
    expect(() => createByollmProvider({ ...base, apiKey: "" })).toThrow(/apiKey/);
  });

  it("rejects a userId that isn't header-safe", () => {
    expect(() => createByollmProvider({ ...base, userId: "bad\nid" })).toThrow(/userId/);
    expect(() => createByollmProvider({ ...base, userId: "a b" })).toThrow(/userId/);
  });
});
