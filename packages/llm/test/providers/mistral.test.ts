import { describe, expect, it } from "vitest";
import { createMistralProvider } from "../../src/providers/mistral.ts";
import type { ProviderError } from "../../src/types.ts";
import { mockFetch, openAIChatResponse } from "../_fixtures.ts";

const apiKey = "mst-test";

describe("createMistralProvider", () => {
  it("plan parses JSON response and returns sql", async () => {
    const provider = createMistralProvider({ apiKey });
    const fetch = mockFetch([
      {
        match: /api\.mistral\.ai.*chat\/completions/,
        respond: () => openAIChatResponse(JSON.stringify({ sql: "SELECT 1" })),
      },
    ]);
    const res = await provider.plan({ goal: "test", schema: "t(a int)", dialect: "sqlite" }, { fetch });
    expect(res.sql).toBe("SELECT 1");
  });

  it("model() defaults the planner tier to mistral-large-latest", () => {
    const provider = createMistralProvider({ apiKey });
    expect(provider.model("plan")).toBe("mistral-large-latest");
    expect(provider.model("schema_infer")).toBe("mistral-large-latest");
  });

  it("custom models override the defaults per operation", () => {
    const provider = createMistralProvider({ apiKey, models: { plan: "codestral-latest" } });
    expect(provider.model("plan")).toBe("codestral-latest");
    expect(provider.model("schema_infer")).toBe("mistral-large-latest");
  });

  it("baseUrl override targets the AI Gateway path", async () => {
    const provider = createMistralProvider({ apiKey, baseUrl: "https://gw.example/mistral/v1" });
    const fetch = mockFetch([
      {
        match: /gw\.example\/mistral\/v1\/chat\/completions/,
        respond: () => openAIChatResponse(JSON.stringify({ sql: "SELECT 2" })),
      },
    ]);
    const res = await provider.plan({ goal: "g", schema: "s", dialect: "sqlite" }, { fetch });
    expect(res.sql).toBe("SELECT 2");
  });

  it("429 (free-tier per-minute token quota) becomes ProviderError so the router fails over", async () => {
    const provider = createMistralProvider({ apiKey });
    const fetch = mockFetch([
      {
        match: /api\.mistral\.ai/,
        respond: () => new Response("rate_limit_exceeded", { status: 429 }),
      },
    ]);
    await expect(
      provider.plan({ goal: "g", schema: "s", dialect: "sqlite" }, { fetch }),
    ).rejects.toMatchObject({ reason: "http_4xx", status: 429 } satisfies Partial<ProviderError>);
  });

  it("network error becomes ProviderError reason=network", async () => {
    const provider = createMistralProvider({ apiKey });
    const fetch = async (): Promise<Response> => {
      throw new Error("dns boom");
    };
    await expect(
      provider.plan({ goal: "g", schema: "s", dialect: "sqlite" }, { fetch }),
    ).rejects.toMatchObject({ reason: "network" } satisfies Partial<ProviderError>);
  });
});
