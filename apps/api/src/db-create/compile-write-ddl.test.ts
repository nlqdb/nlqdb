// Unit tests for the widen-on-write DDL compiler (GLOBAL-041 Phase A
// step 3, SK-SCHEMA-008/009). Cover byte-for-byte determinism of the two
// widen ops (ADD COLUMN nullable / CREATE TABLE), the nullable-only /
// no-default guards, and every documented CompileWriteFailureReason.
//
// The libpg_query allow-list that guards this compiler's output is the
// sibling `apps/api/src/ask/sql-validate-ddl.ts`; its tests live next to
// it and include the integration smoke that the two halves agree.

import type { Column, Table } from "@nlqdb/db/types";
import { describe, expect, it } from "vitest";
import {
  type AddColumnOp,
  type CompileWriteDdlResult,
  compileWriteDdl,
  type WidenPlan,
} from "./compile-write-ddl.ts";

const SCHEMA = "s1";

function table(name: string, columns: Column[], primary_key: string[]): Table {
  return { name, description: "test table", columns, primary_key };
}

const idCol: Column = { name: "id", type: "uuid", nullable: false, description: "pk" };

function ok(res: CompileWriteDdlResult): string[] {
  if (!res.ok) throw new Error(`expected ok, got ${res.reason}`);
  return res.statements;
}

describe("compileWriteDdl", () => {
  it("emits a nullable ADD COLUMN with no NOT NULL / DEFAULT", () => {
    const plan: WidenPlan = {
      create_tables: [],
      add_columns: [
        {
          table: "events",
          column: { name: "note", type: "text", nullable: true, description: "c" },
        },
      ],
    };
    expect(ok(compileWriteDdl(plan, SCHEMA))).toEqual([
      'ALTER TABLE "s1"."events" ADD COLUMN "note" TEXT;',
    ]);
  });

  it("emits a full CREATE TABLE with the create compiler's shape (auto-PK)", () => {
    const plan: WidenPlan = {
      create_tables: [
        table(
          "events",
          [idCol, { name: "note", type: "text", nullable: true, description: "c" }],
          ["id"],
        ),
      ],
      add_columns: [],
    };
    expect(ok(compileWriteDdl(plan, SCHEMA))).toEqual([
      'CREATE TABLE "s1"."events" (\n' +
        '  "id" UUID NOT NULL DEFAULT gen_random_uuid(),\n' +
        '  "note" TEXT,\n' +
        '  PRIMARY KEY ("id")\n' +
        ");",
    ]);
  });

  it("emits CREATE TABLE before ADD COLUMN", () => {
    const plan: WidenPlan = {
      create_tables: [table("t_new", [idCol], ["id"])],
      add_columns: [
        {
          table: "t_old",
          column: { name: "extra", type: "integer", nullable: true, description: "c" },
        },
      ],
    };
    const stmts = ok(compileWriteDdl(plan, SCHEMA));
    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toContain('CREATE TABLE "s1"."t_new"');
    expect(stmts[1]).toBe('ALTER TABLE "s1"."t_old" ADD COLUMN "extra" INTEGER;');
  });

  it("rejects an empty plan", () => {
    const res = compileWriteDdl({ create_tables: [], add_columns: [] }, SCHEMA);
    expect(res).toEqual({ ok: false, reason: "empty_plan" });
  });

  it("rejects a NOT NULL widen column (nullable-only)", () => {
    const op: AddColumnOp = {
      table: "events",
      column: { name: "note", type: "text", nullable: false, description: "c" },
    };
    const res = compileWriteDdl({ create_tables: [], add_columns: [op] }, SCHEMA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("add_column_not_nullable");
  });

  it("rejects a widen column that carries a DEFAULT", () => {
    const op: AddColumnOp = {
      table: "events",
      column: { name: "note", type: "text", nullable: true, default: "'x'", description: "c" },
    };
    const res = compileWriteDdl({ create_tables: [], add_columns: [op] }, SCHEMA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("add_column_has_default");
  });

  it("rejects a reserved schema / table / column name", () => {
    expect(
      compileWriteDdl({ create_tables: [table("t", [idCol], ["id"])], add_columns: [] }, "select")
        .ok,
    ).toBe(false);
    const reservedTable = compileWriteDdl(
      {
        create_tables: [],
        add_columns: [
          { table: "where", column: { name: "x", type: "text", nullable: true, description: "c" } },
        ],
      },
      SCHEMA,
    );
    expect(reservedTable.ok).toBe(false);
    if (!reservedTable.ok) expect(reservedTable.reason).toBe("reserved_word");
  });

  it("rejects a duplicate new-table name and a duplicate column", () => {
    const dupTable = compileWriteDdl(
      {
        create_tables: [table("t", [idCol], ["id"]), table("t", [idCol], ["id"])],
        add_columns: [],
      },
      SCHEMA,
    );
    expect(dupTable.ok).toBe(false);
    if (!dupTable.ok) expect(dupTable.reason).toBe("duplicate_identifier");

    const dupCol = compileWriteDdl(
      { create_tables: [table("t", [idCol, idCol], ["id"])], add_columns: [] },
      SCHEMA,
    );
    expect(dupCol.ok).toBe(false);
    if (!dupCol.ok) expect(dupCol.reason).toBe("duplicate_identifier");
  });

  it("rejects a PK column absent from the new table's columns", () => {
    const res = compileWriteDdl(
      { create_tables: [table("t", [idCol], ["missing"])], add_columns: [] },
      SCHEMA,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("primary_key_column_missing");
  });
});
