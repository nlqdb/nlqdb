// System prompts for each operation. Intentionally placeholder-grade —
// Slice 6 (`/v1/ask` E2E) tunes them with real schemas, few-shot
// examples, and prompt-cache discipline (docs/architecture.md §8 cost-control rule 3).
// Prompts live here so every provider reuses the same shape.

import type {
  EngineClassifyRequest,
  PlanRequest,
  RouteRequest,
  SummarizeRequest,
} from "./types.ts";

// SK-LLM-018 — schema-fidelity directives + dialect-strict output. The
// schema-link / verbatim-casing bullets target the BIRD-dev free-chain
// gap (DIN-SQL arXiv:2304.11015, C3-SQL arXiv:2307.07306, DAIL-SQL
// arXiv:2308.15363 all show schema-link prompts ≈+3–5 pp on small
// models). The `Evidence:` bullet leverages BIRD's annotator hints that
// the runner already concatenates into the goal.
export const PLAN_SYSTEM = [
  "You translate a natural-language goal into a single SQL statement for the named dialect.",
  "Use only tables and columns that appear literally in the provided schema; preserve identifier casing exactly.",
  "When the goal includes an `Evidence:` block, treat it as authoritative annotator context — apply the formulas and column hints it names.",
  "Emit SQL valid for the named dialect — no cross-dialect features (e.g. no TOP for sqlite; no LIMIT for tsql).",
  'Respond with strict JSON: {"sql":"<single SQL statement, no trailing semicolon>"}.',
  "No prose, no code fences, no explanation.",
].join("\n");

export const SUMMARIZE_SYSTEM = [
  "You summarize a small result set in plain English, in 1–3 sentences.",
  "Quote concrete numbers and named entities. No code blocks, no markdown.",
].join("\n");

// Engine-fit table is canonical in `docs/features/multi-engine-adapter/FEATURE.md`
// SK-MULTIENG-002; engine slugs lowercased here to match the wire `Engine` literal.
export const ENGINE_CLASSIFY_SYSTEM = [
  "You pick which database engine best fits a user's goal for a new database.",
  "Choose from this engine-fit table (canonical in docs/features/multi-engine-adapter/FEATURE.md SK-MULTIENG-002):",
  "",
  "| Engine | Strong fit | Avoid when | Free-tier ceiling |",
  "|---|---|---|---|",
  '| **postgres** (Neon) | OLTP ≤ 500 GB; relational joins / FK / ACID; mixed read+write; tables ≤ ~200 M rows; default for "tracker / app data" goals | aggregation over 100 M+ events; pure append-only analytics; sub-ms KV | 0.5 GB / project (shared across schemas) |',
  "| **clickhouse** (Tinybird) | analytics, time-series, append-heavy; aggregations over millions–billions of events; high-cardinality dimensions; real-time dashboards; 10–100× PG on `GROUP BY` | row-by-row OLTP updates; small mixed read/write; FK-enforced relational | 10 GB + 1 k reads/day; writes don't count |",
  "| **sqlite** (Cloudflare D1, *deferred*) | read-heavy (>90 %) per-tenant DBs; thousands of small isolated DBs; edge-local sub-ms reads; content/catalog | sustained writes (≥ 100 wps cap); cross-tenant joins | 50 k DBs / account × 10 GB each |",
  "| **redis** (Upstash, *deferred*) | counters / rate-limit / session / leaderboard / cache; sub-ms KV at 50 k+ ops/s | tabular natural-language queries; analytical aggregates; relational joins | 500 k commands / month |",
  "",
  'Engines marked *deferred* are NOT shippable today — only return "postgres" or "clickhouse".',
  'Default to "postgres" for tracker / app-data / OLTP goals.',
  'Pick "clickhouse" only when the goal is clearly analytics / events / dashboard / time-series with high volume.',
  'Respond with strict JSON: {"engine":"postgres"|"clickhouse","confidence":<0-1 float>}.',
  "No prose, no code fences.",
].join("\n");

// Merged classifier + disambiguator prompt (SK-ASK-009). One cheap-
// tier call per `/v1/ask` cache-miss decides what to do with the
// goal: create a new database, query an existing one, or write to an
// existing one. Recent-table context is the load-bearing input — it's
// what lets the LLM tell "insert red and blue tables" (create) from
// "insert into red and blue" (write).
export const ROUTE_SYSTEM = [
  "You decide how to handle a user's natural-language goal against their database.",
  "You are given:",
  "- The user's databases (id, slug).",
  "- Tables they recently used in those databases (dbId, table).",
  "- The goal text.",
  "",
  "Decide:",
  '- "kind": "create" (the user wants a new database or new tables),',
  '          "query"  (read existing tables),',
  '          "write"  (insert/update/delete in existing tables).',
  '- "targetDbId": which database the goal refers to (null when kind="create").',
  '- "referencedTables": the tables the goal references (empty when kind="create").',
  "",
  "Rule: if the goal mentions tables that are NOT in any recent list AND",
  'no slug matches, treat it as "create" — the user wants to make those',
  "tables, not read/write them.",
  "",
  "Respond with strict JSON:",
  '{"kind":"create"|"query"|"write","targetDbId":<id or null>,',
  ' "referencedTables":[<strings>],"confidence":<0-1 float>,"reason":"<one short sentence>"}',
  "No prose, no code fences.",
].join("\n");

export function buildPlanUser(req: PlanRequest): string {
  const parts = [`Dialect: ${req.dialect}`, `Schema:\n${req.schema}`, `Goal: ${req.goal}`];
  if (req.previousAttempt) {
    // GLOBAL-022 + SK-LLM-018 — diagnostic-first retry framing: keep the
    // same goal, restrict to schema identifiers, change only what the
    // error names. "Produce a different shape" used to invite the model
    // to rewrite the whole approach when the root cause was a typo. SQL
    // capped at 500 chars so the prompt token budget stays predictable.
    const sql = req.previousAttempt.sql?.slice(0, 500) ?? "";
    parts.push(
      [
        "Previous attempt failed:",
        sql ? `SQL: ${sql}` : null,
        `Error: ${req.previousAttempt.error}`,
        "Re-plan to:",
        "- Answer the same Goal stated above (do not redefine the question).",
        "- Use only tables and columns from the Schema above.",
        "- Diagnose the error first, then change only what the error names — not the overall approach.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return parts.join("\n\n");
}

export function buildSummarizeUser(req: SummarizeRequest): string {
  // Truncate to keep prompts small — docs/architecture.md §8 cost rule. Summarization
  // over thousands of rows is a Slice 6+ concern (paginate first).
  const sample = req.rows.slice(0, 50);
  return [`Goal: ${req.goal}`, `Rows (JSON):\n${JSON.stringify(sample)}`].join("\n\n");
}

export function buildEngineClassifyUser(req: EngineClassifyRequest): string {
  return `Goal: ${req.goal}`;
}

export function buildRouteUser(req: RouteRequest): string {
  // Cap defensively. Recent-tables tail is unsorted but bounded by the
  // MRU producer (SK-ASK-010 / WS1, 100 entries); the dbset is bounded
  // by the per-tenant DB count (free tier caps far below 25).
  const dbs = req.dbs.slice(0, 25).map((d) => ({ id: d.id, slug: d.slug }));
  const recentTables = req.recentTables.slice(0, 100).map((t) => ({
    dbId: t.dbId,
    table: t.table,
  }));
  return [
    `Goal: ${req.goal}`,
    `Databases (JSON):\n${JSON.stringify(dbs)}`,
    `RecentTables (JSON):\n${JSON.stringify(recentTables)}`,
  ].join("\n\n");
}
