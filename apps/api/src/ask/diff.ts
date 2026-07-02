// SK-TRUST-001 — build a plain-English preview of a write plan before
// it commits. Returns `null` for read SQL (orchestrator skips the
// preview gate). Values are derived server-side from the AST + a
// pre-flight `SELECT COUNT(*)` so surfaces never compute the affected-
// rows themselves (would be a silent-lie risk under GLOBAL-011).
//
// Parser reuse: `node-sql-parser` is already the validator parser in
// `sql-validate.ts`/`recent-tables.ts` — keeps cold-start cheap and
// avoids a second WASM dep on the eager startup graph.

import { Parser } from "node-sql-parser";
import { containsWriteVerb } from "./sql-validate.ts";
import type { AskDiff } from "./types.ts";

const parser = new Parser();

export type CountExec = (countSql: string) => Promise<number>;

type AnyAst = { type?: string; [k: string]: unknown };

// Pre-flight count helper: build the COUNT(*) SQL for a write plan and
// return the verb + table needed to render the diff. Read SQL returns
// null. Parse failure also returns null — the validator has already
// accepted the SQL by this point, so a re-parse should succeed, but
// degrading gracefully keeps the diff path from blocking exec on a
// parser quirk.
export async function buildDiff(planSql: string, exec: CountExec): Promise<AskDiff | null> {
  let asts: AnyAst[];
  try {
    const parsed = parser.astify(planSql, { database: "PostgreSQL" }) as unknown as
      | AnyAst
      | AnyAst[];
    asts = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return null;
  }
  const root = asts[0];
  if (!root || typeof root !== "object") return null;
  // The write statement may be the root, or nested inside a
  // data-modifying CTE (`WITH x AS (UPDATE … RETURNING *) SELECT …`,
  // whose outer `type` is `select`). Preview the inner write so the
  // CTE form goes through the same render-before-commit gate as a
  // top-level write (SK-TRUST-001) instead of silently committing.
  const stmt = findWriteStmt(root);
  if (!stmt) return null;
  const type = stmt.type;

  if (type === "update" || type === "delete") {
    const tableRef = pickTableRef(stmt, type);
    if (!tableRef) return null;
    const where = (stmt["where"] ?? null) as AnyAst | null;
    const count = await runCount(tableRef, where, exec);
    const verb = type === "update" ? "UPDATE" : "DELETE";
    return {
      verb,
      table: tableRef.table,
      affectedRows: count,
      summary: buildSummary(verb, count, tableRef.table),
    };
  }

  if (type === "insert") {
    const tableRef = pickTableRef(stmt, "insert");
    if (!tableRef) return null;
    const count = await countInsert(stmt, exec);
    return {
      verb: "INSERT",
      table: tableRef.table,
      affectedRows: count,
      summary: buildSummary("INSERT", count, tableRef.table),
    };
  }

  return null;
}

// Returns the INSERT/UPDATE/DELETE statement node — the root itself for a
// top-level write, or the data-modifying statement inside a CTE
// (`with:[{ stmt }]`, recursing for nested WITHs). Null for a pure read.
function findWriteStmt(root: AnyAst): AnyAst | null {
  const type = typeof root.type === "string" ? root.type : null;
  if (type === "update" || type === "delete" || type === "insert") return root;
  const withList = root["with"];
  if (Array.isArray(withList)) {
    for (const cte of withList) {
      const inner = cte && typeof cte === "object" ? (cte as AnyAst)["stmt"] : null;
      if (inner && typeof inner === "object") {
        const found = findWriteStmt(inner as AnyAst);
        if (found) return found;
      }
    }
  }
  return null;
}

type TableRef = { db: string | null; table: string; as?: string | null };

