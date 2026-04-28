// SQL allow-list for `/v1/ask` read/write plans (DESIGN §3.6.5).
//
// This validator covers the read/write path only. DDL (CREATE/ALTER)
// goes through the typed-plan pipeline at DESIGN §3.6.2 — the LLM
// emits a typed JSON plan, our deterministic compiler emits the SQL,
// and a separate Zod-plan + libpg_query parse is the validator.
// CREATE rejection in *this* file is therefore correct: when called
// from `/v1/ask`, the LLM has zero legitimate reason to emit DDL.
//
// nlqdb is **layered guardrails**, not single-rule (lesson from the
// Replit incident — see docs/research-receipts.md §1: three
// guardrails active and still lost data). Three-stage validation here:
//
//   1. Leading-verb gate (regex) — fast, catches every destructive
//      verb at position 0. node-sql-parser doesn't understand all
//      PG-specific destructive variants (DROP MATERIALIZED VIEW,
//      VACUUM, …) so the regex gate is the authoritative reject
//      path for the common shape.
//   2. AST parse — anything that passed the gate goes through
//      node-sql-parser. We walk the result for any embedded
//      destructive verb (DROP / TRUNCATE / GRANT / REVOKE / ALTER /
//      CREATE) — catches the `WITH x AS (DROP TABLE foo) SELECT 1`
//      pattern where leading-verb regex alone gives a false pass.
//   3. AST checks — DELETE without WHERE rejected.
//
// Parse failures do NOT fall through to allow — the LLM produced
// something we can't reason about, so reject. (Earlier behavior was
// "allow on parse failure"; tightened here so layered defense actually
// holds.)
//
// Postgres-specific guardrails this validator does NOT cover, which
// MUST be applied at other layers (DESIGN §3.6.5, research-receipts §10):
//   - Role-level isolation (`pg_read_all_data`, search_path scoping)
//     — applied at the Neon connection pool, not here.
//   - Row-Level Security policies — applied per-schema by the
//     provisioner.
//   - Statement timeout, EXPLAIN cost cap, transactional wrapper —
//     applied by the executor in `apps/api/src/ask/orchestrate.ts`.
//   - Side-effecting function rejection (`pg_sleep`, `dblink`,
//     `lo_import`, `pg_read_file`, `COPY ... FROM PROGRAM`) — TODO
//     to add as an AST function-name walk; tracked in IMPLEMENTATION.md.

import { Parser } from "node-sql-parser";

export type SqlValidationResult =
  | { ok: true }
  | { ok: false; reason: SqlRejectReason; matched?: string };

export type SqlRejectReason =
  | "drop_statement"
  | "truncate_statement"
  | "delete_without_where"
  | "grant_or_revoke"
  | "alter_statement"
  | "disallowed_verb"
  | "parse_failed"
  | "empty";

// Verbs that get an early, attributed reject before the AST walk.
// Keyed by the resolved leading-verb token (lowercase).
const LEADING_VERB_REJECT: Record<string, SqlRejectReason> = {
  drop: "drop_statement",
  truncate: "truncate_statement",
  grant: "grant_or_revoke",
  revoke: "grant_or_revoke",
  alter: "alter_statement",
  vacuum: "disallowed_verb",
  create: "disallowed_verb",
};

const ALLOWED_LEADING = new Set([
  "select",
  "insert",
  "update",
  "delete",
  "with",
  "explain",
  "show",
]);

// EXPLAIN ANALYZE actually executes the wrapped statement on Postgres
// (and unlike plain EXPLAIN, has destructive side-effects when the
// inner statement is DML). Rejected outright; plain EXPLAIN passes.
// Matches `EXPLAIN ANALYZE …` and `EXPLAIN (ANALYZE …) …`.
const EXPLAIN_ANALYZE = /^explain\s*(?:\(\s*[^)]*\banalyze\b|analyze\b)/i;

// Embedded-verb mapping for the AST walk. Same buckets as the
// leading-verb reject map but keyed by the AST `type` string
// node-sql-parser produces.
const EMBEDDED_REJECT: Record<string, SqlRejectReason> = {
  drop: "drop_statement",
  truncate: "truncate_statement",
  grant: "grant_or_revoke",
  revoke: "grant_or_revoke",
  alter: "alter_statement",
  create: "disallowed_verb",
};

// node-sql-parser is sync and the JS event loop in Workers is single-
// threaded, so a module-scoped Parser is safe across concurrent
// `astify()` calls today. If a future await ever lands inside the
// parser path, this needs an instance-per-request (or a pool).
const parser = new Parser();

