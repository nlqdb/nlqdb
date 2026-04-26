// `/v1/ask` orchestrator. Pure function — every external dep is
// passed in. Tests construct stubs; the handler in `src/index.ts`
// constructs the prod deps from the request context.
//
// This commit (4) lands the cache + LLM-plan slice of the orchestration:
//   resolve DB → hash → plan cache lookup → LLM plan on miss → cache write.
// Query execution (`db.execute`) + sql.validate + summarize land in
// commit 5; rate limit + first-query event in commit 6.
//
// Spans / metrics per PERFORMANCE §4 row 6 are emitted here so the
// trace tree composes correctly under the `nlqdb.ask` parent set in
// the handler.

import type { LLMRouter } from "@nlqdb/llm";
import { cachePlanHitsTotal, cachePlanMissesTotal } from "@nlqdb/otel";
import { trace } from "@opentelemetry/api";
import { hashGoal, type PlanCache } from "./plan-cache.ts";
import type { AskError, AskRequest, AskResult, CachedPlan, DbRecord } from "./types.ts";

export type OrchestrateDeps = {
  resolveDb(id: string, tenantId: string): Promise<DbRecord | null>;
  planCache: PlanCache;
  llm: LLMRouter;
};

export type OrchestrateOutcome = { ok: true; result: AskResult } | { ok: false; error: AskError };

export async function orchestrateAsk(
  deps: OrchestrateDeps,
  req: AskRequest,
): Promise<OrchestrateOutcome> {
  const tracer = trace.getTracer("@nlqdb/api");

  const db = await deps.resolveDb(req.dbId, req.userId);
  if (!db) return { ok: false, error: { status: "db_not_found" } };
  if (!db.schemaHash) {
    // First-query-against-empty-DB lands when DB-on-first-reference
    // does (post-Phase-0). For now, require a populated schema.
    return { ok: false, error: { status: "schema_unavailable" } };
  }

  const queryHash = await tracer.startActiveSpan("nlqdb.ask.hash", async (span) => {
    try {
      return await hashGoal(req.goal);
    } finally {
      span.end();
    }
  });

  const cached = await tracer.startActiveSpan("nlqdb.cache.plan.lookup", async (span) => {
    try {
      return await deps.planCache.lookup(db.schemaHash as string, queryHash);
    } finally {
      span.end();
    }
  });

  if (cached) {
    cachePlanHitsTotal().add(1);
    return { ok: true, result: { status: "ok", cached: true, sql: cached.sql } };
  }
  cachePlanMissesTotal().add(1);

  let planSql: string;
  try {
    const plan = await deps.llm.plan({
      goal: req.goal,
      schema: db.schemaHash,
      dialect: "postgres",
    });
    planSql = plan.sql;
  } catch (err) {
    return {
      ok: false,
      error: { status: "llm_failed", message: err instanceof Error ? err.message : String(err) },
    };
  }

  const fresh: CachedPlan = {
    sql: planSql,
    schemaHash: db.schemaHash,
    createdAt: Date.now(),
  };
  await tracer.startActiveSpan("nlqdb.cache.plan.write", async (span) => {
    try {
      await deps.planCache.write(db.schemaHash as string, queryHash, fresh);
    } finally {
      span.end();
    }
  });

  return { ok: true, result: { status: "ok", cached: false, sql: planSql } };
}
