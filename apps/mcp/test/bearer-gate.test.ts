// Unit tests for the Worker's bearer-auth gate. The MCP protocol body
// is fully exercised by `packages/mcp/` against the SDK; this file
// asserts that requests without (or with a malformed) bearer never
// reach the protocol layer, and that the `SK-MCP-006` error envelope
// is shaped right.

import { describe, expect, it } from "vitest";
import handler from "../src/index.ts";

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const env = {};

async function call(method: string, path: string, headers: Record<string, string> = {}) {
  const url = `https://mcp.nlqdb.com${path}`;
  const init: RequestInit = { method, headers };
  if (method === "POST") {
    init.body = JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 });
    headers["content-type"] = "application/json";
  }
  return handler.fetch?.(new Request(url, init), env, ctx);
}

describe("apps/mcp bearer gate", () => {
  it("health is unauthenticated", async () => {
    const res = await call("GET", "/health");
    expect(res?.status).toBe(200);
    expect(await res?.text()).toBe("ok");
  });

  it("OPTIONS preflight is allowed", async () => {
    const res = await call("OPTIONS", "/mcp", { origin: "https://example.com" });
    expect(res?.status).toBe(204);
    expect(res?.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("unknown path returns 404", async () => {
    const res = await call("POST", "/something-else");
    expect(res?.status).toBe(404);
  });

  it("missing bearer returns 401 with SK-MCP-006 envelope", async () => {
    const res = await call("POST", "/mcp");
    expect(res?.status).toBe(401);
    expect(res?.headers.get("www-authenticate")).toContain("Bearer");
    const body = (await res?.json()) as {
      jsonrpc: string;
      error: { code: number; message: string; data: { code: string; action: string } };
    };
    expect(body.jsonrpc).toBe("2.0");
    expect(body.error.data.code).toBe("missing_bearer");
    expect(body.error.data.action).toMatch(/app\.nlqdb\.com\/keys/);
  });

  it("unknown prefix returns 401 with bearer_prefix_unrecognised", async () => {
    const res = await call("POST", "/mcp", { authorization: "Bearer foo_not_an_nlqdb_key" });
    expect(res?.status).toBe(401);
    const body = (await res?.json()) as { error: { data: { code: string } } };
    expect(body.error.data.code).toBe("bearer_prefix_unrecognised");
  });

  it("non-POST on /mcp with valid prefix returns 405 (stateless mode)", async () => {
    const res = await call("GET", "/mcp", { authorization: "Bearer sk_live_test_only" });
    expect(res?.status).toBe(405);
    expect(res?.headers.get("allow")).toBe("POST, OPTIONS");
  });

  it.each([
    "sk_live_",
    "sk_mcp_test_dev_",
    "pk_live_",
  ])("recognised prefix %s passes the gate (then upstream rejects)", async (prefix) => {
    // No upstream API in unit tests — the fetch will fail and return
    // 500. The gate-passing assertion is that we get past 401 (so the
    // body isn't `missing_bearer` / `bearer_prefix_unrecognised`).
    const res = await call("POST", "/mcp", { authorization: `Bearer ${prefix}abcd1234` });
    expect(res?.status).not.toBe(401);
  });
});
