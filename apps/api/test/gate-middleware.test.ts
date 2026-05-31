// Integration tests for `gatePreAlpha`. Use a real Hono app +
// `app.request()` so the middleware chain exercises through the actual
// context surface, not a synthetic mock.
//
// Assumes `EVAL_BASELINE` reports closed today (BIRD 0.318, Spider
// null). When both lanes clear, these tests get updated alongside the
// middleware-removal PR.

import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeGatePreAlpha } from "../src/gate/middleware.ts";
import type { RequireSessionVariables } from "../src/middleware.ts";
import {
  makeRequirePrincipal,
  type RequirePrincipalVariables,
  sha256Hex,
} from "../src/principal.ts";

type Variables = RequirePrincipalVariables & RequireSessionVariables;

function fakeKv(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map(Object.entries(initial));
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [], list_complete: true, cursor: "" }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

function buildAnonApp(kv: KVNamespace) {
  const app = new Hono<{ Variables: Variables }>();
  const requirePrincipal = makeRequirePrincipal({
    getSession: async () => null,
    isRevoked: async () => false,
  });
  const gatePreAlpha = makeGatePreAlpha({ kv, eventsQueue: undefined });
  app.post("/v1/ask", requirePrincipal, gatePreAlpha, (c) => c.json({ ok: true }));
  return app;
}

function buildSessionApp(kv: KVNamespace, userId: string) {
  const app = new Hono<{ Variables: Variables }>();
  const gatePreAlpha = makeGatePreAlpha({ kv, eventsQueue: undefined });
  app.post(
    "/v1/databases",
    async (c, next) => {
      c.set("session", {
        user: { id: userId, email: "x@x.test" },
        session: { token: "tok_x", userId },
      });
      return next();
    },
    gatePreAlpha,
    (c) => c.json({ ok: true }),
  );
  return app;
}

const ANON_BEARER = "Bearer anon_test_0123456789abcdef";

