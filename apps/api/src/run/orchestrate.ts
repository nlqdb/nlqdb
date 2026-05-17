// `/v1/run` raw-SQL orchestrator (`GLOBAL-015` escape hatch,
// `SK-SDK-009` canonical contract). Skips the LLM + plan cache + diff
// gate that `/v1/ask` runs, but reuses the same SQL allow-list
// (`SK-SQLAL-006`) and executor — only the LLM steps are bypassed.

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { hashGoal } from "../ask/plan-cache.ts";
import type { RateLimiter } from "../ask/rate-limit.ts";
import { leadingVerb, stripLeadingComments, validateSql } from "../ask/sql-validate.ts";
import {
  type AskError,
  DbConfigError,
  type DbRecord,
  type QueryResult,
  type Trace,
} from "../ask/types.ts";

export type RunRequest = {
  sql: string;
  dbId: string;
  // Tenant id (`Principal.id`) — drives `resolveDb` scope and the rate-limit bucket fallback.
  userId: string;
  // `SK-MCP-009` — sk_* principals key on `rl:${keyId}` so a noisy host can't burn its siblings.
  rateLimitBucketKey?: string;
  // `SK-APIKEYS-003` — pk_live keys are read-only; orchestrator rejects writes before exec.
  readOnly?: boolean;
};

export type RunResult = {
  rows: Record<string, unknown>[];
  rowCount: number;
  trace: Trace;
};

export type RunError =
  | AskError
  // `SK-APIKEYS-003` — distinct from `sql_rejected` so the wire response carries the policy reason.
  | { status: "forbidden"; reason: "read_only_principal" };

export type RunOutcome = { ok: true; result: RunResult } | { ok: false; error: RunError };

export type RunDeps = {
  resolveDb: (id: string, tenantId: string) => Promise<DbRecord | null>;
  exec: (db: DbRecord, sql: string, signal?: AbortSignal) => Promise<QueryResult>;
  rateLimiter: RateLimiter;
};

const WRITE_VERBS: ReadonlySet<string> = new Set(["insert", "update", "delete"]);

export async function orchestrateRun(deps: RunDeps, req: RunRequest): Promise<RunOutcome> {
  const tracer = trace.getTracer("@nlqdb/api");

  // Records exception + ERROR status on every throw so a D1 / Neon hiccup surfaces on the span.
  const withSpan = <T>(name: string, fn: () => Promise<T>): Promise<T> =>
    tracer.startActiveSpan(name, async (span) => {
      try {
        return await fn();
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    });

  const decision = await withSpan("nlqdb.ratelimit.check", () =>
    deps.rateLimiter.check(req.rateLimitBucketKey ?? req.userId),
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

  // Span name matches `/v1/ask` so dashboards built off `performance.md §3.1` work unchanged.
  const validation = await withSpan("nlqdb.sql.validate", async () => validateSql(req.sql));
  if (!validation.ok) {
    return { ok: false, error: { status: "sql_rejected", reason: validation.reason } };
  }

  // Reuses the validator's normalization so `/* x */ INSERT ...` can't smuggle past this gate.
  if (req.readOnly) {
    const normalized = leadingVerb(stripLeadingComments(req.sql.trim()));
    if (WRITE_VERBS.has(normalized)) {
      return { ok: false, error: { status: "forbidden", reason: "read_only_principal" } };
    }
  }

  const db = await deps.resolveDb(req.dbId, req.userId);
  if (!db) return { ok: false, error: { status: "db_not_found" } };
  if (!db.schemaHash) return { ok: false, error: { status: "schema_unavailable" } };
  const schemaHash = db.schemaHash;

  const sqlHash = await hashGoal(req.sql);

  let result: QueryResult;
  try {
    result = await withSpan("nlqdb.run.exec", () => deps.exec(db, req.sql));
  } catch (err) {
    if (err instanceof DbConfigError) {
      return { ok: false, error: { status: "db_misconfigured" } };
    }
    return { ok: false, error: { status: "db_unreachable" } };
  }

  const traceBlock: Trace = {
    sql: req.sql.trim(),
    plan_id: `${schemaHash}:${sqlHash}`,
    confidence: 1.0,
    model: "raw",
    cache_hit: false,
  };

  return {
    ok: true,
    result: { rows: result.rows, rowCount: result.rowCount, trace: traceBlock },
  };
}
