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

  // The API has TWO error-envelope shapes on the wire. The
  // body-parse helper (apps/api/src/http.ts) returns a string-form
  // envelope `{ error: "invalid_json" }`. Without explicit handling,
  // every 400 from /v1/ask + /v1/chat/messages POST surfaced as
  // `unknown_error` and broke the discriminant contract.
  it("normalizes string-form error envelope into the structured ApiErrorBody", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    const client = createClient({ fetch: fakeFetch });
    try {
      await client.ask({ goal: "x", dbId: "y" });
      expect.fail("should have thrown");
    } catch (err) {
      const e = err as NlqdbApiError;
      expect(e.code).toBe("invalid_json");
      expect(e.httpStatus).toBe(400);
      expect(e.body?.status).toBe("invalid_json");
    }
  });

  it("wraps fetch rejection (network failure) into NlqdbApiError(code='network_error', httpStatus=0)", async () => {
    const fakeFetch: FetchLike = async () => {
      throw new TypeError("Failed to fetch");
    };
    const client = createClient({ fetch: fakeFetch });
    try {
      await client.ask({ goal: "x", dbId: "y" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NlqdbApiError);
      const e = err as NlqdbApiError;
      expect(e.code).toBe("network_error");
      expect(e.httpStatus).toBe(0);
      expect(e.body).toBeNull();
      // README contract: every method throws NlqdbApiError. Make
      // sure the original error is reachable for diagnostics.
      expect(e.cause).toBeInstanceOf(TypeError);
    }
  });

  it("AbortSignal: aborting a request surfaces NlqdbApiError(code='aborted')", async () => {
    const controller = new AbortController();
    const fakeFetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        // Mimic real fetch: reject with AbortError when the signal
        // fires. This is the contract every supported runtime
        // implements — testing the SDK's wrapping, not the runtime's
        // abort plumbing.
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    const client = createClient({ fetch: fakeFetch });
    const promise = client.ask({ goal: "x", dbId: "y" }, { signal: controller.signal });
    controller.abort();
    try {
      await promise;
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NlqdbApiError);
      const e = err as NlqdbApiError;
      expect(e.code).toBe("aborted");
      expect(e.httpStatus).toBe(0);
    }
  });

  it("createClient: throws when both apiKey and withCredentials are set (defensive runtime guard)", () => {
    expect(() =>
      createClient({
        // Defeat the discriminated-union compile error so we can
        // exercise the runtime guard — JS callers + `as any` escapes
        // don't get the type-check.
        ...({ apiKey: "sk_test", withCredentials: true } as { apiKey: string }),
      }),
    ).toThrow("pass either `apiKey`");
  });

  it("listChat: parses a happy-path response with the wire-shape ChatMessage union", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(
        JSON.stringify({
          messages: [
            {
              id: "m_1",
              role: "user",
              userId: "u_1",
              dbId: "db_1",
              goal: "users",
              createdAt: 1700000000000,
            },
            {
              id: "m_2",
              role: "assistant",
              userId: "u_1",
              dbId: "db_1",
              createdAt: 1700000001000,
              result: {
                kind: "ok",
                sql: "select * from users",
                rows: [{ id: 1 }],
                rowCount: 1,
                truncated: false,
                cached: false,
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    const out = await client.listChat();

    expect(out.messages).toHaveLength(2);
    const second = out.messages[1];
    if (second?.role !== "assistant") expect.fail("expected assistant message");
    if (second.result.kind !== "ok") expect.fail("expected ok result");
    // Exercising the new discriminant — `kind` not `status` — and
    // the `truncated` field that the previous SDK type was missing.
    expect(second.result.kind).toBe("ok");
    expect(second.result.truncated).toBe(false);
    expect(second.result.rowCount).toBe(1);
  });

  it("postChat: returns the {user, assistant} envelope and forwards POST + signal", async () => {
    let capturedInit: RequestInit | undefined;
    const fakeFetch: FetchLike = async (_url, init) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({
          user: {
            id: "m_1",
            role: "user",
            userId: "u_1",
            dbId: "db_1",
            goal: "users",
            createdAt: 1700000000000,
          },
          assistant: {
            id: "m_2",
            role: "assistant",
            userId: "u_1",
            dbId: "db_1",
            createdAt: 1700000001000,
            result: {
              kind: "error",
              status: "sql_rejected",
              message: "no DML",
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const controller = new AbortController();
    const client = createClient({ withCredentials: true, fetch: fakeFetch });
    const out = await client.postChat({ goal: "x", dbId: "db_1" }, { signal: controller.signal });

    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.signal).toBe(controller.signal);
    if (out.assistant.role !== "assistant") expect.fail("expected assistant");
    if (out.assistant.result.kind !== "error") expect.fail("expected error result");
    expect(out.assistant.result.status).toBe("sql_rejected");
  });
});
