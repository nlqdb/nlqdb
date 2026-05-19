// `/v1/run` integration — auth-gate + body-parse only; the 200 path lives in `src/run/orchestrate.test.ts`.
//
// The body-parse tests pass `X-Invite-Code: TEST_INVITE` so the
// `GLOBAL-027` pre-alpha gate (which mounts between `requirePrincipal`
// and the handler) lets them through to the body-parse seam. The
// principal-gate tests deliberately omit it — those assertions fire
// before the gate runs, at the `requirePrincipal` step.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import "./apply-migrations.ts";

describe("POST /v1/run — principal gate", () => {
  it("returns 401 when no auth is present", async () => {
    const res = await SELF.fetch("https://example.com/v1/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ db: "db_x", sql: "SELECT 1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when the Authorization header is not a recognized bearer", async () => {
    const res = await SELF.fetch("https://example.com/v1/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer some_random_token",
      },
      body: JSON.stringify({ db: "db_x", sql: "SELECT 1" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /v1/run — body parse", () => {
  it("returns 400 sql_required when sql is missing", async () => {
    const res = await SELF.fetch("https://example.com/v1/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anon_abcdef0123456789",
        "x-invite-code": "TEST_INVITE",
      },
      body: JSON.stringify({ db: "db_x" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "sql_required" });
  });

  it("returns 400 sql_required on whitespace-only sql", async () => {
    const res = await SELF.fetch("https://example.com/v1/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anon_abcdef0123456789",
        "x-invite-code": "TEST_INVITE",
      },
      body: JSON.stringify({ db: "db_x", sql: "   " }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "sql_required" });
  });

  it("returns 400 db_required when db is missing for non-pk_live principals", async () => {
    const res = await SELF.fetch("https://example.com/v1/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anon_abcdef0123456789",
        "x-invite-code": "TEST_INVITE",
      },
      body: JSON.stringify({ sql: "SELECT 1" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "db_required" });
  });

  it("returns 400 sql_too_long when sql exceeds the cap", async () => {
    const huge = `SELECT 1 -- ${"a".repeat(64 * 1024)}`;
    const res = await SELF.fetch("https://example.com/v1/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anon_abcdef0123456789",
        "x-invite-code": "TEST_INVITE",
      },
      body: JSON.stringify({ db: "db_x", sql: huge }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; maxLength: number };
    expect(body.error).toBe("sql_too_long");
    expect(body.maxLength).toBeGreaterThan(0);
  });

  it("returns 400 invalid_json on malformed body", async () => {
    const res = await SELF.fetch("https://example.com/v1/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anon_abcdef0123456789",
        "x-invite-code": "TEST_INVITE",
      },
      body: "not json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
  });
});
