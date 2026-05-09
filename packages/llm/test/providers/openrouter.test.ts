import { describe, expect, it } from "vitest";
import { createOpenRouterProvider } from "../../src/providers/openrouter.ts";
import type { RouteRequest } from "../../src/types.ts";
import { mockFetch, openAIChatResponse } from "../_fixtures.ts";

const apiKey = "sk-or-test";

const routeReq: RouteRequest = {
  goal: "what tables?",
  dbs: [],
  recentTables: [],
};

describe("createOpenRouterProvider", () => {
  it("route parses JSON response", async () => {
    const provider = createOpenRouterProvider({ apiKey });
    const fetch = mockFetch([
      {
        match: /openrouter\.ai/,
        respond: () =>
          openAIChatResponse(
            JSON.stringify({
              kind: "query",
              targetDbId: null,
              referencedTables: [],
              confidence: 0.7,
              reason: "ok",
            }),
          ),
      },
    ]);
    const res = await provider.route(routeReq, { fetch });
    expect(res.kind).toBe("query");
  });

  it("plan parses JSON response", async () => {
    const provider = createOpenRouterProvider({ apiKey });
    const fetch = mockFetch([
      {
        match: /openrouter\.ai/,
        respond: () => openAIChatResponse(JSON.stringify({ sql: "SELECT 3" })),
      },
    ]);
    const res = await provider.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    expect(res.sql).toBe("SELECT 3");
  });

  it("summarize returns trimmed text", async () => {
    const provider = createOpenRouterProvider({ apiKey });
    const fetch = mockFetch([
      { match: /openrouter\.ai/, respond: () => openAIChatResponse("\nfree-tier text\n") },
    ]);
    const res = await provider.summarize({ goal: "g", rows: [] }, { fetch });
    expect(res.summary).toBe("free-tier text");
  });

  it("model() reflects :free defaults", () => {
    const provider = createOpenRouterProvider({ apiKey });
    expect(provider.model("route")).toBe("meta-llama/llama-3.1-8b-instruct:free");
    expect(provider.model("plan")).toBe("meta-llama/llama-3.3-70b-instruct:free");
  });

  it("sends Authorization Bearer header", async () => {
    const provider = createOpenRouterProvider({ apiKey });
    let capturedAuth: string | null = null;
    const fetch = mockFetch([
      {
        match: /openrouter\.ai/,
        respond: (req) => {
          capturedAuth = req.headers.get("authorization");
          return openAIChatResponse(
            JSON.stringify({
              kind: "query",
              targetDbId: null,
              referencedTables: [],
              confidence: 1,
              reason: "ok",
            }),
          );
        },
      },
    ]);
    await provider.route(routeReq, { fetch });
    expect(capturedAuth).toBe("Bearer sk-or-test");
  });
});
