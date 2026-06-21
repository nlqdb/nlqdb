// System prompts for each operation. Prompts live here so every provider
// reuses the same shape. The planner prompt carries schema-fidelity
// directives (SK-LLM-018) + result-shape directives (SK-LLM-027) +
// NULL-safe extremum (SK-LLM-029) + count-grain (SK-LLM-032) + static
// few-shot exemplars (SK-LLM-026); prompt-cache discipline is per
// docs/architecture.md §8 cost-control rule 3.

import { pruneSchemaForGoal } from "./schema-prune.ts";
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
//
// SK-LLM-027 — the two result-shape bullets (projection + REAL-cast)
// target execution-accuracy mismatches the schema-fidelity bullets don't:
// extra projected columns are a recognised EX failure even when the logic
// is correct (Open-SQL arXiv:2405.06674), and SQLite integer-truncates
// `int / int` so a ratio that should be fractional silently floors —
// BIRD's `Evidence:` ratio gold itself casts to REAL.
//
// SK-LLM-029 — the NULL-safe extremum bullet targets BIRD's dirty-data
// trait (arXiv:2305.03111): SQLite sorts NULL before every value, so an
// unfiltered `ORDER BY col ASC LIMIT 1` returns a NULL as a false minimum.
// `WHERE col IS NOT NULL` is the dialect-portable form gold uses (postgres
// defaults NULLS LAST, so the filter is also correct — never harmful — there).
//
// SK-LLM-032 — the count-grain bullet targets two named text-to-SQL error
// categories the projection / REAL-cast / extremum rules don't: "Wrong
// COUNT Object" (COUNT(*) where COUNT(DISTINCT key) is meant — e.g. counting
// entities across a one-to-many join that repeats them) and "Missing DISTINCT
// Keyword" (a non-aggregate SELECT returning duplicate rows) — both from the
// BIRD/Spider error study arXiv:2501.09310. The trailing "otherwise" guard
// keeps it from over-applying DISTINCT where duplicates are intended.
//
// SK-LLM-034 — the group-by-grain bullet targets "Unaligned Aggregation
// Structure" (E5 in the same arXiv:2501.09310 taxonomy), orthogonal to the
// SK-LLM-032 count-object rule: a "per/each/by <category>" goal needs a
// GROUP BY on that column so one row is returned per group — a missing
// GROUP BY collapses the answer to a single global aggregate (a cardinality
// mismatch that fails EX). The "one overall total ⇒ omit GROUP BY" guard and
// the "in an aggregate query" scope bound the inverse over-grouping regression;
// the non-aggregated-column rule is standard SQL and removes SQLite's
// arbitrary-row pick for bare columns (defined only for a lone MIN/MAX).
//
// SK-LLM-040 — the aggregate-filter bullet targets the *HAVING* half of the
// same "Unaligned Aggregation Structure" class (E5 in arXiv:2501.09310, which
// names "aggregate functions, GROUP BY clause, **and HAVING clause**"). T15
// (SK-LLM-034) covered the GROUP BY half (grouping cardinality); this covers
// the orthogonal HAVING half: a threshold on a *group's* aggregate
// (COUNT/SUM/AVG…) must live in HAVING after GROUP BY, not in WHERE. WHERE
// filters individual rows before aggregation and cannot reference an aggregate,
// so `WHERE COUNT(*) > 5` is a hard error (a wasted exec-retry round-trip,
// SK-ASK-013/022) and omitting the group filter entirely is a silent
// cardinality mismatch that fails EX. The "keep plain per-row predicates in
// WHERE" guard is the regression bound — it stops the rule pushing ordinary row
// filters into HAVING (which would scan/aggregate more rows for the same
// answer, a perf + correctness foothold).
//
// SK-LLM-035 — the numeric-text-cast bullet targets "Implicit Type Conversion"
// (C1 in the same arXiv:2501.09310 taxonomy), orthogonal to the SK-LLM-027
// REAL-cast-ratio rule: that rule casts an integer/integer *division* to avoid
// truncation; this rule fires when a column is *declared TEXT* but compared,
// ordered, or min/max'd numerically (SUM/AVG already coerce TEXT, so they are
// out of scope). SQLite gives a TEXT column text affinity and compares it
// lexicographically (so '100' < '9' and an ORDER BY/MIN/MAX mis-ranks; datatypes
// §3.1 + §4.2), silently returning a wrong result — BIRD's real-world schemas
// store numbers as text far more than Spider's clean ones, so the gain is
// BIRD-weighted. The "goal uses it numerically" scope bounds the regression: a
// numeric string and its number cast equal, and the clause keeps the cast off a
// semantically-textual column (zero-padded codes, currency strings).
export const PLAN_DIRECTIVES = [
  "You translate a natural-language goal into a single SQL statement for the named dialect.",
  "Use only tables and columns that appear literally in the provided schema; preserve identifier casing exactly.",
  "When the goal includes an `Evidence:` block, treat it as authoritative annotator context — apply the formulas and column hints it names.",
  "Select exactly the columns the goal asks for, and only those — extra id/name/descriptive columns change the result set and fail execution-accuracy.",
  "For a ratio or percentage of two integer columns, cast one operand to REAL (e.g. CAST(x AS REAL) / y) so the division is not integer-truncated.",
  "When the schema declares a column as TEXT but the goal compares, orders, or takes the min/max of it numerically, cast it to a number (CAST(<col> AS REAL)) — a TEXT column is compared lexicographically (so '100' sorts before '9' and a plain ORDER BY, >, or MIN/MAX mis-ranks); the cast is harmless when the values are already numeric.",
  "When selecting a single extreme row by ordering (ORDER BY <col> ... LIMIT), exclude NULLs in the ordered column (WHERE <col> IS NOT NULL) — a NULL is never the intended extreme value, and in SQLite a NULL sorts before every value, so an ascending LIMIT would return one as a false minimum.",
  "Count and list at the grain the goal asks for: use COUNT(DISTINCT <col>) — not COUNT(*) — when it asks how many distinct/different/unique entities, or when a one-to-many join repeats the counted rows; use SELECT DISTINCT when it asks for distinct values; otherwise use COUNT(*) / a plain SELECT so intended duplicates are kept.",
  "Match the aggregation grain to the goal: when it asks for an aggregate per group (per/for each/by <category>), GROUP BY that column and project it beside the aggregate so each group is one row; when it asks for one overall total, omit GROUP BY. In an aggregate query, every non-aggregated column in the SELECT must also appear in GROUP BY.",
  "Filter groups by an aggregate in HAVING, not WHERE: a threshold on a group's aggregate (e.g. groups having more than N rows, or whose SUM/AVG exceeds a value) belongs in a HAVING clause after GROUP BY, because WHERE filters individual rows before aggregation and cannot reference an aggregate; keep plain per-row predicates in WHERE.",
  "Emit SQL valid for the named dialect — no cross-dialect features (e.g. no TOP/PIVOT for postgres or sqlite; postgres-specific casts only when dialect is postgres).",
  'Respond with strict JSON: {"sql":"<single SQL statement, no trailing semicolon>"}.',
  "No prose, no code fences, no explanation.",
].join("\n");

