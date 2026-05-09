// Production deps for `orchestrateAsk`. Shared between the `/v1/ask`
// and `/v1/chat/messages` handlers so a future seam (swap rate
// limiter, replace LLM router, add tracing wrapper) lands in one
// place — not duplicated per call site.
//
// The Postgres-adapter `exec` callback is created from the worker's
// top-level env via `cloudflare:workers`. It resolves a `databases`
// row's `connection_secret_ref` to a connection URL on every call.

import { env } from "cloudflare:workers";
import { neon } from "@neondatabase/serverless";
import type { Row } from "@nlqdb/db";
import { type EventEmitter, makeNoopEmitter, makeQueueEmitter } from "@nlqdb/events";
import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { resolveDb } from "../db-registry.ts";
import { getLLMRouter } from "../llm-router.ts";
import { makeFirstQueryTracker } from "./first-query.ts";
import type { OrchestrateDeps } from "./orchestrate.ts";
import { makePlanCache } from "./plan-cache.ts";
import { makeRateLimiter } from "./rate-limit.ts";
import { DbConfigError, type DbRecord, type QueryResult } from "./types.ts";

export function buildAskDeps(envBindings: Cloudflare.Env): OrchestrateDeps {
  return {
    resolveDb: (id, tenantId) => resolveDb(envBindings.DB, id, tenantId),
    planCache: makePlanCache(envBindings.KV),
    llm: getLLMRouter(),
    exec: buildExec,
    rateLimiter: makeRateLimiter(envBindings.DB),
    firstQuery: makeFirstQueryTracker(envBindings.KV),
    events: buildEventEmitter(envBindings.EVENTS_QUEUE),
  };
}

// Executes a SQL query inside the tenant's schema context.
//
// Three statements are batched in one Neon HTTP round-trip:
//   1. set_config('search_path', schemaName, true) — routes unqualified
//      table names to the tenant's schema instead of public.
//   2. set_config('app.tenant_id', tenantId, true) — satisfies the RLS
//      USING clause the provisioner set on every table; without this,
//      current_setting('app.tenant_id', true) = '' and all rows are blocked.
//   3. The user's SQL.
//
// set_config(..., true) is transaction-local (equivalent to SET LOCAL) and
// accepts parameterised values — no identifier injection risk. Schema name
// is derived from db.id by stripping the "db_" prefix, mirroring
// neon-provision.ts's stripDbPrefix.
async function buildExec(db: DbRecord, sql: string, signal?: AbortSignal): Promise<QueryResult> {
  const url = (env as unknown as Record<string, string | undefined>)[db.connectionSecretRef];
  if (!url) {
    throw new DbConfigError(
      `connection_secret_ref ${JSON.stringify(db.connectionSecretRef)} did not resolve in env (db_id=${db.id})`,
    );
  }

  const schemaName = db.id.startsWith("db_") ? db.id.slice(3) : db.id;
  const neonSql = neon(url, { fullResults: true });
  const operation = detectSqlOperation(sql);
  const tracer = trace.getTracer("@nlqdb/api");

  return tracer.startActiveSpan(
    "db.query",
    { attributes: { "db.system": "postgresql", "db.operation": operation } },
    async (span) => {
      const startedAt = performance.now();
      try {
        signal?.throwIfAborted();
        const results = await neonSql.transaction(
          [
            neonSql`SELECT set_config('search_path', ${schemaName}, true)`,
            neonSql`SELECT set_config('app.tenant_id', ${db.tenantId}, true)`,
            neonSql`${neonSql.unsafe(sql)}`,
          ],
          signal ? { fetchOptions: { signal } } : {},
        );
        const userResult = results[2];
        return {
          rows: (userResult?.rows ?? []) as Row[],
          rowCount: userResult?.rowCount ?? userResult?.rows?.length ?? 0,
        };
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        dbDurationMs().record(performance.now() - startedAt, { operation });
        span.end();
      }
    },
  );
}

function detectSqlOperation(sql: string): string {
  const stripped = sql.replace(/^(?:\s+|--[^\n]*\n?|\/\*[\s\S]*?\*\/)+/, "");
  const m = stripped.match(/^[A-Za-z]+/);
  return m ? m[0].toUpperCase() : "UNKNOWN";
}

// Returns the production queue-backed emitter when the binding is
// present (always in deployed Workers + `wrangler dev --remote`). Falls
// back to a no-op for unit/integration tests and any environment where
// the binding is unset, so tests don't need to mock a queue. Exported
// because the Stripe webhook path also needs it (no orchestrateAsk
// involvement, just product events).
export function buildEventEmitter(queue: Queue | undefined): EventEmitter {
  return queue ? makeQueueEmitter(queue) : makeNoopEmitter();
}
