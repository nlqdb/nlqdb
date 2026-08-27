// EK-06 box 4 / SK-EKP-008 — the revocation-latency bound, IN-FLIGHT half,
// measured by Postgres rather than asserted about a string.
//
// SK-EKP-008 pins TWO clocks to one 30 s ceiling. The NEW-query clock (the
// status cache) is deterministically unit-measured with an injected wall
// clock in `grant-status.test.ts`; a revoked grant's D1 status flip is
// unit-tested in `grants`/`grant-usage`. The one guarantee neither can
// prove — because it is a property of the database, not of a pure function
// — is the IN-FLIGHT half: a granted read already executing when its grant
// is revoked cannot outlive `statement_timeout`, so within ≤30 s of a
// revoke every in-flight query is gone. This file measures exactly that,
// against a live Neon branch and through the SAME exec batch a granted
// `/v1/ask` runs (`grant-exec.ts` `buildGrantExecSteps`, which delegates the
// statement order to `ask/exec-steps.ts` `buildExecSteps`), so the test
// cannot drift from production.
//
// Two facts, together, are the measurement:
//   1. **The wired batch carries the bound.** The production
//      `buildGrantExecSteps` batch sets the session `statement_timeout` to
//      `GRANT_STATEMENT_TIMEOUT` (= the 30 s ceiling) — read back with
//      `SHOW`, so the value that reaches Postgres is proven, not the string
//      the builder emitted.
//   2. **Postgres enforces it.** A granted read that runs longer than the
//      in-flight bound is cancelled by Postgres (SQLSTATE 57014,
//      "canceling statement due to statement timeout"), under the exact
//      non-owner grant role and batch order production uses. Measured with
//      the bound TIGHTENED (the module blesses downward-only tightening —
//      `resolveGrantStatusTtlMs` clamps to [0, ceiling]) so the suite stays
//      fast; fact 1 pins the production value at the ceiling, so the
//      cancellation fact 2 proves runs at ≤30 s in production.
//
// Gated on `NEON_TEST_BRANCH_URL` exactly like
// `grant-scoping.integration.test.ts` and `memory-scoping.integration.test.ts`
// — unset ⇒ the whole block skips, so CI without the secret stays green.

import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildExecSteps, type HostedExecStep } from "./ask/exec-steps.ts";
import {
  agentMemoryV1Ddl,
  agentMemoryV1ScopePolicies,
} from "./db-create/presets/agent-memory-v1.ts";
import { buildGrantExecSteps } from "./grant-exec.ts";
import { buildGrantRoleDdl } from "./grant-provision.ts";
import { grantRoleName } from "./grant-role.ts";
import { GRANT_REVOCATION_BOUND_MS, GRANT_STATEMENT_TIMEOUT } from "./grant-status.ts";

const TEST_BRANCH_URL = process.env["NEON_TEST_BRANCH_URL"];

const SCHEMA_OWNER = "test_ek06_revoke_owner";
const OWNER_TENANT = "user_ek06_revoke_owner";
// A fixed grant id ⇒ a deterministic `grant_<hex>` role name, so teardown can
// drop it idempotently across runs.
const GRANT_ID = "grant_ek06_revocation_test";
const OWNER_AGENT = "owner_agent_r";
const SCOPE = ["facts", "episodes", "entities", "entity_facts"];

// A tightened in-flight bound for the cancellation measurement (fact 2). The
// module blesses tightening downward; a short value keeps the suite fast
// while proving the DB honours the batch's `statement_timeout`. The runaway
// read sleeps well past it.
const TIGHTENED_TIMEOUT = "250ms";
const RUNAWAY_SLEEP_SECONDS = 5;

const describeIntegration = TEST_BRANCH_URL ? describe : describe.skip;

