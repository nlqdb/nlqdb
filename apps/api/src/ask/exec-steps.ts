// Pure assembly of a hosted-Postgres exec transaction's ordered statement
// list — no `cloudflare:workers` / neon runtime imports, so it is
// importable from node unit tests and from both callers that need the
// order: the hosted request path (`build-deps.ts` `buildHostedExecSteps`)
// and the cross-tenant grant path (`grant-exec.ts` `buildGrantExecSteps`).
// Keeping the load-bearing order in ONE module means the two can never
// drift (the single-source rationale `grant-role.ts` / `tenant-role.ts`
// apply to role names, applied here to the exec batch).

import type { MemoryScope } from "../memory/remember.ts";

export type HostedExecStep = { text: string; params: unknown[] };

// E-03 / SK-PIVOT-009 — the scope GUCs, in the order they are set. Split
// out so the "always set `app.agent_id`, set the narrowing GUCs only when
// the request carries them" rule lives in one place for both wrappers.
// Fail-closed by construction: a GUC we never set reads as NULL, and NULL
// matches no row under the restrictive policies.
export function scopeGucSteps(scope: MemoryScope): HostedExecStep[] {
  const steps: HostedExecStep[] = [
    { text: "SELECT set_config('app.agent_id', $1, true)", params: [scope.agentId] },
  ];
  if (scope.endUserId !== undefined) {
    steps.push({
      text: "SELECT set_config('app.end_user_id', $1, true)",
      params: [scope.endUserId],
    });
  }
  if (scope.threadId !== undefined) {
    steps.push({ text: "SELECT set_config('app.thread_id', $1, true)", params: [scope.threadId] });
  }
  return steps;
}

// The ordered statement list run in one hosted-Postgres exec transaction.
// Order is load-bearing:
//   1. search_path      → unqualified names resolve to the tenant schema.
//   2. app.tenant_id    → satisfies the RLS USING clause.
//   2b. app.agent_id (+ app.end_user_id / app.thread_id when the request
//      carries them) → satisfies the RESTRICTIVE memory-scope policies on
//      an `agent_memory_v1` DB (E-03 / SK-PIVOT-009). `app.agent_id` is set
//      on EVERY hosted exec, defaulting to the tenant id — which is the
//      literal baked into the policy's second arm, so a plain tenant read
//      keeps full visibility while an unset GUC (a wrapper that forgot)
//      would see nothing. Non-memory DBs have no policy reading them, so
//      the extra statements are inert there. Set BEFORE `SET LOCAL ROLE`
//      for symmetry with `app.tenant_id`; re-arming either from inside the
//      user SQL is blocked by the `set_config` / `current_setting` function
//      denylist in `sql-validate.ts` (SK-SQLAL-008).
//   3. statement_timeout→ bounds a runaway query (resource guard). The
//      hosted path passes its request cap; the grant path passes the
//      SK-EKP-008 in-flight revocation bound.
//   4. SET LOCAL ROLE <role> → LEAST PRIVILEGE, the load-bearing
//      cross-tenant isolation control. The shared `neondb_owner` OWNS the
//      tables, so it BYPASSES RLS and can read any tenant's schema by
//      qualifying it (`other_schema.tbl`). Dropping to a non-owner role
//      — which has USAGE only on its own schemas and, being a non-owner,
//      has RLS actually enforced — makes a cross-schema read fail closed
//      and makes any in-query `set_config('app.tenant_id', …)` GUC
//      re-arming useless. Verified against Neon PG17.
//   5. the user statement (raw SQL, or parameterised for memory writes).
// `set_config(…, true)` is transaction-local (= SET LOCAL) and takes
// params. `SET LOCAL ROLE` / `SET LOCAL statement_timeout` cannot be
// parameterised, so the role name (a validated identifier) and the
// constant timeout are interpolated — each caller asserts its own role
// name shape before calling.
export function buildExecSteps(opts: {
  schemaName: string;
  tenantId: string;
  roleName: string;
  userStep: HostedExecStep;
  scope: MemoryScope;
  statementTimeout: string;
}): HostedExecStep[] {
  return [
    { text: "SELECT set_config('search_path', $1, true)", params: [opts.schemaName] },
    { text: "SELECT set_config('app.tenant_id', $1, true)", params: [opts.tenantId] },
    ...scopeGucSteps(opts.scope),
    { text: `SET LOCAL statement_timeout = '${opts.statementTimeout}'`, params: [] },
    { text: `SET LOCAL ROLE "${opts.roleName}"`, params: [] },
    opts.userStep,
  ];
}
