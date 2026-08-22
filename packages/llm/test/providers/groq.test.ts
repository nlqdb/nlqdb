import { describe, expect, it } from "vitest";
import { createGroqProvider, createGroqQwenProvider } from "../../src/providers/groq.ts";
import type { ProviderError, RouteRequest } from "../../src/types.ts";
import { mockFetch, openAIChatResponse } from "../_fixtures.ts";

const apiKey = "gsk_test";

const routeReq: RouteRequest = {
  goal: "show revenue last month",
  dbs: [],
  recentTables: [],
};

describe("createGroqProvider", () => {
  it("route parses JSON response", async () => {
    const provider = createGroqProvider({ apiKey });
    const fetch = mockFetch([
      {
        match: /api\.groq\.com.*chat\/completions/,
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
    const res = await provider.route(routeReq, { fetch });
    expect(res).toEqual({
      kind: "query",
      targetDbId: null,
      referencedTables: [],
      confidence: 0.9,
      reason: "ok",
    });
  });

  it("plan parses JSON response and returns sql", async () => {
    const provider = createGroqProvider({ apiKey });
    const fetch = mockFetch([
      {
        match: /api\.groq\.com/,
        respond: () => openAIChatResponse(JSON.stringify({ sql: "SELECT 1" })),
      },
    ]);
    const res = await provider.plan(
      { goal: "test", schema: "t(a int)", dialect: "postgres" },
      { fetch },
    );
    expect(res.sql).toBe("SELECT 1");
  });

  it("plan decodes greedily by default and forwards a temperature override (SK-QUAL-017)", async () => {
    const provider = createGroqProvider({ apiKey });
    const bodies: Array<{ temperature?: number }> = [];
    const fetch = mockFetch([
      {
        match: /api\.groq\.com/,
        respond: async (req) => {
          bodies.push((await req.clone().json()) as { temperature?: number });
          return openAIChatResponse(JSON.stringify({ sql: "SELECT 1" }));
        },
      },
    ]);
    await provider.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    await provider.plan(
      { goal: "g", schema: "s", dialect: "postgres", temperature: 0.8 },
      { fetch },
    );
    expect(bodies[0]?.temperature).toBe(0);
    expect(bodies[1]?.temperature).toBe(0.8);
  });

  it("summarize returns trimmed text", async () => {
    const provider = createGroqProvider({ apiKey });
    const fetch = mockFetch([
      { match: /api\.groq\.com/, respond: () => openAIChatResponse("  hello world  ") },
    ]);
    const res = await provider.summarize({ goal: "g", rows: [{ a: 1 }] }, { fetch });
    expect(res.summary).toBe("hello world");
  });

  it("sends cf-aig-authorization when a gatewayToken is set, omits it otherwise (SK-LLM-046)", async () => {
    const seen: Array<string | null> = [];
    const fetch = mockFetch([
      {
        match: /chat\/completions/,
        respond: (req) => {
          seen.push(req.headers.get("cf-aig-authorization"));
          return openAIChatResponse(JSON.stringify({ sql: "SELECT 1" }));
        },
      },
    ]);
    const withTok = createGroqProvider({
      apiKey,
      baseUrl: "https://gw.example/groq",
      gatewayToken: "aig_tok",
    });
    await withTok.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    const noTok = createGroqProvider({ apiKey, baseUrl: "https://gw.example/groq" });
    await noTok.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    expect(seen[0]).toBe("Bearer aig_tok");
    expect(seen[1]).toBeNull();
  });

  it("model() reflects per-operation defaults", () => {
    const provider = createGroqProvider({ apiKey });
    expect(provider.model("route")).toBe("openai/gpt-oss-20b");
    expect(provider.model("plan")).toBe("openai/gpt-oss-120b");
    expect(provider.model("summarize")).toBe("openai/gpt-oss-120b");
    expect(provider.model("schema_infer")).toBe("openai/gpt-oss-120b");
    expect(provider.model("engine_classify")).toBe("openai/gpt-oss-20b");
  });

  it("custom models override the defaults per operation", () => {
    const provider = createGroqProvider({ apiKey, models: { route: "qwen/qwen3-32b" } });
    expect(provider.model("route")).toBe("qwen/qwen3-32b");
    expect(provider.model("plan")).toBe("openai/gpt-oss-120b");
  });

  it("non-429 4xx becomes ProviderError reason=http_4xx with status", async () => {
    const provider = createGroqProvider({ apiKey });
    const fetch = mockFetch([
      { match: /api\.groq\.com/, respond: () => new Response("bad request", { status: 400 }) },
    ]);
    await expect(provider.route(routeReq, { fetch })).rejects.toMatchObject({
      reason: "http_4xx",
      status: 400,
    } satisfies Partial<ProviderError>);
  });

  it("429 becomes ProviderError reason=rate_limited carrying Retry-After (SK-LLM-030)", async () => {
    const provider = createGroqProvider({ apiKey });
    const fetch = mockFetch([
      {
        match: /api\.groq\.com/,
        respond: () =>
          new Response("rate limited", { status: 429, headers: { "retry-after": "12" } }),
      },
    ]);
    await expect(provider.route(routeReq, { fetch })).rejects.toMatchObject({
      reason: "rate_limited",
      status: 429,
      retryAfterMs: 12_000,
    } satisfies Partial<ProviderError>);
  });

  it("error message contains the URL and a slice of the upstream body", async () => {
    const provider = createGroqProvider({ apiKey });
    const fetch = mockFetch([
      {
        match: /api\.groq\.com/,
        respond: () =>
          new Response(JSON.stringify({ error: { message: "invalid_api_key" } }), { status: 401 }),
      },
    ]);
    await expect(provider.route(routeReq, { fetch })).rejects.toThrow(
      /api\.groq\.com.*chat\/completions.*401.*invalid_api_key/,
    );
  });

  it("5xx becomes ProviderError reason=http_5xx", async () => {
    const provider = createGroqProvider({ apiKey });
    const fetch = mockFetch([
      { match: /api\.groq\.com/, respond: () => new Response("oops", { status: 503 }) },
    ]);
    await expect(provider.summarize({ goal: "g", rows: [] }, { fetch })).rejects.toMatchObject({
      reason: "http_5xx",
      status: 503,
    } satisfies Partial<ProviderError>);
  });

  it("network error becomes ProviderError reason=network", async () => {
    const provider = createGroqProvider({ apiKey });
    const fetch = async (): Promise<Response> => {
      throw new Error("dns boom");
    };
    await expect(
      provider.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch }),
    ).rejects.toMatchObject({ reason: "network" } satisfies Partial<ProviderError>);
  });

  it("malformed JSON content becomes ProviderError reason=parse", async () => {
    const provider = createGroqProvider({ apiKey });
    const fetch = mockFetch([
      { match: /api\.groq\.com/, respond: () => openAIChatResponse("not json at all") },
    ]);
    await expect(provider.route(routeReq, { fetch })).rejects.toMatchObject({
      reason: "parse",
    } satisfies Partial<ProviderError>);
  });

  it("strips ```json fences from model output", async () => {
    const provider = createGroqProvider({ apiKey });
    const fenced = ["```json", JSON.stringify({ sql: "SELECT 2" }), "```"].join("\n");
    const fetch = mockFetch([
      { match: /api\.groq\.com/, respond: () => openAIChatResponse(fenced) },
    ]);
    const res = await provider.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    expect(res.sql).toBe("SELECT 2");
  });
});

describe("createGroqQwenProvider (SK-LLM-053)", () => {
  it("names the chain entry groq-qwen and serves Qwen3.6-27B on the planner ops", () => {
    const provider = createGroqQwenProvider({ apiKey });
    expect(provider.name).toBe("groq-qwen");
    expect(provider.model("plan")).toBe("qwen/qwen3.6-27b");
    expect(provider.model("schema_infer")).toBe("qwen/qwen3.6-27b");
  });

  it("dispatches the planner head PLAIN — no reasoning_effort (forcing it empties content on Groq)", async () => {
    const provider = createGroqQwenProvider({ apiKey });
    let sent: Record<string, unknown> = {};
    const fetch = mockFetch([
      {
        match: /api\.groq\.com.*chat\/completions/,
        respond: async (req) => {
          sent = (await req.clone().json()) as Record<string, unknown>;
          return openAIChatResponse(JSON.stringify({ sql: "SELECT 1" }));
        },
      },
    ]);
    const res = await provider.plan(
      { goal: "g", schema: "t(a int)", dialect: "sqlite" },
      { fetch },
    );
    expect(res.sql).toBe("SELECT 1");
    expect(sent["model"]).toBe("qwen/qwen3.6-27b");
    expect(sent["reasoning_effort"]).toBeUndefined();
    expect(sent["max_completion_tokens"]).toBeUndefined();
    // Greedy (SK-LLM-024) like every other planner leg.
    expect(sent["temperature"]).toBe(0);
  });
});
