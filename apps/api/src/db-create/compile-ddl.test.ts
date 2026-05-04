// Unit tests for the DDL compiler (docs/architecture.md §3.6.5,
// SK-HDC-002). Tests cover byte-for-byte determinism, every
// documented `CompileFailureReason`, and the type-mapping table.
//
// The libpg_query AST validator is the sibling
// `apps/api/src/ask/sql-validate-ddl.ts` per SK-HDC-006; its tests
// live next to it. Splitting the test files mirrors the source
// split — neither side mocks the other.

import type { SchemaPlan } from "@nlqdb/db/types";
import { describe, expect, it } from "vitest";
import { type CompileDdlResult, compileDdl } from "./compile-ddl.ts";

const minimalTable: SchemaPlan = {
  slug_hint: "test_plan",
  description: "test plan",
  tables: [
    {
      name: "orders",
      description: "test table",
      columns: [
        { name: "id", type: "uuid", nullable: false, description: "test col" },
        { name: "customer", type: "text", nullable: false, description: "test col" },
        { name: "total", type: "numeric", nullable: true, default: "0", description: "test col" },
      ],
      primary_key: ["id"],
    },
  ],
  foreign_keys: [],
  metrics: [],
  dimensions: [],
  sample_rows: [],
};

const planWithFk: SchemaPlan = {
  slug_hint: "test_plan",
  description: "test plan",
  tables: [
    {
      name: "customers",
      description: "test table",
      columns: [
        { name: "id", type: "uuid", nullable: false, description: "test col" },
        { name: "email", type: "text", nullable: false, description: "test col" },
      ],
      primary_key: ["id"],
    },
    {
      name: "orders",
      description: "test table",
      columns: [
        { name: "id", type: "uuid", nullable: false, description: "test col" },
        { name: "customer_id", type: "uuid", nullable: false, description: "test col" },
      ],
      primary_key: ["id"],
    },
  ],
  foreign_keys: [
    {
      from_table: "orders",
      from_columns: ["customer_id"],
      to_table: "customers",
      to_columns: ["id"],
      on_delete: "cascade",
    },
  ],
  metrics: [],
  dimensions: [],
  sample_rows: [],
};

function ok(result: CompileDdlResult): asserts result is { ok: true; statements: string[] } {
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
}

