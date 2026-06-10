import { describe, expect, it } from "vitest";
import { createWorkersAIProvider } from "../../src/providers/workers-ai.ts";
import type { ProviderError, RouteRequest } from "../../src/types.ts";
import { jsonResponse, mockFetch, workersAIResponse } from "../_fixtures.ts";

const accountId = "acc_test";
const apiToken = "cf_token";

const routeReq: RouteRequest = {
  goal: "u",
  dbs: [],
  recentTables: [],
};

describe("createWorkersAIProvider", () => {
  it("route parses JSON from result.response", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken });
    const fetch = mockFetch([
      {
        match: /api\.cloudflare\.com.*\/ai\/run/,
        respond: () =>
          workersAIResponse(
            JSON.stringify({
              kind: "query",
              targetDbId: null,
              referencedTables: [],
              confidence: 0.8,
              reason: "ok",
            }),
          ),
      },
    ]);
    const res = await provider.route(routeReq, { fetch });
    expect(res.kind).toBe("query");
  });

  it("plan parses JSON from result.response", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken });
    const fetch = mockFetch([
      {
        match: /api\.cloudflare\.com/,
        respond: () => workersAIResponse(JSON.stringify({ sql: "SELECT 5" })),
      },
    ]);
    const res = await provider.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    expect(res.sql).toBe("SELECT 5");
  });

  it("plan accepts an object-shaped result.response (llama-3.3 pre-parses JSON output, SK-LLM-036)", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken });
    const fetch = mockFetch([
      {
        match: /api\.cloudflare\.com/,
        respond: () => jsonResponse({ result: { response: { sql: "SELECT 7" } }, success: true }),
      },
    ]);
    const res = await provider.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    expect(res.sql).toBe("SELECT 7");
  });

  it("missing result.response still fails with reason=parse", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken });
    const fetch = mockFetch([
      { match: /api\.cloudflare\.com/, respond: () => jsonResponse({ result: {}, success: true }) },
    ]);
    await expect(
      provider.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch }),
    ).rejects.toMatchObject({ reason: "parse" } satisfies Partial<ProviderError>);
  });

  it("summarize returns trimmed text", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken });
    const fetch = mockFetch([
      { match: /api\.cloudflare\.com/, respond: () => workersAIResponse("the answer  ") },
    ]);
    const res = await provider.summarize({ goal: "g", rows: [] }, { fetch });
    expect(res.summary).toBe("the answer");
  });

  it("sends temperature 0 for greedy decoding parity with the rest of the chain (SK-LLM-024)", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken });
    let body: { temperature?: number } = {};
    const fetch = mockFetch([
      {
        match: /api\.cloudflare\.com/,
        respond: async (req) => {
          body = (await req.clone().json()) as { temperature?: number };
          return workersAIResponse(JSON.stringify({ sql: "SELECT 1" }));
        },
      },
    ]);
    await provider.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    expect(body.temperature).toBe(0);
  });

  it("model() returns the @cf/-prefixed model id", () => {
    const provider = createWorkersAIProvider({ accountId, apiToken });
    expect(provider.model("route")).toBe("@cf/meta/llama-3.1-8b-instruct");
  });

  it("URL embeds the account id and model path", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken });
    let captured = "";
    const fetch = mockFetch([
      {
        match: /api\.cloudflare\.com/,
        respond: (req) => {
          captured = req.url;
          return workersAIResponse(
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
    expect(captured).toContain(`/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`);
  });

  it("success:false in body becomes ProviderError reason=provider_error", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken });
    const fetch = mockFetch([
      {
        match: /api\.cloudflare\.com/,
        respond: () =>
          jsonResponse({
            success: false,
            errors: [{ code: 7000, message: "no route for that path" }],
          }),
      },
    ]);
    await expect(provider.route(routeReq, { fetch })).rejects.toMatchObject({
      reason: "provider_error",
    } satisfies Partial<ProviderError>);
  });

  it("error message includes URL and the upstream errors[0].message", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken });
    const fetch = mockFetch([
      {
        match: /api\.cloudflare\.com/,
        respond: () =>
          jsonResponse({
            success: false,
            errors: [{ code: 7000, message: "no route for that path" }],
          }),
      },
    ]);
    await expect(provider.route(routeReq, { fetch })).rejects.toThrow(/no route for that path/);
  });
});
