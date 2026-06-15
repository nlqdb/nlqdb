import { describe, expect, it } from "vitest";
import { createGeminiProvider } from "../../src/providers/gemini.ts";
import type { ProviderError, RouteRequest } from "../../src/types.ts";
import { geminiResponse, mockFetch } from "../_fixtures.ts";

const apiKey = "AIza-test";

const routeReq: RouteRequest = {
  goal: "show revenue",
  dbs: [],
  recentTables: [],
};

describe("createGeminiProvider", () => {
  it("route parses JSON from candidates[0].content.parts[0].text", async () => {
    const provider = createGeminiProvider({ apiKey });
    const fetch = mockFetch([
      {
        match: /generativelanguage\.googleapis\.com/,
        respond: () =>
          geminiResponse(
            JSON.stringify({
              kind: "query",
              targetDbId: null,
              referencedTables: [],
              confidence: 0.95,
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
      confidence: 0.95,
      reason: "ok",
    });
  });

  it("plan parses JSON response", async () => {
    const provider = createGeminiProvider({ apiKey });
    const fetch = mockFetch([
      {
        match: /generativelanguage/,
        respond: () => geminiResponse(JSON.stringify({ sql: "SELECT 4" })),
      },
    ]);
    const res = await provider.plan({ goal: "g", schema: "s", dialect: "postgres" }, { fetch });
    expect(res.sql).toBe("SELECT 4");
  });

  it("summarize returns trimmed text", async () => {
    const provider = createGeminiProvider({ apiKey });
    const fetch = mockFetch([
      { match: /generativelanguage/, respond: () => geminiResponse("\n  one liner  \n") },
    ]);
    const res = await provider.summarize({ goal: "g", rows: [] }, { fetch });
    expect(res.summary).toBe("one liner");
  });

  it("model() returns the configured Gemini model", () => {
    const provider = createGeminiProvider({ apiKey });
    expect(provider.model("route")).toBe("gemini-2.5-flash");
    expect(provider.model("plan")).toBe("gemini-2.5-flash");
  });

  it("SK-LLM-039 — 401/403 becomes ProviderError reason=auth_denied (project denied)", async () => {
    const provider = createGeminiProvider({ apiKey });
    const fetch = mockFetch([
      { match: /generativelanguage/, respond: () => new Response("nope", { status: 403 }) },
    ]);
    await expect(provider.route(routeReq, { fetch })).rejects.toMatchObject({
      reason: "auth_denied",
      status: 403,
    } satisfies Partial<ProviderError>);
  });

  it("a non-auth 4xx still becomes ProviderError reason=http_4xx", async () => {
    const provider = createGeminiProvider({ apiKey });
    const fetch = mockFetch([
      { match: /generativelanguage/, respond: () => new Response("bad", { status: 400 }) },
    ]);
    await expect(provider.route(routeReq, { fetch })).rejects.toMatchObject({
      reason: "http_4xx",
      status: 400,
    } satisfies Partial<ProviderError>);
  });

  it("api key is passed via x-goog-api-key header, NOT in the URL", async () => {
    // Header rather than `?key=` query param keeps the secret out of
    // wrangler tail logs, span exception messages, and any upstream
    // error body that echoes the request URL.
    const provider = createGeminiProvider({ apiKey });
    let url = "";
    let goog: string | null = null;
    let auth: string | null = null;
    const fetch = mockFetch([
      {
        match: /generativelanguage/,
        respond: (req) => {
          url = req.url;
          goog = req.headers.get("x-goog-api-key");
          auth = req.headers.get("authorization");
          return geminiResponse(
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
    expect(url).not.toContain(apiKey);
    expect(url).not.toContain("key=");
    expect(goog).toBe(apiKey);
    expect(auth).toBeNull();
  });
});
