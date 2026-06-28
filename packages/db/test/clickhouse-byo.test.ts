import { describe, expect, it } from "vitest";
import {
  buildClickhouseByoQuery,
  ClickhouseByoError,
  type ClickhouseConnSpec,
} from "../src/clickhouse-byo.ts";
import type { DnsResolver } from "../src/egress-guard.ts";

// SK-MULTIENG-005 — the BYO ClickHouse live-query adapter. It binds a validated
// host into the `ClickhouseQueryFn` seam the introspector declares. The seven
// guarantees under test: endpoint shape (scheme/host/port + `?database=` +
// `param_*` server-side binding), `FORMAT JSON` body cleanup, header auth (and
// omission when null), `{ data } → { rows }` parse, abort via caller signal and
// via timeout, fail-loud typed errors with no credential leak, and the per-call
// DNS-rebind re-guard (`GLOBAL-035`).

const SPEC: ClickhouseConnSpec = {
  host: "ch.example.com",
  port: 8443,
  secure: true,
  database: "analytics",
  user: "bob",
  password: "hunter2",
};

// Capture the args of the single fetch a query makes, returning a 200 `{ data }`.
function captureFetch(data: unknown[] = []): {
  fetchImpl: typeof fetch;
  calls: { url: string; init: RequestInit }[];
} {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("buildClickhouseByoQuery — request shape", () => {
  it("builds the endpoint URL with ?database= and one param_* per bound param", async () => {
    const { fetchImpl, calls } = captureFetch();
    const query = buildClickhouseByoQuery(SPEC, { fetchImpl });
    await query("SELECT name FROM system.tables WHERE database = {database:String}", {
      database: "analytics",
    });

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!.url);
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("ch.example.com");
    expect(url.port).toBe("8443");
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("database")).toBe("analytics");
    expect(url.searchParams.get("param_database")).toBe("analytics");
  });

  it("uses http and omits the port when port is null + insecure", async () => {
    const { fetchImpl, calls } = captureFetch();
    const query = buildClickhouseByoQuery({ ...SPEC, secure: false, port: null }, { fetchImpl });
    await query("SELECT 1", {});
    const url = new URL(calls[0]!.url);
    expect(url.protocol).toBe("http:");
    expect(url.port).toBe("");
    expect(url.host).toBe("ch.example.com");
  });

  it("appends FORMAT JSON and strips a trailing semicolon + whitespace", async () => {
    const { fetchImpl, calls } = captureFetch();
    const query = buildClickhouseByoQuery(SPEC, { fetchImpl });
    await query("SELECT 1 ;  ", {});
    expect(calls[0]!.init.body).toBe("SELECT 1 FORMAT JSON");
  });

  it("sets X-ClickHouse-User/Key headers and never puts credentials in the URL", async () => {
    const { fetchImpl, calls } = captureFetch();
    const query = buildClickhouseByoQuery(SPEC, { fetchImpl });
    await query("SELECT 1", {});
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["X-ClickHouse-User"]).toBe("bob");
    expect(headers["X-ClickHouse-Key"]).toBe("hunter2");
    expect(calls[0]!.url).not.toContain("hunter2");
    expect(calls[0]!.url).not.toContain("bob");
  });

  it("omits the auth headers when user/password are null", async () => {
    const { fetchImpl, calls } = captureFetch();
    const query = buildClickhouseByoQuery({ ...SPEC, user: null, password: null }, { fetchImpl });
    await query("SELECT 1", {});
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect("X-ClickHouse-User" in headers).toBe(false);
    expect("X-ClickHouse-Key" in headers).toBe(false);
  });
});

describe("buildClickhouseByoQuery — response", () => {
  it("parses { data } into { rows }", async () => {
    const rows = [{ name: "events" }, { name: "users" }];
    const { fetchImpl } = captureFetch(rows);
    const query = buildClickhouseByoQuery(SPEC, { fetchImpl });
    const result = await query("SELECT name FROM system.tables", {});
    expect(result.rows).toEqual(rows);
  });
});

describe("buildClickhouseByoQuery — abort", () => {
  // A fetch stub that rejects with an AbortError the moment its signal trips —
  // whether already aborted on entry or aborted later — mirroring a real fetch.
  const hangUntilAbort = (async (_url: string, init?: RequestInit) => {
    return await new Promise<Response>((_resolve, reject) => {
      const fail = () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      };
      if (init?.signal?.aborted) return fail();
      init?.signal?.addEventListener("abort", fail, { once: true });
    });
  }) as unknown as typeof fetch;

  it("aborts when the caller signal is already aborted", async () => {
    const fetchImpl = hangUntilAbort;
    const query = buildClickhouseByoQuery(SPEC, { fetchImpl });
    const controller = new AbortController();
    controller.abort();
    await expect(query("SELECT 1", {}, controller.signal)).rejects.toThrow();
  });

  it("aborts via the timeout when the host hangs", async () => {
    const query = buildClickhouseByoQuery(SPEC, { fetchImpl: hangUntilAbort, timeoutMs: 5 });
    await expect(query("SELECT 1", {})).rejects.toThrow();
  });
});

describe("buildClickhouseByoQuery — fail-loud errors", () => {
  function errorFetch(status: number): typeof fetch {
    return (async () => new Response("upstream body", { status })) as unknown as typeof fetch;
  }

  it("throws a typed auth error on 401 with no credential leak", async () => {
    const query = buildClickhouseByoQuery(SPEC, { fetchImpl: errorFetch(401) });
    await expect(query("SELECT secret FROM t", {})).rejects.toMatchObject({
      name: "ClickhouseByoError",
      statusCode: 401,
    });
    try {
      await query("SELECT secret FROM t", {});
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).not.toContain("hunter2");
      expect(msg).not.toContain("secret");
    }
  });

  it("throws a typed upstream error on 500", async () => {
    const query = buildClickhouseByoQuery(SPEC, { fetchImpl: errorFetch(503) });
    await expect(query("SELECT 1", {})).rejects.toBeInstanceOf(ClickhouseByoError);
  });
});

describe("buildClickhouseByoQuery — DNS-rebind re-guard", () => {
  it("throws before fetching when resolve returns a private IP", async () => {
    const { fetchImpl, calls } = captureFetch();
    const resolve: DnsResolver = () => Promise.resolve(["10.0.0.1"]);
    const query = buildClickhouseByoQuery(SPEC, { fetchImpl, resolve });
    await expect(query("SELECT 1", {})).rejects.toBeInstanceOf(ClickhouseByoError);
    expect(calls).toHaveLength(0);
  });

  it("fetches when resolve returns a public IP", async () => {
    const { fetchImpl, calls } = captureFetch();
    const resolve: DnsResolver = () => Promise.resolve(["93.184.216.34"]);
    const query = buildClickhouseByoQuery(SPEC, { fetchImpl, resolve });
    await query("SELECT 1", {});
    expect(calls).toHaveLength(1);
  });
});
