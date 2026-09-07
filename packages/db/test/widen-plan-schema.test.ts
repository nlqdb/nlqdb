import { describe, expect, it } from "vitest";

import { WidenPlanSchema } from "../src/index.ts";

// GLOBAL-041 Phase A step 2 — the SK-HDC-003 layer-1 gate the widen path runs
// LLM output through before `compile-write-ddl.ts` (layer 2 = libpg_query
// allow-list). Mirrors how `SchemaPlanSchema` gates `inferSchema` on the
// create path: the validator exists before the untrusted-input path that
// feeds it. The two nullable/no-default refinements are the same grammar the
// compiler's `validateAddColumn` and the `sql-validate-ddl.ts` allow-list
// enforce — asserted here at parse time so a bad LLM plan fails loud
// (GLOBAL-012) before any DDL is emitted.

const addColumn = (table: string, name: string, extra: Record<string, unknown> = {}) => ({
  table,
  column: { name, type: "text", description: "", ...extra },
});

const table = (name: string) => ({
  name,
  description: "",
  columns: [{ name: "id", type: "uuid", description: "" }],
  primary_key: ["id"],
});

describe("WidenPlanSchema", () => {
  it("accepts a plan with add_columns and create_tables", () => {
    const parsed = WidenPlanSchema.safeParse({
      create_tables: [table("orders")],
      add_columns: [addColumn("users", "nickname")],
    });
    expect(parsed.success).toBe(true);
  });

  it("defaults an omitted `nullable` to true (a widen add is nullable)", () => {
    const parsed = WidenPlanSchema.safeParse({
      create_tables: [],
      add_columns: [addColumn("users", "nickname")],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.add_columns[0]?.column.nullable).toBe(true);
  });

  it("rejects a plan with neither op (empty_plan lifted to parse time)", () => {
    expect(WidenPlanSchema.safeParse({ create_tables: [], add_columns: [] }).success).toBe(false);
  });

  it("rejects a NOT NULL add column (SK-SCHEMA-008 — cannot widen an existing table NOT NULL)", () => {
    expect(
      WidenPlanSchema.safeParse({
        create_tables: [],
        add_columns: [addColumn("users", "nickname", { nullable: false })],
      }).success,
    ).toBe(false);
  });

  it("rejects an add column carrying a DEFAULT (SK-SCHEMA-009 retype proposal, not a silent widen)", () => {
    expect(
      WidenPlanSchema.safeParse({
        create_tables: [],
        add_columns: [addColumn("users", "status", { default: "'active'" })],
      }).success,
    ).toBe(false);
  });

  it("rejects a reserved-word table identifier (IdentifierSchema)", () => {
    expect(
      WidenPlanSchema.safeParse({
        create_tables: [],
        add_columns: [addColumn("select", "nickname")],
      }).success,
    ).toBe(false);
  });
});
