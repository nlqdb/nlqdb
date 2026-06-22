// SK-LLM-041 — curated plan-exemplar pool (DAIL-SQL retrieval half, the "pool
// rows" that `selectExemplarsForSchema` ranks; arXiv:2308.15363 §4.1).
//
// `few-shot-select.ts` ships the selection mechanism (question masking +
// masked-token Jaccard + schema-aware top-k) but explicitly leaves the pool
// rows themselves to be sourced. This is that pool — hand-authored, **not** the
// BIRD train split (which is an external, key-/download-gated dataset, not in
// the repo; a real embedding-indexed BIRD pool is the prod hot-path follow-on).
// Each row is a structurally-distinct demonstration of one shape, so the
// selector returns the demonstration whose *skeleton* matches the live goal
// rather than a one-size-fits-all prefix.
//
// The buckets are picked from evidence, not taste: `SK-QUAL-014` classified the
// BIRD mismatch mass as aggregation/DISTINCT **grain** + subquery **shape** +
// GROUP BY/HAVING, so every row below targets one of those structural classes.
// The `null-filter` row (13th) was added on a second evidence source — the
// persona-bench (`SK-QUAL-018`) ICP-retrieval probe (`tools/eval`): nlqdb's own
// "who never logged in" query retrieved the anti-join NOT-IN demo, the wrong
// shape for a plain `IS NULL` filter (ICP retrieval precision@1 18/20 → 19/20).
// Rows deliberately span domains and dialects: masking is what lets a pool row
// written over `employees` help a goal over `students`, so a domain-varied pool
// is a feature, not noise.
//
// Each `payload` is rendered through `prompts.ts::planExample`, byte-identical to
// the static `SK-LLM-026` prefix's shape — a retrieved demonstration must look
// exactly like a static one. `buildPlanSystem` (below) is the per-lever T9
// ablation that wires the pool into the provider chain: default-off (`k <= 0`)
// returns the static `PLAN_SYSTEM` byte-for-byte, so the `SK-LLM-024` determinism
// invariant and the current baselines stay untouched in prod; only the eval's
// `--retrieve-exemplars` dispatch turns it on. The EX delta is the next canonical
// dispatch (`SK-QUAL-002`).

import { type SchemaExemplar, selectExemplarsForSchema } from "./few-shot-select.ts";
import { fewShotBlock, PLAN_DIRECTIVES, PLAN_SYSTEM, planExample } from "./prompts.ts";

// The structural classes the pool covers, named to match the `SK-QUAL-014`
// mismatch buckets so the offline probe can assert retrieval lands the bucket
// the goal needs.
export type PlanBucket =
  | "group-by-count"
  | "having"
  | "count-distinct"
  | "scalar-subquery"
  | "in-subquery"
  | "anti-join"
  | "join-aggregate"
  | "group-max"
  | "group-order-limit"
  | "null-safe-min"
  | "null-filter"
  | "ratio-cast"
  | "date-range";

// A pool row: a `SchemaExemplar` (question + own schema + rendered payload) plus
// the bucket it demonstrates. `bucket` is metadata for the offline measurement
// only — the selector ranks on the masked question alone.
export type PlanExemplar = SchemaExemplar<string> & { bucket: PlanBucket };

const ex = (
  bucket: PlanBucket,
  dialect: "sqlite" | "postgres",
  schema: string,
  question: string,
  sql: string,
): PlanExemplar => ({
  bucket,
  question,
  schema,
  payload: planExample(dialect, schema, question, sql),
});

