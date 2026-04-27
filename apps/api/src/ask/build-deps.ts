// Production deps for `orchestrateAsk`. Shared between the `/v1/ask`
// and `/v1/chat/messages` handlers so a future seam (swap rate
// limiter, replace LLM router, add tracing wrapper) lands in one
// place — not duplicated per call site.
//
// The Postgres-adapter `exec` callback is created from the worker's
// top-level env via `cloudflare:workers`. It resolves a `databases`
// row's `connection_secret_ref` to a connection URL on every call.

import { env } from "cloudflare:workers";
import { createPostgresAdapter } from "@nlqdb/db";
import { type EventEmitter, makeNoopEmitter, makeQueueEmitter } from "@nlqdb/events";
import { resolveDb } from "../db-registry.ts";
import { getLLMRouter } from "../llm-router.ts";
import { makeFirstQueryTracker } from "./first-query.ts";
import type { OrchestrateDeps } from "./orchestrate.ts";
import { makePlanCache } from "./plan-cache.ts";
import { makeRateLimiter } from "./rate-limit.ts";
import { DbConfigError, type DbRecord } from "./types.ts";

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

// Resolves the DB row's `connection_secret_ref` to a connection URL
// from env. Phase 0 ships one shared Postgres (PLAN line 87), so the
// ref is typically "DATABASE_URL". Throws `DbConfigError` if the ref
// doesn't resolve — operator config bug, distinct from a transient
// "Neon is down" failure.
async function buildExec(db: DbRecord, sql: string) {
  const url = (env as unknown as Record<string, string | undefined>)[db.connectionSecretRef];
  if (!url) {
    throw new DbConfigError(
      `connection_secret_ref ${JSON.stringify(db.connectionSecretRef)} did not resolve in env (db_id=${db.id})`,
    );
  }
  const adapter = createPostgresAdapter({ connectionString: url });
  return adapter.execute(sql);
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
