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

import { Parser } from "node-sql-parser";

export type AllowlistConfig = {
  // Published Pipe names this adapter is permitted to call. Rejected
  // outside this set with `pipe_not_allowed`.
  pipes: ReadonlySet<string> | readonly string[];
  // Tables (or materialised views / `Datasource` resources in Tinybird
  // parlance) that raw-SQL plans are permitted to reference. Rejected
  // outside this set with `table_not_allowed`.
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
  | "cross_prefix_reference";

// Verbs allowed on the raw-SQL escape hatch. Read-only by definition;
// every write path on Tinybird Free is via Pipes/Datasources, not raw
// `INSERT`. `WITH` is included so CTE-shaped read queries pass.
const ALLOWED_LEADING = new Set(["select", "with"]);

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
      const cteNames = collectCteNames(root);
      const referenced = collectTables(root);
      for (const t of referenced) {
        // CTE-defined aliases are scoped to the query; they aren't
        // workspace tables. Skip them — only the underlying tables
        // they reference (which the walk already collected from the
        // CTE body) need allowlist clearance.
        if (cteNames.has(t)) continue;
        // Cross-prefix references are the multi-tenant escape vector:
        // a query that names `tenantA__events` from a tenantB context
        // gets rejected even if both prefixes exist in the workspace.
        // The allowlist passed at construction is the tenant's slice;
        // anything outside it is `cross_prefix_reference`.
        if (!tables.has(t)) {
          // `cross_prefix_reference` when the referenced name follows
          // the `<prefix>__<rest>` shape — strong signal someone is
          // trying to read across tenants. Otherwise `table_not_allowed`
          // (typo / unpublished resource).
          const reason: ClickHouseRejectReason = t.includes("__")
            ? "cross_prefix_reference"
            : "table_not_allowed";
          return { ok: false, reason, matched: t };
        }
      }
    }

    return { ok: true };
  };
}

type AstNode = { [k: string]: unknown };

// Walk the AST, collecting every table reference. `node-sql-parser`
// emits FROM/JOIN tables under `from: [{ table, db?, as? }, …]` and
// nested in subqueries / CTE definitions, so the walk recurses through
// arrays + nested objects. Identifiers are unquoted by the parser, so
// the comparison against the allowlist is direct string equality.
function collectTables(node: unknown, out: Set<string> = new Set()): Set<string> {
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
    out.add(obj["table"]);
  }
  for (const value of Object.values(obj)) collectTables(value, out);
  return out;
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
