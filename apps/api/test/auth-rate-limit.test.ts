// SK-RL-008 — the `/api/auth/*` edge limiter: keys on the edge IP, gives
// magic-link its own tighter binding, and fails open without a binding.
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { authRateLimit } from "../src/auth-rate-limit.ts";

function fakeLimiter(max: number) {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    limit: async ({ key }: { key: string }) => {
      keys.push(key);
      const n = (counts.get(key) ?? 0) + 1;
      if (n > max) return { success: false };
      counts.set(key, n);
      return { success: true };
    },
  };
}

function appWith(env: Partial<Cloudflare.Env>) {
  const app = new Hono<{ Bindings: Cloudflare.Env }>();
  app.use("/api/auth/*", authRateLimit);
  app.all("/api/auth/*", (c) => c.text("ok"));
  return (path: string, ip: string | null, method = "GET") =>
    app.request(
      path,
      { method, headers: ip ? { "cf-connecting-ip": ip } : {} },
      env as Cloudflare.Env,
    );
}

describe("authRateLimit", () => {
  it("429s an IP over the limit with Retry-After, other IPs unaffected", async () => {
    const auth = fakeLimiter(2);
    const req = appWith({ AUTH_RATE_LIMIT: auth as unknown as RateLimit });
    expect((await req("/api/auth/get-session", "1.1.1.1")).status).toBe(200);
    expect((await req("/api/auth/get-session", "1.1.1.1")).status).toBe(200);
    const over = await req("/api/auth/get-session", "1.1.1.1");
    expect(over.status).toBe(429);
    expect(over.headers.get("retry-after")).toBe("60");
    expect((await req("/api/auth/get-session", "2.2.2.2")).status).toBe(200);
    expect(auth.keys.every((k) => k === "1.1.1.1" || k === "2.2.2.2")).toBe(true);
  });

  it("routes magic-link sign-in to its own binding", async () => {
    const auth = fakeLimiter(100);
    const magic = fakeLimiter(1);
    const req = appWith({
      AUTH_RATE_LIMIT: auth as unknown as RateLimit,
      MAGIC_LINK_RATE_LIMIT: magic as unknown as RateLimit,
    });
    expect((await req("/api/auth/sign-in/magic-link", "1.1.1.1", "POST")).status).toBe(200);
    expect((await req("/api/auth/sign-in/magic-link", "1.1.1.1", "POST")).status).toBe(429);
    expect(magic.keys).toHaveLength(2);
    expect(auth.keys).toHaveLength(0);
  });

  it("passes through with no binding or no edge IP", async () => {
    expect((await appWith({})("/api/auth/get-session", "1.1.1.1")).status).toBe(200);
    const auth = fakeLimiter(0);
    const req = appWith({ AUTH_RATE_LIMIT: auth as unknown as RateLimit });
    expect((await req("/api/auth/get-session", null)).status).toBe(200);
    expect(auth.keys).toHaveLength(0);
  });
});
