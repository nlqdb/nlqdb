// Granted-read authorization decision (SK-EKP-008, EK-06 box 2 — the
// composition keystone). One pure function that turns a resolved grant plus a
// buyer's raw SQL into either a typed rejection or the ready-to-run exec plan
// a cross-tenant `/v1/ask` executes on the owner's knowledge DB. Every prior
// box-2 sub-piece is a guardrail primitive; this is the single place they
// compose, in order, so the (forthcoming) route branch reduces to: resolve the
// grant (D1 + the ≤30 s status cache, `grant-status.ts`) → `planGrantedRead`
// → run `plan.execSteps` → skip narration → meter (`grant-usage.ts`). A
// reviewer audits "a granted read = these guardrails, in this order" here, once
// (the single-source rationale of `grant-role.ts` / `exec-steps.ts`).
//
// Pure by construction — no D1, no env, no PG (`grantRoleName` is the only
// async bit, a SHA-256 hash). The caller owns all I/O: it passes the already
// status-checked `grant` (or null when there is no live grant), so the full
// reject matrix is unit-testable without a live DB, and the live "owner rows,
// nothing else" + RLS-bypass proof stays the route-wiring run's job.
//
// The guardrails composed, in the order SK-EKP-008 requires:
//   1. **A live grant must exist** — a null grant (none, or revoked and thus
//      filtered by `getActiveGrant` / aged out of the status cache) is
//      `no_grant`, fail-closed. The buyer never reaches a row without one.
//   2. **Scope, at validation** (`validateGrantScope`, layer 1) — base
//      `/v1/ask` allowlist, read-only, and no reach (JOIN/subquery/CTE) to a
//      table outside the grant's authoritative scope, all before execution.
//   3. **Non-owner SELECT-only role + in-flight revocation bound** — baked
//      into `buildGrantExecSteps`: the `grant_<hex>` role assumed last
//      (guardrails #2–3, under FORCE RLS) and `statement_timeout` pinned to
//      the 30 s ceiling. The RLS GUCs carry the OWNER's identity, never the
//      buyer's, so the owner's `agent_isolation` policy returns the owner's
//      published rows and nothing else.
//
// Narration skip (EK-09 box 2, which "lands with this slice") is a route/
// orchestrate concern, not this decision's: the branch consuming a plan MUST
// run the read un-narrated (`Accept: application/json` behaviour) so expert
// cell values never transit the summarize lane on a cross-tenant query.

import type { HostedExecStep } from "./ask/exec-steps.ts";
import type { GrantScopeReject } from "./ask/grant-scope.ts";
import { validateGrantScope } from "./ask/grant-scope.ts";
import { buildGrantExecSteps } from "./grant-exec.ts";
import { grantRoleName } from "./grant-role.ts";
import type { GrantRecord } from "./grants.ts";

export type GrantReadReject =
  // No live grant for this (buyer, DB): none minted, or revoked (filtered at
  // the `getActiveGrant` source and never cached past the bound).
  | { ok: false; reason: "no_grant" }
  // Failed a scope guardrail. `reason`/`detail` are `validateGrantScope`'s
  // verdict (`not_allowed` | `not_read_only` | `out_of_scope`, base allowlist
  // detail or offending table name), passed through unchanged.
  | { ok: false; reason: GrantScopeReject; detail?: string };

export type GrantReadPlan = {
  ok: true;
  // The authorizing grant — the route reads (grant, owner, buyer) off it for
  // (grant, buyer, seller) usage attribution (`grant-usage.ts`).
  grant: GrantRecord;
  // The per-grant, non-owner, SELECT-only role the batch assumes.
  grantRole: string;
  // Referenced tables (deduped, encounter order) — all in scope by
  // construction; useful for provenance / metering context.
  tables: string[];
  // The ordered statement batch to run in one transaction on the owner's DB.
  execSteps: HostedExecStep[];
};

// Decide a buyer's granted read. `grant` is the caller's already-resolved
// active grant (via `getActiveGrant` behind the `grant-status.ts` cache), or
// null; `rawSql` is the generated read; `schemaName` is the owner DB's schema.
export async function planGrantedRead(input: {
  grant: GrantRecord | null;
  rawSql: string;
  schemaName: string;
}): Promise<GrantReadPlan | GrantReadReject> {
  const { grant, rawSql, schemaName } = input;
  if (!grant) return { ok: false, reason: "no_grant" };

  const scope = validateGrantScope(rawSql, grant.scope);
  if (!scope.ok) return { ok: false, reason: scope.reason, detail: scope.detail };

  const grantRole = await grantRoleName(grant.id);
  const execSteps = buildGrantExecSteps(schemaName, grant.ownerTenantId, grantRole, {
    text: rawSql,
    params: [],
  });
  return { ok: true, grant, grantRole, tables: scope.tables, execSteps };
}
