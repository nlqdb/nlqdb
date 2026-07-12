// Production `AclRetarget` for adoption (SK-ANON-003 amendment — see
// `anon-adopt.ts` module header). Imports the Neon client from
// `db-create/pg-client.ts` — NOT `build-deps.ts`, whose static chain
// pulls the libpg-query WASM init. That init fails Workers deploy-time
// validation in the top-level graph, and (run 57) its Emscripten loader
// also CRASHES at runtime module scope in any isolate where
// `ensureLibpgWasmGlobals()` hasn't run — the previous `await
// import("./db-create/build-deps.ts")` here rejected before the try
// below, so the retarget silently no-oped on fresh isolates and every
// adopted DB in them stayed bricked. pg-client's chain is WASM-free, so
// the static import is safe and there is nothing left to fail
// unobserved.

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { type AclRetarget, retargetAdoptedDbAcl } from "./anon-adopt.ts";
import { makeKvDiagSink } from "./ask/diag.ts";
import { buildPgClient, resolveDatabaseUrl } from "./db-create/pg-client.ts";

// Shared-Neon client from the same `DATABASE_URL` ref the provisioner
// uses, wrapped in a `db.transaction` span (GLOBAL-014) covering the
// catalog read + grant batch. `event` names the diag class a failure is
// recorded under — adoption-time callers keep the default; the SK-ASK-024
// exec-time heal passes its own so a pull can tell the two apart.
export function makeAclRetarget(
  envBindings: Cloudflare.Env,
  event: "anon_adopt_regrant_failed" | "exec_acl_heal_failed" = "anon_adopt_regrant_failed",
): AclRetarget {
  return async (dbId, newTenantId) => {
    const tracer = trace.getTracer("@nlqdb/api");
    await tracer.startActiveSpan("db.transaction", async (span) => {
      span.setAttribute("db.system", "postgresql");
      span.setAttribute("nlqdb.anon.adopt.regrant_db_id", dbId);
      try {
        // Client construction sits INSIDE the instrumented try — the
        // run-57 lesson: anything that can fail on this path must
        // reach the diag write, or a miss is invisible on previews.
        const pg = buildPgClient(resolveDatabaseUrl(envBindings));
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
              event,
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
