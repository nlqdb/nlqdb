// Public demo endpoint — backs the live `<nlq-data>` on the marketing
// homepage and any third-party `<nlq-data goal="…" endpoint=".../v1/demo/ask">`
// embed. No auth, CORS-permissive, canned fixtures.
//
// Why server-side and not a client-side stub on the element: per
// PR #43, `<nlq-data>` is the real thing — no demo branch in the
// runtime, bundle stays < 6 KB. The "demo" semantic lives here, on
// the API. The element is dumb; whatever endpoint it points at,
// it renders.
//
// Rate limit: 10/min per IP via KV, defensively keeping this from
// becoming a free LLM-stand-in. Counters share the KV namespace
// already wired for Better Auth's secondaryStorage.

const RATE_WINDOW_SECONDS = 60;
const RATE_MAX_PER_WINDOW = 10;
const RATE_KEY_PREFIX = "demo:rate:";
// Cloudflare KV `expirationTtl` minimum — 60 s. Our window aligns,
// but the floor protects against shorter future tweaks silently
// failing the put.
const KV_MIN_TTL_SECONDS = 60;

type Row = Record<string, string | number | null>;

export interface DemoFixture {
  match: (goal: string) => boolean;
  build: (goal: string) => DemoResult;
}

export interface DemoResult {
  kind: "ok";
  sql: string;
  rows: Row[];
  rowCount: number;
  truncated: boolean;
  cached: boolean;
  summary: string;
}

// Substring filter: if the goal contains any row's column value
// (≥3 chars, case-insensitive), filter rows to matches. Makes the
// demo feel responsive — "show me americano" → only the americano
// row, not the full table. Returns the original rows when there's
// no hit, so default fixtures still render something.
//
// Honest about the SQL string: appends an ILIKE clause referencing
// the matched token so the displayed SQL reflects what got applied,
// not an aspirational query.
function applyGoalFilter(
  rows: Row[],
  baseSql: string,
  goal: string,
): { rows: Row[]; sql: string; matched: string | null } {
  const goalLower = goal.toLowerCase();
  for (const row of rows) {
    for (const value of Object.values(row)) {
      if (value == null) continue;
      const v = String(value).toLowerCase();
      if (v.length < 3) continue;
      if (!goalLower.includes(v)) continue;
      const filtered = rows.filter((r) =>
        Object.values(r).some((c) => c != null && String(c).toLowerCase().includes(v)),
      );
      if (filtered.length > 0 && filtered.length < rows.length) {
        // Inject the WHERE just before the trailing semicolon if any.
        const trimmed = baseSql.replace(/;\s*$/, "");
        const whereSql = `${trimmed}\n WHERE LOWER(CAST(* AS TEXT)) LIKE '%${v}%';`;
        return { rows: filtered, sql: whereSql, matched: v };
      }
    }
  }
  return { rows, sql: baseSql, matched: null };
}

function summaryFor(base: string, goal: string, matched: string | null): string {
  return matched ? `${base} Filtered to "${matched}" (matched in goal "${goal}").` : base;
}

