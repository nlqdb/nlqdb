// Global anonymous-tier rate limiter (SK-ANON-010).
//
// Cumulative across ALL anon traffic — not per-IP. Three rolling
// windows that all must pass before the call proceeds:
//
//   - 100/hour
//   - 1000/day
//   - 10,000/month
//
// When any of the three trips, the route returns 401 with
// `{ error: { status: "auth_required", signInUrl } }`. The web
// surface (CreateForm.tsx, marketing hero) interprets that envelope
// as "stash the prompt, redirect to sign-in" — SK-ANON-011 covers
// the prompt-persistence half. Per-IP limiters (apps/api/src/anon-
// rate-limit.ts) layer underneath this — short bursts still 429,
// sustained anon usage still gets soft-promoted to authed.
//
// Counter shape: one KV key per (window-kind, current-bucket). The
// bucket id is `floor(now / window-seconds)` — a fixed-window
// approximation of "rolling". Trade-off: at the boundary moment a
// fresh bucket gives the next caller a clean 100/1000/10000 budget
// even if the previous window was at 99/999/9999. We accept this
// because (a) the boundary moment is a fixed-time concession and
// (b) the auth-redirect is the safety net — sustained abuse hits
// the next tier within seconds.
//
// KV is the right store: counters are global (one bucket key per
// window, not per-IP), TTLs auto-evict at window+1, no D1 row
// explosion under load. The 1k-writes-per-day Free quota that
// banned KV for per-user limiting (SK-RL-001) doesn't apply here —
// 100/hr * 24 + 1000/day + 10000/month-day = ~4400 writes/day max
// (each anon call increments three counters; 100/hr ceiling => 2400
// counter writes/day from the hourly bucket alone). Well under the
// authed-tier KV quota the secondaryStorage already eats.

const HOUR_WINDOW_SECONDS = 60 * 60;
const HOUR_LIMIT = 100;
const HOUR_KEY_PREFIX = "anon:global:hr:";

const DAY_WINDOW_SECONDS = 24 * 60 * 60;
const DAY_LIMIT = 1000;
const DAY_KEY_PREFIX = "anon:global:day:";

// "Month" is approximated as 30 days. SK-ANON-010 names "10k/month"
// as a budget number, not a calendar contract; the worst case is a
// 30-day window straddling a calendar-month boundary, which still
// caps at 10k. A real calendar-month bucket would require date math
// (and a leap-year edge case in February); the 30-day fixed window
// is the simpler, equally-defensive choice.
const MONTH_WINDOW_SECONDS = 30 * 24 * 60 * 60;
const MONTH_LIMIT = 10_000;
const MONTH_KEY_PREFIX = "anon:global:mo:";

const KV_MIN_TTL_SECONDS = 60;

export type GlobalAnonVerdict =
  | { ok: true; window: "hour" | "day" | "month"; limit: number; count: number; resetAt: number }
  | {
      ok: false;
      window: "hour" | "day" | "month";
      limit: number;
      count: number;
      resetAt: number;
    };