describe("compileDdl", () => {
  it("emits the expected DDL for a single-table plan", () => {
    const result = compileDdl(minimalTable, "tenant_a");
    ok(result);
    expect(result.statements).toEqual([
      `CREATE SCHEMA "tenant_a";`,
      [
        `CREATE TABLE "tenant_a"."orders" (`,
        `  "id" UUID NOT NULL,`,
        `  "customer" TEXT NOT NULL,`,
        `  "total" NUMERIC DEFAULT 0,`,
        `  PRIMARY KEY ("id")`,
        `);`,
      ].join("\n"),
    ]);
  });

  it("emits CREATE TABLE before ALTER ... ADD CONSTRAINT and the FK index last", () => {
    const result = compileDdl(planWithFk, "tenant_b");
    ok(result);
    expect(result.statements).toHaveLength(5); // schema, 2 tables, 1 fk, 1 index
    expect(result.statements[0]).toBe(`CREATE SCHEMA "tenant_b";`);
    expect(result.statements[1]).toContain(`CREATE TABLE "tenant_b"."customers"`);
    expect(result.statements[2]).toContain(`CREATE TABLE "tenant_b"."orders"`);
    expect(result.statements[3]).toBe(
      [
        `ALTER TABLE "tenant_b"."orders"`,
        `  ADD CONSTRAINT "fk_orders__customer_id"`,
        `  FOREIGN KEY ("customer_id")`,
        `  REFERENCES "tenant_b"."customers" ("id")`,
        `  ON DELETE CASCADE;`,
      ].join("\n"),
    );
    expect(result.statements[4]).toBe(
      `CREATE INDEX "idx_orders__customer_id" ON "tenant_b"."orders" ("customer_id");`,
    );
  });

  it("is deterministic — same plan twice produces byte-identical output", () => {
    const a = compileDdl(planWithFk, "tenant_c");
    const b = compileDdl(planWithFk, "tenant_c");
    ok(a);
    ok(b);
    expect(a.statements.join("\n")).toBe(b.statements.join("\n"));
  });

  it("rejects duplicate table names", () => {
    const dup = {
      name: "orders",
      description: "test table",
      columns: [{ name: "id", type: "uuid" as const, nullable: false, description: "test col" }],
      primary_key: ["id"],
    };
    const plan: SchemaPlan = {
      ...minimalTable,
      tables: [dup, dup],
    };
    const result = compileDdl(plan, "tenant_d");
    expect(result).toMatchObject({ ok: false, reason: "duplicate_identifier" });
  });

  it("rejects duplicate column names within a table", () => {
    const plan: SchemaPlan = {
      ...minimalTable,
      tables: [
        {
          name: "orders",
          description: "test table",
          columns: [
            { name: "id", type: "uuid", nullable: false, description: "test col" },
            { name: "id", type: "text", nullable: false, description: "test col" },
          ],
          primary_key: ["id"],
        },
      ],
    };
    const result = compileDdl(plan, "tenant_e");
    expect(result).toMatchObject({ ok: false, reason: "duplicate_identifier" });
  });

  it("rejects a primary_key column missing from columns[]", () => {
    const plan: SchemaPlan = {
      ...minimalTable,
      tables: [
        {
          name: "orders",
          description: "test table",
          columns: [{ name: "id", type: "uuid", nullable: false, description: "test col" }],
          primary_key: ["missing_col"],
        },
      ],
    };
    const result = compileDdl(plan, "tenant_f");
    expect(result).toMatchObject({
      ok: false,
      reason: "primary_key_column_missing",
    });
  });

  it("rejects an FK whose target table is not in tables[]", () => {
    const plan: SchemaPlan = {
      ...planWithFk,
      foreign_keys: [
        {
          from_table: "orders",
          from_columns: ["customer_id"],
          to_table: "no_such_table",
          to_columns: ["id"],
          on_delete: "no_action",
        },
      ],
    };
    const result = compileDdl(plan, "tenant_g");
    expect(result).toMatchObject({ ok: false, reason: "fk_target_not_found" });
  });

  it("rejects an FK whose target column is not in the target table", () => {
    const plan: SchemaPlan = {
      ...planWithFk,
      foreign_keys: [
        {
          from_table: "orders",
          from_columns: ["customer_id"],
          to_table: "customers",
          to_columns: ["no_such_column"],
          on_delete: "no_action",
        },
      ],
    };
    const result = compileDdl(plan, "tenant_h");
    expect(result).toMatchObject({ ok: false, reason: "fk_target_not_found" });
  });

  it("defensively rejects a reserved-word column name (post-Zod safety net)", () => {
    const plan: SchemaPlan = {
      ...minimalTable,
      tables: [
        {
          name: "orders",
          description: "test table",
          columns: [
            { name: "id", type: "uuid", nullable: false, description: "test col" },
            { name: "select", type: "text", nullable: false, description: "test col" },
          ],
          primary_key: ["id"],
        },
      ],
    };
    const result = compileDdl(plan, "tenant_i");
    expect(result).toMatchObject({ ok: false, reason: "reserved_word" });
  });

  it.each([
    ["text", "TEXT"],
    ["integer", "INTEGER"],
    ["bigint", "BIGINT"],
    ["numeric", "NUMERIC"],
    ["real", "REAL"],
    ["double_precision", "DOUBLE PRECISION"],
    ["boolean", "BOOLEAN"],
    ["date", "DATE"],
    ["timestamp_tz", "TIMESTAMPTZ"],
    ["uuid", "UUID"],
    ["jsonb", "JSONB"],
    ["text_array", "TEXT[]"],
  ] as const)("maps PgType %j to SQL %j", (pgType, sql) => {
    const plan: SchemaPlan = {
      slug_hint: "test_plan",
      description: "test plan",
      tables: [
        {
          name: "t",
          description: "test table",
          columns: [{ name: "a", type: pgType, nullable: false, description: "test col" }],
          primary_key: ["a"],
        },
      ],
      foreign_keys: [],
      metrics: [],
      dimensions: [],
      sample_rows: [],
    };
    const result = compileDdl(plan, "tenant_types");
    ok(result);
    expect(result.statements[1]).toContain(`"a" ${sql} NOT NULL`);
  });
});
