// EK-06 box 2 — granted-read exec batch tests (SK-EKP-008, the DB-role
// half, sub-piece (b)). Pins the ordered statement list a buyer's granted
// `/v1/ask` runs on the owner's DB: RLS GUCs set to the OWNER's identity
// (owner rows return), the in-flight `statement_timeout` pinned to the
// revocation bound, the non-owner `grant_<hex>` role assumed last before
// the user statement, and a `tenant_<hex>` / unsafe role refused. The live
// "owner rows, nothing else" + RLS-bypass proof is the route-wiring run
// (sub-piece (c)); this fixes what that run executes.

import { describe, expect, it } from "vitest";
import type { HostedExecStep } from "./ask/exec-steps.ts";
import { buildGrantExecSteps } from "./grant-exec.ts";
import { grantRoleName } from "./grant-role.ts";
import { GRANT_STATEMENT_TIMEOUT } from "./grant-status.ts";

const GRANT_ID = "11111111-2222-3333-4444-555555555555";
const SCHEMA = "owner_schema_0123";
const OWNER = "user_owner_1";
const USER_STEP: HostedExecStep = { text: "SELECT * FROM lessons", params: [] };

async function steps(scope?: { agentId: string; endUserId?: string; threadId?: string }) {
  const role = await grantRoleName(GRANT_ID);
  return { role, batch: buildGrantExecSteps(SCHEMA, OWNER, role, USER_STEP, scope) };
}

describe("buildGrantExecSteps — the granted-read exec order", () => {
  it("emits the load-bearing batch in order, owner-scoped by default", async () => {
    const { role, batch } = await steps();
    expect(batch).toEqual([
      { text: "SELECT set_config('search_path', $1, true)", params: [SCHEMA] },
      // RLS GUCs carry the OWNER's identity — the buyer never influences
      // them — so the owner's `agent_isolation` policy returns the owner's
      // rows (full-tenant visibility via the tenant-literal arm).
      { text: "SELECT set_config('app.tenant_id', $1, true)", params: [OWNER] },
      { text: "SELECT set_config('app.agent_id', $1, true)", params: [OWNER] },
      { text: `SET LOCAL statement_timeout = '${GRANT_STATEMENT_TIMEOUT}'`, params: [] },
      { text: `SET LOCAL ROLE "${role}"`, params: [] },
      USER_STEP,
    ]);
  });

  it("pins the in-flight statement_timeout to the revocation bound, not the request cap", async () => {
    const { batch } = await steps();
    const timeout = batch.find((s) => s.text.startsWith("SET LOCAL statement_timeout"));
    // 30 s (SK-EKP-008 in-flight clock), never the 10 s hosted request cap.
    expect(timeout?.text).toBe("SET LOCAL statement_timeout = '30s'");
  });

  it("assumes the non-owner grant role last, immediately before the user statement", async () => {
    const { role, batch } = await steps();
    expect(role).toMatch(/^grant_[0-9a-f]{16}$/);
    expect(batch[batch.length - 1]).toBe(USER_STEP);
    expect(batch[batch.length - 2]).toEqual({ text: `SET LOCAL ROLE "${role}"`, params: [] });
  });

  it("honours a narrowed scope when one is passed", async () => {
    const role = await grantRoleName(GRANT_ID);
    const batch = buildGrantExecSteps(SCHEMA, OWNER, role, USER_STEP, {
      agentId: "agent_x",
      endUserId: "u_9",
      threadId: "t_3",
    });
    const gucs = batch.filter((s) => s.text.includes("set_config('app."));
    expect(gucs).toEqual([
      { text: "SELECT set_config('app.tenant_id', $1, true)", params: [OWNER] },
      { text: "SELECT set_config('app.agent_id', $1, true)", params: ["agent_x"] },
      { text: "SELECT set_config('app.end_user_id', $1, true)", params: ["u_9"] },
      { text: "SELECT set_config('app.thread_id', $1, true)", params: ["t_3"] },
    ]);
  });

  it("fails closed on a tenant_ role — a granted read can never assume the owner's full-tenant role", () => {
    expect(() => buildGrantExecSteps(SCHEMA, OWNER, "tenant_0123456789abcdef", USER_STEP)).toThrow(
      /unsafe grant role name/,
    );
  });

  it("fails closed on a structurally unsafe role name", () => {
    expect(() => buildGrantExecSteps(SCHEMA, OWNER, 'grant_x"; DROP', USER_STEP)).toThrow(
      /unsafe grant role name/,
    );
  });
});
