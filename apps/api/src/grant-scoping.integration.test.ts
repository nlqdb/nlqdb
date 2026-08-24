// EK-06 box 2 / SK-EKP-008 — the cross-tenant granted-read **invariant**
// test, executed by Postgres rather than asserted about a string. The pure
// builders are unit-tested elsewhere (`grant-provision.test.ts`,
// `grant-exec.test.ts`, `grant-read.test.ts`, `grant-scope.test.ts`); this
// file proves what Postgres then *does* with a grant role provisioned by
// `buildGrantRoleDdl` and a read assembled by `buildGrantExecSteps` — because
// the whole primitive is only worth anything if the engine actually stops a
// buyer at the owner's schema boundary. It is the live "owner rows, nothing
// else" + RLS-bypass kill-test the box-2 sub-piece headers defer to the
// route-wiring run: the wiring is still ahead, but the DB-role guarantees it
// leans on are provable now, so a later route bug can't be mistaken for a
// grant-primitive bug.
//
// Every statement below comes from the SAME builders production runs (the
// provisioner path's `agentMemoryV1Ddl` + `agentMemoryV1ScopePolicies`, the
// grant path's `buildGrantRoleDdl` + `buildGrantExecSteps`), so the test
// cannot drift from what mint provisions and what a granted `/v1/ask`
// executes — the memory-scoping integration test's philosophy applied to the
// grant primitive.
//
// Gated on `NEON_TEST_BRANCH_URL` exactly like
// `neon-provision.integration.test.ts` and `memory-scoping.integration.test.ts`
// — unset ⇒ the whole block skips, so CI without the secret stays green.
//
// The invariants proven (SK-EKP-008):
//   • **owner rows, all agents** — a granted read sees the whole knowledge DB
//     (the marketplace sells the DB, not one narrowed agent): the tenant-
//     literal arm of `agent_isolation` returns every owner agent's rows, and
//     the TTL arm still hides expired ones.
//   • **cross-tenant boundary (the RLS-bypass kill-test)** — the grant role
//     has USAGE on the owner's schema only, so a read that fully qualifies
//     another tenant's schema, directly OR via JOIN, fails closed: a buyer
//     cannot reach knowledge they were not granted, whatever SQL shape they
//     try.
//   • **SELECT-only** — the role holds no INSERT/UPDATE/DELETE, so a granted
//     write is denied at the role level (defense-in-depth beneath the
//     validation-layer read-only guard).
//   • **FORCE ROW LEVEL SECURITY** — every scoped table is FORCE-RLS'd
//     (guardrail #3), so even the table-owning connection is policy-bound if
//     the `SET LOCAL ROLE` switch ever mis-fires.

import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentMemoryV1Ddl,
  agentMemoryV1ScopePolicies,
} from "./db-create/presets/agent-memory-v1.ts";
import { buildGrantExecSteps } from "./grant-exec.ts";
import { buildGrantRoleDdl } from "./grant-provision.ts";
import { grantRoleName } from "./grant-role.ts";

const TEST_BRANCH_URL = process.env["NEON_TEST_BRANCH_URL"];

const SCHEMA_OWNER = "test_ek06_owner";
const SCHEMA_OTHER = "test_ek06_other";
const OWNER_TENANT = "user_ek06_owner";
const OTHER_TENANT = "user_ek06_other";
// A fixed grant id ⇒ a deterministic `grant_<hex>` role name, so teardown can
// drop it idempotently across runs.
const GRANT_ID = "grant_ek06_scoping_test";
const OWNER_AGENT_A = "owner_agent_a";
const OWNER_AGENT_B = "owner_agent_b";
const SCOPE = ["facts", "episodes", "entities", "entity_facts"];

const describeIntegration = TEST_BRANCH_URL ? describe : describe.skip;

