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

import type { EventEmitter } from "@nlqdb/events";
import type { LLMRouter } from "@nlqdb/llm";
import { cachePlanHitsTotal, cachePlanMissesTotal } from "@nlqdb/otel";
import { type Span, SpanStatusCode, trace } from "@opentelemetry/api";
import { deriveSlug } from "../databases/list.ts";
import type { FirstQueryTracker } from "./first-query.ts";
import { hashGoal, type PlanCache } from "./plan-cache.ts";
import type { RateLimiter } from "./rate-limit.ts";
import { extractTables, type RecentTablesStore } from "./recent-tables.ts";
import { Nonrecoverable, type RetryReason, withStageRetry } from "./retry.ts";
import { validateSql } from "./sql-validate.ts";
import {
  type AskError,
  type AskRequest,
  type AskResult,
  type CachedPlan,
  DbConfigError,
  type DbRecord,
  type OrchestrateEvent,
  type PipeAdvisory,
  type QueryResult,
} from "./types.ts";

export type OrchestrateDeps = {
  resolveDb(id: string, tenantId: string): Promise<DbRecord | null>;
  planCache: PlanCache;
  llm: LLMRouter;
  // Throws `DbConfigError` if the DB row's `connection_secret_ref`
  // doesn't resolve in env (operator config bug); other throws are
  // treated as transient `db_unreachable`.
  exec(db: DbRecord, sql: string, signal?: AbortSignal): Promise<QueryResult>;
  rateLimiter: RateLimiter;
  firstQuery: FirstQueryTracker;
  // Product events. Producer hides whether the underlying transport
  // is the EVENTS_QUEUE binding or a no-op (tests / dev without the
  // binding). `emit()` is fire-and-forget — never throws.
  events: EventEmitter;
  // `SK-MIGRATE-005`: optional D1 lookup against `workload_analyser_runs`
  // for the resolved `(db_id, query_hash)`. Returns the most recent
  // audit row's pipe within 24h, or null. Tests omit this dep; production
  // wires it via `buildAskDeps`.
  lookupPipeAdvisory?: (dbId: string, queryHash: string) => Promise<PipeAdvisory | null>;
  // `SK-ASK-012`: per-principal recent-tables MRU. Optional in tests
  // (a noop default is fine); production wires `makeRecentTablesStore`
  // via `buildAskDeps`. Touched after every successful exec — both
  // cache-hit and cache-miss paths converge there. Failures are
  // swallowed inside the store (never propagate to the response).
  recentTables?: RecentTablesStore;
};

export type OrchestrateOptions = {
  // SSE: invoked after plan is decided, after rows arrive, after
  // summary is generated. Omitted in JSON mode.
  onEvent?: (event: OrchestrateEvent) => Promise<void> | void;
  // JSON-no-summary mode (Accept: application/json) — skip the
  // summarize LLM hop entirely. DESIGN line 624.
  skipSummary?: boolean;
};

export type OrchestrateOutcome =
  | {
      ok: true;
      result: AskResult;
      // Fire-and-forget producer call for the `ask.completed` event.
      // The orchestrator returns it instead of awaiting so the route
      // handler can hand it to `ctx.waitUntil(...)` — the queue.send
      // round-trip then runs after the response has flushed and never
      // sits on the user-visible /v1/ask p99 (PERFORMANCE §3.1 says the
      // emit is wrapped in `ctx.waitUntil`; this keeps doc and code in
      // agreement). The promise itself never throws (`SK-EVENTS-003`).
      pendingAskCompleted: Promise<void>;
    }
  | { ok: false; error: AskError };

