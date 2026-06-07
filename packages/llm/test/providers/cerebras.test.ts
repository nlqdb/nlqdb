import { describe, expect, it } from "vitest";
import { createCerebrasProvider } from "../../src/providers/cerebras.ts";
import type { ProviderError } from "../../src/types.ts";
import { mockFetch, openAIChatResponse } from "../_fixtures.ts";

const apiKey = "csk-test";

describe("createCerebrasProvider", () => {
  it("plan parses JSON response and returns sql", async () => {
    const provider = createCerebrasProvider({ apiKey });
    const fetch = mockFetch([
      {
        match: /api\.cerebras\.ai.*chat\/completions/,
        respond: () => openAIChatResponse(JSON.stringify({ sql: "SELECT 1" })),
      },
    ]);
    const res = await provider.plan(
      { goal: "test", schema: "t(a int)", dialect: "sqlite" },
      { fetch },
    );
    expect(res.sql).toBe("SELECT 1");
  });

  it("model() defaults the planner tier to gpt-oss-120b", () => {
    const provider = createCerebrasProvider({ apiKey });
    expect(provider.model("plan")).toBe("gpt-oss-120b");
    expect(provider.model("schema_infer")).toBe("gpt-oss-120b");
  });

  it("custom models override the defaults per operation", () => {
    const provider = createCerebrasProvider({ apiKey, models: { plan: "zai-glm-4.7" } });
    expect(provider.model("plan")).toBe("zai-glm-4.7");
    expect(provider.model("schema_infer")).toBe("gpt-oss-120b");
  });

  it("baseUrl override targets the AI Gateway path", async () => {
    const provider = createCerebrasProvider({ apiKey, baseUrl: "https://gw.example/cerebras/v1" });
    const fetch = mockFetch([
      {
        match: /gw\.example\/cerebras\/v1\/chat\/completions/,
        respond: () => openAIChatResponse(JSON.stringify({ sql: "SELECT 2" })),
      },
    ]);
    const res = await provider.plan({ goal: "g", schema: "s", dialect: "sqlite" }, { fetch });
    expect(res.sql).toBe("SELECT 2");
  });

  it("429 (free-tier per-minute quota) becomes rate_limited carrying the Retry-After window (SK-LLM-030)", async () => {
    const provider = createCerebrasProvider({ apiKey });
    const fetch = mockFetch([
      {
        match: /api\.cerebras\.ai/,
        respond: () =>
          new Response("token_quota_exceeded", { status: 429, headers: { "retry-after": "30" } }),
      },
    ]);
    await expect(
      provider.plan({ goal: "g", schema: "s", dialect: "sqlite" }, { fetch }),
    ).rejects.toMatchObject({
      reason: "rate_limited",
      status: 429,
      retryAfterMs: 30_000,
    } satisfies Partial<ProviderError>);
  });

  it("network error becomes ProviderError reason=network", async () => {
    const provider = createCerebrasProvider({ apiKey });
    const fetch = async (): Promise<Response> => {
      throw new Error("dns boom");
    };
    await expect(
      provider.plan({ goal: "g", schema: "s", dialect: "sqlite" }, { fetch }),
    ).rejects.toMatchObject({ reason: "network" } satisfies Partial<ProviderError>);
  });
});
