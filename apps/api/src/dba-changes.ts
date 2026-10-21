// The change ledger (GLOBAL-041 Phase A step 11): every DDL the DBA commits
// on a hosted DB, one D1 row per statement, each with its inverse. Written
// after the transaction commits, best-effort like the `schema_hash` CAS: the
// rows already landed, so a D1 blip never fails the write.

import type { WidenPlan } from "@nlqdb/db";
import { quoted, quoteIdent } from "./db-create/compile-ddl.ts";

export type DbaChange = {
  kind: "create_table" | "add_column" | "create_index";
  table: string;
  ddl: string;
  inverse: string;
};

// Pairs `compileWriteDdl`'s statements with the plan ops that emitted them:
// one statement per op, CREATE TABLEs first, then ADD COLUMNs.
export function widenChanges(plan: WidenPlan, schemaName: string, ddl: string[]): DbaChange[] {
  const tables = plan.create_tables.map((t) => ({
    kind: "create_table" as const,
    table: t.name,
    inverse: `DROP TABLE ${quoted(schemaName, t.name)};`,
  }));
  const columns = plan.add_columns.map((op) => ({
    kind: "add_column" as const,
    table: op.table,
    inverse: `ALTER TABLE ${quoted(schemaName, op.table)} DROP COLUMN ${quoteIdent(op.column.name)};`,
  }));
  return [...tables, ...columns].map((c, i) => ({ ...c, ddl: ddl[i] ?? "" }));
}

export function indexChange(
  schemaName: string,
  table: string,
  index: { name: string; ddl: string },
): DbaChange {
  return {
    kind: "create_index",
    table,
    ddl: index.ddl,
    inverse: `DROP INDEX ${quoted(schemaName, index.name)};`,
  };
}

export async function recordDbaChanges(
  d1: D1Database,
  databaseId: string,
  origin: "insert" | "ask",
  changes: DbaChange[],
): Promise<void> {
  if (changes.length === 0) return;
  try {
    const stmt = d1.prepare(
      "INSERT INTO dba_changes (database_id, origin, kind, table_name, ddl, inverse) VALUES (?, ?, ?, ?, ?, ?)",
    );
    await d1.batch(
      changes.map((c) => stmt.bind(databaseId, origin, c.kind, c.table, c.ddl, c.inverse)),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "dba_changes_write_failed",
        dbId: databaseId,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
