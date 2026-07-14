// SK-ASK-025 — hosted plan SQL is schema-relative.
//
// Hosted `/v1/ask` exec sets `search_path` to the tenant's own schema and
// drops to a least-privilege per-tenant role (`build-deps.ts`
// `buildHostedExecSteps`): unqualified names resolve to the tenant schema,
// and a *schema-qualified* cross-schema ref (`other_schema.tbl`) is designed
// to fail closed. A plan that bakes the physical schema name into its SQL is
// therefore BOTH (a) not portable across the DBs that share a
// `(schema_hash, query_hash)` plan-cache key — the schema hash fingerprints
// the LOGICAL plan, so two structurally-identical DBs collide, yet the physical
// schema name is minted per-DB from the dbId — breaking GLOBAL-006 /
// SK-PLAN-002's "identical schema + query ⇒ identical SQL" invariant; and
// (b) at odds with the isolation model. These helpers normalise hosted plan
// SQL to schema-relative form so the cache stays genuinely content-addressed.

import { Parser } from "node-sql-parser";

const parser = new Parser();

// Remove the DB's OWN schema qualifier (`"<schema>".` / `<schema>.`) from
// table references, leaving the bare table name for `search_path` to resolve.
// Deterministic string strip keyed on the exact, unique schema name (a
// `<slug>_<6hex>` identifier that never collides with a table or alias name)
// — no SQL rewrite, no parse. The lookahead requires the token after the dot
// to start an identifier (quote or letter/underscore), so a numeric literal
// like `1.5` is never touched even for a degenerate numeric schema name.
// Accepted edge case: this DB's own `<schema>.<ident>` token *inside a
// single-quoted string literal* is also stripped — SK-ASK-025 chose the
// deterministic strip over an AST rewrite. It only ever removes characters
// (no injection) and only ever matches this DB's own token (never a foreign
// schema), so the worst case is a corrupted literal in a near-impossible
// query, not a correctness or isolation risk.
export function schemaRelativeSql(sql: string, schemaName: string): string {
  const esc = schemaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\w"])"?${esc}"?\\s*\\.\\s*(?=["a-zA-Z_])`, "g");
  return sql.replace(re, "$1");
}

// True when a statement still names a schema-qualified table
// (`other_schema.tbl`). Used on a cache hit AFTER own-schema stripping: a
// residual qualifier means the cached plan was baked against a DIFFERENT DB's
// physical schema (a pre-normalisation poisoned entry) — invalid for this DB,
// so the caller drops the hit and re-plans (self-heal). Read-only AST walk;
// `db` is node-sql-parser's schema-qualifier key on a from/target-table node
// and is absent on `column_ref` (see `recent-tables.ts`). Parse failure ⇒
// false — `validateSql` rejects unparseable SQL downstream.
export function referencesQualifiedTable(sql: string): boolean {
  let asts: unknown;
  try {
    asts = parser.astify(sql, { database: "PostgreSQL" });
  } catch {
    return false;
  }
  return walkForQualifiedTable(asts);
}

function walkForQualifiedTable(node: unknown): boolean {
  if (node === null || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(walkForQualifiedTable);
  const obj = node as Record<string, unknown>;
  if (typeof obj["table"] === "string" && typeof obj["db"] === "string" && obj["db"] !== "") {
    return true;
  }
  return Object.values(obj).some(walkForQualifiedTable);
}
