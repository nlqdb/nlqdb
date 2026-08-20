// Granted-read planner tests (SK-EKP-008, EK-06 box 2 — the composition
// keystone). `planGrantedRead` is where the box-2 guardrails compose into one
// exec-authorization decision; these pin that composition without a live DB:
// no grant fails closed; every `validateGrantScope` reject (base allowlist,
// read-only, out-of-scope) is passed through unchanged; and the happy path
// yields the exact `buildGrantExecSteps` batch under the derived `grant_<hex>`
// role with the owner's RLS identity. The live "owner rows, nothing else" +
// RLS-bypass proof is the route-wiring run's job; this fixes what it decides.

import { describe, expect, it } from "vitest";
import { planGrantedRead } from "./grant-read.ts";
import { grantRoleName } from "./grant-role.ts";
import { GRANT_STATEMENT_TIMEOUT } from "./grant-status.ts";
import type { GrantRecord } from "./grants.ts";

const GRANT_ID = "11111111-2222-3333-4444-555555555555";
const SCHEMA = "owner_schema_0123";
const OWNER = "user_owner_1";

const GRANT: GrantRecord = {
  id: GRANT_ID,
  ownerTenantId: OWNER,
  ownerDbId: "db_lang_tutor_1",
  granteeTenantId: "user_buyer_2",
  scope: ["lessons", "students"],
  priceModel: null,
  createdAt: 1_700_000_000,
  revokedAt: null,
};

function plan(rawSql: string, grant: GrantRecord | null = GRANT) {
  return planGrantedRead({ grant, rawSql, schemaName: SCHEMA });
}

describe("planGrantedRead — no live grant fails closed", () => {
  it("rejects with no_grant when the grant is null (none, or revoked and filtered)", async () => {
    // A well-formed in-scope read still cannot proceed without a grant — the
    // buyer never reaches a row without one.
    expect(await plan("SELECT * FROM lessons", null)).toEqual({ ok: false, reason: "no_grant" });
  });
});

describe("planGrantedRead — passes through every scope reject unchanged", () => {
  it("out_of_scope with the offending table when a JOIN leaks", async () => {
    expect(
      await plan("SELECT * FROM lessons l JOIN billing b ON b.student_id = l.student_id"),
    ).toEqual({ ok: false, reason: "out_of_scope", detail: "billing" });
  });

  it("not_read_only on a write against a granted table", async () => {
    expect(await plan("UPDATE lessons SET title = 'x' WHERE id = 1")).toEqual({
      ok: false,
      reason: "not_read_only",
    });
  });

  it("not_allowed on DDL, with the base reason passed through as detail", async () => {
    expect(await plan("DROP TABLE lessons")).toEqual({
      ok: false,
      reason: "not_allowed",
      detail: "drop_statement",
    });
  });

  it("does not derive a role or build steps when scope rejects", async () => {
    // The reject short-circuits before the exec-plan machinery — a rejected
    // read carries no role/steps a caller could accidentally run.
    const res = await plan("SELECT * FROM pricing");
    expect(res.ok).toBe(false);
    expect(res).not.toHaveProperty("execSteps");
    expect(res).not.toHaveProperty("grantRole");
  });
});

describe("planGrantedRead — an authorized read yields the exec plan", () => {
  it("returns the grant, the derived grant_ role, in-scope tables, and the exec batch", async () => {
    const rawSql = "SELECT l.id FROM lessons l JOIN students s ON s.id = l.student_id";
    const res = await plan(rawSql);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const role = await grantRoleName(GRANT_ID);
    expect(res.grant).toBe(GRANT);
    expect(res.grantRole).toBe(role);
    expect(res.grantRole).toMatch(/^grant_[0-9a-f]{16}$/);
    expect(res.tables).toEqual(["lessons", "students"]);

    // The exact batch `buildGrantExecSteps` builds: owner-scoped RLS GUCs
    // (never the buyer's), the 30 s in-flight revocation bound, the non-owner
    // role assumed last, then the buyer's statement.
    expect(res.execSteps).toEqual([
      { text: "SELECT set_config('search_path', $1, true)", params: [SCHEMA] },
      { text: "SELECT set_config('app.tenant_id', $1, true)", params: [OWNER] },
      { text: "SELECT set_config('app.agent_id', $1, true)", params: [OWNER] },
      { text: `SET LOCAL statement_timeout = '${GRANT_STATEMENT_TIMEOUT}'`, params: [] },
      { text: `SET LOCAL ROLE "${role}"`, params: [] },
      { text: rawSql, params: [] },
    ]);
  });
});
