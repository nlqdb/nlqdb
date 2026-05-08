// Per-engine validator for ClickHouse via Tinybird (`SK-MULTIENG-004`).
//
// Two modes mirror the adapter's two-call shape:
//   1. Pipe call — validate the named Pipe is in the allowlist passed
//      at construction time. Pipe names are bounded by the workspace's
//      published-resource set; rejecting cross-prefix references is
//      what blocks one tenant's plan from naming another tenant's
//      Pipe (we use a `<prefix>__<name>` naming convention).
//   2. Raw SQL — `GLOBAL-015` escape hatch. Same layered-guardrails
//      posture as `apps/api/src/ask/sql-validate.ts` (`SK-SQLAL-001`):
//      leading-verb gate + AST parse + table-allowlist walk. Tinybird
//      itself enforces token-level access control server-side, but
//      that's defense-in-depth on top of the validator, not in place
//      of it.
//
// `node-sql-parser` does not ship a ClickHouse dialect today; ClickHouse
// SELECT grammar overlaps closely with MySQL for the constructs an LLM
// would emit (CTEs, joins, `GROUP BY`, window functions), so we parse
// with `database: "MySQL"`. Engine-specific functions (`toStartOfHour`,
// `quantileTDigest`) parse cleanly as generic function calls; the AST
// shape we walk only inspects statement types and table references,
// not function semantics. If a query fails to parse here, we reject —
// `SK-SQLAL-005` says parse failures never fall through to allow.
//
// Multi-statement defense (mirrors `apps/api/src/ask/sql-validate.ts`'s
// `walkForRejected`): node-sql-parser returns an array of ASTs when the
// input is `stmt1; stmt2`. Walking only the first statement's tables
// would let `SELECT 1 FROM events; DROP TABLE events` slip through if
// `events` is allowlisted. Every statement is gated on `root.type ∈
// {select, with}` and walked for embedded destructive verbs at any
// depth (including inside CTEs and subqueries).

import { Parser } from "node-sql-parser";

export type AllowlistConfig = {
  // Published Pipe names this adapter is permitted to call. Rejected
  // outside this set with `pipe_not_allowed`.
  pipes: ReadonlySet<string> | readonly string[];
  // Tables (or materialised views / `Datasource` resources in Tinybird
  // parlance) that raw-SQL plans are permitted to reference. Rejected
  // outside this set with `table_not_allowed`. Schema-qualified entries
  // (`<db>.<table>`) match qualified references; bare entries match
  // bare references only.
  tables: ReadonlySet<string> | readonly string[];
};

export type ValidatorInput = { kind: "pipe"; name: string } | { kind: "sql"; text: string };

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: ClickHouseRejectReason; matched?: string };

export type ClickHouseRejectReason =
  | "empty"
  | "pipe_not_allowed"
  | "disallowed_verb"
  | "parse_failed"
  | "table_not_allowed"
  | "cross_prefix_reference"
  | "non_select_statement"
  | "embedded_destructive_verb";

// Verbs allowed on the raw-SQL escape hatch. Read-only by definition;
// every write path on Tinybird Free is via Pipes/Datasources, not raw
// `INSERT`. `WITH` is included so CTE-shaped read queries pass.
const ALLOWED_LEADING = new Set(["select", "with"]);

// AST `type` strings node-sql-parser emits for destructive statements.
// Mirrors `EMBEDDED_REJECT` in `apps/api/src/ask/sql-validate.ts` —
// every type that must never appear at any depth of a Tinybird raw-SQL
// plan, even inside a CTE or a UNION branch. `select` and `with` are
// the only allowed top-level statement types.
const EMBEDDED_REJECT = new Set([
  "drop",
  "truncate",
  "insert",
  "update",
  "alter",
  "grant",
  "revoke",
  "create",
  "delete",
  "replace",
  "rename",
]);

