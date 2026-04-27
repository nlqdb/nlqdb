import { describe, expect, it, vi } from "vitest";
import { ABORT_SENTINEL, type FetchLike, fetchAsk } from "../src/fetch.ts";

// Minimal `Response`-shaped object — `fetchAsk` only ever touches
// `ok`, `status`, and `.json()`, so we don't bother fabricating
// headers / body streams. Cast through `unknown` to escape the full
// `Response` shape check.
function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const successBody = {
  status: "ok" as const,
  cached: false,
  sql: "SELECT 1",
  rows: [{ a: 1 }],
  rowCount: 1,
};

function call(
  fetchImpl: ReturnType<typeof vi.fn>,
  idx = 0,
): {
  url: string;
  init: RequestInit;
} {
  const c = fetchImpl.mock.calls[idx];
  if (!c) throw new Error(`fetch was not called (idx=${idx})`);
  return { url: c[0] as string, init: c[1] as RequestInit };
}

describe("fetchAsk", () => {
  it("posts goal + dbId as JSON, returns parsed success", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(successBody));

    const outcome = await fetchAsk({
      endpoint: "https://api.example/v1/ask",
      goal: "the most-loved coffee shops",
      dbId: "coffee",
      apiKey: null,
      fetchImpl,
    });

    expect(outcome).toEqual({ ok: true, data: successBody });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const { url, init } = call(fetchImpl);
    expect(url).toBe("https://api.example/v1/ask");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      goal: "the most-loved coffee shops",
      dbId: "coffee",
    });
    const headers = init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["accept"]).toBe("application/json");
    expect(headers["authorization"]).toBeUndefined();
    expect(init.credentials).toBe("include");
  });

  it("attaches Authorization Bearer when api-key is provided", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(successBody));
    await fetchAsk({
      endpoint: "https://api.example/v1/ask",
      goal: "x",
      dbId: "d",
      apiKey: "pk_live_abc123",
      fetchImpl,
    });
    const headers = call(fetchImpl).init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer pk_live_abc123");
  });

  it("returns a network failure when fetch rejects", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new TypeError("Failed to fetch");
    });
    const outcome = await fetchAsk({
      endpoint: "https://api.example/v1/ask",
      goal: "x",
      dbId: "d",
      apiKey: null,
      fetchImpl,
    });
    expect(outcome).toEqual({
      ok: false,
      failure: { kind: "network", message: "Failed to fetch" },
    });
  });

  it("returns ABORT_SENTINEL when the caller aborts", async () => {
    const ac = new AbortController();
    const fetchImpl = vi.fn<FetchLike>(async () => {
      ac.abort();
      throw new DOMException("aborted", "AbortError");
    });
    const outcome = await fetchAsk({
      endpoint: "https://api.example/v1/ask",
      goal: "x",
      dbId: "d",
      apiKey: null,
      signal: ac.signal,
      fetchImpl,
    });
    expect(outcome).toBe(ABORT_SENTINEL);
  });

  it("returns auth failure for 401", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      jsonResponse({ error: "unauthorized" }, { status: 401 }),
    );
    const outcome = await fetchAsk({
      endpoint: "x",
      goal: "x",
      dbId: "d",
      apiKey: null,
      fetchImpl,
    });
    expect(outcome).toEqual({ ok: false, failure: { kind: "auth", status: 401 } });
  });

  it("returns auth failure for 403", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({}, { status: 403 }));
    const outcome = await fetchAsk({
      endpoint: "x",
      goal: "x",
      dbId: "d",
      apiKey: null,
      fetchImpl,
    });
    expect(outcome).toEqual({ ok: false, failure: { kind: "auth", status: 403 } });
  });

  it("surfaces the API's structured error for non-2xx responses", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      jsonResponse({ error: { status: "rate_limited", limit: 10, count: 11 } }, { status: 429 }),
    );
    const outcome = await fetchAsk({
      endpoint: "x",
      goal: "x",
      dbId: "d",
      apiKey: null,
      fetchImpl,
    });
    expect(outcome).toEqual({
      ok: false,
      failure: {
        kind: "api",
        status: 429,
        error: { status: "rate_limited", limit: 10, count: 11 },
      },
    });
  });

  it("preserves bare-string error bodies (goal_required / invalid_json)", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      jsonResponse({ error: "goal_required" }, { status: 400 }),
    );
    const outcome = await fetchAsk({
      endpoint: "x",
      goal: "x",
      dbId: "d",
      apiKey: null,
      fetchImpl,
    });
    expect(outcome).toEqual({
      ok: false,
      failure: { kind: "api", status: 400, error: "goal_required" },
    });
  });

  it("treats a non-JSON body as a network failure", async () => {
    const fetchImpl = vi.fn<FetchLike>(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError("Unexpected token");
          },
        }) as unknown as Response,
    );
    const outcome = await fetchAsk({
      endpoint: "x",
      goal: "x",
      dbId: "d",
      apiKey: null,
      fetchImpl,
    });
    expect(outcome).toEqual({
      ok: false,
      failure: { kind: "network", message: "invalid_json_response" },
    });
  });
});
