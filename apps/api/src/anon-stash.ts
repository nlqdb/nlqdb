// HMAC-signed anon-bearer stash for the sign-in round-trip
// (SK-ANON-012, post-OAuth adoption).
//
// The flow:
//   1. Before initiating sign-in (magic-link POST or OAuth init top-
//      level GET) the sign-in page calls `POST /api/auth/anon-stash`
//      with the anon bearer in an `x-anon-bearer` header.
//   2. The endpoint signs the bearer with HMAC-SHA-256 (key =
//      `BETTER_AUTH_SECRET`) and writes a temp cookie
//      (`__Secure-anon-bearer` in prod, `anon-bearer` in dev) at
//      `Path=/api/auth`, `HttpOnly`, `SameSite=Lax`, 10-minute Max-Age.
//   3. The browser sends the cookie on the magic-link verify or
//      OAuth callback (both same-origin, both under `/api/auth`).
//   4. Better Auth's `after` hook (`apps/api/src/auth.ts`) reads
//      the cookie, verifies the HMAC, calls
//      `recordAnonAdoption(env.DB, userId, bearer)` (the SK-ANON-003
//      one-row update), and clears the cookie by setting it with
//      `Max-Age=0`.
//
// Why HMAC + cookie rather than a server-side store:
//   - No KV write on every sign-in init. The Workers free-tier KV
//     budget is shared with rate-limit + plan cache + secondary
//     storage; one cookie write is cheaper.
//   - The bearer never lands in a span attribute, an OTel label,
//     a D1 row, or a server log — only the cookie body, which is
//     opaque to operators reading traces.
//   - 10-minute Max-Age is long enough for OAuth round-trips
//     (typical IdP < 60 s) but short enough that a stolen cookie
//     doesn't outlive the sign-in flow.
//
// SameSite=Lax permits the cookie to ride along on the top-level
// navigation from the IdP back to `/api/auth/callback/:provider`
// (OAuth) and from the email-click landing at `/auth/continue` to
// `/api/auth/magic-link/verify` (magic-link). HttpOnly prevents JS
// from reading the cookie post-stash; the bearer is committed to
// the cookie and the page no longer needs it.

const ANON_BEARER_PREFIX = "anon_";

// Cookie name follows the Better Auth posture from `apps/api/src/auth.ts`:
// `__Secure-` only when the worker is serving HTTPS (production /
// canary). Dev (localhost over http) drops the prefix so the cookie
// can be set without `Secure`. The `Path=/api/auth` scope keeps the
// cookie from being sent on `/v1/*` traffic — adoption-time only.
export const ANON_STASH_COOKIE_NAME_PROD = "__Secure-anon-bearer";
export const ANON_STASH_COOKIE_NAME_DEV = "anon-bearer";
export const ANON_STASH_COOKIE_PATH = "/api/auth";
export const ANON_STASH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export function cookieName(isProd: boolean): string {
  return isProd ? ANON_STASH_COOKIE_NAME_PROD : ANON_STASH_COOKIE_NAME_DEV;
}

// Sign the bearer. Output shape: `<base64url(bearer)>.<base64url(hmac)>`
// — a single string the cookie carries opaquely. Verify reverses it.
export async function signAnonStash(bearer: string, secret: string): Promise<string> {
  const payload = base64UrlEncode(new TextEncoder().encode(bearer));
  const mac = await hmacSha256(secret, payload);
  return `${payload}.${mac}`;
}

// Returns the bearer on a successful verify, or `null` if the cookie
// is malformed, the HMAC doesn't match, or the embedded bearer doesn't
// have the expected `anon_` prefix.
export async function verifyAnonStash(cookieValue: string, secret: string): Promise<string | null> {
  const dot = cookieValue.indexOf(".");
  if (dot < 0) return null;
  const payload = cookieValue.slice(0, dot);
  const mac = cookieValue.slice(dot + 1);
  if (!payload || !mac) return null;

  const expected = await hmacSha256(secret, payload);
  if (!constantTimeEqual(expected, mac)) return null;

  let bearer: string;
  try {
    bearer = new TextDecoder().decode(base64UrlDecode(payload));
  } catch {
    return null;
  }
  if (!bearer.startsWith(ANON_BEARER_PREFIX)) return null;
  if (bearer.length <= ANON_BEARER_PREFIX.length) return null;
  return bearer;
}

// `Set-Cookie` value for the stash. `isProd` flips the `__Secure-`
// prefix + the `Secure` attribute. The cookie is HttpOnly so the
// stash page can't read it back; SameSite=Lax so the OAuth-callback
// cross-site redirect still sends it.
export function buildSetCookie(value: string, isProd: boolean): string {
  const name = cookieName(isProd);
  const attrs = [
    `${name}=${value}`,
    `Path=${ANON_STASH_COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ANON_STASH_COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (isProd) attrs.push("Secure");
  return attrs.join("; ");
}

// `Set-Cookie` value that clears the stash. Must echo the same
// `Path` + `Secure` posture as `buildSetCookie` so the browser
// matches the cookie to delete.
export function buildClearCookie(isProd: boolean): string {
  const name = cookieName(isProd);
  const attrs = [
    `${name}=`,
    `Path=${ANON_STASH_COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isProd) attrs.push("Secure");
  return attrs.join("; ");
}

// Pull the stash cookie value off a `Cookie` request header. Returns
// the raw signed value (still un-verified) or `null` if absent.
export function readStashCookie(cookieHeader: string | null, isProd: boolean): string | null {
  if (!cookieHeader) return null;
  const name = cookieName(isProd);
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      const v = trimmed.slice(name.length + 1);
      return v.length > 0 ? v : null;
    }
  }
  return null;
}

// ─── crypto helpers ──────────────────────────────────────────────────

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Length-checked then bitwise XOR — avoids the early-exit timing leak
// of `===`. Strings only; both sides are base64url MACs of equal length
// on the happy path.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
