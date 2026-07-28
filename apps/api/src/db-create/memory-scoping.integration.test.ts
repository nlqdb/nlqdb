// E-03 / SK-PIVOT-009 — the memory-scoping **invariant** test, executed by
// Postgres rather than asserted about a string. The DDL unit tests
// (`presets/agent-memory-v1.test.ts`) pin what we emit; this file proves
// what Postgres then does with it, because the whole slice is only worth
// anything if the engine actually filters the rows:
//
//   • two narrowed agents in ONE memory DB: A writes, B cannot read it, and
//     the tenant-default principal reads both (the account owner and the
//     E-04 sweep must never lose rows — SK-PIVOT-009's tenant-literal arm)
//   • end_user_id / thread_id hard gates: with the GUC set, another
//     end-user's / thread's rows are invisible to *any* SQL shape, not just
//     to a query that remembered to filter
//   • fail-closed: no `app.agent_id` at all ⇒ no rows
//   • expired `facts` invisible on reads before the sweep runs (E-04's
//     read-side half, SK-PIVOT-011)
//   • the write side is gated too: a narrowed agent cannot INSERT a row
//     tagged for another agent / end-user
//
// Gated on `NEON_TEST_BRANCH_URL` exactly like
// `neon-provision.integration.test.ts` — unset ⇒ the whole block skips, so
// CI without the secret stays green. Every statement below mirrors what the
// provisioner emits (schema → preset DDL → role + grants → RLS + the
// tenant/scope policies); the policy SQL itself comes from the real builder
// so the test cannot drift from production.
//
// RLS is only enforced for a NON-owner, so every read runs inside a
// transaction that drops to the test role via `SET LOCAL ROLE` — the same
// shape `buildHostedExecSteps` produces on the request path.

import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agentMemoryV1Ddl, agentMemoryV1ScopePolicies } from "./presets/agent-memory-v1.ts";

const TEST_BRANCH_URL = process.env["NEON_TEST_BRANCH_URL"];
const SCHEMA = "test_e03_scope";
const ROLE = "test_e03_role";
const TENANT = "user_e03";
const AGENT_A = "agent_a";
const AGENT_B = "agent_b";

const describeIntegration = TEST_BRANCH_URL ? describe : describe.skip;