function pickTableRef(root: AnyAst, kind: "update" | "delete" | "insert"): TableRef | null {
  // UPDATE / INSERT carry the target on `table[]`; DELETE on `from[]`
  // for node-sql-parser's PG dialect.
  const source =
    kind === "delete"
      ? (root["from"] as unknown[] | undefined)
      : (root["table"] as unknown[] | undefined);
  if (!Array.isArray(source) || source.length === 0) return null;
  const first = source[0] as Record<string, unknown> | undefined;
  if (!first || typeof first["table"] !== "string") return null;
  return {
    db: typeof first["db"] === "string" ? first["db"] : null,
    table: first["table"],
    as: typeof first["as"] === "string" ? first["as"] : null,
  };
}

// Re-serialise a SELECT COUNT(*) over the same target + WHERE. Building
// the AST node-by-node (rather than string-templating the count SQL)
// inherits the parser's PG quoting + qualification rules — a table
// named `user` round-trips as `"user"` so the count query parses
// against the live DB.
async function runCount(
  tableRef: TableRef,
  where: AnyAst | null,
  exec: CountExec,
): Promise<number> {
  const countAst: AnyAst = {
    with: null,
    type: "select",
    options: null,
    distinct: null,
    columns: [
      {
        expr: {
          type: "aggr_func",
          name: "COUNT",
          args: { expr: { type: "star", value: "*" } },
          over: null,
        },
        as: "c",
      },
    ],
    from: [
      {
        db: tableRef.db,
        table: tableRef.table,
        as: tableRef.as ?? null,
      },
    ],
    where,
    groupby: null,
    having: null,
    orderby: null,
    limit: null,
  };
  let countSql: string;
  try {
    countSql = parser.sqlify(countAst as never, { database: "PostgreSQL" });
  } catch {
    return 0;
  }
  try {
    return await exec(countSql);
  } catch {
    return 0;
  }
}

// node-sql-parser PG `INSERT` nests its payload on `values`:
//   • VALUES form:  `values.type === "values"`, `values.values: ExprList[]`.
//   • SELECT form:  `values.type === "select"`, the whole SELECT AST.
// We count tuples directly for the VALUES form (no SQL hop), and wrap
// the SELECT in `SELECT COUNT(*) FROM (<select>) s` for the SELECT
// form. Falls back to 0 on shapes we don't recognise (e.g. `INSERT …
// DEFAULT VALUES`).
async function countInsert(root: AnyAst, exec: CountExec): Promise<number> {
  const payload = root["values"];
  if (!payload || typeof payload !== "object") return 0;
  const p = payload as AnyAst;
  if (p["type"] === "values") {
    const tuples = p["values"];
    return Array.isArray(tuples) ? tuples.length : 0;
  }
  if (p["type"] === "select") {
    try {
      const innerSql = parser.sqlify(p as never, { database: "PostgreSQL" });
      // Wrap as a subquery so the inner SELECT's columns / ORDER BY /
      // LIMIT don't bleed into the outer count semantics. Alias `s` is
      // arbitrary; PG requires an alias on a subquery in FROM.
      return await exec(`SELECT COUNT(*) AS c FROM (${innerSql}) AS s`);
    } catch {
      return 0;
    }
  }
  return 0;
}

function buildSummary(verb: AskDiff["verb"], count: number, table: string): string {
  const rows = count === 1 ? "row" : "rows";
  if (verb === "UPDATE") return `This will update ${count.toLocaleString()} ${rows} in ${table}.`;
  if (verb === "DELETE") return `This will delete ${count.toLocaleString()} ${rows} in ${table}.`;
  if (verb === "INSERT") return `This will insert ${count.toLocaleString()} ${rows} into ${table}.`;
  return `This will modify ${count.toLocaleString()} ${rows} in ${table}.`;
}

// Write-detection helper for the orchestrator's preview gate
// (SK-TRUST-001). Delegates to the validator's `containsWriteVerb` so the
// gate and `validateSql` share one definition of "is this a write" — a
// comment-prefixed write (`/* x */ UPDATE …`) AND a data-modifying CTE
// (`WITH x AS (INSERT … RETURNING *) SELECT …`, leading verb `with`) both
// count as writes, so neither can slip past the render-before-commit diff
// (the same smuggle `/v1/run`'s read-only gate guards against).
export function isWriteVerb(sql: string): boolean {
  return containsWriteVerb(sql);
}