// SK-LLM-026 — static few-shot exemplars (DAIL-SQL arXiv:2308.15363).
// Compact, dialect-portable Question→strict-JSON demonstrations of the
// PLAN_DIRECTIVES behaviours: schema-literal identifiers + verbatim casing
// (+ JOIN); `Evidence:` formula application with the SK-LLM-027 REAL cast
// for an integer ratio; minimal projection (COUNT(*) / a single requested
// column, never an extra id/name) plus the SK-LLM-029 NULL-safe extremum
// (`WHERE col IS NOT NULL` before an ascending `ORDER BY ... LIMIT 1`);
// dialect-strict output for the named dialect (the `Dialect:` line varies —
// sqlite then postgres — so the model sees it as a variable to honour);
// strict-JSON-no-semicolon shape (`JSON.stringify`-built, so valid by construction).
// Static (not similarity-retrieved) keeps it zero-dep and token-bounded —
// the retrieval gain is a separate future lever, and a fixed prefix is
// cache-friendly under SK-LLM-009.
// Exported so the retrieval pool (SK-LLM-041 `plan-exemplar-pool.ts`) renders
// each curated exemplar in the byte-identical Question→strict-JSON shape the
// static prefix uses — a retrieved demonstration must look exactly like a
// static one or the model sees two different formats.
export const planExample = (
  dialect: "sqlite" | "postgres",
  schema: string,
  goal: string,
  sql: string,
): string =>
  [`Dialect: ${dialect}`, "Schema:", schema, `Goal: ${goal}`, JSON.stringify({ sql })].join("\n");

// Few-shot header + assembler, shared by the static prefix and the SK-LLM-041
// retrieval ablation (`plan-exemplar-pool.ts::buildPlanSystem`) so a retrieved
// prefix is byte-identical in structure to the static one — header, blank
// line, then `planExample` payloads separated by a blank line.
export const PLAN_FEW_SHOT_HEADER = "Examples — match this exact input→output shape:";

export const fewShotBlock = (examples: string[]): string =>
  [PLAN_FEW_SHOT_HEADER, "", examples.join("\n\n")].join("\n");

export const PLAN_FEW_SHOT = fewShotBlock([
  planExample(
    "sqlite",
    'CREATE TABLE "Album" (AlbumId INTEGER, Title TEXT, ArtistId INTEGER); CREATE TABLE "Artist" (ArtistId INTEGER, Name TEXT)',
    "How many albums does the artist named 'Queen' have?",
    `SELECT COUNT(*) FROM "Album" AS T1 JOIN "Artist" AS T2 ON T1.ArtistId = T2.ArtistId WHERE T2.Name = 'Queen'`,
  ),
  planExample(
    "sqlite",
    "CREATE TABLE income (district_id INTEGER, residents INTEGER, total_income INTEGER)",
    "What is the income per resident in district 7?\nEvidence: income per resident = total_income / residents",
    "SELECT CAST(total_income AS REAL) / residents FROM income WHERE district_id = 7",
  ),
  planExample(
    "postgres",
    "CREATE TABLE products (id INTEGER, name TEXT, price REAL)",
    "Which product is the cheapest? Return its id.",
    "SELECT id FROM products WHERE price IS NOT NULL ORDER BY price ASC LIMIT 1",
  ),
]);

export const PLAN_SYSTEM = `${PLAN_DIRECTIVES}\n\n${PLAN_FEW_SHOT}`;

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
  // SK-LLM-037 — goal-relevant schema pruning. A retry gets the full
  // schema: the failed attempt is exactly the case where the pruned view
  // may have hidden the table the error names.
  const schema = req.previousAttempt ? req.schema : pruneSchemaForGoal(req.schema, req.goal);
  const parts = [`Dialect: ${req.dialect}`, `Schema:\n${schema}`, `Goal: ${req.goal}`];
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
