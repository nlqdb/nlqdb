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

  it("sends temperature 0 (SK-LLM-024) and lifts the 256-token default completion cap", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken });
    let body: { temperature?: number; max_tokens?: number } = {};
    const fetch = mockFetch([
      {
        match: /api\.cloudflare\.com/,
        respond: async (req) => {
          body = (await req.clone().json()) as typeof body;
          return workersAIResponse(JSON.stringify({ sql: "SELECT 1" }));
        },
      },
    ]);
    await provider.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    expect(body.temperature).toBe(0);
    expect(body.max_tokens).toBe(4096);
  });

  it("repairs a SQL-style \\' apostrophe escape in the plan JSON to Postgres ''", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken });
    const raw = String.raw`{"sql":"INSERT INTO t (note) VALUES ('run 223\'s hint')"}`;
    const fetch = mockFetch([
      { match: /api\.cloudflare\.com/, respond: () => workersAIResponse(raw) },
    ]);
    const res = await provider.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    expect(res.sql).toBe("INSERT INTO t (note) VALUES ('run 223''s hint')");
  });

  it("forwards a PlanRequest.temperature override for SK-QUAL-017 sampling", async () => {
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
    await provider.plan(
      { goal: "g", schema: "s", dialect: "postgres", temperature: 0.7 },
      { fetch },
    );
    expect(body.temperature).toBe(0.7);
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

  it("sends cf-aig-authorization when a gatewayToken is set, omits it otherwise (SK-LLM-046)", async () => {
    const seen: Array<string | null> = [];
    const fetch = mockFetch([
      {
        match: /gw\.example/,
        respond: (req) => {
          seen.push(req.headers.get("cf-aig-authorization"));
          return workersAIResponse("hi");
        },
      },
    ]);
    const withTok = createWorkersAIProvider({
      accountId,
      apiToken,
      baseUrl: "https://gw.example/workers-ai",
      gatewayToken: "aig_tok",
    });
    await withTok.summarize({ goal: "g", rows: [{ a: 1 }] }, { fetch });
    const noTok = createWorkersAIProvider({
      accountId,
      apiToken,
      baseUrl: "https://gw.example/workers-ai",
    });
    await noTok.summarize({ goal: "g", rows: [{ a: 1 }] }, { fetch });
    expect(seen[0]).toBe("Bearer aig_tok");
    expect(seen[1]).toBeNull();
  });
});

// SK-LLM-055 — the account's daily neuron cap, read from Cloudflare's analytics.
describe("createWorkersAIProvider accountNeuronCap", () => {
  const plan = { goal: "g", schema: "s", dialect: "postgres" } as const;
  const spent = (totalNeurons: number) =>
    jsonResponse({
      data: { viewer: { accounts: [{ aiInferenceAdaptiveGroups: [{ sum: { totalNeurons } }] }] } },
    });
  const counting = (analytics: () => Response) => {
    const calls = { analytics: 0, run: 0 };
    const fetch = mockFetch([
      {
        match: /\/client\/v4\/graphql$/,
        respond: () => {
          calls.analytics++;
          return analytics();
        },
      },
      {
        match: /\/ai\/run\//,
        respond: () => {
          calls.run++;
          return workersAIResponse(JSON.stringify({ sql: "SELECT 1" }));
        },
      },
    ]);
    return { calls, fetch };
  };

  it("calls the model while the account is under the cap, reading the spend once per minute", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken, accountNeuronCap: 7000 });
    const { calls, fetch } = counting(() => spent(6999));
    await provider.plan(plan, { fetch });
    await provider.plan(plan, { fetch });
    expect(calls).toEqual({ analytics: 1, run: 2 });
  });

  it("at the cap, fails as rate_limited until 00:00 UTC without calling the model", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken, accountNeuronCap: 7000 });
    // 2026-10-26: 11,203 by 16:00 UTC, past the free 10,000.
    const { calls, fetch } = counting(() => spent(11203));
    const err = (await provider.plan(plan, { fetch }).catch((e) => e)) as ProviderError;
    expect(err.reason).toBe("rate_limited");
    expect(err.retryAfterMs).toBeGreaterThan(0);
    expect(err.retryAfterMs).toBeLessThanOrEqual(24 * 3_600_000);
    expect(calls.run).toBe(0);
  });

  it("an unreadable spend (token without Account Analytics read) fails over without calling the model", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken, accountNeuronCap: 7000 });
    const { calls, fetch } = counting(() =>
      jsonResponse({ data: null, errors: [{ message: "not authorized for that account" }] }),
    );
    const err = (await provider.plan(plan, { fetch }).catch((e) => e)) as ProviderError;
    expect(err.reason).toBe("provider_error");
    expect(calls.run).toBe(0);
  });

  it("without a cap, never reads the analytics", async () => {
    const provider = createWorkersAIProvider({ accountId, apiToken });
    const { calls, fetch } = counting(() => spent(99999));
    await provider.plan(plan, { fetch });
    expect(calls).toEqual({ analytics: 0, run: 1 });
  });
});
