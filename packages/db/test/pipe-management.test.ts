// `pipe-management.ts` — typed Tinybird Pipes management owner. Tests
// inject the HTTP client to keep the wire format and the typed-error
// classification in one place. Mirrors `query-log.test.ts`.

import { describe, expect, it, vi } from "vitest";
import {
  createPipe,
  createPipeManagementClient,
  dropPipe,
  getPipe,
  PipeAuthError,
  type PipeHttpClient,
  type PipeHttpRequest,
  PipeRateLimitError,
  PipeRequestError,
  PipeServerError,
} from "../src/clickhouse-tinybird/pipe-management.ts";

const PIPE = {
  name: "nlqdb_w5__sh_aaaaaaaa__qh_bbbbbbbb",
  nodes: [{ name: "node_00", sql: "SELECT 1 WHERE 0 = 1" }],
};

describe("createPipe", () => {
  it("dispatches a `create` HTTP request carrying the typed pipe and returns the parsed server record", async () => {
    const captured: PipeHttpRequest[] = [];
    const http: PipeHttpClient = async (req) => {
      captured.push(req);
      return {
        status: 200,
        body: { name: PIPE.name, nodes: [{ name: "node_00", sql: PIPE.nodes[0]?.sql }] },
      };
    };
    const result = await createPipe(http, PIPE);
    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({ kind: "create", pipe: PIPE });
    expect(result.name).toBe(PIPE.name);
    expect(result.nodes).toEqual(PIPE.nodes);
  });

  it("returns the input pipe when the server response body is missing or malformed (2xx success)", async () => {
    const http: PipeHttpClient = async () => ({ status: 200 });
    const result = await createPipe(http, PIPE);
    // Caller can rely on the returned name for downstream audit-row writes.
    expect(result.name).toBe(PIPE.name);
  });

  it("throws PipeAuthError on 401/403 with a status-keyed hint", async () => {
    const http: PipeHttpClient = async () => ({
      status: 403,
      bodySnippet: '{"error":"forbidden"}',
    });
    await expect(createPipe(http, PIPE)).rejects.toMatchObject({
      name: "PipeAuthError",
      statusCode: 403,
      hint: expect.stringContaining("TINYBIRD_TOKEN"),
    });
  });

  it("throws PipeRateLimitError on 429 carrying retryAfterSeconds", async () => {
    const http: PipeHttpClient = async () => ({
      status: 429,
      retryAfterSeconds: 30,
      bodySnippet: "rate-limited",
    });
    let caught: unknown;
    try {
      await createPipe(http, PIPE);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PipeRateLimitError);
    if (caught instanceof PipeRateLimitError) {
      expect(caught.statusCode).toBe(429);
      expect(caught.retryAfterSeconds).toBe(30);
    }
  });

  it("throws PipeServerError on 5xx (analyser will retry tomorrow per SK-MIGRATE-006)", async () => {
    const http: PipeHttpClient = async () => ({ status: 503, bodySnippet: "upstream wedged" });
    await expect(createPipe(http, PIPE)).rejects.toBeInstanceOf(PipeServerError);
  });

  it("throws PipeRequestError on other 4xx (e.g. 422 invalid SQL)", async () => {
    const http: PipeHttpClient = async () => ({ status: 422, bodySnippet: '{"error":"bad sql"}' });
    await expect(createPipe(http, PIPE)).rejects.toBeInstanceOf(PipeRequestError);
  });

  it("propagates AbortSignal to the http client", async () => {
    const captured: { signal?: AbortSignal } = {};
    const http: PipeHttpClient = async (_req, signal) => {
      captured.signal = signal;
      return { status: 200, body: { name: PIPE.name, nodes: PIPE.nodes } };
    };
    const ac = new AbortController();
    await createPipe(http, PIPE, ac.signal);
    expect(captured.signal).toBe(ac.signal);
  });
});

