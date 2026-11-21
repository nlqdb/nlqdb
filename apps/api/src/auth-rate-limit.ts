// SK-RL-008 — per-IP limit on `/api/auth/*`, counted by Cloudflare's
// rate-limiting binding: no KV or D1 write per request, so a scanner can't
// spend the free-tier write caps the way Better Auth's KV-backed limiter let
// it (2026-11-21: 1,000 KV writes in one hour, sign-in down for the day).
// The binding's counts are per Cloudflare location and approximate — a
// bot-speed brake, not an exact quota.
import type { Context, Next } from "hono";
import { fail } from "./error-envelope.ts";

const WINDOW_SECONDS = 60;
const AUTH_LIMIT = 100;
const MAGIC_LINK_LIMIT = 5;

export async function authRateLimit(c: Context<{ Bindings: Cloudflare.Env }>, next: Next) {
  const ip = c.req.header("cf-connecting-ip");
  const isMagicLink = c.req.method === "POST" && c.req.path === "/api/auth/sign-in/magic-link";
  const limiter = isMagicLink ? c.env.MAGIC_LINK_RATE_LIMIT : c.env.AUTH_RATE_LIMIT;
  // No binding (unit tests, local dev) or no edge IP: nothing to key on.
  if (!limiter || !ip) return next();
  const { success } = await limiter.limit({ key: ip });
  if (success) return next();
  c.header("Retry-After", String(WINDOW_SECONDS));
  return fail(c, "rate_limited", {
    limit: isMagicLink ? MAGIC_LINK_LIMIT : AUTH_LIMIT,
    resetAt: Math.floor(Date.now() / 1000) + WINDOW_SECONDS,
  });
}
