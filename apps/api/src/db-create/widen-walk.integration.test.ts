// Widen-on-write REAL-Postgres walk — GLOBAL-041 Phase A step 9 (E2E extend
// walk), the KPI-1 (first-insert inference rate) yield measurement the unit
// tests cannot make. `widen-provision.test.ts` pins the batch's string shape
// and its SQLSTATE classification against a stub; this file proves what
// Postgres then DOES with that batch — that the SQL `compile-write-ddl.ts`
// emits and `executeWidenBatch` runs is VALID Postgres that commits
// atomically and lands the write queryable. That is the "the DBA acts on a
// real database, observably" question (daily.md step-2 lever #1): each landed
// widen-write is one first-insert-inference hit.
//
// Gated on `NEON_TEST_BRANCH_URL` exactly like
// `neon-provision.integration.test.ts` — unset ⇒ the whole block `skip`s so CI
// without the secret stays green. When set, it runs against a disposable Neon
// branch and drops its schema + tenant role at start and end (a Postgres role
// is cluster-global, so teardown drops it too, best-effort).
//
// Skill cross-ref: docs/features/schema-widening/FEATURE.md SK-SCHEMA-008/011.

import type { WidenPlan } from "@nlqdb/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tenantRoleName } from "../tenant-role.ts";
import { buildPgClient } from "./pg-client.ts";
import type { PgClient, PgTransactionStatement } from "./types.ts";
import { buildWidenBatch, executeWidenBatch } from "./widen-provision.ts";

const TEST_BRANCH_URL = process.env["NEON_TEST_BRANCH_URL"];
const SCHEMA = "test_widen_walk";
const TENANT = "tenant_widen_walk";

// `describe.skipIf` — every test in the block skips when no branch URL is
// configured. CI without the secret gets a clean pass; a run (or CI) with the
// secret runs the walk against a disposable branch.
const describeIntegration = TEST_BRANCH_URL ? describe : describe.skip;

