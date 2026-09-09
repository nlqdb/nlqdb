// Unit tests for the widen-on-write transaction builder (GLOBAL-041 Phase A
// step 5, SK-SCHEMA-008). Cover the ordered batch shape (timeout →
// search_path → widen DDL → RLS/policy → grants → INSERT), the "grants +
// RLS only when a table is created" rule, tenant-literal escaping, the
// INSERT placed last with its params intact, and that a bad plan's compiler
// reason passes straight through with no batch built.

import type { Column, Table, WidenPlan } from "@nlqdb/db/types";
import { describe, expect, it } from "vitest";
import { tenantRoleName } from "../tenant-role.ts";
import type { PgTransactionStatement } from "./types.ts";
import { buildWidenBatch } from "./widen-provision.ts";

const SCHEMA = "db1";
const TENANT = "tenant-abc";
const INSERT: PgTransactionStatement = {
  sql: 'INSERT INTO "events" ("id", "note") VALUES ($1, $2)',
  params: ["e1", "hello"],
};

const idCol: Column = { name: "id", type: "uuid", nullable: false, description: "pk" };
function table(name: string, columns: Column[], primary_key: string[]): Table {
  return { name, description: "t", columns, primary_key };
}
function sqls(statements: PgTransactionStatement[]): string[] {
  return statements.map((s) => s.sql);
}
async function okBatch(plan: WidenPlan, tenantId = TENANT): Promise<PgTransactionStatement[]> {
  const res = await buildWidenBatch({ schemaName: SCHEMA, tenantId, plan, insert: INSERT });
  if (!res.ok) throw new Error(`expected ok, got ${res.reason}`);
  return res.statements;
}

describe("buildWidenBatch", () => {
  it("an ADD COLUMN-only plan skips RLS + grants (the table already has them)", async () => {
    const plan: WidenPlan = {
      create_tables: [],
      add_columns: [
        {
          table: "events",
          column: { name: "note", type: "text", nullable: true, description: "c" },
        },
      ],
    };
    const stmts = await okBatch(plan);
    expect(sqls(stmts)).toEqual([
      "SET LOCAL statement_timeout = '30s'",
      "SELECT set_config('search_path', $1, true)",
      'ALTER TABLE "db1"."events" ADD COLUMN "note" TEXT;',
      INSERT.sql,
    ]);
    // No RLS / policy / grant when nothing was created.
    expect(sqls(stmts).some((s) => /ROW LEVEL SECURITY|POLICY|GRANT/.test(s))).toBe(false);
  });

  it("a CREATE TABLE plan emits RLS + policy + schema-wide grants", async () => {
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
    const role = await tenantRoleName(TENANT);
    const stmts = sqls(await okBatch(plan));
    expect(stmts[0]).toBe("SET LOCAL statement_timeout = '30s'");
    expect(stmts[1]).toBe("SELECT set_config('search_path', $1, true)");
    expect(stmts[2]).toContain('CREATE TABLE "db1"."events"');
    expect(stmts[3]).toBe('ALTER TABLE "db1"."events" ENABLE ROW LEVEL SECURITY');
    expect(stmts[4]).toBe(
      'CREATE POLICY tenant_isolation ON "db1"."events" ' +
        "USING (current_setting('app.tenant_id', true) = 'tenant-abc')",
    );
    expect(stmts[5]).toBe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "db1" TO "${role}"`,
    );
    expect(stmts[6]).toBe(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA "db1" TO "${role}"`);
    expect(stmts[7]).toBe(INSERT.sql);
  });

  it("emits RLS + policy for every created table, before the grants", async () => {
    const plan: WidenPlan = {
      create_tables: [table("a", [idCol], ["id"]), table("b", [idCol], ["id"])],
      add_columns: [],
    };
    const stmts = sqls(await okBatch(plan));
    const rls = stmts.filter((s) => s.includes("ENABLE ROW LEVEL SECURITY"));
    const policies = stmts.filter((s) => s.includes("CREATE POLICY tenant_isolation"));
    expect(rls).toHaveLength(2);
    expect(policies).toHaveLength(2);
    // Both policies come before the first GRANT.
    const firstGrant = stmts.findIndex((s) => s.startsWith("GRANT"));
    const lastPolicy = stmts.map((s) => s.includes("CREATE POLICY")).lastIndexOf(true);
    expect(lastPolicy).toBeLessThan(firstGrant);
  });

  it("places the write last with its params intact, and no other statement carries params", async () => {
    const plan: WidenPlan = {
      create_tables: [table("events", [idCol], ["id"])],
      add_columns: [],
    };
    const res = await buildWidenBatch({
      schemaName: SCHEMA,
      tenantId: TENANT,
      plan,
      insert: INSERT,
    });
    if (!res.ok) throw new Error("expected ok");
    const last = res.statements[res.statements.length - 1];
    expect(last).toEqual(INSERT);
    // Only the search_path set_config (params: [schema]) and the INSERT carry
    // params; the DDL / RLS / grant statements are param-free.
    const withParams = res.statements.filter((s) => s.params !== undefined);
    expect(withParams).toHaveLength(2);
  });

  it("escapes a single quote in the tenant id inside the policy literal", async () => {
    const plan: WidenPlan = { create_tables: [table("t", [idCol], ["id"])], add_columns: [] };
    const stmts = sqls(await okBatch(plan, "o'brien"));
    const policy = stmts.find((s) => s.includes("CREATE POLICY"));
    expect(policy).toContain("= 'o''brien'");
  });

  it("passes a compiler failure reason straight through with no batch", async () => {
    // A reserved word the Zod gate would not have caught if a caller
    // hand-built the plan — the compiler's defense-in-depth reason wins.
    const res = await buildWidenBatch({
      schemaName: SCHEMA,
      tenantId: TENANT,
      plan: { create_tables: [table("select", [idCol], ["id"])], add_columns: [] },
      insert: INSERT,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("reserved_word");
  });

  it("rejects an unsafe schema name before compiling (SK-HDC-009)", async () => {
    await expect(
      buildWidenBatch({
        schemaName: "bad name",
        tenantId: TENANT,
        plan: { create_tables: [], add_columns: [] },
        insert: INSERT,
      }),
    ).rejects.toThrow(/unsafe schemaName/);
  });
});
