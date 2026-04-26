// SQL allow-list for `/v1/ask` plans (DESIGN §0.1, §1, §12; PERFORMANCE
// §4 row 6 nlqdb.sql.validate span).
//
// nlqdb is **schemas-only-widen**: the LLM is never allowed to emit
// schema-narrowing or destructive DDL/DML. The product escape for a
// genuinely incompatible schema is `nlq new` (DESIGN §12) — a fresh
// DB, not a destructive ALTER on the existing one.
//
// Reject-list:
//   - DROP TABLE / DROP COLUMN / DROP INDEX / DROP …
//   - TRUNCATE
//   - DELETE without a WHERE clause (full-table wipe)
//   - ALTER … DROP COLUMN (schema narrowing)
//   - GRANT / REVOKE (auth surface, not data)
//   - Anything outside the allow-listed leading verb set.
//
// Allow-list (leading verb): SELECT, INSERT, UPDATE (with WHERE),
// DELETE (with WHERE), WITH (CTE-led SELECT/INSERT/UPDATE), EXPLAIN,
// SHOW (read-only metadata).
//
// Implementation: lightweight regex over the trimmed, lower-cased SQL.
// Not a full parser — that's overkill for the LLM-emitted shape — but
// matches the patterns the reject list cares about. A future tightening
// can swap in `pg-query-emscripten` (~280KB) once we hit a false
// positive or false negative that justifies the bundle cost.

export type SqlValidationResult =
  | { ok: true }
  | { ok: false; reason: SqlRejectReason; matched?: string };

export type SqlRejectReason =
  | "drop_statement"
  | "truncate_statement"
  | "delete_without_where"
  | "alter_drop_column"
  | "grant_or_revoke"
  | "disallowed_verb"
  | "empty";

const ALLOWED_LEADING_VERBS = ["select", "insert", "update", "delete", "with", "explain", "show"];

export function validateSql(rawSql: string): SqlValidationResult {
  const sql = rawSql.trim();
  if (!sql) return { ok: false, reason: "empty" };

  const lower = sql.toLowerCase();

  // GRANT / REVOKE — auth surface, never legitimate from the planner.
  if (/^\s*(grant|revoke)\b/.test(lower)) {
    return { ok: false, reason: "grant_or_revoke" };
  }

  // DROP anything (table, column, index, schema, view, function, trigger…).
  // Both `DROP TABLE` and `ALTER TABLE … DROP COLUMN` patterns.
  if (
    /\bdrop\s+(table|column|index|schema|view|function|trigger|database|materialized\s+view)\b/.test(
      lower,
    )
  ) {
    return { ok: false, reason: "drop_statement" };
  }

  // ALTER … DROP COLUMN specifically (schema narrowing).
  if (/\balter\s+table\b[\s\S]*\bdrop\s+column\b/.test(lower)) {
    return { ok: false, reason: "alter_drop_column" };
  }

  // TRUNCATE — full-table wipe.
  if (/^\s*truncate\b/.test(lower)) {
    return { ok: false, reason: "truncate_statement" };
  }

  // DELETE without WHERE — full-table wipe via DELETE.
  if (/^\s*delete\s+from\b/.test(lower) && !/\bwhere\b/.test(lower)) {
    return { ok: false, reason: "delete_without_where" };
  }

  // Leading verb must be on the allow-list.
  const leadingVerb = lower.split(/\s+/)[0];
  if (!leadingVerb || !ALLOWED_LEADING_VERBS.includes(leadingVerb)) {
    return { ok: false, reason: "disallowed_verb", matched: leadingVerb };
  }

  return { ok: true };
}
