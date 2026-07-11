// Production `AclRetarget` for adoption (SK-ANON-003 amendment — see
// `anon-adopt.ts` module header). `db-create/build-deps.ts` is loaded
// lazily: its static-import chain pulls the libpg-query WASM init at
// module scope, which fails Workers deploy-time validation when it
// reaches the top-level graph (same reason `index.ts` dynamic-imports
// `buildDbCreateDeps`).

import { trace } from "@opentelemetry/api";
import { type AclRetarget, retargetAdoptedDbAcl } from "./anon-adopt.ts";

// Shared-Neon client from the same `DATABASE_URL` ref the provisioner
// uses, wrapped in a `db.transaction` span (GLOBAL-014) covering the
// catalog read + grant batch.
export function makeAclRetarget(envBindings: Cloudflare.Env): AclRetarget {
  return async (dbId, newTenantId) => {
    const { buildPgClient, resolveDatabaseUrl } = await import("./db-create/build-deps.ts");
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
