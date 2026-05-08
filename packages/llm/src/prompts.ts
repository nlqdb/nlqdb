// System prompts for each operation. Intentionally placeholder-grade —
// Slice 6 (`/v1/ask` E2E) tunes them with real schemas, few-shot
// examples, and prompt-cache discipline (docs/architecture.md §8 cost-control rule 3).
// Prompts live here so every provider reuses the same shape.

import type {
  ClassifyRequest,
  DisambiguateRequest,
  EngineClassifyRequest,
  PlanRequest,
  SummarizeRequest,
} from "./types.ts";

export const CLASSIFY_SYSTEM = [
  "You classify a user utterance into one of four intents:",
  '- "create": the user wants to create a new database or schema ("a blog db", "db named messages", "tracker for my orders").',
  '- "data_query": read-only data lookup against an existing db (SELECT, aggregate, filter).',
  '- "meta": schema / metadata question about an existing db ("what tables do I have", "describe X").',
  '- "destructive": write or destructive op against an existing db (INSERT, UPDATE, DELETE, DROP).',
  'Respond with strict JSON: {"intent":"<one of the four>","confidence":<0-1 float>}.',
  "No prose, no code fences.",
].join("\n");

export const PLAN_SYSTEM = [
  "You translate a natural-language goal into a single SQL statement for the named dialect.",
  "Use the provided schema; do not invent tables or columns.",
  'Respond with strict JSON: {"sql":"<single SQL statement, no trailing semicolon>"}.',
  "No prose, no code fences, no explanation.",
].join("\n");

export const SUMMARIZE_SYSTEM = [
  "You summarize a small result set in plain English, in 1–3 sentences.",
  "Quote concrete numbers and named entities. No code blocks, no markdown.",
].join("\n");

// Engine classifier system prompt (SK-DB-010 / SK-MULTIENG-002). The
// table below is embedded VERBATIM from
// `docs/features/multi-engine-adapter/FEATURE.md` SK-MULTIENG-002 — the
// FEATURE.md is the canonical source. Adding a new engine = add a row
// there, ship an adapter, then update this prompt to match.
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

export const DISAMBIGUATE_SYSTEM = [
  "You pick which of a user's existing databases best matches their goal.",
  "Inputs: a natural-language goal and a list of candidate databases (id + slug, sometimes a schema fingerprint).",
  "Pick the most likely match by reading the slug semantically — slugs are kebab-case names like 'orders-tracker-a4f', 'support-tickets-9xy'.",
  'If no candidate is a clear match, return {"chosenId":null,...} and explain why in one short sentence.',
  'Respond with strict JSON: {"chosenId":"<id-from-list-or-null>","confidence":<0-1 float>,"reason":"<one short sentence>"}.',
  "No prose outside JSON, no code fences.",
].join("\n");

export function buildClassifyUser(req: ClassifyRequest): string {
  return `Utterance: ${req.utterance}`;
}

export function buildPlanUser(req: PlanRequest): string {
  return [`Dialect: ${req.dialect}`, `Schema:\n${req.schema}`, `Goal: ${req.goal}`].join("\n\n");
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

export function buildDisambiguateUser(req: DisambiguateRequest): string {
  // Cap the candidate list defensively — the API hot path will rarely
  // hit this, but a runaway tenant with hundreds of DBs shouldn't blow
  // the cheap-tier prompt budget.
  const trimmed = req.candidates.slice(0, 25).map((c) => ({
    id: c.id,
    slug: c.slug,
    ...(c.schemaHash ? { schemaHash: c.schemaHash } : {}),
  }));
  return [`Goal: ${req.goal}`, `Candidates (JSON):\n${JSON.stringify(trimmed)}`].join("\n\n");
}
