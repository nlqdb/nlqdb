// Unit tests for the principal-resolver middleware. Mirrors
// `middleware.test.ts` (pure callback-driven, no SELF.fetch, no
// worker-module vi.mock).

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  makeRequirePrincipal,
  type Principal,
  parseAnonBearer,
  type RequirePrincipalOpts,
  type RequirePrincipalVariables,
  sha256Hex,
} from "../src/principal.ts";

function buildApp(opts: RequirePrincipalOpts) {
  const app = new Hono<{ Variables: RequirePrincipalVariables }>();
  app.get("/protected", makeRequirePrincipal(opts), (c) => {
    const principal = c.get("principal") as Principal;
    return c.json({
      ok: true,
      kind: principal.kind,
      id: principal.id,
    });
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
