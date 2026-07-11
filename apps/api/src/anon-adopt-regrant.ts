// Production `AclRetarget` for adoption (SK-ANON-003 amendment — see
// `anon-adopt.ts` module header). Lives in its own module because it
// pulls `db-create/build-deps.ts` (and transitively `cloudflare:workers`)
// into the import graph, which the dependency-light `anon-adopt.ts`
// unit-test pool cannot load.

import { trace } from "@opentelemetry/api";
import { type AclRetarget, retargetAdoptedDbAcl } from "./anon-adopt.ts";
import { buildPgClient, resolveDatabaseUrl } from "./db-create/build-deps.ts";

// Shared-Neon client from the same `DATABASE_URL` ref the provisioner
// uses, wrapped in a `db.transaction` span (GLOBAL-014) covering the
// catalog read + grant batch.
export function makeAclRetarget(envBindings: Cloudflare.Env): AclRetarget {
  return async (dbId, newTenantId) => {
    const pg = buildPgClient(resolveDatabaseUrl(envBindings));
    const tracer = trace.getTracer("@nlqdb/api");
    await tracer.startActiveSpan("db.transaction", async (span) => {
      span.setAttribute("db.system", "postgresql");
      span.setAttribute("nlqdb.anon.adopt.regrant_db_id", dbId);
      try {
        await retargetAdoptedDbAcl(pg, dbId, newTenantId);
      } finally {
        span.end();
      }
    });
  };
}