// Goal → canned fixture. Match order matters: first hit wins.
// Default (orders) is the fallback when nothing else matches.
const FIXTURES: DemoFixture[] = [
  {
    match: (g) => /memory|agent|conversation/i.test(g),
    build: (goal) => ({
      kind: "ok",
      sql: "SELECT thread_id, role, content, created_at\n  FROM agent_memory\n WHERE created_at > now() - interval '1 day'\n ORDER BY created_at DESC\n LIMIT 6;",
      rows: [
        {
          thread_id: "t-204",
          role: "user",
          content: "summarize last week's invoices",
          created_at: "2026-04-26 18:42:11",
        },
        {
          thread_id: "t-204",
          role: "assistant",
          content: "12 invoices, $14,802 total",
          created_at: "2026-04-26 18:42:13",
        },
        {
          thread_id: "t-198",
          role: "user",
          content: "switch focus to support tickets",
          created_at: "2026-04-26 14:10:08",
        },
        {
          thread_id: "t-198",
          role: "assistant",
          content: "ok, scoping to /support",
          created_at: "2026-04-26 14:10:09",
        },
        {
          thread_id: "t-187",
          role: "user",
          content: "what changed in db schema?",
          created_at: "2026-04-26 09:32:55",
        },
        {
          thread_id: "t-187",
          role: "assistant",
          content: "added `tags` column on `feedback`",
          created_at: "2026-04-26 09:32:56",
        },
      ],
      rowCount: 6,
      truncated: false,
      cached: false,
      summary: `Pulled the last 6 turns across 3 threads (matching “${goal}”).`,
    }),
  },
  {
    // `\blead\b` not bare `lead` — otherwise "leaderboard" matches CRM
    // before reaching the leaderboard fixture below.
    match: (g) => /\b(crm|contact|customer|lead)\b/i.test(g),
    build: (goal) => ({
      kind: "ok",
      sql: "SELECT name, company, last_touch, status\n  FROM contacts\n ORDER BY last_touch DESC\n LIMIT 5;",
      rows: [
        { name: "Maya Chen", company: "Vellum Coffee", last_touch: "2026-04-26", status: "warm" },
        {
          name: "Tomas Reyes",
          company: "Northwind Audio",
          last_touch: "2026-04-25",
          status: "active",
        },
        { name: "Aki Sato", company: "Six Lab", last_touch: "2026-04-24", status: "cold" },
        { name: "Priya Nair", company: "Lampshade", last_touch: "2026-04-22", status: "warm" },
        {
          name: "Jonas Berg",
          company: "Bauhaus Bikes",
          last_touch: "2026-04-20",
          status: "active",
        },
      ],
      rowCount: 5,
      truncated: false,
      cached: false,
      summary: `5 most-recent contacts (matching “${goal}”). 2 active, 2 warm, 1 cold.`,
    }),
  },
  {
    match: (g) => /leaderboard|score|ranking/i.test(g),
    build: (goal) => ({
      kind: "ok",
      sql: "SELECT player, score, region\n  FROM hackathon_scores\n ORDER BY score DESC\n LIMIT 5;",
      rows: [
        { player: "axolotl-prime", score: 9412, region: "EU" },
        { player: "kestrel", score: 9180, region: "NA" },
        { player: "mochi-net", score: 8847, region: "APAC" },
        { player: "vela", score: 8214, region: "EU" },
        { player: "owl-club", score: 7902, region: "NA" },
      ],
      rowCount: 5,
      truncated: false,
      cached: false,
      summary: `Top 5 by score (matching “${goal}”).`,
    }),
  },
  {
    match: (g) => /feedback|inbox|tag/i.test(g),
    build: (goal) => ({
      kind: "ok",
      sql: "SELECT submitted_at, channel, body, tags\n  FROM feedback\n WHERE submitted_at > now() - interval '24 hours'\n ORDER BY submitted_at DESC\n LIMIT 5;",
      rows: [
        {
          submitted_at: "2026-04-27 09:14",
          channel: "email",
          body: "Tabbed code panel is great!",
          tags: "praise,onboarding",
        },
        {
          submitted_at: "2026-04-27 08:02",
          channel: "intercom",
          body: "Can't find sign-in",
          tags: "bug,nav",
        },
        {
          submitted_at: "2026-04-27 06:48",
          channel: "twitter",
          body: "Try not to feel like Postgres",
          tags: "perf",
        },
        {
          submitted_at: "2026-04-26 22:30",
          channel: "email",
          body: "Need a Python SDK",
          tags: "feature,sdk",
        },
        {
          submitted_at: "2026-04-26 19:11",
          channel: "email",
          body: "Demo broke after click",
          tags: "bug",
        },
      ],
      rowCount: 5,
      truncated: false,
      cached: false,
      summary: `Last 24h of feedback (matching “${goal}”). Mixed signal — 2 bug, 1 feature, 2 praise/observation.`,
    }),
  },
];

// Default fixture (no match → orders by drink). Mirrors the snippet
// shown on the marketing homepage so the rendered table matches the
// `<pre>` block one-for-one.
const DEFAULT_FIXTURE: DemoFixture["build"] = (goal) => ({
  kind: "ok",
  sql: "SELECT drink, COUNT(*) AS orders, ROUND(SUM(total), 2) AS revenue\n  FROM orders\n WHERE created_at > date_trunc('day', now())\n GROUP BY drink\n ORDER BY orders DESC;",
  rows: [
    { drink: "flat white", orders: 14, revenue: 64.4 },
    { drink: "cortado", orders: 11, revenue: 47.3 },
    { drink: "americano", orders: 9, revenue: 35.1 },
    { drink: "cold brew", orders: 8, revenue: 36.8 },
    { drink: "espresso", orders: 6, revenue: 19.2 },
    { drink: "latte", orders: 4, revenue: 18.0 },
  ],
  rowCount: 6,
  truncated: false,
  cached: false,
  summary: goal
    ? `Today's orders aggregated by drink (matching “${goal}”).`
    : "Today's orders aggregated by drink.",
});

export function buildDemoResult(goal: string): DemoResult {
  const base = pickFixture(goal);
  const filtered = applyGoalFilter(base.rows, base.sql, goal);
  return {
    ...base,
    rows: filtered.rows,
    rowCount: filtered.rows.length,
    sql: filtered.sql,
    summary: summaryFor(base.summary, goal, filtered.matched),
  };
}

function pickFixture(goal: string): DemoResult {
  for (const fixture of FIXTURES) {
    if (fixture.match(goal)) return fixture.build(goal);
  }
  return DEFAULT_FIXTURE(goal);
}

export interface RateLimiter {
  hit: (
    clientIp: string,
  ) => Promise<{ ok: true } | { ok: false; retryAfter: number; limit: number; count: number }>;
}

export function makeRateLimiter(kv: KVNamespace): RateLimiter {
  return {
    hit: async (clientIp) => {
      // Bucket per IP per window. Counter resets on TTL expiry — coarse
      // but cheap; matches the pattern in @nlqdb/api's other rate-limit
      // surfaces (auth, /v1/ask).
      const key = `${RATE_KEY_PREFIX}${clientIp}`;
      const current = Number((await kv.get(key)) ?? "0");
      if (current >= RATE_MAX_PER_WINDOW) {
        return {
          ok: false,
          retryAfter: RATE_WINDOW_SECONDS,
          limit: RATE_MAX_PER_WINDOW,
          count: current,
        };
      }
      await kv.put(key, String(current + 1), {
        expirationTtl: Math.max(RATE_WINDOW_SECONDS, KV_MIN_TTL_SECONDS),
      });
      return { ok: true };
    },
  };
}
