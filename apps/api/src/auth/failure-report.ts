// Who an auth failure hit, read without D1 — the store that is usually what
// failed (2026-11-18: the account's D1 read cap refused every query and a
// first-time sign-in 500'd with nothing naming its owner). Logs carry only
// fingerprints (`SK-WEB-001`); the email reaches LogSnag through the
// `user.auth_failed` event (`SK-EVENTS-006`), as `user.registered` already does.

import type { EventEmitter } from "@nlqdb/events";
import { redactPii } from "@nlqdb/otel";
import { type AlertEnv, alertRnd, stableSignature } from "../internal-alert.ts";
import { hashEmail } from "./magic-link-throttle.ts";

const RECIPIENT_PREFIX = "ml-who:";

async function sha256Hex(input: string, hexChars = 64): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, hexChars);
}
const MAGIC_LINK_SEND_PATH = "/api/auth/sign-in/magic-link";
const MAGIC_LINK_VERIFY_PATH = "/api/auth/magic-link/verify";

export function tokenFromVerifyUrl(verifyUrl: string): string | null {
  try {
    return new URL(verifyUrl).searchParams.get("token");
  } catch {
    return null;
  }
}

/** KV keeps token → email for the link's life, so a failed verify can name its owner. */
export async function rememberMagicLinkRecipient(
  kv: KVNamespace,
  verifyUrl: string,
  email: string,
  ttlSeconds: number,
): Promise<void> {
  const token = tokenFromVerifyUrl(verifyUrl);
  if (!token) return;
  await kv.put(`${RECIPIENT_PREFIX}${await sha256Hex(token)}`, email.trim().toLowerCase(), {
    expirationTtl: ttlSeconds,
  });
}

/**
 * The email an auth request was for, when one is recoverable without D1: the
 * sign-in body (`email`) or a verify link's token remembered at send time.
 * `body` is the request text read before Better Auth consumed it.
 */
export async function authRequestEmail(
  kv: KVNamespace,
  url: URL,
  body: string | null,
): Promise<string | null> {
  if (url.pathname === MAGIC_LINK_SEND_PATH && body) {
    try {
      const email = (JSON.parse(body) as { email?: unknown }).email;
      if (typeof email !== "string") return null;
      const clean = email.trim().toLowerCase();
      // Unauthenticated input bound for LogSnag: only an address-shaped, RFC-length string.
      return clean.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(clean) ? clean : null;
    } catch {
      return null;
    }
  }
  const token = url.pathname === MAGIC_LINK_VERIFY_PATH ? url.searchParams.get("token") : null;
  return token ? kv.get(`${RECIPIENT_PREFIX}${await sha256Hex(token)}`) : null;
}

/** Whether `reportAuthServerError` can use the request body (read it before the handler). */
export function wantsAuthBody(url: URL, method: string): boolean {
  return method === "POST" && url.pathname === MAGIC_LINK_SEND_PATH;
}

/**
 * A non-reversible handle on the caller's credential: a session-token hash
 * (match by hashing `session.token`) or an API key's type + last 4 (the
 * `api_keys.last_4` column). Never the credential itself.
 */
export async function credentialFingerprint(req: Request): Promise<string> {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer) {
    const type = /^(sk_live|sk_mcp|pk_live|anon)_/.exec(bearer)?.[1] ?? "bearer";
    return type === "anon" ? "anon" : `key:${type}…${bearer.slice(-4)}`;
  }
  const cookie = req.headers.get("cookie") ?? "";
  // Prefix varies by env (`__Secure-__Secure.` in prod, `better-auth.` in dev).
  const raw = /(?:^|;\s*)[^=;\s]*\.session_token=([^;]+)/.exec(cookie)?.[1];
  if (!raw) return "none";
  const token = decodeURIComponent(raw).split(".")[0] ?? "";
  return `session:${await sha256Hex(token, 16)}`;
}

/** Request context every auth-failure log line carries. */
export function requestContext(req: Request): { cfRay: string; country: string; colo: string } {
  const cf = req.cf as { country?: string; colo?: string } | undefined;
  return {
    cfRay: req.headers.get("cf-ray") ?? "",
    country: cf?.country ?? "",
    colo: cf?.colo ?? "",
  };
}

export type AuthServerErrorDeps = {
  env: AlertEnv;
  events: EventEmitter;
  req: Request;
  body: string | null;
  status: number;
  utcDay: string;
  /** The handler threw, so `app.onError` already logs and alerts; only the event is left. */
  thrown?: boolean;
};

/**
 * A 5xx out of Better Auth: one log line, the R&D alert `app.onError` would
 * have sent had it thrown, and a `user.auth_failed` event when the email is
 * recoverable (deduped per email per UTC day, so it can't drain LogSnag).
 * The email is computed even when `thrown`, the one thing `app.onError` lacks.
 */
export async function reportAuthServerError(deps: AuthServerErrorDeps): Promise<void> {
  const { env, req, status } = deps;
  const url = new URL(req.url);
  const [email, credential] = await Promise.all([
    authRequestEmail(env.KV, url, deps.body).catch(() => null),
    credentialFingerprint(req),
  ]);
  const emailHash = email ? (await hashEmail(email)).slice(0, 16) : "";
  const ctx = requestContext(req);
  const event = email
    ? deps.events.emit({ name: "user.auth_failed", email, emailHash, path: url.pathname, status })
    : Promise.resolve();
  if (deps.thrown) return event;
  console.error(
    JSON.stringify({
      msg: "auth_server_error",
      method: req.method,
      path: url.pathname,
      status,
      credential,
      emailHash,
      ...ctx,
    }),
  );
  await Promise.all([
    alertRnd(env, {
      kind: "server",
      summary: `${status} ${req.method} ${url.pathname} (auth)`,
      signature: stableSignature(`auth::${req.method} ${url.pathname}::${status}`),
      utcDay: deps.utcDay,
      fields: [
        ["when", new Date().toISOString()],
        ["method", req.method],
        ["path", url.pathname],
        ["status", String(status)],
        ["credential", credential],
        ["emailHash", emailHash || "unknown"],
        ["cf-ray", ctx.cfRay],
        ["country", ctx.country],
        ["user-agent", redactPii(req.headers.get("user-agent") ?? "").slice(0, 200)],
      ],
    }),
    event,
  ]);
}
