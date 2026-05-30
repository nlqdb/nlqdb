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
        JSON.stringify({
          status: "ok",
          rows: [],
          rowCount: 0,
          trace: {
            sql: "select 1",
            plan_id: "h:q",
            confidence: 1,
            model: "stub",
            cache_hit: false,
          },
        }),
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
    expect(out).toMatchObject({ status: "ok", trace: { sql: "select 1" } });
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

  it("createDatabase: forwards engine in the JSON body when set (SK-DB-010)", async () => {
    let capturedBody: unknown;
    const fakeFetch: FetchLike = async (_url, init) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : null;
      return new Response(
        JSON.stringify({
          dbId: "db_x_a1",
          slug: "x-a1",
          engine: "clickhouse",
          pkLive: "pk_live_x",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    const out = await client.createDatabase({ name: "events", engine: "clickhouse" });
    expect(capturedBody).toEqual({ name: "events", engine: "clickhouse" });
    expect(out.engine).toBe("clickhouse");
    expect(out.dbId).toBe("db_x_a1");
  });

  it("deleteDatabase: issues DELETE with an idempotency-key header (SK-HDC-016)", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedKey: string | null = null;
    const fakeFetch: FetchLike = async (url, init) => {
      capturedUrl = String(url);
      capturedMethod = init?.method ?? "GET";
      const headers = init?.headers;
      if (headers instanceof Headers) capturedKey = headers.get("idempotency-key");
      else if (Array.isArray(headers)) {
        const found = headers.find(([k]) => k.toLowerCase() === "idempotency-key");
        capturedKey = found ? found[1] : null;
      } else if (headers && typeof headers === "object") {
        const obj = headers as Record<string, string>;
        capturedKey = obj["idempotency-key"] ?? obj["Idempotency-Key"] ?? null;
      }
      return new Response(null, { status: 204 });
    };
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    await client.deleteDatabase("db_orders_a1");
    expect(capturedMethod).toBe("DELETE");
    expect(capturedUrl).toContain("/v1/databases/db_orders_a1");
    // Auto-generated when caller omits — SK-SDK-006 retry-safe dedupe.
    expect(capturedKey).toBeTruthy();
  });

  it("deleteDatabase: encodes the dbId for path safety", async () => {
    let capturedUrl = "";
    const fakeFetch: FetchLike = async (url) => {
      capturedUrl = String(url);
      return new Response(null, { status: 204 });
    };
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    await client.deleteDatabase("db with spaces");
    expect(capturedUrl).toContain("/v1/databases/db%20with%20spaces");
  });

  it("deleteDatabase: surfaces a typed NlqdbApiError on 404 db_not_found", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(JSON.stringify({ error: { status: "db_not_found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    await expect(client.deleteDatabase("db_missing_x")).rejects.toMatchObject({
      name: "NlqdbApiError",
      code: "db_not_found",
      httpStatus: 404,
    });
  });

  it("createDatabase: omits engine from the body when not set (classifier-default path)", async () => {
    let capturedBody: unknown;
    const fakeFetch: FetchLike = async (_url, init) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : null;
      return new Response(
        JSON.stringify({ dbId: "db_y_b2", slug: "y-b2", engine: "postgres", pkLive: "pk_live_y" }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    const out = await client.createDatabase({ name: "tracker" });
    expect(capturedBody).toEqual({ name: "tracker" });
    expect(out.engine).toBe("postgres");
  });

  it("ask: forwards engine on the create-branch request body", async () => {
    let capturedBody: unknown;
    const fakeFetch: FetchLike = async (_url, init) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : null;
      return new Response(
        JSON.stringify({
          kind: "create",
          db: "db_x_a1",
          schemaName: "x_a1",
          engine: "clickhouse",
          pkLive: null,
          plan: {},
          sampleRows: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    const out = await client.ask({ goal: "events tracker", engine: "clickhouse" });
    expect(capturedBody).toMatchObject({ goal: "events tracker", engine: "clickhouse" });
    if (!("kind" in out)) throw new Error("expected create result");
    expect(out.engine).toBe("clickhouse");
  });

  it("listDatabases: surfaces engine on each row (SK-DB-010 / GLOBAL-003)", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(
        JSON.stringify({
          databases: [
            {
              id: "db_a",
              slug: "a",
              engine: "postgres",
              pkLive: null,
              lastQueriedAt: null,
              createdAt: 1,
            },
            {
              id: "db_b",
              slug: "b",
              engine: "clickhouse",
              pkLive: null,
              lastQueriedAt: null,
              createdAt: 2,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    const out = await client.listDatabases();
    expect(out.databases.map((d) => d.engine)).toEqual(["postgres", "clickhouse"]);
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

  // GLOBAL-022 — SDK wire-layer retry. Three attempts on transport
  // failures + transient 5xx; 4xx + abort surface immediately. Same
  // Idempotency-Key reused across attempts so the API's dedupe store
  // collapses retries to a single side-effect.

  it("retries transient 5xx up to 3 attempts before throwing (GLOBAL-022)", async () => {
    let calls = 0;
    const fakeFetch: FetchLike = async () => {
      calls++;
      return new Response(JSON.stringify({ error: { status: "unknown_error" } }), { status: 503 });
    };
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    await expect(client.ask({ goal: "x", dbId: "y" })).rejects.toThrow();
    expect(calls).toBe(3);
  });

  it("retries transport failure then succeeds on attempt 2", async () => {
    let calls = 0;
    const fakeFetch: FetchLike = async () => {
      calls++;
      if (calls === 1) throw new TypeError("Failed to fetch");
      return new Response(
        JSON.stringify({
          status: "ok",
          rows: [],
          rowCount: 0,
          trace: {
            sql: "select 1",
            plan_id: "h:q",
            confidence: 1,
            model: "stub",
            cache_hit: false,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    const out = await client.ask({ goal: "x", dbId: "y" });
    expect(calls).toBe(2);
    expect(out).toMatchObject({ status: "ok" });
  });

  it("does NOT retry 4xx caller errors", async () => {
    let calls = 0;
    const fakeFetch: FetchLike = async () => {
      calls++;
      return new Response(JSON.stringify({ error: { status: "rate_limited" } }), { status: 429 });
    };
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    await expect(client.ask({ goal: "x", dbId: "y" })).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("does NOT retry on abort (caller intent cancelled)", async () => {
    let calls = 0;
    const fakeFetch: FetchLike = async () => {
      calls++;
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    };
    const controller = new AbortController();
    controller.abort();
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    await expect(
      client.ask({ goal: "x", dbId: "y" }, { signal: controller.signal }),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("auto-generates Idempotency-Key on POST and reuses it across retries (SK-SDK-006)", async () => {
    const seenKeys: string[] = [];
    let calls = 0;
    const fakeFetch: FetchLike = async (_url, init) => {
      calls++;
      const headers = (init?.headers ?? {}) as Record<string, string>;
      seenKeys.push(headers["idempotency-key"] ?? "");
      if (calls < 3) {
        return new Response(JSON.stringify({ error: { status: "unknown_error" } }), {
          status: 502,
        });
      }
      return new Response(
        JSON.stringify({
          status: "ok",
          rows: [],
          rowCount: 0,
          trace: {
            sql: "select 1",
            plan_id: "h:q",
            confidence: 1,
            model: "stub",
            cache_hit: false,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    await client.ask({ goal: "x", dbId: "y" });
    expect(seenKeys).toHaveLength(3);
    expect(seenKeys[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(seenKeys[1]).toBe(seenKeys[0]);
    expect(seenKeys[2]).toBe(seenKeys[0]);
  });

  it("preserves a caller-supplied Idempotency-Key across retries", async () => {
    const seenKeys: string[] = [];
    let calls = 0;
    const fakeFetch: FetchLike = async (_url, init) => {
      calls++;
      const headers = (init?.headers ?? {}) as Record<string, string>;
      seenKeys.push(headers["idempotency-key"] ?? "");
      if (calls < 2) {
        return new Response(JSON.stringify({ error: { status: "unknown_error" } }), {
          status: 502,
        });
      }
      return new Response(
        JSON.stringify({ dbId: "db_1", slug: "x", engine: "postgres", pkLive: "pk_x" }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    await client.createDatabase({ name: "x" }, { idempotencyKey: "caller-supplied-key" });
    expect(seenKeys).toEqual(["caller-supplied-key", "caller-supplied-key"]);
  });

  it("does NOT auto-generate Idempotency-Key on GET", async () => {
    let seenKey: string | undefined;
    const fakeFetch: FetchLike = async (_url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      seenKey = headers["idempotency-key"];
      return new Response(JSON.stringify({ databases: [] }), { status: 200 });
    };
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    await client.listDatabases();
    expect(seenKey).toBeUndefined();
  });

  it("mintKey sk_live: POSTs /v1/keys with name + auto Idempotency-Key", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fakeFetch: FetchLike = async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          id: "k_new",
          type: "sk_live",
          key: "sk_live_aabbccdd",
          last4: "ccdd",
          name: "CI",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({
      withCredentials: true,
      baseUrl: "https://app.nlqdb.com/",
      fetch: fakeFetch,
    });
    const out = await client.mintKey({ type: "sk_live", name: "CI" });
    expect(capturedUrl).toBe("https://app.nlqdb.com/v1/keys");
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.credentials).toBe("include");
    const headers = (capturedInit?.headers ?? {}) as Record<string, string>;
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f]{32}$/);
    const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
    expect(body).toEqual({ type: "sk_live", name: "CI" });
    expect(out.key).toBe("sk_live_aabbccdd");
    expect(out.last4).toBe("ccdd");
  });

  it("mintKey sk_mcp: passes host + device claims through", async () => {
    let capturedBody: Record<string, unknown> | null = null;
    const fakeFetch: FetchLike = async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          id: "k_mcp",
          type: "sk_mcp",
          key: "sk_mcp_cursor_dev_aabb",
          last4: "aabb",
          host: "cursor",
          device: "dev",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({
      withCredentials: true,
      baseUrl: "https://app.nlqdb.com/",
      fetch: fakeFetch,
    });
    const out = await client.mintKey({ type: "sk_mcp", host: "cursor", device: "dev" });
    expect(capturedBody).toEqual({ type: "sk_mcp", host: "cursor", device: "dev" });
    expect(out.host).toBe("cursor");
    expect(out.device).toBe("dev");
  });

  it("mintKey: surfaces 400 invalid_type as NlqdbApiError", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(JSON.stringify({ error: "invalid_type", allowed: ["sk_live", "sk_mcp"] }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    try {
      // `as never` keeps the wire-error path exercisable without
      // teaching the union about server-side rejections.
      await client.mintKey({ type: "pk_live" } as never);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NlqdbApiError);
      const e = err as NlqdbApiError;
      expect(e.httpStatus).toBe(400);
      expect(e.code).toBe("invalid_type");
    }
  });

  it("listKeys: GETs /v1/keys with the session cookie", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fakeFetch: FetchLike = async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          keys: [
            {
              id: "k_1",
              keyType: "sk_live",
              last4: "a4f7",
              name: "CI",
              dbId: null,
              mcpHost: null,
              deviceId: null,
              lastUsedAt: null,
              createdAt: 1700000000,
              revokedAt: null,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({
      withCredentials: true,
      baseUrl: "https://app.nlqdb.com/",
      fetch: fakeFetch,
    });
    const out = await client.listKeys();
    expect(capturedUrl).toBe("https://app.nlqdb.com/v1/keys");
    expect(capturedInit?.credentials).toBe("include");
    expect(capturedInit?.method ?? "GET").toBe("GET");
    expect(out.keys[0]?.last4).toBe("a4f7");
  });

  it("revokeKey: DELETE /v1/keys/:id with auto Idempotency-Key", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fakeFetch: FetchLike = async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true, alreadyRevoked: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    const out = await client.revokeKey("k 1/needs encoding");
    expect(capturedUrl).toBe("https://app.nlqdb.com/v1/keys/k%201%2Fneeds%20encoding");
    expect(capturedInit?.method).toBe("DELETE");
    const headers = (capturedInit?.headers ?? {}) as Record<string, string>;
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f]{32}$/);
    expect(out).toEqual({ ok: true, alreadyRevoked: false });
  });

  it("revokeKey: surfaces 404 key_not_found as NlqdbApiError", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(JSON.stringify({ error: { status: "key_not_found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    try {
      await client.revokeKey("k_missing");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NlqdbApiError);
      const e = err as NlqdbApiError;
      expect(e.httpStatus).toBe(404);
      expect(e.code).toBe("key_not_found");
    }
  });

  it("runSql: POSTs /v1/run with bearer + body + auto Idempotency-Key", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fakeFetch: FetchLike = async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          status: "ok",
          rows: [{ a: 1 }],
          rowCount: 1,
          trace: {
            sql: "select 1",
            plan_id: "h:s",
            confidence: 1,
            model: "raw",
            cache_hit: false,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({
      apiKey: "sk_test",
      baseUrl: "https://api.example.com/",
      fetch: fakeFetch,
    });
    const out = await client.runSql({ db: "db_1", sql: "SELECT 1" });
    expect(capturedUrl).toBe("https://api.example.com/v1/run");
    const headers = (capturedInit?.headers ?? {}) as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer sk_test");
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f]{32}$/);
    expect(capturedInit?.method).toBe("POST");
    expect(JSON.parse(String(capturedInit?.body))).toEqual({ db: "db_1", sql: "SELECT 1" });
    expect(out).toMatchObject({
      status: "ok",
      rowCount: 1,
      trace: { model: "raw", cache_hit: false },
    });
  });

  it("runSql: caller-supplied idempotencyKey overrides the auto-generated one", async () => {
    let capturedInit: RequestInit | undefined;
    const fakeFetch: FetchLike = async (_url, init) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({
          status: "ok",
          rows: [],
          rowCount: 0,
          trace: { sql: "x", plan_id: "h:s", confidence: 1, model: "raw", cache_hit: false },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    await client.runSql({ db: "db_1", sql: "SELECT 1" }, { idempotencyKey: "stable-key-123" });
    const headers = (capturedInit?.headers ?? {}) as Record<string, string>;
    expect(headers["idempotency-key"]).toBe("stable-key-123");
  });

  it("runSql: surfaces 400 sql_rejected as NlqdbApiError", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(
        JSON.stringify({ error: { status: "sql_rejected", reason: "drop_statement" } }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    const client = createClient({ apiKey: "sk_test", fetch: fakeFetch });
    try {
      await client.runSql({ db: "db_1", sql: "DROP TABLE x" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NlqdbApiError);
      const e = err as NlqdbApiError;
      expect(e.httpStatus).toBe(400);
      expect(e.code).toBe("sql_rejected");
    }
  });

  it("runSql: surfaces 403 forbidden as NlqdbApiError (pk_live write)", async () => {
    const fakeFetch: FetchLike = async () =>
      new Response(
        JSON.stringify({ error: { status: "forbidden", reason: "read_only_principal" } }),
        { status: 403, headers: { "content-type": "application/json" } },
      );
    const client = createClient({ apiKey: "pk_live_test", fetch: fakeFetch });
    try {
      await client.runSql({ db: "db_1", sql: "DELETE FROM x WHERE id = 1" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NlqdbApiError);
      const e = err as NlqdbApiError;
      expect(e.httpStatus).toBe(403);
      expect(e.code).toBe("forbidden");
    }
  });

  // SK-SDK-010 — BYOLLM lane: the caller's own provider key rides
  // `x-nlq-byollm-key` on `/v1/ask` only, signed-in only.
  it("ask: attaches the x-nlq-byollm-key header on /v1/ask when byollm is set", async () => {
    let capturedInit: RequestInit | undefined;
    const fakeFetch: FetchLike = async (_url, init) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({
          status: "ok",
          rows: [],
          rowCount: 0,
          trace: { sql: "select 1", plan_id: "h:q", confidence: 1, model: "x", cache_hit: false },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({
      withCredentials: true,
      byollm: { provider: "anthropic", model: "claude-sonnet-4-6", key: "sk-ant-abc:123" },
      fetch: fakeFetch,
    });
    await client.ask({ goal: "users", dbId: "db_1" });
    const headers = capturedInit?.headers as Record<string, string>;
    // Key contains a colon — it survives intact as the unsplit remainder.
    expect(headers["x-nlq-byollm-key"]).toBe("anthropic:claude-sonnet-4-6:sk-ant-abc:123");
    expect(capturedInit?.credentials).toBe("include");
  });

  it("ask: keeps the byollm key OFF endpoints that don't dispatch LLM calls", async () => {
    let capturedInit: RequestInit | undefined;
    const fakeFetch: FetchLike = async (_url, init) => {
      capturedInit = init;
      return new Response(JSON.stringify({ databases: [] }), { status: 200 });
    };
    const client = createClient({
      withCredentials: true,
      byollm: { provider: "openai", model: "gpt-5.2", key: "sk-test" },
      fetch: fakeFetch,
    });
    await client.listDatabases();
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["x-nlq-byollm-key"]).toBeUndefined();
  });

  it("askStream: attaches the byollm header on the SSE request", async () => {
    let capturedInit: RequestInit | undefined;
    const sse =
      'event: plan\ndata: {"trace":{"sql":"select 1","plan_id":"h:q","confidence":1,"model":"x","cache_hit":false}}\n\nevent: done\ndata: {"status":"ok"}\n\n';
    const fakeFetch: FetchLike = async (_url, init) => {
      capturedInit = init;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sse));
          controller.close();
        },
      });
      return new Response(body, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    };
    const client = createClient({
      withCredentials: true,
      byollm: { provider: "anthropic", model: "claude-sonnet-4-6", key: "sk-ant" },
      fetch: fakeFetch,
    });
    const out = await client.askStream({ goal: "users", dbId: "db_1" }, {});
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["x-nlq-byollm-key"]).toBe("anthropic:claude-sonnet-4-6:sk-ant");
    expect(out.trace.sql).toBe("select 1");
  });

  it("createClient: throws when byollm is set without withCredentials (signed-in only)", () => {
    expect(() =>
      createClient({
        apiKey: "sk_live_test",
        byollm: { provider: "openai", model: "gpt-5.2", key: "sk-test" },
      }),
    ).toThrow(/requires `withCredentials: true`/);
  });

  it("createClient: throws when a byollm part is empty", () => {
    expect(() =>
      createClient({
        withCredentials: true,
        byollm: { provider: "openai", model: "", key: "sk-test" },
      }),
    ).toThrow(/non-empty/);
  });

  it("createClient: throws when provider or model contains a colon (would mis-split)", () => {
    expect(() =>
      createClient({
        withCredentials: true,
        byollm: { provider: "openai", model: "gpt:5", key: "sk-test" },
      }),
    ).toThrow(/must not contain a colon/);
  });

  it("createClient: throws when byollm is set with no auth at all (anonymous)", () => {
    expect(() =>
      createClient({ byollm: { provider: "openai", model: "gpt-5.2", key: "sk-test" } }),
    ).toThrow(/requires `withCredentials: true`/);
  });

  it("createClient: throws when a byollm value contains a control character (CRLF injection)", () => {
    expect(() =>
      createClient({
        withCredentials: true,
        byollm: { provider: "openai", model: "gpt-5.2", key: "sk-test\r\nx-evil: 1" },
      }),
    ).toThrow(/control characters/);
  });

  it("ask: lower-cases the byollm provider to match the server's normalisation", async () => {
    let capturedInit: RequestInit | undefined;
    const fakeFetch: FetchLike = async (_url, init) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({
          status: "ok",
          rows: [],
          rowCount: 0,
          trace: { sql: "s", plan_id: "p", confidence: 1, model: "x", cache_hit: false },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createClient({
      withCredentials: true,
      byollm: { provider: "Anthropic", model: "claude-sonnet-4-6", key: "sk-ant" },
      fetch: fakeFetch,
    });
    await client.ask({ goal: "x", dbId: "db_1" });
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["x-nlq-byollm-key"]).toBe("anthropic:claude-sonnet-4-6:sk-ant");
  });
});
