// Unit tests for the `requireSession` middleware factory. Pure
// callback-driven — no SELF.fetch, no vi.mock of worker modules,
// so reliable under @cloudflare/vitest-pool-workers (where worker-
// module mocking is broken upstream).
//
// Integration tests exercising the full cookieCache + KV revocation
// path land in commit 3 alongside `/v1/ask`.

import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  makeRequireSession,
  type RequireSessionOpts,
  type RequireSessionVariables,
} from "../src/middleware.ts";

function buildApp(opts: RequireSessionOpts) {
  const app = new Hono<{ Variables: RequireSessionVariables }>();
  app.get("/protected", makeRequireSession(opts), (c) => {
    const session = c.get("session");
    return c.json({ ok: true, userId: session.user.id, token: session.session.token });
  });
  return app;
}

describe("requireSession middleware", () => {
  it("returns 401 when no session", async () => {
    const app = buildApp({
      getSession: async () => null,
      isRevoked: async () => false,
    });
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      error: { code: "unauthorized", message: expect.any(String), action: expect.any(String) },
    });
  });

  it("returns 401 + session_revoked when the token is in the revocation set", async () => {
    const app = buildApp({
      getSession: async () => ({
        user: { id: "u_1" },
        session: { token: "tok_revoked", userId: "u_1" },
      }),
      isRevoked: async (token) => token === "tok_revoked",
    });
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "session_revoked" });
  });

  it("passes through and exposes the session on the context when valid", async () => {
    const app = buildApp({
      getSession: async () => ({
        user: { id: "u_1", email: "u1@example.com" },
        session: { token: "tok_valid", userId: "u_1" },
      }),
      isRevoked: async () => false,
    });
    const res = await app.request("/protected");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: "u_1", token: "tok_valid" });
  });

  it("does not call isRevoked when there is no session (avoids a wasted KV read)", async () => {
    const isRevoked = vi.fn(async () => false);
    const app = buildApp({
      getSession: async () => null,
      isRevoked,
    });
    await app.request("/protected");
    expect(isRevoked).not.toHaveBeenCalled();
  });

  it("returns a retryable 503 auth_unavailable when getSession throws (storage blip, not 500)", async () => {
    const app = buildApp({
      // Mirrors Better Auth wrapping a KV/D1 failure as `APIError: Failed to
      // get session` — the exact production 500 this guard converts.
      getSession: async () => {
        throw new Error("Failed to get session");
      },
      isRevoked: async () => false,
    });
    const res = await app.request("/protected");
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      error: { code: "auth_unavailable", retryable: true },
    });
  });

  it("fails open (honours the valid cookie) when isRevoked throws, per SK-AUTH-020", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const app = buildApp({
      getSession: async () => ({
        user: { id: "u_1" },
        session: { token: "tok_1", userId: "u_1" },
      }),
      isRevoked: async () => {
        throw new Error("KV get failed");
      },
    });
    const res = await app.request("/protected");
    // A KV blip on the revocation set must NOT log out a validly-signed
    // session (SK-AUTH-020) — the cookie signature already proves identity.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: "u_1", token: "tok_1" });
    // …but the fail-open is observable via one warn log.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("session_revocation_check_failed"));
    warn.mockRestore();
  });
});