// Allowed top-level statement types. node-sql-parser tags SELECT
// statements as `type: "select"` and CTE-shaped reads as `type: "with"`
// (or as a select that carries a `with` clause, depending on grammar
// path). Anything else at the root rejects as `non_select_statement`.
const ALLOWED_ROOT_TYPES = new Set(["select", "with"]);

// Module-scoped parser is safe — `node-sql-parser` is sync and the
// Workers event loop is single-threaded (same reasoning as
// `apps/api/src/ask/sql-validate.ts`).
const parser = new Parser();

function leadingVerb(sql: string): string {
  const stripped = sql.replace(/^(?:\s+|--[^\n]*\n?|\/\*[\s\S]*?\*\/)+/, "").replace(/^\(+\s*/, "");
  return (stripped.match(/^[a-z_][a-z_0-9]*/i)?.[0] ?? "").toLowerCase();
}

export type Validator = (input: ValidatorInput) => ValidationResult;

export function createValidator(allowlist: AllowlistConfig): Validator {
  const pipes = new Set(allowlist.pipes);
  const tables = new Set(allowlist.tables);

  return (input) => {
    if (input.kind === "pipe") {
      if (!input.name) return { ok: false, reason: "empty" };
      if (!pipes.has(input.name)) {
        return { ok: false, reason: "pipe_not_allowed", matched: input.name };
      }
      return { ok: true };
    }

    const sql = input.text.trim();
    if (!sql) return { ok: false, reason: "empty" };

    const verb = leadingVerb(sql);
    if (!ALLOWED_LEADING.has(verb)) {
      return { ok: false, reason: "disallowed_verb", matched: verb };
    }

    let asts: AstNode[];
    try {
      const parsed = parser.astify(sql, { database: "MySQL" }) as unknown as AstNode | AstNode[];
      asts = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return { ok: false, reason: "parse_failed" };
    }

    for (const root of asts) {
      // Explicit statement-type gate — closes the door on anything
      // that isn't a SELECT or CTE-shaped read at the top level.
      // Multi-statement input (`SELECT 1; DROP TABLE x;`) hits this
      // because `DROP` lands as a sibling AST with `type: "drop"`.
      const rootType =
        typeof root["type"] === "string" ? (root["type"] as string).toLowerCase() : null;
      if (!rootType || !ALLOWED_ROOT_TYPES.has(rootType)) {
        return { ok: false, reason: "non_select_statement", matched: rootType ?? undefined };
      }

      // Embedded destructive verbs anywhere in the tree — covers
      // `WITH cte AS (DELETE FROM x) SELECT 1` and UNION branches
      // that smuggle an INSERT/UPDATE.
      const embedded = walkForEmbeddedReject(root);
      if (embedded) {
        return { ok: false, reason: "embedded_destructive_verb", matched: embedded };
      }

      const cteNames = collectCteNames(root);
      const referenced = collectTables(root);
      for (const ref of referenced) {
        // CTE-defined aliases are scoped to the query; they aren't
        // workspace tables. Skip them — only the underlying tables
        // they reference (which the walk already collected from the
        // CTE body) need allowlist clearance. Bare-name CTEs only —
        // CTEs are never schema-qualified.
        if (!ref.db && cteNames.has(ref.table)) continue;

        // Schema-qualified reference (`analytics.events`) requires the
        // qualified key to be in the allowlist. node-sql-parser places
        // the schema/database under `db` when a qualifier is present,
        // and leaves it null/empty otherwise. A qualified reference
        // that isn't in the allowlist is the cross-tenant escape vector
        // — surface it with `cross_prefix_reference` so dashboards can
        // split it from typo / unknown-table cases.
        if (ref.db) {
          const qualified = `${ref.db}.${ref.table}`;
          if (!tables.has(qualified)) {
            return { ok: false, reason: "cross_prefix_reference", matched: qualified };
          }
          continue;
        }

        if (!tables.has(ref.table)) {
          // Cross-prefix references are the multi-tenant escape vector:
          // a query that names `tenantA__events` from a tenantB context
          // gets rejected even if both prefixes exist in the workspace.
          // The allowlist passed at construction is the tenant's slice;
          // anything outside it is `cross_prefix_reference`. Otherwise
          // (no `__` shape) it's a typo / unpublished resource.
          const reason: ClickHouseRejectReason = ref.table.includes("__")
            ? "cross_prefix_reference"
            : "table_not_allowed";
          return { ok: false, reason, matched: ref.table };
        }
      }
    }

    return { ok: true };
  };
}

type AstNode = { [k: string]: unknown };

// A table reference resolved from the AST. `db` is the schema/database
// qualifier when present (e.g. `analytics.events` → `{db:"analytics",
// table:"events"}`); bare references leave it null.
type TableRef = { db: string | null; table: string };

// Walk the AST, collecting every table reference. `node-sql-parser`
// emits FROM/JOIN tables under `from: [{ table, db?, as? }, …]` and
// nested in subqueries / CTE definitions, so the walk recurses through
// arrays + nested objects. Identifiers are unquoted by the parser, so
// the comparison against the allowlist is direct string equality.
function collectTables(node: unknown, out: TableRef[] = []): TableRef[] {
  if (node === null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectTables(item, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj["table"] === "string" && obj["table"]) {
    // Filter out node-sql-parser sentinel for "no table" (the parser
    // sometimes places `table: null` shaped as the string in CTE refs);
    // a real reference always has a non-empty string identifier.
    const db = typeof obj["db"] === "string" && obj["db"] ? (obj["db"] as string) : null;
    out.push({ db, table: obj["table"] as string });
  }
  for (const value of Object.values(obj)) collectTables(value, out);
  return out;
}

// Walk the AST for any node whose `type` is in EMBEDDED_REJECT — covers
// destructive verbs hidden inside CTE bodies, subqueries, UNION
// branches, etc. Returns the matched verb token on hit.
//
// Statement-shape gate: a node-sql-parser DDL/DML statement node always
// carries a `keyword` sibling (e.g. `{type:"drop", keyword:"table"}`).
// Expression nodes that happen to share a type string (hypothetically a
// future `type:"create"` for a CREATE-USER expression) wouldn't, so
// requiring `keyword` keeps the walk from false-rejecting on grammar
// evolution. Mirrors the `apps/api/src/ask/sql-validate.ts` walk.
function walkForEmbeddedReject(node: unknown): string | null {
  if (node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = walkForEmbeddedReject(item);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = typeof obj["type"] === "string" ? (obj["type"] as string).toLowerCase() : null;
  if (type && EMBEDDED_REJECT.has(type) && "keyword" in obj) {
    return type;
  }
  // DELETE / INSERT / UPDATE statement nodes don't always carry a
  // `keyword` sibling; their statement-shape marker is the `from` /
  // `table` / `into` field. Catch those too.
  if (
    type &&
    EMBEDDED_REJECT.has(type) &&
    ("from" in obj || "table" in obj || "into" in obj || "name" in obj)
  ) {
    return type;
  }
  for (const value of Object.values(obj)) {
    const hit = walkForEmbeddedReject(value);
    if (hit) return hit;
  }
  return null;
}

// Collect every CTE alias defined under a `with: [{ name: { value },
// stmt }]` clause. Recursive so nested CTEs in subqueries are also
// resolved — the same alias-vs-table disambiguation has to apply at
// every depth where a `with` shows up.
function collectCteNames(node: unknown, out: Set<string> = new Set()): Set<string> {
  if (node === null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectCteNames(item, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  const withClause = obj["with"];
  if (Array.isArray(withClause)) {
    for (const cte of withClause) {
      if (cte && typeof cte === "object") {
        const nameField = (cte as Record<string, unknown>)["name"];
        if (typeof nameField === "string") {
          out.add(nameField);
        } else if (nameField && typeof nameField === "object") {
          const value = (nameField as Record<string, unknown>)["value"];
          if (typeof value === "string") out.add(value);
        }
      }
    }
  }
  for (const value of Object.values(obj)) collectCteNames(value, out);
  return out;
}
