// Anon-tier rate-limit + create caps + Turnstile gate.
// Companion to `apps/api/src/ask/rate-limit.ts` (per-user/D1 limiter)
// and `apps/api/src/demo.ts` (per-IP/KV demo limiter). This is the
// per-IP layer SK-RL-006 / SK-ANON-004 promised would land "when
// anonymous mode does."
//
// Three buckets, three responsibilities:
//   1. Per-IP query rate-limit. Anon /v1/ask traffic counted per
//      IP so an abuser without an account can't burn the LLM
//      budget across many anonymous tokens. Default 30/min (half
//      the 60/min authed tier — see Open Questions in
//      docs/features/rate-limit/FEATURE.md).
//   2. Per-IP create cap (5/hr). DDL is the most expensive thing
//      we do; this is the create-rate guard from
//      docs/architecture.md §3.6.8.
//   3. Per-IP create-burst gate (3 in any 5-minute rolling window
//      → require Turnstile). Mirrors SK-ANON-007's
//      "challenge_required" 428 trigger.
//
// All three live in KV. KV is the right store for per-IP buckets:
// IP cardinality is unbounded under abuse and TTL semantics give us
// auto-eviction without a sweep job. The D1 limiter (per-user) stays
// where it is — its row count is bounded by user count.

const QUERY_WINDOW_SECONDS = 60;
const QUERY_MAX_PER_WINDOW = 30;
const QUERY_KEY_PREFIX = "anon:query:";

const CREATE_HOUR_WINDOW_SECONDS = 60 * 60;
const CREATE_HOUR_MAX = 5;
const CREATE_HOUR_KEY_PREFIX = "anon:create:hr:";

// Turnstile burst gate. The 5-minute rolling window is approximated
// with a 5-minute fixed window (cheap; one KV key per IP per 5min).
// SK-ANON-007 spec is "rolling" but the trade-off is one KV write
// per request vs cheaper fixed-window — the false-positive surface
// is identical for legitimate users (a real burst still trips the
// gate within the next bucket boundary at worst).
const CREATE_BURST_WINDOW_SECONDS = 5 * 60;
const CREATE_BURST_THRESHOLD = 3;
const CREATE_BURST_KEY_PREFIX = "anon:create:burst:";

const KV_MIN_TTL_SECONDS = 60;

// All verdicts carry `limit` + `count` + `resetAt` so the route can
// emit RFC 9110 X-RateLimit-* headers (SK-RL-004 + GLOBAL-002 parity
// with `/v1/ask`'s authed path).
export type AnonQueryVerdict =
  | { ok: true; limit: number; count: number; resetAt: number }
  | { ok: false; retryAfter: number; limit: number; count: number; resetAt: number };

export type AnonCreateVerdict =
  | { ok: true; needsChallenge: false; limit: number; count: number; resetAt: number }
  | { ok: true; needsChallenge: true; limit: number; count: number; resetAt: number }
  | {
      ok: false;
      reason: "ip_create_cap";
      retryAfter: number;
      limit: number;
      count: number;
      resetAt: number;
    };

// Read-only check used by the route to decide before the orchestrator
// runs whether to ask the user for a Turnstile token. Callers compose:
// `peekCreate → (verify Turnstile if needed) → recordCreate`.
export interface AnonRateLimiter {
  checkQuery(ip: string): Promise<AnonQueryVerdict>;
  peekCreate(ip: string): Promise<AnonCreateVerdict>;
  recordCreate(ip: string): Promise<void>;
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

    async peekCreate(ip) {
      const hourKey = `${CREATE_HOUR_KEY_PREFIX}${ip}`;
      const burstKey = `${CREATE_BURST_KEY_PREFIX}${ip}`;
      const [hourRaw, burstRaw] = await Promise.all([kv.get(hourKey), kv.get(burstKey)]);
      const hourCount = Number(hourRaw ?? "0");
      const resetAt = nowSeconds() + CREATE_HOUR_WINDOW_SECONDS;
      if (hourCount >= CREATE_HOUR_MAX) {
        return {
          ok: false,
          reason: "ip_create_cap",
          retryAfter: CREATE_HOUR_WINDOW_SECONDS,
          limit: CREATE_HOUR_MAX,
          count: hourCount,
          resetAt,
        };
      }
      const burstCount = Number(burstRaw ?? "0");
      const base = {
        limit: CREATE_HOUR_MAX,
        count: hourCount,
        resetAt,
      } as const;
      if (burstCount >= CREATE_BURST_THRESHOLD) {
        return { ok: true, needsChallenge: true, ...base };
      }
      return { ok: true, needsChallenge: false, ...base };
    },

    async recordCreate(ip) {
      const hourKey = `${CREATE_HOUR_KEY_PREFIX}${ip}`;
      const burstKey = `${CREATE_BURST_KEY_PREFIX}${ip}`;
      const [hourRaw, burstRaw] = await Promise.all([kv.get(hourKey), kv.get(burstKey)]);
      const hour = Number(hourRaw ?? "0") + 1;
      const burst = Number(burstRaw ?? "0") + 1;
      await Promise.all([
        kv.put(hourKey, String(hour), {
          expirationTtl: Math.max(CREATE_HOUR_WINDOW_SECONDS, KV_MIN_TTL_SECONDS),
        }),
        kv.put(burstKey, String(burst), {
          expirationTtl: Math.max(CREATE_BURST_WINDOW_SECONDS, KV_MIN_TTL_SECONDS),
        }),
      ]);
    },
  };
}
