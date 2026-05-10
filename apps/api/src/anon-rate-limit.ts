// Anon-tier rate-limit + per-device create cap.
// Companion to `apps/api/src/ask/rate-limit.ts` (per-user/D1 limiter).
//
// Two buckets, two responsibilities:
//   1. Per-IP query rate-limit. Anon /v1/ask traffic counted per
//      IP so an abuser without an account can't burn the LLM
//      budget across many anonymous tokens. Default 30/min (half
//      the 60/min authed tier — see Open Questions in
//      docs/features/rate-limit/FEATURE.md).
//   2. Per-device create cap (1/device, SK-ANON-012). Keyed on
//      `sha256(anon_token)[:16]` rather than IP — coffee-shop /
//      university / hotel-wifi scenarios collapse multiple users
//      to one IP, so the IP key false-positived honest co-located
//      users. The 2nd create returns `401 auth_required` with the
//      `SK-ANON-010` envelope shape; the surface stashes the
//      pending prompt and redirects to sign-in.
//
// All counters live in KV. KV is the right store for unbounded
// per-IP / per-device cardinality: TTL semantics auto-evict without
// a sweep job. The D1 limiter (per-user) stays where it is — its
// row count is bounded by user count.

const QUERY_WINDOW_SECONDS = 60;
const QUERY_MAX_PER_WINDOW = 30;
const QUERY_KEY_PREFIX = "anon:query:";

// Per-device create cap. The TTL matches `SK-ANON-002` server
// retention (90 days) — the cap should reset when the anon device
// itself expires. A user who comes back 6 months later on the same
// device gets a fresh 1-call budget; their old anon DB is already
// gone, so the two windows match.
const CREATE_DEVICE_MAX = 1;
const CREATE_DEVICE_WINDOW_SECONDS = 90 * 24 * 60 * 60;
const CREATE_DEVICE_KEY_PREFIX = "anon:create:device:";

const KV_MIN_TTL_SECONDS = 60;

// All verdicts carry `limit` + `count` + `resetAt` so the route can
// emit RFC 9110 X-RateLimit-* headers (SK-RL-004 + GLOBAL-002 parity
// with `/v1/ask`'s authed path).
export type AnonQueryVerdict =
  | { ok: true; limit: number; count: number; resetAt: number }
  | { ok: false; retryAfter: number; limit: number; count: number; resetAt: number };

export type AnonDeviceVerdict =
  | { ok: true; limit: number; count: number; resetAt: number }
  | {
      ok: false;
      reason: "device_cap";
      retryAfter: number;
      limit: number;
      count: number;
      resetAt: number;
    };

// Read-only check used by the route to decide before the orchestrator
// runs whether the device has already burned its create budget. Callers
// compose: `peekDevice → (verify Turnstile) → recordDevice` (the
// recordDevice happens only after a successful provision per WS5 fix C).
export interface AnonRateLimiter {
  checkQuery(ip: string): Promise<AnonQueryVerdict>;
  peekDevice(principalId: string): Promise<AnonDeviceVerdict>;
  recordDevice(principalId: string): Promise<void>;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function makeAnonRateLimiter(kv: KVNamespace): AnonRateLimiter {
  return {
    async checkQuery(ip) {
      const key = `${QUERY_KEY_PREFIX}${ip}`;
      const current = Number((await kv.get(key)) ?? "0");
      const resetAt = nowSeconds() + QUERY_WINDOW_SECONDS;
      if (current >= QUERY_MAX_PER_WINDOW) {
        return {
          ok: false,
          retryAfter: QUERY_WINDOW_SECONDS,
          limit: QUERY_MAX_PER_WINDOW,
          count: current,
          resetAt,
        };
      }
      await kv.put(key, String(current + 1), {
        expirationTtl: Math.max(QUERY_WINDOW_SECONDS, KV_MIN_TTL_SECONDS),
      });
      return {
        ok: true,
        limit: QUERY_MAX_PER_WINDOW,
        count: current + 1,
        resetAt,
      };
    },

    async peekDevice(principalId) {
      const key = `${CREATE_DEVICE_KEY_PREFIX}${principalId}`;
      const current = Number((await kv.get(key)) ?? "0");
      const resetAt = nowSeconds() + CREATE_DEVICE_WINDOW_SECONDS;
      if (current >= CREATE_DEVICE_MAX) {
        return {
          ok: false,
          reason: "device_cap",
          retryAfter: CREATE_DEVICE_WINDOW_SECONDS,
          limit: CREATE_DEVICE_MAX,
          count: current,
          resetAt,
        };
      }
      return {
        ok: true,
        limit: CREATE_DEVICE_MAX,
        count: current,
        resetAt,
      };
    },

    async recordDevice(principalId) {
      const key = `${CREATE_DEVICE_KEY_PREFIX}${principalId}`;
      const current = Number((await kv.get(key)) ?? "0");
      await kv.put(key, String(current + 1), {
        expirationTtl: Math.max(CREATE_DEVICE_WINDOW_SECONDS, KV_MIN_TTL_SECONDS),
      });
    },
  };
}