describeIntegration("widen-on-write real-Postgres walk (GLOBAL-041 KPI 1)", () => {
  // Constructed unconditionally so the skipped path doesn't blow up at
  // module-load; the placeholder URL has the shape neon() validates against
  // and the skipped suite never issues a fetch.
  const pg: PgClient = buildPgClient(TEST_BRANCH_URL ?? "postgresql://u:p@host.tld/db");
  let role = "";

  async function tryQuery(sql: string): Promise<void> {
    try {
      await pg.query(sql);
    } catch {
      // best-effort teardown: the branch is disposable and dropped after the run
    }
  }

  async function cleanup(): Promise<void> {
    await tryQuery(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    if (role) {
      // The schema (and its grants to the role) are gone; clear any residual
      // ownership then drop the cluster-global role.
      await tryQuery(`DROP OWNED BY "${role}"`);
      await tryQuery(`DROP ROLE IF EXISTS "${role}"`);
    }
  }

  beforeAll(async () => {
    role = await tenantRoleName(TENANT);
    await cleanup();
    await pg.query(`CREATE SCHEMA "${SCHEMA}"`);
    // The tenant role the CREATE-TABLE widen grants DML to (the same
    // least-privilege role `neon-provision.ts` creates per hosted DB).
    await pg.query(`CREATE ROLE "${role}" NOLOGIN`);
    // A pre-existing table for the ADD COLUMN (unobserved field) case.
    await pg.query(`CREATE TABLE "${SCHEMA}"."orders" ("id" uuid PRIMARY KEY)`);
  });

  afterAll(cleanup);

  it("lands a write to an UNOBSERVED FIELD (ADD COLUMN) — column appears, value queryable", async () => {
    const plan: WidenPlan = {
      create_tables: [],
      add_columns: [
        {
          table: "orders",
          column: { name: "total", type: "numeric", nullable: true, description: "order total" },
        },
      ],
    };
    const insert: PgTransactionStatement = {
      sql: 'INSERT INTO "orders" ("id", "total") VALUES ($1, $2)',
      params: ["11111111-1111-1111-1111-111111111111", "5.50"],
    };
    const batch = await buildWidenBatch({ schemaName: SCHEMA, tenantId: TENANT, plan, insert });
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;

    // KPI-1 hit: the first-insert naming an unobserved field lands in one txn.
    const res = await executeWidenBatch({ pg }, batch.statements);
    expect(res.ok).toBe(true);

    // The column now exists with the compiled type…
    const col = await pg.query<{ data_type: string }>(
      "SELECT data_type FROM information_schema.columns " +
        "WHERE table_schema = $1 AND table_name = 'orders' AND column_name = 'total'",
      [SCHEMA],
    );
    expect(col.rows[0]?.data_type).toBe("numeric");
    // …and the row that needed it is readable with its value.
    const row = await pg.query<{ total: string }>(
      `SELECT "total"::text AS total FROM "${SCHEMA}"."orders" WHERE "id" = $1`,
      ["11111111-1111-1111-1111-111111111111"],
    );
    expect(row.rows[0]?.total).toBe("5.50");
  });

  it("lands a write to an UNOBSERVED TABLE (CREATE TABLE) — RLS + tenant_isolation policy attached, row queryable", async () => {
    const plan: WidenPlan = {
      create_tables: [
        {
          name: "ratings",
          description: "user ratings",
          columns: [
            { name: "id", type: "uuid", nullable: false, description: "pk" },
            { name: "stars", type: "integer", nullable: true, description: "1-5" },
          ],
          primary_key: ["id"],
        },
      ],
      add_columns: [],
    };
    const insert: PgTransactionStatement = {
      sql: 'INSERT INTO "ratings" ("id", "stars") VALUES ($1, $2)',
      params: ["22222222-2222-2222-2222-222222222222", 5],
    };
    const batch = await buildWidenBatch({ schemaName: SCHEMA, tenantId: TENANT, plan, insert });
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;

    // KPI-1 hit: the first-insert naming an unobserved table lands in one txn.
    const res = await executeWidenBatch({ pg }, batch.statements);
    expect(res.ok).toBe(true);

    // The row landed…
    const row = await pg.query<{ stars: number }>(
      `SELECT "stars" FROM "${SCHEMA}"."ratings" WHERE "id" = $1`,
      ["22222222-2222-2222-2222-222222222222"],
    );
    expect(row.rows[0]?.stars).toBe(5);
    // …RLS is enabled on the widen-created table…
    const rls = await pg.query<{ relrowsecurity: boolean }>(
      "SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace " +
        "WHERE n.nspname = $1 AND c.relname = 'ratings'",
      [SCHEMA],
    );
    expect(rls.rows[0]?.relrowsecurity).toBe(true);
    // …and the tenant_isolation policy is attached (the same predicate the
    // create path emits, so a future tenant-role read is scoped).
    const pol = await pg.query<{ polname: string }>(
      "SELECT p.polname FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid " +
        "JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relname = 'ratings'",
      [SCHEMA],
    );
    expect(pol.rows.map((r) => r.polname)).toContain("tenant_isolation");
  });

  it("rolls the whole batch back when the write is doomed — schema never widens for a write that never landed (SK-SCHEMA-008)", async () => {
    // ADD COLUMN "discount" (numeric) + an INSERT binding a non-numeric text
    // value to it. Postgres rejects at the trailing INSERT (class 22); the
    // ADD COLUMN in the same transaction must roll back with it.
    const plan: WidenPlan = {
      create_tables: [],
      add_columns: [
        {
          table: "orders",
          column: { name: "discount", type: "numeric", nullable: true, description: "d" },
        },
      ],
    };
    const insert: PgTransactionStatement = {
      sql: 'INSERT INTO "orders" ("id", "discount") VALUES ($1, $2)',
      params: ["33333333-3333-3333-3333-333333333333", "not-a-number"],
    };
    const batch = await buildWidenBatch({ schemaName: SCHEMA, tenantId: TENANT, plan, insert });
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;

    const res = await executeWidenBatch({ pg }, batch.statements);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("write_rejected"); // class-22 on the INSERT

    // The widen rolled back with the doomed write: the column must NOT exist.
    const col = await pg.query(
      "SELECT 1 FROM information_schema.columns " +
        "WHERE table_schema = $1 AND table_name = 'orders' AND column_name = 'discount'",
      [SCHEMA],
    );
    expect(col.rows.length).toBe(0);
  });
});
