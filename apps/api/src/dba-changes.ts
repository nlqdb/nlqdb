// The change ledger (GLOBAL-041 Phase A step 11): every DDL the DBA commits
// on a hosted DB, and every proposal it makes on an attached one (GLOBAL-043),
// one D1 row per statement, each with its inverse. Hosted-path rows are written
// after the transaction commits, best-effort like the `schema_hash` CAS: the
// rows already landed, so a D1 blip never fails the write.

import type { Proposal, WidenPlan } from "@nlqdb/db";
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

// A Tier 0 proposal the attach door records with the DB row (`GLOBAL-043`
// item 4): `proposed` until a verb applies it, the whole Proposal kept for the
// apply / verify that follow.
export function proposalStatement(
  d1: D1Database,
  databaseId: string,
  p: Proposal,
): D1PreparedStatement {
  return d1
    .prepare(
      "INSERT INTO dba_changes (database_id, origin, kind, table_name, ddl, inverse, status, proposal) VALUES (?, 'attach', ?, ?, ?, ?, 'proposed', ?)",
    )
    .bind(databaseId, p.kind, p.table, p.ddl, p.inverse, JSON.stringify(p));
}

// The attach door's proposals still waiting on a DB, as its response listed
// them — an `Idempotency-Key` replay returns these, not a second observe.
export async function listProposals(
  d1: D1Database,
  databaseId: string,
): Promise<(Proposal & { id: number })[]> {
  const { results } = await d1
    .prepare(
      "SELECT id, proposal FROM dba_changes WHERE database_id = ? AND status = 'proposed' AND proposal IS NOT NULL ORDER BY id",
    )
    .bind(databaseId)
    .all<{ id: number; proposal: string }>();
  return results.map((r) => ({ ...(JSON.parse(r.proposal) as Proposal), id: r.id }));
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

// One ledger row as `GET /v1/databases/:id/changes` returns it (`/app/dba`).
// `reason` is the proposal card's sentence; null on hosted-path rows.
export type DbaChangeRow = DbaChange & {
  id: number;
  origin: "insert" | "ask" | "attach";
  status: "proposed" | "applied";
  reason: string | null;
  createdAt: number;
};

// The DB's ledger, newest first; null when the caller doesn't own the DB.
export async function listDbaChanges(
  d1: D1Database,
  databaseId: string,
  tenantId: string,
  limit = 500,
): Promise<DbaChangeRow[] | null> {
  const [owned, rows] = await d1.batch<Record<string, unknown>>([
    d1
      .prepare("SELECT 1 AS ok FROM databases WHERE id = ? AND tenant_id = ?")
      .bind(databaseId, tenantId),
    d1
      .prepare(
        "SELECT id, origin, kind, table_name AS \"table\", ddl, inverse, status, json_extract(proposal, '$.reason') AS reason, created_at AS createdAt FROM dba_changes WHERE database_id = ? ORDER BY id DESC LIMIT ?",
      )
      .bind(databaseId, limit),
  ]);
  if (!owned?.results.length) return null;
  return (rows?.results ?? []) as DbaChangeRow[];
}
