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
import { type Span, SpanStatusCode, trace } from "@opentelemetry/api";
import type { FirstQueryTracker } from "./first-query.ts";
import { hashGoal, type PlanCache } from "./plan-cache.ts";
import type { RateLimiter } from "./rate-limit.ts";
import { validateSql } from "./sql-validate.ts";
import {
  type AskError,
  type AskRequest,
  type AskResult,
  type CachedPlan,
  DbConfigError,
  type DbRecord,
  type OrchestrateEvent,
  type QueryResult,
} from "./types.ts";

export type OrchestrateDeps = {
  resolveDb(id: string, tenantId: string): Promise<DbRecord | null>;
  planCache: PlanCache;
  llm: LLMRouter;
  // Throws `DbConfigError` if the DB row's `connection_secret_ref`
  // doesn't resolve in env (operator config bug); other throws are
  // treated as transient `db_unreachable`.
  exec(db: DbRecord, sql: string): Promise<QueryResult>;
  rateLimiter: RateLimiter;
  firstQuery: FirstQueryTracker;
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

  // Wrap a step in a child span. `swallow` flag turns the catch
  // path into a recordException + ERROR-status (used for non-fatal
  // bookkeeping — cache writes, first-query commit).
  async function withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    swallow?: { onError: T },
  ): Promise<T> {
    return tracer.startActiveSpan(name, async (span) => {
      try {
        return await fn(span);
      } catch (err) {
        if (swallow) {
          recordSwallowedException(span, err);
          return swallow.onError;
        }
        throw err;
      } finally {
        span.end();
      }
    });
  }

  // SSE consumer disconnect mid-stream (browser closes tab) is the
  // most likely throw site for `onEvent`. We don't want that to abort
  // a request that already produced rows — swallow.
  async function safeEmit(event: OrchestrateEvent): Promise<void> {
    if (!opts.onEvent) return;
    try {
      await opts.onEvent(event);
    } catch {
      // intentional: client disconnected or handler threw — request
      // continues so the caller sees a final outcome (or DC quietly).
    }
  }

  // Rate-limit check first — fail fast on overlimit before any DB
  // work or LLM call. PERFORMANCE §4 row 6 nlqdb.ratelimit.check span.
  const decision = await withSpan("nlqdb.ratelimit.check", () =>
    deps.rateLimiter.check(req.userId),
  );
  if (!decision.allowed) {
    return {
      ok: false,
      error: { status: "rate_limited", limit: decision.limit, count: decision.count },
    };
  }

  const db = await deps.resolveDb(req.dbId, req.userId);
  if (!db) return { ok: false, error: { status: "db_not_found" } };
  if (!db.schemaHash) {
    // First-query-against-empty-DB lands when DB-on-first-reference
    // does (post-Phase-0). For now, require a populated schema.
    return { ok: false, error: { status: "schema_unavailable" } };
  }
  // TS narrows db.schemaHash to string after the guard above.
  const schemaHash = db.schemaHash;

  // SHA-256 over a short string is microseconds — folding into the
  // parent span instead of its own (the dedicated `nlqdb.ask.hash`
  // span emission cost more than the work it described).
  const queryHash = await hashGoal(req.goal);

  const cached = await withSpan("nlqdb.cache.plan.lookup", () =>
    deps.planCache.lookup(schemaHash, queryHash),
  );

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
        schema: schemaHash,
        dialect: "postgres",
      });
      planSql = plan.sql;
    } catch (err) {
      return {
        ok: false,
        error: { status: "llm_failed", message: err instanceof Error ? err.message : String(err) },
      };
    }
    const fresh: CachedPlan = { sql: planSql, schemaHash };
    // Cache write is non-fatal — we have a valid plan in `planSql`,
    // so a KV blip shouldn't 500 the request.
    await withSpan(
      "nlqdb.cache.plan.write",
      () => deps.planCache.write(schemaHash, queryHash, fresh),
      { onError: undefined },
    );
    cacheHit = false;
  }

  // SQL allow-list. DESIGN §0.1 / §12 — no DROP / TRUNCATE / DELETE-
  // without-WHERE / ALTER…DROP / etc. The user's escape for an
  // incompatible schema is `nlq new`, not destructive SQL.
  const validation = await withSpan("nlqdb.sql.validate", async () => validateSql(planSql));
  if (!validation.ok) {
    return { ok: false, error: { status: "sql_rejected", reason: validation.reason } };
  }

  await safeEmit({ type: "plan", sql: planSql, cached: cacheHit });

  let result: QueryResult;
  try {
    result = await deps.exec(db, planSql);
  } catch (err) {
    if (err instanceof DbConfigError) {
      return { ok: false, error: { status: "db_misconfigured", message: err.message } };
    }
    return {
      ok: false,
      error: {
        status: "db_unreachable",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  await safeEmit({ type: "rows", rows: result.rows, rowCount: result.rowCount });

  let summary: string | undefined;
  if (!opts.skipSummary) {
    try {
      const out = await deps.llm.summarize({ goal: req.goal, rows: result.rows });
      summary = out.summary;
      await safeEmit({ type: "summary", summary });
    } catch {
      // Summary failure is non-fatal — return rows + sql, just no
      // narration. Caller can show "summary unavailable" UI hint.
      summary = undefined;
    }
  }

  // First-query: emit-then-commit. Span fires immediately on the
  // observability path; the KV commit is a separate, non-fatal step.
  // If the commit fails, the next request re-emits — slight over-
  // count is preferred to a 500 on a working query (UX > strict-once,
  // per review).
  const shouldEmitFirstQuery = await withSpan(
    "nlqdb.cache.first_query.lookup",
    // Read failure → false. Avoids the worst case: emit without ever
    // committing, which would re-emit forever.
    () => deps.firstQuery.notFiredYet(req.userId),
    { onError: false },
  );
  if (shouldEmitFirstQuery) {
    tracer.startActiveSpan("nlqdb.events.emit", (span) => {
      span.setAttribute("nlqdb.event.type", "user.first_query");
      span.setAttribute("nlqdb.user.id", req.userId);
      span.end();
    });
    await withSpan("nlqdb.cache.first_query.commit", () => deps.firstQuery.commit(req.userId), {
      onError: undefined,
    });
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

// Records the exception on the span and marks it ERROR, but doesn't
// re-throw. Used by `withSpan({ onError })` for non-fatal failures.
function recordSwallowedException(span: Span, err: unknown): void {
  const error = err instanceof Error ? err : new Error(String(err));
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
}
