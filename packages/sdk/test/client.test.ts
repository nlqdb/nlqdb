import { describe, expect, it } from "vitest";
import { createClient, type FetchLike } from "../src/index.ts";

describe("createClient", () => {
  it("ask: posts JSON to /v1/ask with bearer + base url", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fakeFetch: FetchLike = async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(
        JSON.stringify({ status: "ok", cached: false, sql: "select 1", rows: [], rowCount: 0 }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const client = createClient({
      apiKey: "sk_test",
      baseUrl: "https://api.example.com/",
      fetch: fakeFetch,
    });
    const out = await client.ask({ goal: "users", dbId: "db_1" });

    expect(capturedUrl).toBe("https://api.example.com/v1/ask");
    expect((capturedInit?.headers as Record<string, string>)["authorization"]).toBe(
      "Bearer sk_test",
    );
    expect(capturedInit?.method).toBe("POST");
    expect(out).toMatchObject({ status: "ok", sql: "select 1" });
  });

  it("listChat: includes credentials when withCredentials=true", async () => {
    let capturedInit: RequestInit | undefined;
    const fakeFetch: FetchLike = async (_url, init) => {
      capturedInit = init;
      return new Response(JSON.stringify({ messages: [] }), { status: 200 });
    };

    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    await client.listChat();

    expect(capturedInit?.credentials).toBe("include");
  });

  it("returns body when status is non-ok but body has `error`", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(JSON.stringify({ error: { status: "rate_limited", limit: 100, count: 101 } }), {
        status: 429,
      });
    const client = createClient({ fetch: fakeFetch });
    const out = await client.ask({ goal: "x", dbId: "y" });
    expect(out).toMatchObject({ error: { status: "rate_limited" } });
  });
});
