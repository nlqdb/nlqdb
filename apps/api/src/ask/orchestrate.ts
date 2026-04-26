// `/v1/ask` orchestrator. Pure function — every external dep is
// passed in. Tests construct stubs; the handler in `src/index.ts`
// constructs the prod deps from the request context.
//
// Slice 6 commits 4-6 land their pieces here:
//   commit 4: resolve DB → hash → plan cache → LLM plan → cache write
//   commit 5: sql.validate → exec → summarize, with optional event stream
//   commit 6: rate-limit check + first-query event
//
// Spans / metrics per PERFORMANCE §4 row 6 emitted under the
// `nlqdb.ask` parent span set in the handler.

import type { LLMRouter } from "@nlqdb/llm";
import { cachePlanHitsTotal, cachePlanMissesTotal } from "@nlqdb/otel";
import { trace } from "@opentelemetry/api";
import { hashGoal, type PlanCache } from "./plan-cache.ts";
import { validateSql } from "./sql-validate.ts";
import type {
  AskError,
  AskRequest,
  AskResult,
  CachedPlan,
  DbRecord,
  OrchestrateEvent,
  QueryResult,
} from "./types.ts";

export type OrchestrateDeps = {
  resolveDb(id: string, tenantId: string): Promise<DbRecord | null>;
  planCache: PlanCache;
  llm: LLMRouter;
  // Returns null when the DB row's `connection_secret_ref` doesn't
  // resolve to anything in env. Tests pass a stub that returns rows
  // directly; prod constructs a Postgres adapter.
  exec(db: DbRecord, sql: string): Promise<QueryResult | null>;
};

export type OrchestrateOptions = {
  // SSE: invoked after plan is decided, after rows arrive, after
  // summary is generated. Omitted in JSON mode.
  onEvent?: (event: OrchestrateEvent) => Promise<void> | void;
  // JSON-no-summary mode (Accept: application/json) — skip the
  // summarize LLM hop entirely. DESIGN line 624.
  skipSummary?: boolean;
};

export type OrchestrateOutcome = { ok: true; result: AskResult } | { ok: false; error: AskError };

export async function orchestrateAsk(
  deps: OrchestrateDeps,
  req: AskRequest,
  opts: OrchestrateOptions = {},
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

  let planSql: string;
  let cacheHit: boolean;
  if (cached) {
    cachePlanHitsTotal().add(1);
    planSql = cached.sql;
    cacheHit = true;
  } else {
    cachePlanMissesTotal().add(1);
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
    cacheHit = false;
  }

  // SQL allow-list. DESIGN §0.1 / §12 — no DROP / TRUNCATE / DELETE-
  // without-WHERE / ALTER…DROP / etc. The user's escape for an
  // incompatible schema is `nlq new`, not destructive SQL.
  const validation = await tracer.startActiveSpan("nlqdb.sql.validate", async (span) => {
    try {
      return validateSql(planSql);
    } finally {
      span.end();
    }
  });
  if (!validation.ok) {
    return { ok: false, error: { status: "sql_rejected", reason: validation.reason } };
  }

  await opts.onEvent?.({ type: "plan", sql: planSql, cached: cacheHit });

  let result: QueryResult | null;
  try {
    result = await deps.exec(db, planSql);
  } catch (err) {
    return {
      ok: false,
      error: {
        status: "db_unreachable",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
  if (!result) {
    return {
      ok: false,
      error: { status: "db_unreachable", message: "no exec adapter for this DB" },
    };
  }

  await opts.onEvent?.({ type: "rows", rows: result.rows, rowCount: result.rowCount });

  let summary: string | undefined;
  if (!opts.skipSummary) {
    try {
      const out = await deps.llm.summarize({ goal: req.goal, rows: result.rows });
      summary = out.summary;
      await opts.onEvent?.({ type: "summary", summary });
    } catch {
      // Summary failure is non-fatal — return rows + sql, just no
      // narration. Caller can show "summary unavailable" UI hint.
      summary = undefined;
    }
  }

  return {
    ok: true,
    result: {
      status: "ok",
      cached: cacheHit,
      sql: planSql,
      rows: result.rows,
      rowCount: result.rowCount,
      ...(summary !== undefined ? { summary } : {}),
    },
  };
}
