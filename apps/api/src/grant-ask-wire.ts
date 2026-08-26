// Granted-read Neon wiring (SK-EKP-008, EK-06 box 2 — sub-piece (h), the
// live half). The node-safe composition lives in `grant-ask-io.ts`
// (`buildGrantedReadIo`); this module owns the two pieces that MUST touch the
// runtime — the Neon exec-batch runner and the isolate-local status cache — so
// importing the composition in a unit test never drags in `cloudflare:workers`
// or `neon`. The forthcoming cross-tenant `/v1/ask` branch calls
// `grantedReadIo(d1)` and passes it to `executeGrantedRead`.

import { env } from "cloudflare:workers";
import { neon } from "@neondatabase/serverless";
import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { HostedExecStep } from "./ask/exec-steps.ts";
import { DbConfigError, type DbRecord, type QueryResult } from "./ask/types.ts";
import { buildGrantedReadIo, type GrantStatusCache } from "./grant-ask-io.ts";
import type { GrantedReadIo } from "./grant-orchestrate.ts";
import { makeGrantStatusCache, resolveGrantStatusTtlMs } from "./grant-status.ts";

// Isolate-local NEW-query revocation-bound cache (grant-status.ts). ONE per
// isolate so the ≤30 s bound holds across requests within it; env-tunable
// downward only via `GRANT_STATUS_TTL_MS`. Positive-only + fail-closed by
// construction, so a revoke propagates within the bound.
const grantStatusCache: GrantStatusCache = makeGrantStatusCache({
  now: () => Date.now(),
  ttlMs: resolveGrantStatusTtlMs(
    (env as unknown as Record<string, string | undefined>)["GRANT_STATUS_TTL_MS"],
  ),
});

// Run a granted read's pre-built exec batch in one transaction on the OWNER's
// hosted Neon DB. Unlike `runHostedPgQuery`, the batch arrives fully assembled
// by `buildGrantExecSteps` (via `planGrantedRead`) — grant `statement_timeout`,
// owner-scoped RLS GUCs, and the non-owner `grant_<hex>` role are already in
// `execSteps` — so this runs them VERBATIM and never rebuilds them. The owner
// DB's Neon URL resolves from `env[connectionSecretRef]` (the hosted convention,
// build-deps.ts `dispatchExec`); a missing ref fails closed with
// `DbConfigError`. The operation is always `select` — a granted read is
// SELECT-only by construction (`validateGrantScope` rejects any write).
export async function runGrantExecSteps(
  ownerDb: DbRecord,
  execSteps: HostedExecStep[],
  signal?: AbortSignal,
): Promise<QueryResult> {
  const url = (env as unknown as Record<string, string | undefined>)[ownerDb.connectionSecretRef];
  if (!url) {
    throw new DbConfigError(
      `connection_secret_ref ${JSON.stringify(ownerDb.connectionSecretRef)} did not resolve in env (db_id=${ownerDb.id})`,
    );
  }
  const neonSql = neon(url, { fullResults: true });
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan(
    "db.query",
    { attributes: { "db.system": "postgresql", "db.operation": "select" } },
    async (span) => {
      const startedAt = performance.now();
      try {
        signal?.throwIfAborted();
        const results = await neonSql.transaction(
          execSteps.map((s) => neonSql.query(s.text, s.params)),
          signal ? { fetchOptions: { signal } } : {},
        );
        const userResult = results[results.length - 1];
        return {
          rows: (userResult?.rows ?? []) as QueryResult["rows"],
          rowCount: userResult?.rowCount ?? userResult?.rows?.length ?? 0,
        };
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        dbDurationMs().record(performance.now() - startedAt, { operation: "select" });
        span.end();
      }
    },
  );
}

// The one call the cross-tenant `/v1/ask` branch makes: the production
// `GrantedReadIo` for this request's D1 handle, over the shared status cache
// and the live Neon runner.
export function grantedReadIo(d1: D1Database): GrantedReadIo {
  return buildGrantedReadIo({ d1, statusCache: grantStatusCache, runExecSteps: runGrantExecSteps });
}