describeIntegration("agent-memory scoping invariant — Neon (E-03 / SK-PIVOT-009)", () => {
  const sql = neon(TEST_BRANCH_URL ?? "postgresql://u:p@host.tld/db", { fullResults: true });

  // One read under the exec-path statement shape: scope GUCs, then drop to
  // the non-owner role, then the query. A GUC is omitted entirely when the
  // caller leaves it out — the "request didn't carry it" case, which must
  // leave the matching policy a no-op.
  async function readAs(
    scope: { agentId?: string | null; endUserId?: string | null; threadId?: string | null },
    query: string,
  ): Promise<Record<string, unknown>[]> {
    const steps = [sql.query("SELECT set_config('search_path', $1, true)", [SCHEMA])];
    for (const [guc, value] of [
      ["app.agent_id", scope.agentId],
      ["app.end_user_id", scope.endUserId],
      ["app.thread_id", scope.threadId],
    ] as const) {
      if (value != null) steps.push(sql.query(`SELECT set_config('${guc}', $1, true)`, [value]));
    }
    steps.push(sql.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT]));
    steps.push(sql.query(`SET LOCAL ROLE "${ROLE}"`));
    steps.push(sql.query(query));
    const results = await sql.transaction(steps, { isolationLevel: "ReadCommitted" });
    return (results[results.length - 1]?.rows ?? []) as Record<string, unknown>[];
  }

  // A write under the same wrapper — used to prove the policies' WITH CHECK
  // (defaulted from USING) gates INSERTs, not just SELECTs.
  function writeAs(
    scope: { agentId: string; endUserId?: string },
    statement: string,
    params: unknown[],
  ): Promise<unknown> {
    const steps = [
      sql.query("SELECT set_config('search_path', $1, true)", [SCHEMA]),
      sql.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT]),
      sql.query("SELECT set_config('app.agent_id', $1, true)", [scope.agentId]),
    ];
    if (scope.endUserId !== undefined) {
      steps.push(sql.query("SELECT set_config('app.end_user_id', $1, true)", [scope.endUserId]));
    }
    steps.push(sql.query(`SET LOCAL ROLE "${ROLE}"`));
    steps.push(sql.query(statement, params));
    return sql.transaction(steps, { isolationLevel: "ReadCommitted" });
  }

  const contents = (rows: Record<string, unknown>[]): string[] =>
    rows.map((r) => String(r["content"])).sort();

  async function teardown(): Promise<void> {
    await sql.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    // The role owns nothing (privileges are per-schema and went with the
    // CASCADE), so a bare DROP ROLE is safe and idempotent under IF EXISTS.
    await sql.query(`DROP ROLE IF EXISTS "${ROLE}"`);
  }

  beforeAll(async () => {
    await teardown();
    await sql.transaction(
      [
        sql.query(`CREATE SCHEMA "${SCHEMA}"`),
        ...agentMemoryV1Ddl(SCHEMA).map((s) => sql.query(s)),
        sql.query(`CREATE ROLE "${ROLE}"`),
        sql.query(`GRANT "${ROLE}" TO CURRENT_USER WITH SET TRUE`),
        sql.query(`GRANT USAGE ON SCHEMA "${SCHEMA}" TO "${ROLE}"`),
        sql.query(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${SCHEMA}" TO "${ROLE}"`,
        ),
        sql.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA "${SCHEMA}" TO "${ROLE}"`),
        // The provisioner's permissive tenant policy + this slice's
        // restrictive scope policies, per table.
        ...["facts", "episodes", "entities", "entity_facts"].flatMap((t) => [
          sql.query(`ALTER TABLE "${SCHEMA}"."${t}" ENABLE ROW LEVEL SECURITY`),
          sql.query(
            `CREATE POLICY tenant_isolation ON "${SCHEMA}"."${t}" ` +
              `USING (current_setting('app.tenant_id', true) = '${TENANT}')`,
          ),
        ]),
        ...agentMemoryV1ScopePolicies(SCHEMA, TENANT).map((s) => sql.query(s)),
      ],
      { isolationLevel: "ReadCommitted" },
    );

    // Seed as the owner (RLS bypassed) so the fixture is independent of the
    // very policies under test.
    await sql.query(
      `INSERT INTO "${SCHEMA}"."facts"
         (agent_id, end_user_id, thread_id, kind, content, expires_at)
       VALUES ($1, $2, $3, 'fact', 'a-shared',   NULL),
              ($1, $4, $5, 'fact', 'a-eu7-t1',   NULL),
              ($1, $6, $5, 'fact', 'a-eu8-t1',   NULL),
              ($1, $4, $7, 'fact', 'a-eu7-t2',   NULL),
              ($1, NULL, NULL, 'fact', 'a-expired', now() - interval '1 hour'),
              ($1, NULL, NULL, 'fact', 'a-live',    now() + interval '1 hour'),
              ($8, NULL, NULL, 'fact', 'b-only',    NULL)`,
      [AGENT_A, null, null, "eu_7", "t_1", "eu_8", "t_2", AGENT_B],
    );
    await sql.query(
      `INSERT INTO "${SCHEMA}"."episodes" (agent_id, end_user_id, role, content)
       VALUES ($1, 'eu_7', 'user', 'a-ep-eu7'), ($2, NULL, 'user', 'b-ep')`,
      [AGENT_A, AGENT_B],
    );
    // entities + the link table, so the inherited scope on `entity_facts`
    // is exercised against a real join target.
    await sql.query(
      `WITH e AS (
         INSERT INTO "${SCHEMA}"."entities" (agent_id, kind, canonical_name)
         VALUES ($1, 'person', 'Ada'), ($2, 'person', 'Grace')
         RETURNING id, agent_id
       )
       INSERT INTO "${SCHEMA}"."entity_facts" (entity_id, fact_id)
       SELECT e.id, f.id FROM e
       JOIN "${SCHEMA}"."facts" f
         ON f.agent_id = e.agent_id AND f.content IN ('a-shared', 'b-only')`,
      [AGENT_A, AGENT_B],
    );
  });

  afterAll(teardown);

  it("agent A's rows are invisible to agent B, and vice versa", async () => {
    const asB = await readAs({ agentId: AGENT_B }, "SELECT content FROM facts");
    expect(contents(asB)).toEqual(["b-only"]);

    const asA = await readAs({ agentId: AGENT_A }, "SELECT content FROM facts");
    expect(contents(asA)).not.toContain("b-only");
  });

  it("no SQL shape gets around it — join, subquery and aggregate all see the scoped set", async () => {
    expect(
      await readAs({ agentId: AGENT_B }, `SELECT content FROM facts WHERE agent_id = '${AGENT_A}'`),
    ).toEqual([]);
    expect(
      await readAs(
        { agentId: AGENT_B },
        "SELECT content FROM facts WHERE id IN (SELECT id FROM facts)",
      ).then(contents),
    ).toEqual(["b-only"]);
    const counted = await readAs({ agentId: AGENT_B }, "SELECT count(*)::int AS n FROM facts");
    expect(counted[0]?.["n"]).toBe(1);
    // The link table has no agent_id of its own — it inherits scope from its
    // parent entities row, so agent B sees only its own link.
    const links = await readAs({ agentId: AGENT_B }, "SELECT count(*)::int AS n FROM entity_facts");
    expect(links[0]?.["n"]).toBe(1);
  });

  it("the tenant-default principal reads every agent's rows (owner + E-04 sweep stay sighted)", async () => {
    const all = await readAs({ agentId: TENANT }, "SELECT content FROM facts");
    // Everything except the expired row, which the TTL arm hides from reads.
    expect(contents(all)).toEqual([
      "a-eu7-t1",
      "a-eu7-t2",
      "a-eu8-t1",
      "a-live",
      "a-shared",
      "b-only",
    ]);
    const eps = await readAs({ agentId: TENANT }, "SELECT content FROM episodes");
    expect(contents(eps)).toEqual(["a-ep-eu7", "b-ep"]);
  });

  it("fails closed when no agent GUC is set at all (unset ⇒ no rows)", async () => {
    expect(await readAs({}, "SELECT content FROM facts")).toEqual([]);
    expect(await readAs({}, "SELECT content FROM episodes")).toEqual([]);
    expect(await readAs({}, "SELECT entity_id FROM entity_facts")).toEqual([]);
  });

  // A narrowed request must not poison the next request on the same backend.
  // `SET LOCAL`'s transaction-end reset leaves a custom GUC as the EMPTY
  // STRING (not NULL) for the rest of the session, and Neon's HTTP proxy
  // reuses backends — so a policy testing `current_setting(…) IS NULL` would
  // make every later unnarrowed read on that connection return nothing. The
  // policies use `nullif(current_setting(…), '') IS NULL` instead; this test
  // is the regression guard, and it only bites when the two reads land on the
  // same backend (so it can pass vacuously — the DDL unit test pins the
  // `nullif` shape unconditionally).
  it("an earlier narrowed request does not narrow a later unnarrowed one", async () => {
    await readAs({ agentId: AGENT_A, endUserId: "eu_7", threadId: "t_1" }, "SELECT 1");
    const after = await readAs({ agentId: AGENT_A }, "SELECT content FROM facts");
    expect(contents(after)).toEqual(["a-eu7-t1", "a-eu7-t2", "a-eu8-t1", "a-live", "a-shared"]);
  });

  it("end_user_id is a hard gate when set, and a no-op when absent", async () => {
    const eu7 = await readAs({ agentId: AGENT_A, endUserId: "eu_7" }, "SELECT content FROM facts");
    expect(contents(eu7)).toEqual(["a-eu7-t1", "a-eu7-t2"]);
    // Another end-user's row cannot be reached even by naming it.
    expect(
      await readAs(
        { agentId: AGENT_A, endUserId: "eu_7" },
        "SELECT content FROM facts WHERE end_user_id = 'eu_8'",
      ),
    ).toEqual([]);
    // Absent ⇒ cross-end-user analytics run unrestricted inside the agent
    // scope (the wedge pitch).
    const crossEndUser = await readAs({ agentId: AGENT_A }, "SELECT content FROM facts");
    expect(contents(crossEndUser)).toContain("a-eu8-t1");
    // The gate applies to episodes too.
    const eps = await readAs(
      { agentId: TENANT, endUserId: "eu_7" },
      "SELECT content FROM episodes",
    );
    expect(contents(eps)).toEqual(["a-ep-eu7"]);
  });

  it("thread_id narrows within an end-user, and composes with it", async () => {
    const t1 = await readAs({ agentId: AGENT_A, threadId: "t_1" }, "SELECT content FROM facts");
    expect(contents(t1)).toEqual(["a-eu7-t1", "a-eu8-t1"]);
    const t1eu7 = await readAs(
      { agentId: AGENT_A, endUserId: "eu_7", threadId: "t_1" },
      "SELECT content FROM facts",
    );
    expect(contents(t1eu7)).toEqual(["a-eu7-t1"]);
  });

  it("expired facts are invisible on reads before any sweep runs (E-04 read-side)", async () => {
    const rows = await readAs({ agentId: AGENT_A }, "SELECT content FROM facts");
    expect(contents(rows)).toContain("a-live");
    expect(contents(rows)).not.toContain("a-expired");
    // Still there physically — the sweep (owner-run) is what deletes it.
    const owner = await sql.query(
      `SELECT count(*)::int AS n FROM "${SCHEMA}"."facts" WHERE content = 'a-expired'`,
    );
    expect((owner.rows[0] as { n: number }).n).toBe(1);
  });

  it("gates writes as well as reads — a narrowed agent cannot tag a row for another scope", async () => {
    await expect(
      writeAs(
        { agentId: AGENT_B },
        "INSERT INTO facts (agent_id, kind, content) VALUES ($1, 'fact', 'forged')",
        [AGENT_A],
      ),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      writeAs(
        { agentId: AGENT_B, endUserId: "eu_7" },
        "INSERT INTO facts (agent_id, end_user_id, kind, content) VALUES ($1, 'eu_8', 'fact', 'forged')",
        [AGENT_B],
      ),
    ).rejects.toThrow(/row-level security/i);
    // The matching-scope write is accepted.
    await writeAs(
      { agentId: AGENT_B },
      "INSERT INTO facts (agent_id, kind, content) VALUES ($1, 'fact', 'b-own-write')",
      [AGENT_B],
    );
    expect(contents(await readAs({ agentId: AGENT_B }, "SELECT content FROM facts"))).toEqual([
      "b-only",
      "b-own-write",
    ]);
    await sql.query(`DELETE FROM "${SCHEMA}"."facts" WHERE content = 'b-own-write'`);
  });
});