// The curated pool. One row per structural bucket; correct, dialect-portable
// SQL that obeys the PLAN_DIRECTIVES (schema-literal identifiers, minimal
// projection, NULL-safe extremum, REAL-cast ratios).
export const PLAN_EXEMPLAR_POOL: readonly PlanExemplar[] = [
  ex(
    "group-by-count",
    "sqlite",
    "CREATE TABLE employees (id INTEGER, name TEXT, department TEXT)",
    "How many employees are in each department?",
    "SELECT department, COUNT(*) FROM employees GROUP BY department",
  ),
  ex(
    "having",
    "postgres",
    "CREATE TABLE orders (id INTEGER, customer_id INTEGER, amount REAL)",
    "Which customers have placed more than 5 orders? Return the customer id.",
    "SELECT customer_id FROM orders GROUP BY customer_id HAVING COUNT(*) > 5",
  ),
  ex(
    "count-distinct",
    "sqlite",
    "CREATE TABLE customers (id INTEGER, name TEXT, city TEXT)",
    "How many distinct cities do customers come from?",
    "SELECT COUNT(DISTINCT city) FROM customers",
  ),
  ex(
    "scalar-subquery",
    "postgres",
    "CREATE TABLE products (id INTEGER, name TEXT, price REAL)",
    "List the names of products priced above the average price.",
    "SELECT name FROM products WHERE price > (SELECT AVG(price) FROM products)",
  ),
  ex(
    "in-subquery",
    "sqlite",
    "CREATE TABLE customers (id INTEGER, name TEXT);\nCREATE TABLE orders (id INTEGER, customer_id INTEGER)",
    "Which customers have placed an order? Return their name.",
    "SELECT name FROM customers WHERE id IN (SELECT customer_id FROM orders)",
  ),
  ex(
    // The negated twin of in-subquery: NOT IN over the FK, NULL-guarded so a
    // NULL in the subquery can't silently empty the result (the classic NOT IN
    // trap). Without this row a "never …" goal retrieves the *positive*
    // in-subquery demo — the un-negated shape, actively the wrong lesson.
    "anti-join",
    "sqlite",
    "CREATE TABLE customers (id INTEGER, name TEXT);\nCREATE TABLE orders (id INTEGER, customer_id INTEGER)",
    "Which customers have never placed an order? Return their name.",
    "SELECT name FROM customers WHERE id NOT IN (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL)",
  ),
  ex(
    "join-aggregate",
    "sqlite",
    "CREATE TABLE customers (id INTEGER, name TEXT);\nCREATE TABLE orders (id INTEGER, customer_id INTEGER, amount REAL)",
    "What is the total order amount for each customer? Return the customer name and total.",
    "SELECT T2.name, SUM(T1.amount) FROM orders AS T1 JOIN customers AS T2 ON T1.customer_id = T2.id GROUP BY T2.name",
  ),
  ex(
    "group-max",
    "postgres",
    "CREATE TABLE employees (id INTEGER, name TEXT, department TEXT, salary REAL)",
    "What is the highest salary in each department?",
    "SELECT department, MAX(salary) FROM employees GROUP BY department",
  ),
  ex(
    // Top-N of an aggregate (GROUP BY → ORDER BY agg → LIMIT) — distinct from
    // group-max (per-group extremum) and null-safe-min (whole-table extremum):
    // here the grain is "the group with the largest count". A "which X has the
    // most Y" goal otherwise retrieves group-by-count or group-max, neither of
    // which demonstrates the order-by-count-limit shape.
    "group-order-limit",
    "postgres",
    "CREATE TABLE employees (id INTEGER, name TEXT, department TEXT)",
    "Which department has the most employees? Return the department.",
    "SELECT department FROM employees GROUP BY department ORDER BY COUNT(*) DESC LIMIT 1",
  ),
  ex(
    "null-safe-min",
    "postgres",
    "CREATE TABLE employees (id INTEGER, name TEXT, salary REAL)",
    "Which employee has the lowest salary? Return their name.",
    "SELECT name FROM employees WHERE salary IS NOT NULL ORDER BY salary ASC LIMIT 1",
  ),
  ex(
    // "Never <did X>" where X is an **attribute of the row itself** (a NULL
    // timestamp/column) — the plain `WHERE col IS NULL` filter, NOT the
    // anti-join NOT-IN subquery. The two read identically as questions ("…have
    // never …"); the distinguishing token is the *verb* (logged in ⇒ a NULL
    // login column on the same table; placed an order ⇒ absence in a related
    // table ⇒ anti-join). Without this row the headline "who never logged in"
    // ICP query (personas.md §P1, persona-bench q3) retrieved the anti-join
    // NOT-IN demo — teaching a subquery over a table that does not exist.
    // Ordered after `anti-join` so an ambiguous "never <relation>" goal still
    // breaks the masked-Jaccard tie to anti-join (earliest pool index wins).
    "null-filter",
    "sqlite",
    "CREATE TABLE users (id INTEGER, name TEXT, last_login TEXT)",
    "Which users have never logged in? Return their name.",
    "SELECT name FROM users WHERE last_login IS NULL",
  ),
  ex(
    "ratio-cast",
    "sqlite",
    "CREATE TABLE regions (id INTEGER, sales INTEGER, population INTEGER)",
    "What are the sales per capita in region 3?\nEvidence: sales per capita = sales / population",
    "SELECT CAST(sales AS REAL) / population FROM regions WHERE id = 3",
  ),
  ex(
    "date-range",
    "sqlite",
    "CREATE TABLE orders (id INTEGER, order_date TEXT, amount REAL)",
    "How many orders were placed in 2023?",
    "SELECT COUNT(*) FROM orders WHERE order_date >= '2023-01-01' AND order_date < '2024-01-01'",
  ),
];

// Retrieve the `k` pool exemplars whose masked question skeleton is closest to
// the live goal, masked against the live schema — the `buildPlanUser` entry
// point the prod wiring will call once the T9 ablation clears it. Thin wrapper
// over `selectExemplarsForSchema` so callers don't import the pool + selector
// separately.
export function retrievePlanExemplars(goal: string, goalSchema: string, k: number): PlanExemplar[] {
  return selectExemplarsForSchema(goal, goalSchema, PLAN_EXEMPLAR_POOL, k) as PlanExemplar[];
}

// SK-LLM-041 half (b) — the per-lever T9 ablation. Build the planner SYSTEM
// prompt for one request: `k <= 0` (every production call — `retrieveExemplars`
// is unset) returns the static `PLAN_SYSTEM` byte-for-byte, so the `SK-LLM-024`
// greedy-decoding determinism invariant and the `SK-LLM-009` cache prefix are
// untouched in prod; `k > 0` (the eval's `--retrieve-exemplars` dispatch only)
// swaps the static `SK-LLM-026` 3-shot prefix for the `k` pool exemplars whose
// masked skeleton is closest to the goal, so the next canonical dispatch can
// A/B static-vs-retrieved few-shot and attribute the lever before prod adopts
// it (the prerequisite `SK-LLM-041` §Alternatives names). A goal that retrieves
// nothing (no structural overlap with any bucket) falls back to the static
// prefix — never an empty/degenerate few-shot block.
export function buildPlanSystem(goal: string, goalSchema: string, k: number): string {
  if (!Number.isFinite(k) || k <= 0) return PLAN_SYSTEM;
  const retrieved = retrievePlanExemplars(goal, goalSchema, k);
  if (retrieved.length === 0) return PLAN_SYSTEM;
  return `${PLAN_DIRECTIVES}\n\n${fewShotBlock(retrieved.map((e) => e.payload))}`;
}