// Strip leading SQL comments (`-- …\n` line comments and `/* … */`
// block comments, possibly nested inside whitespace) so the leading-
// verb gate sees the actual first token, not a comment artifact.
function stripLeadingComments(sql: string): string {
  let s = sql;
  for (;;) {
    const next = s.replace(/^\s+/, "");
    if (next.startsWith("--")) {
      const nl = next.indexOf("\n");
      s = nl === -1 ? "" : next.slice(nl + 1);
      continue;
    }
    if (next.startsWith("/*")) {
      const end = next.indexOf("*/");
      s = end === -1 ? "" : next.slice(end + 2);
      continue;
    }
    return next;
  }
}

// Pull the first SQL keyword token out of the (already-comment-stripped)
// statement. Tolerates leading parens (`(SELECT …)`) and inline comments
// directly after the verb (`WITH/*c*/x AS …`, `EXPLAIN(ANALYZE) …`).
function leadingVerb(sql: string): string {
  const head = sql.replace(/^\(+\s*/, "");
  return (head.match(/^[a-z_][a-z_0-9]*/i)?.[0] ?? "").toLowerCase();
}

export function validateSql(rawSql: string): SqlValidationResult {
  const sql = stripLeadingComments(rawSql.trim());
  if (!sql) return { ok: false, reason: "empty" };

  const leading = leadingVerb(sql);

  const directReject = LEADING_VERB_REJECT[leading];
  if (directReject) return { ok: false, reason: directReject };

  if (!ALLOWED_LEADING.has(leading)) {
    return { ok: false, reason: "disallowed_verb", matched: leading };
  }

  // EXPLAIN ANALYZE / EXPLAIN (ANALYZE) execute the wrapped statement.
  // Reject before the SHOW/EXPLAIN short-circuit; plain EXPLAIN is fine.
  if (EXPLAIN_ANALYZE.test(sql)) {
    return { ok: false, reason: "disallowed_verb", matched: "explain_analyze" };
  }

  // SHOW + plain EXPLAIN are read-only by definition. node-sql-parser
  // refuses both ("not supported"); short-circuit instead of demanding
  // a parse.
  if (leading === "show" || leading === "explain") return { ok: true };

  let asts: AstNode[];
  try {
    const parsed = parser.astify(sql, { database: "PostgreSQL" }) as unknown as AstNode | AstNode[];
    asts = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return { ok: false, reason: "parse_failed" };
  }

  for (const root of asts) {
    const embedded = walkForRejected(root);
    if (embedded) return { ok: false, reason: embedded };
  }

  return { ok: true };
}

type AstNode = { [k: string]: unknown };

// Recursively walks the AST for any rejected pattern:
//   • a `type` matching EMBEDDED_REJECT (drop / truncate / grant / …)
//   • a `delete` statement with no `where` (catches both top-level and
//     CTE-embedded `WITH x AS (DELETE FROM foo) SELECT 1`, which PG
//     happily executes the destructive DELETE for)
//
// The walk traverses arrays + nested objects but skips primitive leaves
// — keeps it O(nodes) without descending into string positions / line
// numbers / other parser metadata.
//
// Statement-shape gate: a node-sql-parser DDL statement node always
// carries a `keyword` sibling (e.g. `{type:"drop", keyword:"table"}`).
// Expression nodes that happen to share a type string (hypothetically a
// future `type:"create"` for a CREATE-USER expression) wouldn't, so
// requiring `keyword` here keeps the walk from false-rejecting on
// grammar evolution.
function walkForRejected(node: unknown): SqlRejectReason | null {
  if (node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = walkForRejected(item);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = typeof obj["type"] === "string" ? (obj["type"] as string).toLowerCase() : null;
  if (type && EMBEDDED_REJECT[type] && "keyword" in obj) {
    return EMBEDDED_REJECT[type] ?? null;
  }
  // DELETE-without-WHERE check applies anywhere in the tree —
  // `from`/`table` (or `name`) presence is the marker that this is a
  // statement node, not an expression that happens to be `type:"delete"`.
  if (type === "delete" && !obj["where"] && ("from" in obj || "table" in obj || "name" in obj)) {
    return "delete_without_where";
  }
  for (const value of Object.values(obj)) {
    const hit = walkForRejected(value);
    if (hit) return hit;
  }
  return null;
}