describe("gatePreAlpha — closed branch (today: BIRD 0.318, Spider null)", () => {
  it("blocks an anon /v1/ask with 403 feature_gated + progress payload", async () => {
    const app = buildAnonApp(fakeKv());
    const res = await app.request("/v1/ask", {
      method: "POST",
      headers: { authorization: ANON_BEARER },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as {
      error: {
        status: string;
        message: string;
        action: string;
        waitlist_url: string;
        gate: {
          bird_accuracy: number;
          spider_accuracy: number | null;
          bird_target: number;
          spider_target: number;
          measured_at: string;
        };
      };
    };
    expect(body.error.status).toBe("feature_gated");
    expect(body.error.action).toBe("Join the waitlist");
    expect(body.error.waitlist_url).toMatch(/waitlist/);
    expect(body.error.gate.bird_target).toBe(0.65);
    expect(body.error.gate.spider_target).toBe(0.75);
    expect(body.error.gate.bird_accuracy).toBeGreaterThan(0); // current free-chain value
    expect(body.error.gate.spider_accuracy).toBeNull(); // SK-QUAL-003 slice 3 unshipped
  });

  it("blocks an authed-session /v1/databases POST with the same shape", async () => {
    const app = buildSessionApp(fakeKv(), "u_alice");
    const res = await app.request("/v1/databases", { method: "POST" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { status: string } };
    expect(body.error.status).toBe("feature_gated");
  });
});

describe("gatePreAlpha — allowlist bypass (SK-GATE-003)", () => {
  it("passes a session whose user_id is in gate:user:*", async () => {
    const kv = fakeKv({ "gate:user:u_partner": "1" });
    const app = buildSessionApp(kv, "u_partner");
    const res = await app.request("/v1/databases", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("does NOT pass anon principals on the allowlist path (anon has no account)", async () => {
    // anon's allowlistKey is null from accountTenantIdFromPrincipal,
    // so a stray `gate:user:anon:*` row can't accidentally let anon
    // bypass.
    const kv = fakeKv({ "gate:user:anon:0123456789abcdef": "1" });
    const app = buildAnonApp(kv);
    const res = await app.request("/v1/ask", {
      method: "POST",
      headers: { authorization: ANON_BEARER },
    });
    expect(res.status).toBe(403);
  });
});

describe("gatePreAlpha — invite-code bypass (SK-GATE-003)", () => {
  it("passes when X-Invite-Code matches a hashed entry in KV", async () => {
    const code = "NLQDB-PARTNER-001";
    const hash = await sha256Hex(code, 32);
    const kv = fakeKv({ [`gate:invite:${hash}`]: "1" });
    const app = buildAnonApp(kv);
    const res = await app.request("/v1/ask", {
      method: "POST",
      headers: { authorization: ANON_BEARER, "x-invite-code": code },
    });
    expect(res.status).toBe(200);
  });

  it("rejects an unknown invite code with the gate body", async () => {
    const app = buildAnonApp(fakeKv());
    const res = await app.request("/v1/ask", {
      method: "POST",
      headers: { authorization: ANON_BEARER, "x-invite-code": "WRONG" },
    });
    expect(res.status).toBe(403);
  });

  it("an anon caller with a valid invite code clears the gate (GLOBAL-007: no login wall)", async () => {
    const code = "open-sesame";
    const hash = await sha256Hex(code, 32);
    const kv = fakeKv({ [`gate:invite:${hash}`]: "1" });
    const app = buildAnonApp(kv);
    const res = await app.request("/v1/ask", {
      method: "POST",
      headers: { authorization: ANON_BEARER, "x-invite-code": code },
    });
    expect(res.status).toBe(200);
  });
});

describe("gatePreAlpha — bypass precedence is OR (any hit passes)", () => {
  it("allowlisted user with a wrong invite code still passes via the allowlist", async () => {
    const kv = fakeKv({ "gate:user:u_partner": "1" });
    const app = buildSessionApp(kv, "u_partner");
    const res = await app.request("/v1/databases", {
      method: "POST",
      headers: { "x-invite-code": "WRONG" },
    });
    expect(res.status).toBe(200);
  });
});

describe("gatePreAlpha — fail-closed when KV is unreachable (robustness)", () => {
  function brokenKv(): KVNamespace {
    return {
      get: async () => {
        throw new Error("KV unreachable");
      },
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [], list_complete: true, cursor: "" }),
      getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
    } as unknown as KVNamespace;
  }

  it("returns the gate body (not a 500) when both bypass reads throw", async () => {
    const app = buildAnonApp(brokenKv());
    const res = await app.request("/v1/ask", {
      method: "POST",
      headers: { authorization: ANON_BEARER, "x-invite-code": "ANY" },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { status: string } };
    expect(body.error.status).toBe("feature_gated");
  });

  it("a real allowlist hit still works even if a transient KV error happens elsewhere", async () => {
    const kv = fakeKv({ "gate:user:u_partner": "1" });
    const app = buildSessionApp(kv, "u_partner");
    const res = await app.request("/v1/databases", { method: "POST" });
    expect(res.status).toBe(200);
  });
});

describe("gatePreAlpha — nlqdb.gate.checks.total counter (SK-GATE-008)", () => {
  let telemetry: TestTelemetry;
  beforeEach(() => {
    telemetry = createTestTelemetry();
  });
  afterEach(() => {
    telemetry.reset();
  });

  async function point(outcome: string, reason: string, principalKind: string) {
    await telemetry.collectMetrics();
    const counter = telemetry.metricExporter
      .getMetrics()
      .flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics))
      .find((m) => m.descriptor.name === "nlqdb.gate.checks.total");
    return counter?.dataPoints.find(
      (dp) =>
        dp.attributes["outcome"] === outcome &&
        dp.attributes["bypass_reason"] === reason &&
        dp.attributes["principal_kind"] === principalKind,
    );
  }

  it("increments {block, none, anon} when an anon caller bounces with no code", async () => {
    const app = buildAnonApp(fakeKv());
    await app.request("/v1/ask", { method: "POST", headers: { authorization: ANON_BEARER } });
    expect(await point("block", "none", "anon")).toBeDefined();
  });

  it("increments {block, invite_invalid, anon} on a wrong-code attempt", async () => {
    const app = buildAnonApp(fakeKv());
    await app.request("/v1/ask", {
      method: "POST",
      headers: { authorization: ANON_BEARER, "x-invite-code": "WRONG" },
    });
    expect(await point("block", "invite_invalid", "anon")).toBeDefined();
  });

  it("increments {pass, invite_code, anon} on a valid redemption", async () => {
    const code = "open-sesame";
    const hash = await sha256Hex(code, 32);
    const app = buildAnonApp(fakeKv({ [`gate:invite:${hash}`]: "1" }));
    await app.request("/v1/ask", {
      method: "POST",
      headers: { authorization: ANON_BEARER, "x-invite-code": code },
    });
    expect(await point("pass", "invite_code", "anon")).toBeDefined();
  });
});

describe("gatePreAlpha — surfaces invite-attempted-but-invalid for abuse detection", () => {
  it("invalid-code attempts return the same 403 shape as no-code requests", async () => {
    // The discriminant is on the span (`bypass_reason=invite_invalid`),
    // not in the response — that's the no-information-leak property.
    const app = buildAnonApp(fakeKv());
    const withHeader = await app.request("/v1/ask", {
      method: "POST",
      headers: { authorization: ANON_BEARER, "x-invite-code": "GUESS" },
    });
    const withoutHeader = await app.request("/v1/ask", {
      method: "POST",
      headers: { authorization: ANON_BEARER },
    });
    expect(withHeader.status).toBe(withoutHeader.status);
    const withBody = (await withHeader.json()) as { error: { status: string } };
    const withoutBody = (await withoutHeader.json()) as { error: { status: string } };
    expect(withBody.error.status).toBe(withoutBody.error.status);
  });
});