export async function orchestrateAsk(
  deps: OrchestrateDeps,
  req: AskRequest,
  opts: OrchestrateOptions = {},
): Promise<OrchestrateOutcome> {
  const tracer = trace.getTracer("@nlqdb/api");
  const startedAt = Date.now();

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
      error: {
        status: "rate_limited",
        limit: decision.limit,
        count: decision.count,
        resetAt: decision.resetAt,
      },
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

  // `SK-MIGRATE-005`: lookup before `plan_pending` so the SSE event
  // order is `pipe_advisory? → plan_pending → plan → rows → summary`.
  // The lookup is best-effort — a failure here never blocks the request.
  let pipeAdvisory: PipeAdvisory | null = null;
  if (deps.lookupPipeAdvisory) {
    try {
      pipeAdvisory = await deps.lookupPipeAdvisory(req.dbId, queryHash);
    } catch {
      // Treat any lookup failure as "no advisory" — informational surface.
    }
    if (pipeAdvisory) {
      await safeEmit({ type: "pipe_advisory", advisory: pipeAdvisory });
    }
  }

  // Heartbeat before any plan work. Always fires (cache hit OR miss) so
  // SSE clients can render "Thinking…" against a stable event order
  // (`plan_pending → plan → rows → summary`). On a cache hit the `plan`
  // event lands immediately after; on a miss it covers the LLM latency.
  await safeEmit({ type: "plan_pending" });

  const cached = await withSpan("nlqdb.cache.plan.lookup", () =>
    deps.planCache.lookup(schemaHash, queryHash),
  );

  let planSql: string;
  let cacheHit: boolean;
  if (cached) {
    cachePlanHitsTotal().add(1);
    planSql = cached.sql;
    // Validate the cached plan once — caches don't lie often, but we
    // never trust SQL onto the wire without a fresh allowlist pass.
    const cachedValidation = await withSpan("nlqdb.sql.validate", async () => validateSql(planSql));
    if (!cachedValidation.ok) {
      return { ok: false, error: { status: "sql_rejected", reason: cachedValidation.reason } };
    }
    cacheHit = true;
  } else {
    cachePlanMissesTotal().add(1);
    // GLOBAL-022 — plan + validate is one recovery loop: if the
    // validator rejects the LLM's SQL, re-prompt with the rejection
    // reason in `previousAttempt`. Three attempts; on exhaustion the
    // last error wins (`llm_failed` or `sql_rejected`).
    // `schema_text` is the compiled DDL (`CREATE TABLE ...`, foreign
    // keys, indexes) written by `db-create/neon-provision.ts` at
    // provision time. Feeding it into the planner is what lets the LLM
    // see real table + column names; without it the prompt only carried
    // the FNV `schemaHash` fingerprint and the LLM hallucinated table
    // names from it. Legacy rows pre-migration-0010 keep `schemaText`
    // null — fall back to the hash so they still respond instead of
    // 500'ing, even with the degraded prompt quality.
    const planSchema = db.schemaText ?? schemaHash;
    try {
      planSql = await withStageRetry(
        "plan",
        async (_attempt, prev) => {
          const plan = await deps.llm.plan({
            goal: req.goal,
            schema: planSchema,
            dialect: "postgres",
            ...(prev ? { previousAttempt: prevAttemptFromError(prev) } : {}),
          });
          const validation = validateSql(plan.sql);
          if (!validation.ok) {
            // Tag with the reject reason so the next attempt's prompt
            // can describe what to avoid; keep the rejected SQL on the
            // error so prevAttemptFromError can echo it back.
            const reject = new PlanValidationError(plan.sql, validation.reason);
            throw reject;
          }
          return plan.sql;
        },
        { reasonOf: planRetryReason },
      );
    } catch (err) {
      if (err instanceof PlanValidationError) {
        return { ok: false, error: { status: "sql_rejected", reason: err.reason } };
      }
      // LLM provider errors can contain API keys or prompt fragments —
      // the OTel span (llm.plan, SK-LLM-006) captures the root cause.
      return { ok: false, error: { status: "llm_failed" } };
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

  await safeEmit({ type: "plan", sql: planSql, cached: cacheHit });

  let result: QueryResult;
  try {
    result = await withStageRetry(
      "exec",
      async () => {
        try {
          return await deps.exec(db, planSql);
        } catch (err) {
          // Config errors are non-recoverable — operator has to fix
          // the secret ref; retrying just delays surfacing the bug.
          if (err instanceof DbConfigError) throw new Nonrecoverable("db_misconfigured", err);
          throw err;
        }
      },
      { reasonOf: () => "db_unreachable" satisfies RetryReason },
    );
  } catch (err) {
    if (err instanceof DbConfigError) {
      // Message would contain the secret ref name — don't leak it.
      // The span (db.query) records the exception for operator visibility.
      return { ok: false, error: { status: "db_misconfigured" } };
    }
    // Postgres errors include schema details; keep them server-side.
    return { ok: false, error: { status: "db_unreachable" } };
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
    // Span around the emit so a producer-side failure (queue.send
    // rejection) shows up in traces. The emitter itself swallows the
    // error — emit is fire-and-forget by contract — but the span
    // closes with ERROR status so operators can see it.
    await tracer.startActiveSpan("nlqdb.events.emit", async (span) => {
      span.setAttribute("nlqdb.event.type", "user.first_query");
      span.setAttribute("nlqdb.user.id", req.userId);
      try {
        await deps.events.emit({
          name: "user.first_query",
          userId: req.userId,
          dbId: req.dbId,
        });
      } finally {
        span.end();
      }
    });
    await withSpan("nlqdb.cache.first_query.commit", () => deps.firstQuery.commit(req.userId), {
      onError: undefined,
    });
  }

  // SK-ASK-012 — push the executed plan's referenced tables to the
  // principal's recent-tables MRU. Runs on both cache-hit and cache-miss
  // paths (this is the convergence point) so the MRU tracks user
  // activity, not LLM-router behaviour. The store wraps its own
  // `nlqdb.recent_tables.touch` span; we just kick it off so the route
  // handler can hand the promise to `ctx.waitUntil` and keep the KV
  // round-trip off the user-visible p99.
  const recentTablesStore = deps.recentTables;
  const pendingRecentTablesTouch: Promise<void> = recentTablesStore
    ? safeTouchRecentTables(recentTablesStore, req.userId, req.dbId, planSql)
    : Promise.resolve();

  // Query-log fingerprint — anonymised; no SQL text, no values, no PII.
  // Drained off EVENTS_QUEUE by `apps/events-worker/src/sinks/query-log.ts`
  // into the Tinybird `query_log` Data Source (W4 → W5 input). Fire-
  // and-forget: emit() never throws (`SK-EVENTS-003`), so a queue blip
  // never affects the user-visible response.
  //
  // `orchestratorMs` is captured BEFORE the response serialise / egress
  // step so it stays orchestrator-internal — distinct from the §1 SLO
  // wall-clock (request-in → response-out) which the W5 analyser
  // measures separately. `planShape` is hashed inline so the value is
  // computed before the promise is detached from the request lifetime.
  const planShape = await hashPlanShape(planSql);
  const orchestratorMs = Date.now() - startedAt;
  const askCompletedEmit = deps.events.emit({
    name: "ask.completed",
    dbId: req.dbId,
    schemaHash,
    queryHash,
    planShape,
    engine: db.engine,
    orchestratorMs,
    rowsReturned: result.rowCount,
    ts: Date.now(),
  });

  // Both background promises are non-throwing by contract — combine so
  // the route handler hands a single promise to `ctx.waitUntil`.
  const pendingAskCompleted = Promise.all([askCompletedEmit, pendingRecentTablesTouch]).then(
    () => undefined,
  );

  return {
    ok: true,
    result: {
      status: "ok",
      cached: cacheHit,
      sql: planSql,
      rows: result.rows,
      rowCount: result.rowCount,
      ...(summary !== undefined ? { summary } : {}),
      ...(pipeAdvisory ? { pipe_advisory: pipeAdvisory } : {}),
    },
    pendingAskCompleted,
  };
}

// SHA-256 of the planned SQL — `plan_shape` on the query-log fingerprint.
// Distinct from `query_hash` (over the user's goal); same goal can
// produce structurally different plans across schema versions, so the
// analyser dedupes at both axes. One-way hash means the wire log carries
// no SQL text or literal values — the workload analyser sees only
// equality classes.
async function hashPlanShape(sql: string): Promise<string> {
  const data = new TextEncoder().encode(sql);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Records the exception on the span and marks it ERROR, but doesn't
// re-throw. Used by `withSpan({ onError })` for non-fatal failures.
function recordSwallowedException(span: Span, err: unknown): void {
  const error = err instanceof Error ? err : new Error(String(err));
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
}

// GLOBAL-022 — sentinel thrown inside the plan retry loop when the
// LLM returned SQL the validator rejected. Distinguished from raw
// LLM throws so the outer catch can return `sql_rejected` (with the
// validator's reason) rather than `llm_failed`.
class PlanValidationError extends Error {
  constructor(
    readonly sql: string,
    readonly reason: string,
  ) {
    super(`plan SQL rejected by validator: ${reason}`);
    this.name = "PlanValidationError";
  }
}

function prevAttemptFromError(err: Error): { sql?: string; error: string } {
  if (err instanceof PlanValidationError) {
    return { sql: err.sql, error: `validator rejected SQL: ${err.reason}` };
  }
  return { error: err.message };
}

function planRetryReason(err: unknown): RetryReason {
  if (err instanceof PlanValidationError) return "sql_rejected";
  return "llm_failed";
}

// Best-effort MRU touch for the post-exec hook. Resolves void on every
// path: parse failures yield zero tables (no-op write), KV failures are
// swallowed inside the store, and any other throw is contained here so
// `Promise.all([emit, touch])` in the outer flow never rejects.
async function safeTouchRecentTables(
  store: RecentTablesStore,
  principalId: string,
  dbId: string,
  planSql: string,
): Promise<void> {
  try {
    const tables = extractTables(planSql);
    if (tables.length === 0) return;
    await store.touch(principalId, dbId, deriveSlug(dbId), tables);
  } catch {
    // span already records the exception inside `store.touch`; nothing
    // for the orchestrator to do but stay quiet.
  }
}