describe("getPipe", () => {
  it("returns null on 404 (caller treats as `pipe not present`)", async () => {
    const http: PipeHttpClient = async () => ({ status: 404 });
    const result = await getPipe(http, PIPE.name);
    expect(result).toBeNull();
  });

  it("returns the parsed PipeRecord on 200", async () => {
    const http: PipeHttpClient = async () => ({
      status: 200,
      body: { name: PIPE.name, nodes: PIPE.nodes },
    });
    const result = await getPipe(http, PIPE.name);
    expect(result).not.toBeNull();
    expect(result?.name).toBe(PIPE.name);
    expect(result?.nodes).toHaveLength(1);
  });

  it("throws PipeAuthError on 403 (token lacks PIPE:READ scope)", async () => {
    const http: PipeHttpClient = async () => ({ status: 403, bodySnippet: "no read scope" });
    await expect(getPipe(http, PIPE.name)).rejects.toBeInstanceOf(PipeAuthError);
  });
});

describe("dropPipe", () => {
  it("treats 404 as success (idempotent — pipe already absent)", async () => {
    const http: PipeHttpClient = async () => ({ status: 404 });
    await expect(dropPipe(http, PIPE.name)).resolves.toBeUndefined();
  });

  it("succeeds on 204 No Content", async () => {
    const http: PipeHttpClient = async () => ({ status: 204 });
    await expect(dropPipe(http, PIPE.name)).resolves.toBeUndefined();
  });

  it("throws PipeRequestError on other 4xx", async () => {
    const http: PipeHttpClient = async () => ({ status: 400, bodySnippet: "bad name" });
    await expect(dropPipe(http, PIPE.name)).rejects.toBeInstanceOf(PipeRequestError);
  });
});

describe("createPipeManagementClient", () => {
  it("requires either token or httpClient (production fetch needs a token)", () => {
    expect(() => createPipeManagementClient({})).toThrow(/token.+httpClient/);
  });

  it("uses the injected httpClient (token unused) and routes all three verbs through it", async () => {
    const calls: PipeHttpRequest[] = [];
    const http: PipeHttpClient = vi.fn(async (req) => {
      calls.push(req);
      if (req.kind === "create")
        return { status: 200, body: { name: req.pipe.name, nodes: req.pipe.nodes } };
      if (req.kind === "get") return { status: 200, body: { name: req.name, nodes: PIPE.nodes } };
      return { status: 204 };
    });
    const client = createPipeManagementClient({ httpClient: http });
    await client.createPipe(PIPE);
    await client.getPipe(PIPE.name);
    await client.dropPipe(PIPE.name);
    expect(calls.map((c) => c.kind)).toEqual(["create", "get", "drop"]);
  });

  it("POSTs /v0/pipes with bearer auth + JSON body when using the production fetch client", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ name: PIPE.name, nodes: PIPE.nodes }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const client = createPipeManagementClient({ token: "tok_pipes" });
      await client.createPipe(PIPE);
      const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock
        .calls;
      const [url, init] = calls[0] ?? [];
      expect(url).toBe("https://api.tinybird.co/v0/pipes");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers["authorization"]).toBe("Bearer tok_pipes");
      expect(headers["content-type"]).toBe("application/json");
      const parsedBody = JSON.parse(String(init?.body));
      expect(parsedBody.name).toBe(PIPE.name);
      expect(parsedBody.nodes).toEqual(PIPE.nodes);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("DELETEs /v0/pipes/<name> for dropPipe and accepts 204 with no body", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const client = createPipeManagementClient({ token: "tok_pipes" });
      await client.dropPipe(PIPE.name);
      const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock
        .calls;
      const [url, init] = calls[0] ?? [];
      expect(url).toBe(`https://api.tinybird.co/v0/pipes/${encodeURIComponent(PIPE.name)}`);
      expect(init?.method).toBe("DELETE");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("honours custom apiBase (US gateway / on-prem)", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ name: PIPE.name, nodes: PIPE.nodes }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const client = createPipeManagementClient({
        token: "tok_pipes",
        apiBase: "https://api.us-east.tinybird.co",
      });
      await client.getPipe(PIPE.name);
      const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock
        .calls;
      const [url] = calls[0] ?? [];
      expect(url).toBe(`https://api.us-east.tinybird.co/v0/pipes/${encodeURIComponent(PIPE.name)}`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
