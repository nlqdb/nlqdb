// Unit tests for `openSupabaseMgmtPostgres` — the BYO Supabase Management-API
// transport (the HTTP path that replaces the broken postgres.js socket for
// Supabase). No live Supabase in the unit env, so `fetch` is injected via the
// `fetchImpl` seam: a fake that records the request it received and returns a
// canned response. Proves the request targets `/v1/projects/{ref}/database/query`
// with a Bearer token + `read_only:true`, that params ride the body, that a bare
// JSON-array response maps to `{ rows, rowCount }`, and that non-2xx fails loud
// with a one-sentence, secret-free message.

import { describe, expect, it } from "vitest";
import { openSupabaseMgmtPostgres, SupabaseMgmtError } from "../src/index.ts";

type Captured = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown) {
  const calls: Captured[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("openSupabaseMgmtPostgres", () => {
  it("POSTs to the Management-API query endpoint with a Bearer token and read_only", async () => {
    const { impl, calls } = fakeFetch(201, [{ n: 1 }]);
    const { query } = openSupabaseMgmtPostgres("abcref", "tok_123", { fetchImpl: impl });

    const res = await query("select $1::int as n", [1]);

    expect(res).toEqual({ rows: [{ n: 1 }], rowCount: 1 });
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe("https://api.supabase.com/v1/projects/abcref/database/query");
    expect(call.init.method).toBe("POST");
    const headers = call.init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer tok_123");
    const sent = JSON.parse(call.init.body as string);
    expect(sent).toEqual({ query: "select $1::int as n", parameters: [1], read_only: true });
  });

  it("never leaks the token into the URL", async () => {
    const { impl, calls } = fakeFetch(200, []);
    const { query } = openSupabaseMgmtPostgres("abcref", "super-secret-token", { fetchImpl: impl });
    await query("select 1", []);
    expect(calls[0]!.url).not.toContain("super-secret-token");
  });

  it("accepts a { result: [...] } wrapper defensively", async () => {
    const { impl } = fakeFetch(201, { result: [{ a: 1 }, { a: 2 }] });
    const { query } = openSupabaseMgmtPostgres("abcref", "tok", { fetchImpl: impl });
    const res = await query("select a", []);
    expect(res).toEqual({ rows: [{ a: 1 }, { a: 2 }], rowCount: 2 });
  });

  it("maps 401 to a one-sentence reconnect error that omits the SQL and token", async () => {
    const { impl } = fakeFetch(401, { message: "unauthorized" });
    const { query } = openSupabaseMgmtPostgres("abcref", "tok_secret", { fetchImpl: impl });
    await expect(query("select secret_col from t", [])).rejects.toMatchObject({
      name: "SupabaseMgmtError",
      statusCode: 401,
    });
    const err = (await query("select secret_col from t", []).catch((e) => e)) as SupabaseMgmtError;
    expect(err.message).toContain("reconnect");
    expect(err.message).not.toContain("secret_col");
    expect(err.message).not.toContain("tok_secret");
  });

  it("maps 429 to a retry message", async () => {
    const { impl } = fakeFetch(429, {});
    const { query } = openSupabaseMgmtPostgres("abcref", "tok", { fetchImpl: impl });
    await expect(query("select 1", [])).rejects.toMatchObject({ statusCode: 429 });
  });

  it("fails loud on an unexpected (non-array) 2xx body", async () => {
    const { impl } = fakeFetch(201, { unexpected: "shape" });
    const { query } = openSupabaseMgmtPostgres("abcref", "tok", { fetchImpl: impl });
    await expect(query("select 1", [])).rejects.toBeInstanceOf(SupabaseMgmtError);
  });
});
