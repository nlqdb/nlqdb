// SK-HDC-012 — integration smoke test for the Neon HTTP transaction
// batch path. Asserts that DDL + RLS + INSERT all batch correctly,
// that any statement failure rolls back the whole batch atomically,
// and that `SET LOCAL statement_timeout` scopes correctly inside the
// batch.
//
// Gated on `NEON_TEST_BRANCH_URL` — when unset, every test in this
// file `skip`s (so CI without the secret stays green). When set,
// the suite runs against a disposable Neon dev branch and cleans up
// `test_ws6*` schemas at start and end.
//
// Skill cross-ref: docs/features/hosted-db-create/FEATURE.md SK-HDC-012.
// Worksheet: worksheets/WS6-neon-batch-provisioner.md (Step 1).
//
// The cleanup helper drops `test_ws6*` schemas idempotently — missing
// schema is not an error. Tests are self-contained: no shared fixtures
// across other tests in the suite.

import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_BRANCH_URL = process.env["NEON_TEST_BRANCH_URL"];
const SCHEMA_PREFIX = "test_ws6";

// `describe.skipIf` — every test in the block skips when no branch
// URL is configured. Local devs without a Neon dev branch get a clean
// pass; CI with the secret runs the full suite.
const describeIntegration = TEST_BRANCH_URL ? describe : describe.skip;

describeIntegration("provisioner batch — Neon HTTP integration (SK-HDC-012)", () => {
  // Constructed inside the suite body so the skipped path doesn't
  // blow up at module-load time when NEON_TEST_BRANCH_URL is unset.
  // The placeholder URL has the shape neon() validates against; the
  // skipped suite never actually issues a fetch.
  const sql = neon(TEST_BRANCH_URL ?? "postgresql://u:p@host.tld/db", {
    fullResults: true,
  });

  async function dropTestSchemas(): Promise<void> {
    // Find every schema starting with our prefix and DROP CASCADE.
    // Idempotent: zero matches is success.
    const result = await sql.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE $1",
      [`${SCHEMA_PREFIX}%`],
    );
    for (const row of (result.rows ?? []) as { schema_name: string }[]) {
      // Schema names are restricted to the regex ^test_ws6[a-z0-9_]+$
      // by the test fixtures below; no injection surface.
      await sql.query(`DROP SCHEMA IF EXISTS "${row.schema_name}" CASCADE`);
    }
  }

  beforeAll(async () => {
    await dropTestSchemas();
  });

  afterAll(async () => {
    await dropTestSchemas();
  });

  it("happy-path batch: SET LOCAL + CREATE SCHEMA + CREATE TABLE + INSERT in one round-trip", async () => {
    const schemaName = `${SCHEMA_PREFIX}_happy`;
    await sql.transaction(
      [
        sql.query("SET LOCAL statement_timeout = '30s'"),
        sql.query(`CREATE SCHEMA "${schemaName}"`),
        sql.query(`CREATE TABLE "${schemaName}".t (id int, label text)`),
        sql.query(`INSERT INTO "${schemaName}".t (id, label) VALUES ($1, $2)`, [1, "alice"]),
      ],
      { isolationLevel: "ReadCommitted" },
    );

    const tables = await sql.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = $1",
      [schemaName],
    );
    expect((tables.rows as { table_name: string }[]).map((r) => r.table_name)).toEqual(["t"]);

    const rows = await sql.query(`SELECT id, label FROM "${schemaName}".t ORDER BY id`);
    expect(rows.rows).toEqual([{ id: 1, label: "alice" }]);
  });

  it("rollback on broken statement: every prior statement is undone (no half-created schema)", async () => {
    const schemaName = `${SCHEMA_PREFIX}_rollback`;
    await expect(
      sql.transaction(
        [
          sql.query(`CREATE SCHEMA "${schemaName}"`),
          sql.query(`CREATE TABLE "${schemaName}".t (id int)`),
          // Deliberate parse error — column name `1invalid` cannot
          // start with a digit. Postgres aborts the whole transaction.
          sql.query(`CREATE TABLE "${schemaName}".fail (1invalid int)`),
        ],
        { isolationLevel: "ReadCommitted" },
      ),
    ).rejects.toThrow();

    // Schema must not exist after the rollback.
    const after = await sql.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1",
      [schemaName],
    );
    expect(after.rows).toEqual([]);
  });

  it("RLS DDL works in a batch: CREATE TABLE + ENABLE RLS + CREATE POLICY all atomic", async () => {
    const schemaName = `${SCHEMA_PREFIX}_rls`;
    await sql.transaction(
      [
        sql.query(`CREATE SCHEMA "${schemaName}"`),
        sql.query(`CREATE TABLE "${schemaName}".t (id int, tenant_id text)`),
        sql.query(`ALTER TABLE "${schemaName}".t ENABLE ROW LEVEL SECURITY`),
        sql.query(
          `CREATE POLICY tenant_isolation ON "${schemaName}".t USING (tenant_id = current_setting('app.tenant_id', true))`,
        ),
      ],
      { isolationLevel: "ReadCommitted" },
    );

    const rls = await sql.query("SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass", [
      `"${schemaName}".t`,
    ]);
    expect((rls.rows[0] as { relrowsecurity: boolean }).relrowsecurity).toBe(true);

    const policies = await sql.query(
      "SELECT polname FROM pg_policy WHERE polrelid = $1::regclass",
      [`"${schemaName}".t`],
    );
    expect((policies.rows as { polname: string }[]).map((r) => r.polname)).toEqual([
      "tenant_isolation",
    ]);
  });

  it("SET LOCAL statement_timeout scopes inside the batch transaction", async () => {
    // A 100 ms timeout against a 1 s sleep should reject — confirms
    // SET LOCAL applies to subsequent statements in the same batch.
    // 57014 = query_canceled (statement_timeout); the driver may
    // surface it as a thrown NeonDbError or rejected promise.
    const start = Date.now();
    await expect(
      sql.transaction(
        [sql.query("SET LOCAL statement_timeout = '100ms'"), sql.query("SELECT pg_sleep(1)")],
        { isolationLevel: "ReadCommitted" },
      ),
    ).rejects.toThrow();
    const elapsed = Date.now() - start;
    // The full sleep would be 1000+ms; with the 100ms timeout we
    // should reject well under 500ms even with HTTP latency. Loose
    // upper bound: 800ms.
    expect(elapsed).toBeLessThan(800);
  });

  it("collision: bare CREATE SCHEMA on an existing schema fails with SQLSTATE 42P06", async () => {
    // SK-HDC-012 dropped the IF NOT EXISTS guard — the orchestrator
    // retries on 42P06 with a fresh suffix. Verify the SQLSTATE is
    // what we map.
    const schemaName = `${SCHEMA_PREFIX}_collide`;
    await sql.query(`CREATE SCHEMA "${schemaName}"`);
    try {
      await expect(
        sql.transaction([sql.query(`CREATE SCHEMA "${schemaName}"`)], {
          isolationLevel: "ReadCommitted",
        }),
      ).rejects.toMatchObject({ code: "42P06" });
    } finally {
      await sql.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
  });
});
