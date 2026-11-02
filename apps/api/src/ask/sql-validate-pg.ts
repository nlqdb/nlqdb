// Postgres's own parser as the authority over `validateSql` (SK-SQLAL-009).
//
// `validateSql` walks node-sql-parser's AST, but Postgres runs the SQL, and
// where the two read the text differently the walk checks a query Postgres
// never runs (2026-11-01: `SELECT 'a\'; RESET ROLE; …` was one SELECT to
// node-sql-parser and three statements to Postgres). So every statement that
// passes `validateSql` is re-parsed with libpg_query, Postgres's real parser,
// and must agree on the facts the gates act on — fail closed on any mismatch:
//
//   1. exactly one statement;
//   2. its kind is the one its leading verb names (a SELECT is a SelectStmt);
//   3. it writes exactly when `containsWriteVerb` says so — the read-only
//      gates (`SK-APIKEYS-003`, `SK-TRUST-001`, grants) all key off that;
//   4. no `DISALLOWED_FUNCTIONS` call, no `SELECT … INTO`, no DELETE / UPDATE
//      without WHERE, no EXPLAIN ANALYZE — the rules `validateSql` enforces.
//
// The WASM loads once per isolate, on the first statement validated.

import type { FuncCall, Node, RawStmt } from "libpg-query";
import {
  containsWriteVerb,
  DISALLOWED_FUNCTIONS,
  leadingVerb,
  type SqlRejectReason,
  type SqlValidationResult,
  stripLeadingComments,
  validateSql,
} from "./sql-validate.ts";

const WRITES = new Set(["InsertStmt", "UpdateStmt", "DeleteStmt", "MergeStmt"]);
// The statement kinds each allowed leading verb may parse to. `WITH` heads a
// write too (`WITH x AS (…) DELETE …`).
const KINDS: Record<string, ReadonlySet<string>> = {
  select: new Set(["SelectStmt"]),
  with: new Set(["SelectStmt", "InsertStmt", "UpdateStmt", "DeleteStmt"]),
  insert: new Set(["InsertStmt"]),
  update: new Set(["UpdateStmt"]),
  delete: new Set(["DeleteStmt"]),
  show: new Set(["VariableShowStmt"]),
  explain: new Set(["ExplainStmt"]),
};

export async function validateSqlPg(rawSql: string): Promise<SqlValidationResult> {
  const base = validateSql(rawSql);
  if (!base.ok) return base;
  const reason = await disagreement(rawSql);
  return reason ? { ok: false, reason } : base;
}

// Why Postgres's reading of an already-validated statement is rejected, or null.
export async function disagreement(rawSql: string): Promise<SqlRejectReason | null> {
  const { loadModule, parseSync } = await import("./libpg-query-worker.ts");
  await loadModule();
  let stmts: RawStmt[];
  try {
    stmts = (parseSync(rawSql) as { stmts?: RawStmt[] }).stmts ?? [];
  } catch {
    return "parse_failed";
  }
  if (stmts.length !== 1) return "multi_statement";
  const stmt = (stmts[0]?.stmt ?? {}) as Record<string, unknown>;
  const kind = Object.keys(stmt)[0] ?? "";
  const leading = leadingVerb(stripLeadingComments(rawSql.trim()));
  if (!KINDS[leading]?.has(kind)) return "disallowed_verb";
  // EXPLAIN plans its statement without running it; only ANALYZE runs it.
  if (kind === "ExplainStmt") {
    const options = (stmt["ExplainStmt"] as { options?: Node[] }).options ?? [];
    const analyze = options.some((o) =>
      /^analy[sz]e$/i.test((o as { DefElem?: { defname?: string } }).DefElem?.defname ?? ""),
    );
    return analyze ? "disallowed_verb" : null;
  }
  const facts = { writes: false, hit: null as SqlRejectReason | null };
  walk(stmt, facts);
  if (facts.hit) return facts.hit;
  return facts.writes === containsWriteVerb(rawSql) ? null : "parse_failed";
}

function walk(node: unknown, facts: { writes: boolean; hit: SqlRejectReason | null }): void {
  if (facts.hit || node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, facts);
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (WRITES.has(key)) facts.writes = true;
    const body = (value ?? {}) as Record<string, unknown>;
    if ((key === "DeleteStmt" || key === "UpdateStmt") && !body["whereClause"]) {
      facts.hit = key === "DeleteStmt" ? "delete_without_where" : "update_without_where";
    } else if (key === "SelectStmt" && body["intoClause"]) {
      facts.hit = "disallowed_verb";
    } else if (key === "FuncCall" && isDisallowed(value as FuncCall)) {
      facts.hit = "disallowed_function";
    }
    walk(value, facts);
  }
}

// `pg_sleep` or `pg_catalog.pg_sleep`: the unqualified name decides.
function isDisallowed(fc: FuncCall): boolean {
  const parts = (fc.funcname ?? []).map(
    (seg) => (seg as { String?: { sval?: string } }).String?.sval?.toLowerCase() ?? "",
  );
  return DISALLOWED_FUNCTIONS.has(parts.at(-1) ?? "");
}
