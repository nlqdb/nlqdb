// Tenant-role reaper (SK-HDC-024). Neon caps a branch at 500 roles and the
// provisioner mints one `tenant_<hash>` role per tenant (`tenant-role.ts`),
// so every tenant that stops owning a hosted DB — DB deleted (SK-HDC-016),
// anon DB swept (`sweep.ts`), anon tenant adopted into a user (SK-ANON-003)
// — leaks a role for good. At 500/500 every create fails (Neon 422 `roles
// limit exceeded`).
//
// A role is live while any `databases` row names its tenant; every other
// `tenant_*` role is revoked from its schemas and dropped. Reaping a live
// role by mistake (a create racing this read) is self-healing: the exec path
// recreates a missing tenant role on the next query (SK-ASK-024).
//
// Explicit REVOKEs, not `DROP OWNED BY`: on PG18 that also strips the
// owner's ADMIN membership, which `DROP ROLE` needs. A role holding a
// privilege outside its own schemas fails `DROP ROLE` (2BP01) — logged and
// skipped, never forced.

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { assertSafeIdentifier } from "../db-create/neon-provision.ts";
import type { PgClient, PgTransactionStatement } from "../db-create/types.ts";
import { assertTenantRoleName, tenantRoleName } from "../tenant-role.ts";

// Bounded work per tick: the job runs hourly, so a backlog drains in hours.
// Dropping is founder-gated — `TENANT_ROLE_REAP=1` on the api Worker; unset,
// the job passes batch 0 and only counts (the instrument for the role cap).
export const REAP_BATCH = 50;

// Every `tenant_*` role with the schemas it holds a grant on (none → one
// row with a null schema). One catalog read for the whole run.
const ROLE_SCHEMAS_SQL = `
  SELECT r.rolname, n.nspname
  FROM pg_roles r
  LEFT JOIN pg_namespace n
    ON EXISTS (SELECT 1 FROM aclexplode(n.nspacl) a WHERE a.grantee = r.oid)
  WHERE r.rolname ~ '^tenant_[0-9a-f]{16}$'`;

export type ReapResult = {
  rolesTotal: number;
  rolesLive: number;
  reaped: number;
  failed: number;
};

export function buildReapStatements(role: string, schemas: string[]): PgTransactionStatement[] {
  assertTenantRoleName(role);
  const statements: PgTransactionStatement[] = [];
  for (const schema of schemas) {
    assertSafeIdentifier(schema, "schemaName");
    statements.push(
      { sql: `REVOKE ALL ON ALL TABLES IN SCHEMA "${schema}" FROM "${role}"` },
      { sql: `REVOKE ALL ON ALL SEQUENCES IN SCHEMA "${schema}" FROM "${role}"` },
      { sql: `REVOKE ALL ON SCHEMA "${schema}" FROM "${role}"` },
    );
  }
  statements.push({ sql: `DROP ROLE "${role}"` });
  return statements;
}

export async function reapTenantRoles(
  pg: PgClient,
  d1: D1Database,
  batch = REAP_BATCH,
): Promise<ReapResult> {
  const tracer = trace.getTracer("@nlqdb/api/role-reap");

  const tenants = await d1
    .prepare("SELECT DISTINCT tenant_id FROM databases")
    .all<{ tenant_id: string }>();
  const live = new Set(
    await Promise.all((tenants.results ?? []).map((r) => tenantRoleName(r.tenant_id))),
  );

  const rows = await tracer.startActiveSpan("db.query", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "SELECT");
    span.setAttribute("nlqdb.cron", "tenant_role_reap");
    try {
      return (await pg.query<{ rolname: string; nspname: string | null }>(ROLE_SCHEMAS_SQL)).rows;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });

  const schemasByRole = new Map<string, string[]>();
  for (const { rolname, nspname } of rows) {
    const schemas = schemasByRole.get(rolname) ?? [];
    if (nspname) schemas.push(nspname);
    schemasByRole.set(rolname, schemas);
  }

  const orphans = [...schemasByRole.keys()].filter((role) => !live.has(role));
  const result: ReapResult = {
    rolesTotal: schemasByRole.size,
    rolesLive: schemasByRole.size - orphans.length,
    reaped: 0,
    failed: 0,
  };
  // An empty live set means D1 read nothing — never "every tenant is gone".
  if (live.size === 0) return result;

  for (const role of orphans.slice(0, batch)) {
    await tracer.startActiveSpan("db.transaction", async (span) => {
      span.setAttribute("db.system", "postgresql");
      span.setAttribute("nlqdb.cron", "tenant_role_reap");
      try {
        await pg.transaction(buildReapStatements(role, schemasByRole.get(role) ?? []));
        result.reaped++;
      } catch (err) {
        result.failed++;
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        console.warn(
          JSON.stringify({
            msg: "tenant_role_reap_failed",
            role,
            message: (err instanceof Error ? err.message : String(err)).slice(0, 300),
          }),
        );
      } finally {
        span.end();
      }
    });
  }
  return result;
}