describeIntegration("granted-read in-flight revocation bound — Neon (EK-06 / SK-EKP-008)", () => {
  const sql = neon(TEST_BRANCH_URL ?? "postgresql://u:p@host.tld/db", { fullResults: true });

  let grantRole = "";

  // Provision one memory schema the way `neon-provision.ts` does on the preset
  // path — same fixture the scoping integration test uses, from the real
  // builders so it cannot diverge from production.
  function provisionSchema(schemaName: string, tenantLiteral: string) {
    return [
      sql.query(`CREATE SCHEMA "${schemaName}"`),
      ...agentMemoryV1Ddl(schemaName).map((s) => sql.query(s)),
      ...["facts", "episodes", "entities", "entity_facts"].flatMap((t) => [
        sql.query(`ALTER TABLE "${schemaName}"."${t}" ENABLE ROW LEVEL SECURITY`),
        sql.query(
          `CREATE POLICY tenant_isolation ON "${schemaName}"."${t}" ` +
            `USING (current_setting('app.tenant_id', true) = '${tenantLiteral}')`,
        ),
      ]),
      ...agentMemoryV1ScopePolicies(schemaName, tenantLiteral).map((s) => sql.query(s)),
    ];
  }

  // Run a statement batch inside one transaction and return the last result's
  // rows — the shape a granted `/v1/ask` executes.
  async function runBatch(steps: HostedExecStep[]): Promise<Record<string, unknown>[]> {
    const results = await sql.transaction(
      steps.map((s) => sql.query(s.text, s.params as never[])),
      { isolationLevel: "ReadCommitted" },
    );
    return (results[results.length - 1]?.rows ?? []) as Record<string, unknown>[];
  }

  async function teardown(): Promise<void> {
    await sql.query(`DROP SCHEMA IF EXISTS "${SCHEMA_OWNER}" CASCADE`);
    if (grantRole) await sql.query(`DROP ROLE IF EXISTS "${grantRole}"`);
  }

  beforeAll(async () => {
    grantRole = await grantRoleName(GRANT_ID);
    await teardown();

    await sql.transaction(provisionSchema(SCHEMA_OWNER, OWNER_TENANT), {
      isolationLevel: "ReadCommitted",
    });
    await sql.query(
      `INSERT INTO "${SCHEMA_OWNER}"."facts" (agent_id, kind, content) VALUES ($1, 'fact', 'owner-1')`,
      [OWNER_AGENT],
    );

    const ddl = await buildGrantRoleDdl({
      grantId: GRANT_ID,
      schemaName: SCHEMA_OWNER,
      scope: SCOPE,
    });
    await sql.transaction(
      ddl.map((s) => sql.query(s)),
      { isolationLevel: "ReadCommitted" },
    );
  });

  afterAll(teardown);

  it("the wired granted batch sets the session statement_timeout to the SK-EKP-008 bound", async () => {
    // The exact production batch, with `SHOW` as the user statement so we read
    // back what actually reached Postgres — not the literal the builder emitted.
    const rows = await runBatch(
      buildGrantExecSteps(SCHEMA_OWNER, OWNER_TENANT, grantRole, {
        text: "SHOW statement_timeout",
        params: [],
      }),
    );
    expect(String(rows[0]?.["statement_timeout"])).toBe(GRANT_STATEMENT_TIMEOUT);
  });

  it("statement_timeout is pinned at or under the 30 s revocation ceiling", () => {
    // The in-flight clock the DB enforces can only ever be ≤ the bound the
    // NEW-query clock reads — a reviewer holds the wired route to this.
    expect(pgIntervalToMs(GRANT_STATEMENT_TIMEOUT)).toBeLessThanOrEqual(GRANT_REVOCATION_BOUND_MS);
  });

  it("Postgres cancels an in-flight granted read that outlives the bound (57014)", async () => {
    // Same batch order + non-owner grant role as production, bound tightened
    // (downward-only, module-blessed) so the runaway read is cancelled fast.
    // Fact 1 pins production at the ceiling, so this cancellation runs at ≤30 s
    // there — the in-flight half of the ≤30 s revocation latency.
    const steps = buildExecSteps({
      schemaName: SCHEMA_OWNER,
      tenantId: OWNER_TENANT,
      roleName: grantRole,
      userStep: { text: `SELECT pg_sleep(${RUNAWAY_SLEEP_SECONDS})`, params: [] },
      scope: { agentId: OWNER_TENANT },
      statementTimeout: TIGHTENED_TIMEOUT,
    });

    const started = Date.now();
    await expect(runBatch(steps)).rejects.toThrow(/canceling statement due to statement timeout/i);
    // Cancelled by the timeout, not by the driver waiting out the full sleep.
    expect(Date.now() - started).toBeLessThan(RUNAWAY_SLEEP_SECONDS * 1000);
  });
});

// Parse a Postgres interval literal as emitted by `msToPgInterval`
// (`<n>s` or `<n>ms`) back to milliseconds, for the ceiling assertion.
function pgIntervalToMs(literal: string): number {
  const ms = literal.match(/^(\d+)ms$/);
  if (ms) return Number(ms[1]);
  const s = literal.match(/^(\d+)s$/);
  if (s) return Number(s[1]) * 1000;
  throw new Error(`unrecognized interval literal: ${literal}`);
}
