// Unit tests for the principal-resolver middleware. Mirrors
// `middleware.test.ts` (pure callback-driven, no SELF.fetch, no
// worker-module vi.mock).

import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  accountTenantIdFromPrincipal,
  makeRequirePrincipal,
  type Principal,
  parseAnonBearer,
  parseSkBearer,
  type RequirePrincipalOpts,
  type RequirePrincipalVariables,
  rateLimitBucketKey,
  sha256Hex,
  surfaceFromPrincipal,
} from "../src/principal.ts";

function buildApp(opts: RequirePrincipalOpts) {
  const app = new Hono<{ Variables: RequirePrincipalVariables }>();
  app.get("/protected", makeRequirePrincipal(opts), (c) => {
    const principal = c.get("principal") as Principal;
    const body: Record<string, unknown> = {
      ok: true,
      kind: principal.kind,
      id: principal.id,
    };
    if (principal.kind === "sk_mcp") {
      body["mcpHost"] = principal.mcpHost;
      body["deviceId"] = principal.deviceId;
    }
    return c.json(body);
  });
  return app;
}

describe("requirePrincipal middleware", () => {
  it("returns 401 when neither cookie nor anon bearer is present", async () => {
    const app = buildApp({
      getSession: async () => null,
      isRevoked: async () => false,
    });
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("resolves a user principal when the cookie session is valid", async () => {
    const app = buildApp({
      getSession: async () => ({
        user: { id: "u_alice" },
        session: { token: "tok_1", userId: "u_alice" },
      }),
      isRevoked: async () => false,
    });
    const res = await app.request("/protected");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, kind: "user", id: "u_alice" });
  });

  it("returns session_revoked when the cookie token is on the revocation list", async () => {
    const app = buildApp({
      getSession: async () => ({
        user: { id: "u_alice" },
        session: { token: "tok_1", userId: "u_alice" },
      }),
      isRevoked: async () => true,
    });
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "session_revoked" });
  });

  it("resolves an anon principal from Authorization: Bearer anon_*", async () => {
    const app = buildApp({
      getSession: async () => null,
      isRevoked: async () => false,
    });
    const res = await app.request("/protected", {
      headers: { authorization: "Bearer anon_abcdef0123456789" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; kind: string; id: string };
    expect(body.kind).toBe("anon");
    expect(body.id.startsWith("anon:")).toBe(true);
    expect(body.id.length).toBe("anon:".length + 16);
  });

  it("prefers cookie session over anon bearer when both present", async () => {
    const app = buildApp({
      getSession: async () => ({
        user: { id: "u_alice" },
        session: { token: "tok_1", userId: "u_alice" },
      }),
      isRevoked: async () => false,
    });
    const res = await app.request("/protected", {
      headers: { authorization: "Bearer anon_xxxxx" },
    });
    const body = (await res.json()) as { kind: string; id: string };
    expect(body).toEqual({ ok: true, kind: "user", id: "u_alice" });
  });

  it("rejects an Authorization header without the anon_ prefix", async () => {
    const app = buildApp({
      getSession: async () => null,
      isRevoked: async () => false,
    });
    const res = await app.request("/protected", {
      headers: { authorization: "Bearer pk_live_real_key" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects bare 'Bearer anon_' (no entropy after the prefix)", async () => {
    const app = buildApp({
      getSession: async () => null,
      isRevoked: async () => false,
    });
    const res = await app.request("/protected", {
      headers: { authorization: "Bearer anon_" },
    });
    expect(res.status).toBe(401);
  });
});

describe("parseAnonBearer", () => {
  it("returns null on missing/empty header", () => {
    expect(parseAnonBearer(null)).toBeNull();
    expect(parseAnonBearer(undefined)).toBeNull();
    expect(parseAnonBearer("")).toBeNull();
  });

  it("returns the full anon_ token", () => {
    expect(parseAnonBearer("Bearer anon_abc")).toBe("anon_abc");
  });

  it("is case-insensitive on the Bearer keyword", () => {
    expect(parseAnonBearer("bearer anon_abc")).toBe("anon_abc");
  });

  it("rejects non-anon tokens", () => {
    expect(parseAnonBearer("Bearer pk_live_xyz")).toBeNull();
  });

  it("rejects tokens with no body after the prefix", () => {
    expect(parseAnonBearer("Bearer anon_")).toBeNull();
  });
});

describe("sha256Hex", () => {
  it("produces a stable digest for a fixed input", async () => {
    const a = await sha256Hex("hello", 16);
    const b = await sha256Hex("hello", 16);
    expect(a).toBe(b);
    expect(a.length).toBe(16);
    // Sanity: anchor against a known SHA-256 prefix for "hello".
    expect(a).toBe("2cf24dba5fb0a30e");
  });
});

// SK-EVENTS-010 / performance.md §3.3 — surface attribute and event
// payload both read from this mapping. A regression here drifts the
// `nlqdb.surface` OTel attribute and the `feature.*` event field apart.
describe("surfaceFromPrincipal", () => {
  it("maps anon principals to `hero`", () => {
    const principal: Principal = { kind: "anon", id: "anon:abc", token: "anon_x" };
    expect(surfaceFromPrincipal(principal)).toBe("hero");
  });

  it("maps user principals to `chat`", () => {
    // `session` is opaque in this test — the function only reads `.kind`.
    const principal = { kind: "user", id: "u_1", session: {} } as unknown as Principal;
    expect(surfaceFromPrincipal(principal)).toBe("chat");
  });

  it("maps pk_live principals to `embed`", () => {
    const principal: Principal = { kind: "pk_live", id: "t_1", dbId: "db_1" };
    expect(surfaceFromPrincipal(principal)).toBe("embed");
  });

  it("maps sk_live principals to `cli`", () => {
    const principal: Principal = { kind: "sk_live", id: "u_1", keyId: "k_1" };
    expect(surfaceFromPrincipal(principal)).toBe("cli");
  });

  it("maps sk_mcp principals to `mcp`", () => {
    const principal: Principal = {
      kind: "sk_mcp",
      id: "u_1",
      keyId: "k_1",
      mcpHost: "cursor",
      deviceId: "macbook-air",
    };
    expect(surfaceFromPrincipal(principal)).toBe("mcp");
  });
});

// SK-MCP-009 — per-key rate-limit bucketing. The bucket key must be
// stable per principal and distinct between sibling sk_mcp keys so a
// noisy MCP host can't burn its tenant's other-host budgets.
describe("rateLimitBucketKey", () => {
  it("keys user principals by their user id (same bucket as chat surface)", () => {
    const principal = { kind: "user", id: "u_alice", session: {} } as unknown as Principal;
    expect(rateLimitBucketKey(principal)).toBe("u_alice");
  });

  it("keys anon principals by their hashed id", () => {
    const principal: Principal = { kind: "anon", id: "anon:abc", token: "anon_x" };
    expect(rateLimitBucketKey(principal)).toBe("anon:abc");
  });

  it("keys pk_live principals by tenant id (unchanged from pre-slice-3c)", () => {
    const principal: Principal = { kind: "pk_live", id: "t_1", dbId: "db_a" };
    expect(rateLimitBucketKey(principal)).toBe("t_1");
  });

  it("isolates sibling sk_mcp keys for the same tenant", () => {
    const cursor: Principal = {
      kind: "sk_mcp",
      id: "u_1",
      keyId: "k_cursor",
      mcpHost: "cursor",
      deviceId: "macbook",
    };
    const claude: Principal = {
      kind: "sk_mcp",
      id: "u_1",
      keyId: "k_claude",
      mcpHost: "claude-desktop",
      deviceId: "macbook",
    };
    expect(rateLimitBucketKey(cursor)).toBe("rl:k_cursor");
    expect(rateLimitBucketKey(claude)).toBe("rl:k_claude");
  });

  it("uses one bucket-key namespace for sk_live and sk_mcp (no per-prefix special-casing)", () => {
    const skLive: Principal = { kind: "sk_live", id: "u_1", keyId: "k_1" };
    const skMcp: Principal = {
      kind: "sk_mcp",
      id: "u_1",
      keyId: "k_2",
      mcpHost: "cursor",
      deviceId: "macbook",
    };
    expect(rateLimitBucketKey(skLive).startsWith("rl:")).toBe(true);
    expect(rateLimitBucketKey(skMcp).startsWith("rl:")).toBe(true);
  });
});

// SK-MCP-010 slice 1 — `sk_live_*` and `sk_mcp_<host>_<device>_*`
// bearer auth lands here. The lookup hook is stubbed; integration
// against the real `lookupSkKey` (HMAC + D1) is covered by the
// api-keys unit tests.
describe("requirePrincipal — sk_live / sk_mcp", () => {
  it("resolves an sk_live principal when the lookup hook returns one", async () => {
    const app = buildApp({
      getSession: async () => null,
      isRevoked: async () => false,
      lookupSkKey: async (key) =>
        key === "sk_live_abc123" ? { kind: "sk_live", tenantId: "u_alice", keyId: "k_1" } : null,
    });
    const res = await app.request("/protected", {
      headers: { authorization: "Bearer sk_live_abc123" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, kind: "sk_live", id: "u_alice" });
  });

  it("resolves an sk_mcp principal carrying the host + device claims", async () => {
    const app = buildApp({
      getSession: async () => null,
      isRevoked: async () => false,
      lookupSkKey: async () => ({
        kind: "sk_mcp",
        tenantId: "u_alice",
        keyId: "k_2",
        mcpHost: "cursor",
        deviceId: "macbook-air",
      }),
    });
    const res = await app.request("/protected", {
      headers: { authorization: "Bearer sk_mcp_cursor_macbook-air_zzz" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      kind: "sk_mcp",
      id: "u_alice",
      mcpHost: "cursor",
      deviceId: "macbook-air",
    });
  });

  it("returns 401 when the sk_* token is unknown to the lookup hook", async () => {
    const app = buildApp({
      getSession: async () => null,
      isRevoked: async () => false,
      lookupSkKey: async () => null,
    });
    const res = await app.request("/protected", {
      headers: { authorization: "Bearer sk_live_unknown" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when sk_* tokens arrive without a lookup hook configured", async () => {
    const app = buildApp({
      getSession: async () => null,
      isRevoked: async () => false,
    });
    const res = await app.request("/protected", {
      headers: { authorization: "Bearer sk_mcp_cursor_macbook_xxx" },
    });
    expect(res.status).toBe(401);
  });

  it("prefers cookie session over an sk_live bearer when both are present", async () => {
    const lookup = vi.fn(async () => ({
      kind: "sk_live" as const,
      tenantId: "u_other",
      keyId: "k_x",
    }));
    const app = buildApp({
      getSession: async () => ({
        user: { id: "u_alice" },
        session: { token: "tok_1", userId: "u_alice" },
      }),
      isRevoked: async () => false,
      lookupSkKey: lookup,
    });
    const res = await app.request("/protected", {
      headers: { authorization: "Bearer sk_live_xxx" },
    });
    const body = (await res.json()) as { kind: string; id: string };
    expect(body).toEqual({ ok: true, kind: "user", id: "u_alice" });
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe("parseSkBearer", () => {
  it("returns the sk_live_ token verbatim", () => {
    expect(parseSkBearer("Bearer sk_live_abc")).toBe("sk_live_abc");
  });

  it("returns the sk_mcp_ token verbatim", () => {
    expect(parseSkBearer("Bearer sk_mcp_cursor_dev_zzz")).toBe("sk_mcp_cursor_dev_zzz");
  });

  it("rejects other bearer prefixes", () => {
    expect(parseSkBearer("Bearer anon_xxx")).toBeNull();
    expect(parseSkBearer("Bearer pk_live_xxx")).toBeNull();
  });

  it("rejects bare `Bearer sk_live_` and `Bearer sk_mcp_` (no entropy after the prefix)", () => {
    expect(parseSkBearer("Bearer sk_live_")).toBeNull();
    expect(parseSkBearer("Bearer sk_mcp_")).toBeNull();
  });
});

describe("accountTenantIdFromPrincipal", () => {
  it("returns the user id for session principals", () => {
    const principal = { kind: "user", id: "u_1", session: {} } as unknown as Principal;
    expect(accountTenantIdFromPrincipal(principal)).toBe("u_1");
  });

  it("returns the tenant id for sk_live and sk_mcp principals", () => {
    expect(accountTenantIdFromPrincipal({ kind: "sk_live", id: "u_2", keyId: "k_1" })).toBe("u_2");
    expect(
      accountTenantIdFromPrincipal({
        kind: "sk_mcp",
        id: "u_3",
        keyId: "k_2",
        mcpHost: "cursor",
        deviceId: "mac",
      }),
    ).toBe("u_3");
  });

  it("returns null for anon and pk_live principals (no account)", () => {
    expect(
      accountTenantIdFromPrincipal({ kind: "anon", id: "anon:abc", token: "anon_x" }),
    ).toBeNull();
    expect(accountTenantIdFromPrincipal({ kind: "pk_live", id: "t_1", dbId: "db_1" })).toBeNull();
  });
});
