// SQL allow-list for `/v1/ask` plans (DESIGN §0.1, §1, §12).
//
// nlqdb is **schemas-only-widen**: the LLM is never allowed to emit
// schema-narrowing or destructive DDL/DML. Two-stage validation:
//
//   1. Leading-verb gate (regex) — fast, catches every DDL we reject.
//      node-sql-parser doesn't understand all PG-specific destructive
//      variants (DROP MATERIALIZED VIEW, VACUUM, …) so the regex gate
//      is the authoritative reject path.
//   2. AST check — node-sql-parser parses what passes the gate, so the
//      DELETE-without-WHERE rule runs against a real AST instead of a
//      brittle regex on the SQL string.

import { Parser } from "node-sql-parser";

export type SqlValidationResult =
  | { ok: true }
  | { ok: false; reason: SqlRejectReason; matched?: string };

export type SqlRejectReason =
  | "drop_statement"
  | "truncate_statement"
  | "delete_without_where"
  | "grant_or_revoke"
  | "disallowed_verb"
  | "empty";

const REJECT_VERBS: Array<[RegExp, SqlRejectReason]> = [
  [/^\s*drop\b/i, "drop_statement"],
  [/^\s*truncate\b/i, "truncate_statement"],
  [/^\s*grant\b/i, "grant_or_revoke"],
  [/^\s*revoke\b/i, "grant_or_revoke"],
  // ALTER is rejected outright — the only flavor we'd want is
  // ALTER TABLE … ADD COLUMN (schema widen), but we have no way to
  // tell from the LLM that the broader DDL is intentional. Bucket
  // under drop_statement since DROP is the user-visible failure mode.
  [/^\s*alter\b/i, "drop_statement"],
];

const ALLOWED_LEADING = new Set([
  "select",
  "insert",
  "update",
  "delete",
  "with",
  "explain",
  "show",
]);

const parser = new Parser();

export function validateSql(rawSql: string): SqlValidationResult {
  const sql = rawSql.trim();
  if (!sql) return { ok: false, reason: "empty" };

  for (const [pattern, reason] of REJECT_VERBS) {
    if (pattern.test(sql)) return { ok: false, reason };
  }

  const leading = sql.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!ALLOWED_LEADING.has(leading)) {
    return { ok: false, reason: "disallowed_verb", matched: leading };
  }

  // DELETE-without-WHERE — only meaningful AST check on the allow-list.
  // The parser may not handle every dialect quirk; fall back to a
  // simple `\bwhere\b` regex on parse failure.
  if (leading === "delete") {
    try {
      const ast = parser.astify(sql, { database: "PostgreSQL" });
      const node = (Array.isArray(ast) ? ast[0] : ast) as { type?: string; where?: unknown };
      if (node?.type === "delete" && !node.where) {
        return { ok: false, reason: "delete_without_where" };
      }
    } catch {
      if (!/\bwhere\b/i.test(sql)) return { ok: false, reason: "delete_without_where" };
    }
  }

  return { ok: true };
}
