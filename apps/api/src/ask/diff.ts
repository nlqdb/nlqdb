// SK-TRUST-001 — build a plain-English preview of a write plan before
// it commits. Values are derived server-side from the AST + a pre-flight
// `SELECT COUNT(*)` so surfaces never compute the affected-rows
// themselves (would be a silent-lie risk under GLOBAL-011).
//
// SK-TRUST-006 — every "couldn't compute it" path now THROWS
// `PreviewUnavailableError` instead of degrading to `affectedRows: 0` or
// `null`. A fabricated 0 asked the user to approve a no-op; a `null`
// dropped the write straight through the gate and committed it with no
// diff at all. Neither is honest, so the orchestrator refuses the write
// instead.
//
// Parser reuse: `node-sql-parser` is already the validator parser in
// `sql-validate.ts`/`recent-tables.ts` — keeps cold-start cheap and
// avoids a second WASM dep on the eager startup graph.

import { Parser } from "node-sql-parser";
import { containsWriteVerb } from "./sql-validate.ts";
import type { AskDiff } from "./types.ts";

const parser = new Parser();

export type CountExec = (countSql: string) => Promise<number>;

// SK-TRUST-006 — thrown when the diff cannot be computed honestly
// (unparseable plan, unidentifiable target, an INSERT payload shape we
// don't count, or a failed pre-flight count). The orchestrator surfaces
// it rather than previewing a number it made up or committing unpreviewed.
export class PreviewUnavailableError extends Error {
  constructor(reason: string, options?: { cause: unknown }) {
    super(`write preview unavailable: ${reason}`, options);
    this.name = "PreviewUnavailableError";
  }
}

export type WriteTarget = { verb: "INSERT" | "UPDATE" | "DELETE"; table: string };

type AnyAst = { type?: string; [k: string]: unknown };

// Pre-flight count helper: build the COUNT(*) SQL for a write plan and
// return the verb + table needed to render the diff. Throws
// `PreviewUnavailableError` when the effect can't be computed — the caller
// is the SK-TRUST-001 gate, and a write it cannot describe must not run.
export async function buildDiff(planSql: string, exec: CountExec): Promise<AskDiff> {
  const stmt = parseWriteStmt(planSql);
  if (!stmt) throw new PreviewUnavailableError("no write statement in the plan");
  const type = stmt.type as "insert" | "update" | "delete";
  const tableRef = pickTableRef(stmt, type);
  if (!tableRef) throw new PreviewUnavailableError(`${type} target table not identifiable`);
  const count =
    type === "insert"
      ? await countInsert(stmt, exec)
      : await runCount(tableRef, (stmt["where"] ?? null) as AnyAst | null, exec);
  const verb = type.toUpperCase() as WriteTarget["verb"];
  return {
    verb,
    table: tableRef.table,
    affectedRows: count,
    summary: buildSummary(verb, count, tableRef.table),
  };
}

// SK-TRUST-006 — verb + table of a write plan, for the post-exec
// zero-rows-affected envelope. Same AST walk the diff uses (so a
// data-modifying CTE resolves to its inner write); null when the plan
// isn't a parseable write.
export function writeTarget(sql: string): WriteTarget | null {
  const stmt = parseWriteStmt(sql);
  if (!stmt) return null;
  const type = stmt.type as "insert" | "update" | "delete";
  const tableRef = pickTableRef(stmt, type);
  if (!tableRef) return null;
  return { verb: type.toUpperCase() as WriteTarget["verb"], table: tableRef.table };
}

// The write statement node — the root itself, or the data-modifying
// statement inside a CTE. Null for a read or an unparseable statement
// (`validateSql` has already rejected the latter upstream).
function parseWriteStmt(planSql: string): AnyAst | null {
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
  return findWriteStmt(root);
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
  } catch (cause) {
    throw new PreviewUnavailableError("could not build the pre-flight count", { cause });
  }
  try {
    return await exec(countSql);
  } catch (cause) {
    throw new PreviewUnavailableError("pre-flight count failed", { cause });
  }
}

// node-sql-parser PG `INSERT` nests its payload on `values`:
//   • VALUES form:  `values.type === "values"`, `values.values: ExprList[]`.
//   • SELECT form:  `values.type === "select"`, the whole SELECT AST.
// We count tuples directly for the VALUES form (no SQL hop), and wrap
// the SELECT in `SELECT COUNT(*) FROM (<select>) s` for the SELECT
// form. Any other shape (e.g. `INSERT … DEFAULT VALUES`) is a count we
// can't prove — SK-TRUST-006 refuses rather than reporting 0.
async function countInsert(root: AnyAst, exec: CountExec): Promise<number> {
  const payload = root["values"];
  const p = payload && typeof payload === "object" ? (payload as AnyAst) : null;
  if (p?.["type"] === "values") {
    const tuples = p["values"];
    if (Array.isArray(tuples)) return tuples.length;
  }
  if (p?.["type"] === "select") {
    let innerSql: string;
    try {
      innerSql = parser.sqlify(p as never, { database: "PostgreSQL" });
    } catch (cause) {
      throw new PreviewUnavailableError("could not re-serialise the INSERT source", { cause });
    }
    try {
      // Wrap as a subquery so the inner SELECT's columns / ORDER BY /
      // LIMIT don't bleed into the outer count semantics. Alias `s` is
      // arbitrary; PG requires an alias on a subquery in FROM.
      return await exec(`SELECT COUNT(*) AS c FROM (${innerSql}) AS s`);
    } catch (cause) {
      throw new PreviewUnavailableError("pre-flight count failed", { cause });
    }
  }
  throw new PreviewUnavailableError("unrecognised INSERT payload shape");
}

// SK-ASK-028 — factual narration of a committed write, built from the
// verb + table + the engine's affected-row count. Writes are never
// narrated by the summarize LLM (it has only the returned rows — an empty
// array for a plain INSERT — so it invents a read).
export function writeOutcomeSummary(
  verb: WriteTarget["verb"],
  table: string,
  rowCount: number,
): string {
  const rows = `${rowCount.toLocaleString()} ${rowCount === 1 ? "row" : "rows"}`;
  if (verb === "INSERT") return `Inserted ${rows} into ${table}.`;
  if (verb === "UPDATE") return `Updated ${rows} in ${table}.`;
  return `Deleted ${rows} from ${table}.`;
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
