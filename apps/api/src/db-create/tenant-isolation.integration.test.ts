// Cross-tenant isolation invariant, executed by Postgres. The per-tenant
// role is the load-bearing control (`exec-steps.ts` step 4): the shared
// owner bypasses RLS and can read any schema by qualifying it, so a user
// statement must neither reach another tenant's schema under the tenant
// role nor escape that role. The validator rejects a second statement
// (SK-SQLAL-009); this file pins the engine-side half on the exec shape.
//
// Gated on `NEON_TEST_BRANCH_URL` exactly like
// `neon-provision.integration.test.ts` — unset ⇒ the whole block skips.

import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_BRANCH_URL = process.env["NEON_TEST_BRANCH_URL"];
const OWN = "test_iso_own";
const OTHER = "test_iso_other";
const ROLE = "test_iso_role";
const SECRET = "other-tenant-secret";

const describeIntegration = TEST_BRANCH_URL ? describe : describe.skip;

describeIntegration("tenant isolation — Neon (exec-steps role drop)", () => {
  const sql = neon(TEST_BRANCH_URL ?? "postgresql://u:p@host.tld/db", { fullResults: true });

  // The request-path shape: search_path + tenant GUC, drop to the tenant
  // role, then the user statement.
  async function execAsTenant(statement: string): Promise<Record<string, unknown>[]> {
    const results = await sql.transaction(
      [
        sql.query("SELECT set_config('search_path', $1, true)", [OWN]),
        sql.query("SELECT set_config('app.tenant_id', $1, true)", ["user_iso"]),
        sql.query(`SET LOCAL ROLE "${ROLE}"`),
        sql.query(statement),
      ],
      { isolationLevel: "ReadCommitted" },
    );
    return (results[results.length - 1]?.rows ?? []) as Record<string, unknown>[];
  }

  async function teardown(): Promise<void> {
    await sql.query(`DROP SCHEMA IF EXISTS "${OWN}" CASCADE`);
    await sql.query(`DROP SCHEMA IF EXISTS "${OTHER}" CASCADE`);
    await sql.query(`DROP ROLE IF EXISTS "${ROLE}"`);
  }

  beforeAll(async () => {
    await teardown();
    await sql.transaction(
      [
        sql.query(`CREATE SCHEMA "${OWN}"`),
        sql.query(`CREATE TABLE "${OWN}".t (v text)`),
        sql.query(`INSERT INTO "${OWN}".t VALUES ('own-row')`),
        sql.query(`CREATE SCHEMA "${OTHER}"`),
        sql.query(`CREATE TABLE "${OTHER}".t (v text)`),
        sql.query(`INSERT INTO "${OTHER}".t VALUES ('${SECRET}')`),
        sql.query(`CREATE ROLE "${ROLE}"`),
        sql.query(`GRANT "${ROLE}" TO CURRENT_USER WITH SET TRUE`),
        sql.query(`GRANT USAGE ON SCHEMA "${OWN}" TO "${ROLE}"`),
        sql.query(`GRANT SELECT ON ALL TABLES IN SCHEMA "${OWN}" TO "${ROLE}"`),
      ],
      { isolationLevel: "ReadCommitted" },
    );
  });

  afterAll(teardown);

  it("reads its own schema", async () => {
    expect(await execAsTenant("SELECT v FROM t")).toEqual([{ v: "own-row" }]);
  });

  it("cannot read another tenant's schema by qualified name", async () => {
    await expect(execAsTenant(`SELECT v FROM "${OTHER}".t`)).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("a multi-statement user step never returns another tenant's rows", async () => {
    const rows = await execAsTenant(`SELECT 1; RESET ROLE; SELECT v FROM "${OTHER}".t`).catch(
      () => [] as Record<string, unknown>[],
    );
    expect(JSON.stringify(rows)).not.toContain(SECRET);
  });
});
