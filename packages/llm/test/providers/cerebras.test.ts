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

  it("model() defaults the planner tier to Qwen-3-235B and cheap tier to a small model", () => {
    const provider = createCerebrasProvider({ apiKey });
    expect(provider.model("plan")).toBe("qwen-3-235b-a22b-instruct-2507");
    expect(provider.model("schema_infer")).toBe("qwen-3-235b-a22b-instruct-2507");
    expect(provider.model("route")).toBe("llama3.1-8b");
  });

  it("custom models override the defaults per operation", () => {
    const provider = createCerebrasProvider({ apiKey, models: { plan: "qwen-3-32b" } });
    expect(provider.model("plan")).toBe("qwen-3-32b");
    expect(provider.model("schema_infer")).toBe("qwen-3-235b-a22b-instruct-2507");
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

  it("4xx (context-cap / rate-limit) becomes ProviderError so the router fails over", async () => {
    const provider = createCerebrasProvider({ apiKey });
    const fetch = mockFetch([
      {
        match: /api\.cerebras\.ai/,
        respond: () => new Response("context_length_exceeded", { status: 400 }),
      },
    ]);
    await expect(
      provider.plan({ goal: "g", schema: "s", dialect: "sqlite" }, { fetch }),
    ).rejects.toMatchObject({ reason: "http_4xx", status: 400 } satisfies Partial<ProviderError>);
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