export interface GlobalAnonLimiter {
  // Read-only — used by the route to decide before the orchestrator
  // boots. Returns the FIRST window that's full (preference order
  // hour → day → month, since the shortest-window resetAt is the
  // most actionable for the user). Returns the most-utilised window
  // on the success path so callers can emit X-RateLimit-* headers.
  peek(): Promise<GlobalAnonVerdict>;
  // Increment all three counters; called only after `peek().ok`
  // and after the orchestrator has accepted the call (SK-ANON-010
  // "count what we serve"). Errors swallowed — the call already
  // succeeded; a counter miss is preferable to a user-facing fail.
  record(): Promise<void>;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function bucketKey(prefix: string, windowSeconds: number, now: number): string {
  const bucket = Math.floor(now / windowSeconds);
  return `${prefix}${bucket}`;
}

function bucketResetAt(windowSeconds: number, now: number): number {
  const bucket = Math.floor(now / windowSeconds);
  return (bucket + 1) * windowSeconds;
}

export function makeGlobalAnonLimiter(kv: KVNamespace): GlobalAnonLimiter {
  return {
    async peek() {
      const now = nowSeconds();
      const [hourRaw, dayRaw, monthRaw] = await Promise.all([
        kv.get(bucketKey(HOUR_KEY_PREFIX, HOUR_WINDOW_SECONDS, now)),
        kv.get(bucketKey(DAY_KEY_PREFIX, DAY_WINDOW_SECONDS, now)),
        kv.get(bucketKey(MONTH_KEY_PREFIX, MONTH_WINDOW_SECONDS, now)),
      ]);
      const hourCount = Number(hourRaw ?? "0");
      const dayCount = Number(dayRaw ?? "0");
      const monthCount = Number(monthRaw ?? "0");

      // Trip-priority: hour → day → month. The shortest-window
      // verdict surfaces first; its `resetAt` is the soonest
      // moment the user can retry without auth.
      if (hourCount >= HOUR_LIMIT) {
        return {
          ok: false,
          window: "hour",
          limit: HOUR_LIMIT,
          count: hourCount,
          resetAt: bucketResetAt(HOUR_WINDOW_SECONDS, now),
        };
      }
      if (dayCount >= DAY_LIMIT) {
        return {
          ok: false,
          window: "day",
          limit: DAY_LIMIT,
          count: dayCount,
          resetAt: bucketResetAt(DAY_WINDOW_SECONDS, now),
        };
      }
      if (monthCount >= MONTH_LIMIT) {
        return {
          ok: false,
          window: "month",
          limit: MONTH_LIMIT,
          count: monthCount,
          resetAt: bucketResetAt(MONTH_WINDOW_SECONDS, now),
        };
      }

      // Success path returns the most-utilised window so the route
      // can emit X-RateLimit-* headers reflecting the binding limit.
      // Utilisation = count/limit, ranked across the three windows.
      const ranked = [
        {
          window: "hour" as const,
          limit: HOUR_LIMIT,
          count: hourCount,
          resetAt: bucketResetAt(HOUR_WINDOW_SECONDS, now),
        },
        {
          window: "day" as const,
          limit: DAY_LIMIT,
          count: dayCount,
          resetAt: bucketResetAt(DAY_WINDOW_SECONDS, now),
        },
        {
          window: "month" as const,
          limit: MONTH_LIMIT,
          count: monthCount,
          resetAt: bucketResetAt(MONTH_WINDOW_SECONDS, now),
        },
      ];
      ranked.sort((a, b) => b.count / b.limit - a.count / a.limit);
      // `ranked` is constructed inline above with three entries —
      // [0] is always defined.
      const top = ranked[0] as (typeof ranked)[number];
      return { ok: true, ...top };
    },

    async record() {
      const now = nowSeconds();
      const hourKey = bucketKey(HOUR_KEY_PREFIX, HOUR_WINDOW_SECONDS, now);
      const dayKey = bucketKey(DAY_KEY_PREFIX, DAY_WINDOW_SECONDS, now);
      const monthKey = bucketKey(MONTH_KEY_PREFIX, MONTH_WINDOW_SECONDS, now);
      const [hourRaw, dayRaw, monthRaw] = await Promise.all([
        kv.get(hourKey),
        kv.get(dayKey),
        kv.get(monthKey),
      ]);
      await Promise.all([
        kv.put(hourKey, String(Number(hourRaw ?? "0") + 1), {
          expirationTtl: Math.max(HOUR_WINDOW_SECONDS, KV_MIN_TTL_SECONDS),
        }),
        kv.put(dayKey, String(Number(dayRaw ?? "0") + 1), {
          expirationTtl: Math.max(DAY_WINDOW_SECONDS, KV_MIN_TTL_SECONDS),
        }),
        kv.put(monthKey, String(Number(monthRaw ?? "0") + 1), {
          expirationTtl: Math.max(MONTH_WINDOW_SECONDS, KV_MIN_TTL_SECONDS),
        }),
      ]);
    },
  };
}

export const GLOBAL_ANON_LIMITS = {
  hour: HOUR_LIMIT,
  day: DAY_LIMIT,
  month: MONTH_LIMIT,
};
