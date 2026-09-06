// Widen-on-write DDL compiler — GLOBAL-041 Phase A step 3, SK-SCHEMA-008 /
// SK-SCHEMA-009. Sibling of `compile-ddl.ts` (the create-path compiler): the
// LLM never emits raw DDL — it emits a typed `{ add_columns[], create_tables[] }`
// plan (GLOBAL-041 Phase A step 2) and this compiler turns it into the exact
// deterministic SQL strings the widen path executes. This is the ONLY emitter
// of `ALTER TABLE … ADD COLUMN` / widen-path `CREATE TABLE` DDL; the
// libpg_query allow-list that runs after it is `ask/sql-validate-ddl.ts`
// (`checkAlterTable` accepts exactly `AT_AddColumn` nullable / no-default and
// the FK `AT_AddConstraint` the create compiler emits — step 4).
//
// Widen is monotonic and non-destructive (SK-SCHEMA-008): a new column is
// added NULLable with no default (an existing table already has rows, so a
// NOT NULL / DEFAULT add is a retype-class change — a previewed proposal,
// SK-SCHEMA-009, never a silent widen); a new table is created from the same
// typed `Table` the create compiler consumes, so single-column int/uuid PKs
// get the SK-HDC-015 auto-generator for free.
//
// RLS + tenant-role grants for a widen-CREATED table are NOT emitted here:
// exactly as `compile-ddl.ts` stays pure and tenant-agnostic while
// `neon-provision.ts` attaches `ENABLE ROW LEVEL SECURITY` + the
// `tenant_isolation` policy with the tenant literal, the widen executor
// (GLOBAL-041 Phase A step 5, not this slice) reuses that same emitter at
// commit time. Keeping the tenant identity out of a pure string function is
// the safer design — a security predicate lives in one place, not two.
//
// Sibling skill: docs/features/schema-widening/FEATURE.md (SK-SCHEMA-008/009).

import type { Column, Table } from "@nlqdb/db";
import { checkReserved, compileColumn, compileTable, quoted } from "./compile-ddl.ts";

// A single column added to a table that already exists in the schema.
export type AddColumnOp = { table: string; column: Column };

// The typed widen plan the extend prompt emits (GLOBAL-041 Phase A step 2):
// new tables in full + new columns on existing tables. Both arrays may be
// empty individually, but a plan with neither op is a caller bug (`empty_plan`).
export type WidenPlan = {
  create_tables: Table[];
  add_columns: AddColumnOp[];
};

export type CompileWriteDdlResult =
  | { ok: true; statements: string[] }
  | { ok: false; reason: CompileWriteFailureReason; details?: unknown };

export type CompileWriteFailureReason =
  | "empty_plan"
  | "reserved_word"
  | "duplicate_identifier"
  | "primary_key_column_missing"
  | "add_column_not_nullable"
  | "add_column_has_default";

// Mirrors `compileDdl`'s per-table identifier checks (reserved words,
// duplicate columns, PK columns present) — kept minimal and local rather
// than routing a partial `SchemaPlan` through the create compiler.
function validateCreateTable(table: Table): CompileWriteDdlResult | null {
  if (checkReserved(table.name)) {
    return { ok: false, reason: "reserved_word", details: { table: table.name } };
  }
  const cols = new Set<string>();
  for (const col of table.columns) {
    if (cols.has(col.name)) {
      return {
        ok: false,
        reason: "duplicate_identifier",
        details: { kind: "column", table: table.name, name: col.name },
      };
    }
    if (checkReserved(col.name)) {
      return {
        ok: false,
        reason: "reserved_word",
        details: { table: table.name, column: col.name },
      };
    }
    cols.add(col.name);
  }
  for (const pk of table.primary_key) {
    if (!cols.has(pk)) {
      return {
        ok: false,
        reason: "primary_key_column_missing",
        details: { table: table.name, column: pk },
      };
    }
  }
  return null;
}

function validateAddColumn(op: AddColumnOp): CompileWriteDdlResult | null {
  if (checkReserved(op.table)) {
    return { ok: false, reason: "reserved_word", details: { table: op.table } };
  }
  if (checkReserved(op.column.name)) {
    return {
      ok: false,
      reason: "reserved_word",
      details: { table: op.table, column: op.column.name },
    };
  }
  // Widen is nullable-only: a column added to a table that already has rows
  // cannot be NOT NULL, and a DEFAULT on a widen add is a retype-class change
  // (SK-SCHEMA-009), not a silent widen. The allow-list (step 4) rejects the
  // same shapes; refusing here gives the caller a typed reason instead of a
  // downstream `parse`/`destructive_verb`.
  if (op.column.nullable === false) {
    return {
      ok: false,
      reason: "add_column_not_nullable",
      details: { table: op.table, column: op.column.name },
    };
  }
  if (op.column.default !== undefined && op.column.default !== null) {
    return {
      ok: false,
      reason: "add_column_has_default",
      details: { table: op.table, column: op.column.name },
    };
  }
  return null;
}

export function compileWriteDdl(plan: WidenPlan, schemaName: string): CompileWriteDdlResult {
  if (checkReserved(schemaName)) {
    return { ok: false, reason: "reserved_word", details: { schemaName } };
  }
  if (plan.create_tables.length === 0 && plan.add_columns.length === 0) {
    return { ok: false, reason: "empty_plan" };
  }

  const newTableNames = new Set<string>();
  for (const table of plan.create_tables) {
    if (newTableNames.has(table.name)) {
      return {
        ok: false,
        reason: "duplicate_identifier",
        details: { kind: "table", name: table.name },
      };
    }
    const bad = validateCreateTable(table);
    if (bad) return bad;
    newTableNames.add(table.name);
  }
  for (const op of plan.add_columns) {
    const bad = validateAddColumn(op);
    if (bad) return bad;
  }

  // Emission order: CREATE TABLE × N (plan order) → ALTER … ADD COLUMN × N.
  // The two op kinds address disjoint tables (a brand-new table needs no
  // ADD COLUMN), so no cross-dependency ordering is required.
  const statements: string[] = [];
  for (const table of plan.create_tables) {
    statements.push(compileTable(table, schemaName));
  }
  for (const op of plan.add_columns) {
    // `compileColumn(col, false)` on a nullable / no-default column emits
    // exactly `"name" TYPE` — no NOT NULL, no DEFAULT, no auto-PK generator.
    statements.push(
      `ALTER TABLE ${quoted(schemaName, op.table)} ADD COLUMN ${compileColumn(op.column, false)};`,
    );
  }
  return { ok: true, statements };
}
