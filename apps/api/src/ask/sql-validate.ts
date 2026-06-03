// SQL allow-list for `/v1/ask` read/write plans (docs/architecture.md §3.6.5).
//
// This validator covers the read/write path only. DDL (CREATE/ALTER)
// goes through the typed-plan pipeline at docs/architecture.md §3.6.2 — the LLM
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
// MUST be applied at other layers (docs/architecture.md §3.6.5, research-receipts §10):
//   - Role-level isolation (`pg_read_all_data`, search_path scoping)
//     — applied at the Neon connection pool, not here.
//   - Row-Level Security policies — applied per-schema by the
//     provisioner.
//   - Statement timeout, EXPLAIN cost cap, transactional wrapper —
//     the executor's job (still unwired; tracked in db-adapter).
//   - `COPY ... FROM PROGRAM` and friends — `copy` isn't in
//     ALLOWED_LEADING, so the leading-verb gate already rejects it.
//
// Side-effecting function rejection (`pg_sleep`, `dblink`, `lo_import`,
// `pg_read_file`, …) IS covered here, via the AST function-name walk
// (SK-SQLAL-008 / GLOBAL-033): Neon's non-superuser role blocks the
// file/program functions at the PG level, but `pg_sleep` is callable by
// any role and no other active layer catches it — one plan could pin a
// connection for an hour. Layered guardrails (research-receipts §1) over
// trusting a single control.

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
  | "disallowed_function"
  | "multi_statement"
  | "parse_failed"
  | "empty";

// SK-EVENTS-010 / GLOBAL-024 — reasons that signal "user requested DDL
// via /v1/ask" (the LLM emitted a DDL verb on the query path). Co-located
// with `SqlRejectReason` so the demand-signal set cannot drift from the
// validator: a new DDL-class reason MUST be added here at the same time
// it's added to the union above. Non-DDL reasons (`parse_failed`,
// `empty`, `delete_without_where`) are LLM-quality or write-safety
// signals, not feature requests — they're deliberately excluded.
//
// Internally typed as `Set<SqlRejectReason>` so the array literal is
// exhaustiveness-checked; exposed as `ReadonlySet<string>` so callers
// with `AskError.reason: string` can `.has()` it without a cast.
export const DDL_REJECT_REASONS: ReadonlySet<string> = new Set<SqlRejectReason>([
  "drop_statement",
  "truncate_statement",
  "alter_statement",
  "grant_or_revoke",
  "disallowed_verb",
]);

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

// Side-effecting functions rejected anywhere in the tree (SK-SQLAL-008).
// `pg_sleep*` is a connection-pinning DoS callable by any role; the rest
// are server-side file / network IO that Neon's non-superuser role
// already blocks at the PG level — listed here as defense-in-depth so
// the reject is attributed (`disallowed_function`) rather than surfacing
// as a raw Postgres permission error.
const DISALLOWED_FUNCTIONS = new Set([
  "pg_sleep",
  "pg_sleep_for",
  "pg_sleep_until",
  "dblink",
  "dblink_exec",
  "dblink_connect",
  "lo_import",
  "lo_export",
  "pg_read_file",
  "pg_read_binary_file",
  "pg_ls_dir",
  "pg_stat_file",
  "pg_logical_emit_message",
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
// Exported so `/v1/run`'s pk_live gate uses the SAME normalization the
// validator uses — `/* x */ INSERT ...` must reach both as `INSERT`,
// otherwise pk_live could smuggle writes past the orchestrator gate
// while the validator allows the verb.
export function stripLeadingComments(sql: string): string {
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
// Exported alongside `stripLeadingComments` for `/v1/run` — see above.
export function leadingVerb(sql: string): string {
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

  // Multi-statement reject (SK-SQLAL-009). `SELECT 1; DELETE FROM x
  // WHERE id=1` parses as two sibling statements; the per-statement
  // walk below would clear each one, so a benign-looking lead statement
  // can smuggle a second. A plan is exactly one statement — fail closed.
  if (asts.length > 1) return { ok: false, reason: "multi_statement" };

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
  // Side-effecting function calls (SK-SQLAL-008). node-sql-parser tags a
  // call as type:"function"/"aggr_func"; the name lives under `name` as
  // either a bare string or a `{name:[{value}]}` node depending on
  // version, so test every string leaf under `name`.
  if ((type === "function" || type === "aggr_func") && containsDisallowedFunction(obj["name"])) {
    return "disallowed_function";
  }
  for (const value of Object.values(obj)) {
    const hit = walkForRejected(value);
    if (hit) return hit;
  }
  return null;
}

function containsDisallowedFunction(nameNode: unknown): boolean {
  if (typeof nameNode === "string") return DISALLOWED_FUNCTIONS.has(nameNode.toLowerCase());
  if (Array.isArray(nameNode)) return nameNode.some(containsDisallowedFunction);
  if (nameNode && typeof nameNode === "object") {
    return Object.values(nameNode as Record<string, unknown>).some(containsDisallowedFunction);
  }
  return false;
}