describeIntegration("granted-read scoping invariant — Neon (EK-06 / SK-EKP-008)", () => {
  // Constructed inside the suite body so the skipped path doesn't blow up at
  // module-load time when the URL is unset — same idiom as the sibling tests.
  const sql = neon(TEST_BRANCH_URL ?? "postgresql://u:p@host.tld/db", { fullResults: true });

  let grantRole = "";

  // Provision one memory schema the way `neon-provision.ts` does on the preset
  // path: DDL → per-table ENABLE RLS + permissive `tenant_isolation` → the
  // restrictive scope policies. The policy SQL comes from the real builders so
  // the fixture cannot diverge from production.
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

  // A buyer's granted read, run through the EXACT statement batch a granted
  // `/v1/ask` executes: `buildGrantExecSteps` sets the owner-scoped RLS GUCs,
  // pins the in-flight `statement_timeout`, drops to the non-owner grant role,
  // then runs the user statement.
  async function grantedRead(query: string): Promise<Record<string, unknown>[]> {
    const steps = buildGrantExecSteps(SCHEMA_OWNER, OWNER_TENANT, grantRole, {
      text: query,
      params: [],
    });
    const results = await sql.transaction(
      steps.map((s) => sql.query(s.text, s.params as never[])),
      { isolationLevel: "ReadCommitted" },
    );
    return (results[results.length - 1]?.rows ?? []) as Record<string, unknown>[];
  }

  const contents = (rows: Record<string, unknown>[]): string[] =>
    rows.map((r) => String(r["content"])).sort();

  async function teardown(): Promise<void> {
    await sql.query(`DROP SCHEMA IF EXISTS "${SCHEMA_OWNER}" CASCADE`);
    await sql.query(`DROP SCHEMA IF EXISTS "${SCHEMA_OTHER}" CASCADE`);
    // The role owns nothing (privileges are per-schema and went with the
    // CASCADEs), so a bare DROP ROLE is safe and idempotent under IF EXISTS.
    if (grantRole) await sql.query(`DROP ROLE IF EXISTS "${grantRole}"`);
  }

  beforeAll(async () => {
    grantRole = await grantRoleName(GRANT_ID);
    await teardown();

    // Schemas + policies first; the grant role (which FORCE-RLSes the owner
    // tables) comes AFTER seeding, so the owner connection can still seed the
    // fixture with RLS merely ENABLEd (owner bypasses ENABLE, not FORCE).
    await sql.transaction(
      [
        ...provisionSchema(SCHEMA_OWNER, OWNER_TENANT),
        ...provisionSchema(SCHEMA_OTHER, OTHER_TENANT),
      ],
      { isolationLevel: "ReadCommitted" },
    );

    // Owner's published knowledge: two agents under one tenant, plus an
    // expired row (must stay hidden) and a live one.
    await sql.query(
      `INSERT INTO "${SCHEMA_OWNER}"."facts" (agent_id, kind, content, expires_at)
       VALUES ($1, 'fact', 'owner-a-1', NULL),
              ($1, 'fact', 'owner-a-live', now() + interval '1 hour'),
              ($1, 'fact', 'owner-a-expired', now() - interval '1 hour'),
              ($2, 'fact', 'owner-b-1', NULL)`,
      [OWNER_AGENT_A, OWNER_AGENT_B],
    );
    await sql.query(
      `INSERT INTO "${SCHEMA_OWNER}"."episodes" (agent_id, role, content)
       VALUES ($1, 'user', 'owner-a-ep')`,
      [OWNER_AGENT_A],
    );

    // Another tenant's private knowledge, in its own schema — the thing a
    // grant on the owner DB must never reach.
    await sql.query(
      `INSERT INTO "${SCHEMA_OTHER}"."facts" (agent_id, kind, content)
       VALUES ('other_agent', 'fact', 'other-secret')`,
    );

    // Provision the grant role from the real builder — SELECT on exactly the
    // scope, WITH SET so the owner can assume it, FORCE RLS per table.
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

  it("returns the owner's rows across every owner agent (tenant-literal arm), minus expired", async () => {
    const facts = await grantedRead("SELECT content FROM facts");
    expect(contents(facts)).toEqual(["owner-a-1", "owner-a-live", "owner-b-1"]);
    const eps = await grantedRead("SELECT content FROM episodes");
    expect(contents(eps)).toEqual(["owner-a-ep"]);
  });

  it("cannot reach another tenant's schema — direct qualified read fails closed (RLS-bypass kill-test)", async () => {
    await expect(grantedRead(`SELECT content FROM "${SCHEMA_OTHER}".facts`)).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("cannot reach another tenant's schema via a JOIN either", async () => {
    await expect(
      grantedRead(`SELECT o.content FROM facts f JOIN "${SCHEMA_OTHER}".facts o ON true`),
    ).rejects.toThrow(/permission denied/i);
  });

  it("is SELECT-only — a granted write is denied at the role level", async () => {
    await expect(
      grantedRead("INSERT INTO facts (agent_id, kind, content) VALUES ('x', 'fact', 'forged')"),
    ).rejects.toThrow(/permission denied/i);
    await expect(grantedRead("DELETE FROM facts")).rejects.toThrow(/permission denied/i);
  });

  it("FORCE ROW LEVEL SECURITY is applied to every scoped table (guardrail #3)", async () => {
    const rows = await sql.query(
      "SELECT relname, relforcerowsecurity FROM pg_class " +
        "WHERE relnamespace = $1::regnamespace AND relname = ANY($2)",
      [`"${SCHEMA_OWNER}"`, SCOPE],
    );
    const forced = (rows.rows as { relname: string; relforcerowsecurity: boolean }[])
      .filter((r) => r.relforcerowsecurity)
      .map((r) => r.relname)
      .sort();
    expect(forced).toEqual([...SCOPE].sort());
  });
});
