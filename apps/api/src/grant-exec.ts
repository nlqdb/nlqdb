// Cross-tenant granted-read exec batch (SK-EKP-008, EK-06 box 2 — the
// DB-role half, sub-piece (b)). The `buildHostedExecSteps` analogue for a
// buyer's granted `/v1/ask`: the ordered statement list that runs the
// buyer's read against the **owner's** knowledge DB under the per-grant,
// non-owner, SELECT-only role (`grant-role.ts`), provisioned by the
// sub-piece (a) DDL builder (`grant-provision.ts`).
//
// Pure builder — no DB access — so the batch is unit-testable and the
// (forthcoming) `/v1/ask` route wiring cannot disagree with the tests on
// what it executes. It delegates the load-bearing statement ORDER to
// `buildExecSteps` (shared with the hosted path) so the two can never
// drift; this module contributes only the two differences SK-EKP-008
// requires of the grant path:
//
//   1. **Grant role, fail-closed** — the role is `grant_<hex>`
//      (`assertGrantRoleName`), never a `tenant_<hex>`. A granted read can
//      thus never assume an owner's full-tenant role, and an unsafe name
//      throws before interpolation (`SET LOCAL ROLE` cannot be
//      parameterised). The role's *existence* is not healed here — a
//      missing grant role fails closed at exec (`grant-role.ts`).
//   2. **In-flight revocation bound** — `statement_timeout` is pinned to
//      `GRANT_STATEMENT_TIMEOUT` (the 30 s ceiling, `grant-status.ts`), the
//      IN-FLIGHT half of SK-EKP-008's ≤30 s revocation latency, so a query
//      already running when its grant is revoked cannot outlive the bound.
//      (The NEW-query half is the status cache; this is the other clock.)
//
// The RLS-driving GUCs are identical to the hosted path: `app.tenant_id`
// and `app.agent_id` are set to the **owner's** identity so the owner's
// `agent_isolation` policy returns the owner's published rows (full-tenant
// visibility via the tenant-literal arm) and nothing else — the caller
// derives them from the grant's owner. Buyer identity drives metering
// attribution at the app layer (`grant-usage.ts`), not a GUC, so no
// buyer-side GUC is set here. The role is a non-owner under
// `FORCE ROW LEVEL SECURITY` (guardrail #3), so the policy is enforced
// against it — the live "owner rows, nothing else" proof lands with the
// route wiring (sub-piece (c)) and its RLS-bypass kill-test.

import { buildExecSteps, type HostedExecStep } from "./ask/exec-steps.ts";
import { assertGrantRoleName } from "./grant-role.ts";
import { GRANT_STATEMENT_TIMEOUT } from "./grant-status.ts";
import type { MemoryScope } from "./memory/remember.ts";

// Build the ordered exec batch for a granted read on the owner's DB.
// `ownerTenantId` is the grantor's tenant (the owner of the knowledge the
// buyer bought access to); `grantRole` is `grant-role.ts`'s per-grant role
// name. `scope` defaults to full owner-tenant visibility (the tenant-literal
// arm of `agent_isolation`) — the marketplace sells a knowledge DB, not a
// single narrowed agent — and a narrower scope is honoured if a caller ever
// passes one. The user statement must already have passed `validateGrantScope`.
export function buildGrantExecSteps(
  schemaName: string,
  ownerTenantId: string,
  grantRole: string,
  userStep: HostedExecStep,
  scope: MemoryScope = { agentId: ownerTenantId },
): HostedExecStep[] {
  assertGrantRoleName(grantRole);
  return buildExecSteps({
    schemaName,
    tenantId: ownerTenantId,
    roleName: grantRole,
    userStep,
    scope,
    statementTimeout: GRANT_STATEMENT_TIMEOUT,
  });
}
