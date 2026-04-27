import { describe, expect, it } from "vitest";
import { createClient, type FetchLike, NlqdbApiError } from "../src/index.ts";

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

  it("throws NlqdbApiError on non-ok with structured envelope", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(JSON.stringify({ error: { status: "rate_limited", limit: 100, count: 101 } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    const client = createClient({ fetch: fakeFetch });
    try {
      await client.ask({ goal: "x", dbId: "y" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NlqdbApiError);
      const e = err as NlqdbApiError;
      expect(e.httpStatus).toBe(429);
      expect(e.code).toBe("rate_limited");
      expect(e.body?.limit).toBe(100);
      expect(e.path).toBe("/v1/ask");
    }
  });

  it("throws NlqdbApiError with code='unknown_error' when body lacks the envelope", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(JSON.stringify({ random: "shape" }), { status: 502 });
    const client = createClient({ fetch: fakeFetch });
    try {
      await client.ask({ goal: "x", dbId: "y" });
      expect.fail("should have thrown");
    } catch (err) {
      const e = err as NlqdbApiError;
      expect(e.code).toBe("unknown_error");
      expect(e.httpStatus).toBe(502);
    }
  });

  it("throws NlqdbApiError with code='non_json_response' on HTML body (no body leak)", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response("<html><body>SOME-CDN-INTERNALS</body></html>", { status: 503 });
    const client = createClient({ fetch: fakeFetch });
    try {
      await client.ask({ goal: "x", dbId: "y" });
      expect.fail("should have thrown");
    } catch (err) {
      const e = err as NlqdbApiError;
      expect(e.code).toBe("non_json_response");
      // Critical: the HTML body must NOT leak into the thrown message.
      expect(e.message).not.toContain("SOME-CDN-INTERNALS");
      expect(e.message).not.toContain("html");
    }
  });
});
