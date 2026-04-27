// SQL allow-list for `/v1/ask` plans (DESIGN §0.1, §1, §12).
//
// nlqdb is **schemas-only-widen**: the LLM is never allowed to emit
// schema-narrowing or destructive DDL/DML. Three-stage validation:
//
//   1. Leading-verb gate (regex) — fast, catches every DDL we reject
//      at position 0. node-sql-parser doesn't understand all PG-
//      specific destructive variants (DROP MATERIALIZED VIEW, VACUUM, …)
//      so the regex gate is the authoritative reject path for the
//      common shape.
//   2. AST parse — anything that passed the gate goes through
//      node-sql-parser. We walk the result for any embedded
//      destructive verb (DROP / TRUNCATE / GRANT / REVOKE / ALTER) —
//      catches the `WITH x AS (DROP TABLE foo) SELECT 1` pattern
//      where leading-verb regex alone gives a false pass.
//   3. AST checks — DELETE without WHERE rejected.
//
// Parse failures do NOT fall through to allow — the LLM produced
// something we can't reason about, so reject. (Earlier behavior was
// "allow on parse failure"; tightened here so layered defense actually
// holds.)

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
  | "parse_failed"
  | "empty";

const REJECT_VERBS: Array<[RegExp, SqlRejectReason]> = [
  [/^\s*drop\b/i, "drop_statement"],
  [/^\s*truncate\b/i, "truncate_statement"],
  [/^\s*grant\b/i, "grant_or_revoke"],
  [/^\s*revoke\b/i, "grant_or_revoke"],
  // ALTER is rejected outright. Bucket under drop_statement since DROP
  // is the user-visible failure mode.
  [/^\s*alter\b/i, "drop_statement"],
  [/^\s*vacuum\b/i, "disallowed_verb"],
  [/^\s*create\b/i, "disallowed_verb"],
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

// Embedded-verb mapping for the AST walk. Same buckets as REJECT_VERBS
// but keyed by the AST `type` string node-sql-parser produces.
const EMBEDDED_REJECT: Record<string, SqlRejectReason> = {
  drop: "drop_statement",
  truncate: "truncate_statement",
  grant: "grant_or_revoke",
  revoke: "grant_or_revoke",
  alter: "drop_statement",
  create: "disallowed_verb",
};

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

  // SHOW + EXPLAIN are read-only by definition. node-sql-parser refuses
  // both ("not supported"); short-circuit instead of demanding a parse.
  if (leading === "show" || leading === "explain") return { ok: true };

  let asts: AstNode[];
  try {
    const parsed = parser.astify(sql, { database: "PostgreSQL" }) as unknown as AstNode | AstNode[];
    asts = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return { ok: false, reason: "parse_failed" };
  }

  for (const root of asts) {
    const embedded = walkForRejectedType(root);
    if (embedded) return { ok: false, reason: embedded };
    if (root["type"] === "delete" && !root["where"]) {
      return { ok: false, reason: "delete_without_where" };
    }
  }

  return { ok: true };
}

type AstNode = { [k: string]: unknown };

// Recursively walks the AST looking for any node with a `type` matching
// EMBEDDED_REJECT. Returns the first reject-reason found, or null.
//
// The walk traverses arrays + nested objects but skips primitive leaves
// — keeps it O(nodes) without descending into string positions / line
// numbers / other parser metadata.
function walkForRejectedType(node: unknown): SqlRejectReason | null {
  if (node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = walkForRejectedType(item);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = typeof obj["type"] === "string" ? (obj["type"] as string).toLowerCase() : null;
  if (type && EMBEDDED_REJECT[type]) {
    return EMBEDDED_REJECT[type] ?? null;
  }
  for (const value of Object.values(obj)) {
    const hit = walkForRejectedType(value);
    if (hit) return hit;
  }
  return null;
}
