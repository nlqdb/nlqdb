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
// Rows deliberately span domains and dialects: masking is what lets a pool row
// written over `employees` help a goal over `students`, so a domain-varied pool
// is a feature, not noise.
//
// Each `payload` is rendered through `prompts.ts::planExample`, byte-identical to
// the static `SK-LLM-026` prefix's shape — a retrieved demonstration must look
// exactly like a static one. Pure data + zero runtime dependency; nothing in the
// production chain imports it yet (the `buildPlanUser` wiring stays behind the
// per-lever T9 ablation, `SK-LLM-041` §Alternatives), so the `SK-LLM-024`
// determinism invariant and the current baselines are untouched. The EX delta is
// the next canonical dispatch (`SK-QUAL-002`).

import { type SchemaExemplar, selectExemplarsForSchema } from "./few-shot-select.ts";
import { planExample } from "./prompts.ts";

// The structural classes the pool covers, named to match the `SK-QUAL-014`
// mismatch buckets so the offline probe can assert retrieval lands the bucket
// the goal needs.
export type PlanBucket =
  | "group-by-count"
  | "having"
  | "count-distinct"
  | "scalar-subquery"
  | "in-subquery"
  | "join-aggregate"
  | "group-max"
  | "null-safe-min"
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
    "null-safe-min",
    "postgres",
    "CREATE TABLE employees (id INTEGER, name TEXT, salary REAL)",
    "Which employee has the lowest salary? Return their name.",
    "SELECT name FROM employees WHERE salary IS NOT NULL ORDER BY salary ASC LIMIT 1",
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
export function retrievePlanExemplars(
  goal: string,
  goalSchema: string,
  k: number,
): PlanExemplar[] {
  return selectExemplarsForSchema(goal, goalSchema, PLAN_EXEMPLAR_POOL, k) as PlanExemplar[];
}
