// Production `AclRetarget` for adoption (SK-ANON-003 amendment — see
// `anon-adopt.ts` module header). `db-create/build-deps.ts` is loaded
// lazily: its static-import chain pulls the libpg-query WASM init at
// module scope, which fails Workers deploy-time validation when it
// reaches the top-level graph (same reason `index.ts` dynamic-imports
// `buildDbCreateDeps`).

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { type AclRetarget, retargetAdoptedDbAcl } from "./anon-adopt.ts";
import { makeKvDiagSink } from "./ask/diag.ts";

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
      } catch (err) {
        // Same failure shape as the provision batch (SK-HDC-017): record
        // + SQLSTATE on the span, then rethrow into the caller's
        // best-effort per-DB catch.
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        const code = (err as { code?: string } | null)?.code;
        span.setAttribute(
          "db.transaction.error_sqlstate",
          typeof code === "string" ? code : "none",
        );
        // SK-ASK-023 — a failed retarget leaves the DB unqueryable, and
        // both this span and the caller's console line vanish on preview
        // invocations (where every e2e adoption runs). Persist the reason
        // where it survives; never mask the original error.
        await tracer.startActiveSpan("nlqdb.diag.write", async (diagSpan) => {
          try {
            await makeKvDiagSink(envBindings.KV, envBindings.NODE_ENV ?? "unknown").record({
              event: "anon_adopt_regrant_failed",
              pgCode: typeof code === "string" ? code : "none",
              pgMessage: (err instanceof Error ? err.message : String(err)).slice(0, 500),
              dbId,
            });
          } catch (diagErr) {
            // Diagnostic write is best-effort by definition.
            diagSpan.recordException(diagErr as Error);
            diagSpan.setStatus({ code: SpanStatusCode.ERROR });
          } finally {
            diagSpan.end();
          }
        });
        throw err;
      } finally {
        span.end();
      }
    });
  };
}
