// `/v1/run` raw-SQL orchestrator (`GLOBAL-015` escape hatch,
// `SK-SDK-009` canonical contract). Distinct from `/v1/ask`'s
// orchestrator because: no LLM, no plan cache, no diff/confirm gate
// (the operator typed the SQL — see `docs/features/trust-ux/FEATURE.md`
// line 42). Same SQL allow-list (`SK-SQLAL-006`) and same executor
// (`buildExec`) — only the LLM steps are bypassed; the safety surface
// is unchanged. Trace block mirrors `SK-TRUST-002` with
// `model = "raw"`, `confidence = 1.0`, `cache_hit = false`.

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
  // Tenant id (`Principal.id`). Drives `resolveDb` tenancy scope and the
  // rate-limit bucket fallback.
  userId: string;
  // SK-MCP-009 — sk_* principals key on `rl:${keyId}` so a noisy MCP
  // host can't burn its siblings' budgets. Defaults to `userId`.
  rateLimitBucketKey?: string;
  // SK-APIKEYS-003 — pk_live_ bearer keys are read-only. Set true when
  // the principal is pk_live so the validator rejects write verbs at
  // the leading-verb gate before exec.
  readOnly?: boolean;
};

export type RunResult = {
  rows: Record<string, unknown>[];
  rowCount: number;
  trace: Trace;
};

export type RunError =
  | AskError
  // GLOBAL-015 / SK-APIKEYS-003 — pk_live keys cannot write through
  // `/v1/run`. Surfaced before exec so the wire response carries the
  // policy reason rather than the generic `sql_rejected`.
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

  const decision = await tracer.startActiveSpan("nlqdb.ratelimit.check", async (span) => {
    try {
      return await deps.rateLimiter.check(req.rateLimitBucketKey ?? req.userId);
    } finally {
      span.end();
    }
  });
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

  // `nlqdb.sql.validate` span matches `/v1/ask` so the validate stage
  // shows up in the same place on dashboards built off the shared
  // span catalog (`docs/performance.md §3.1`).
  const validation = await tracer.startActiveSpan("nlqdb.sql.validate", async (span) => {
    try {
      return validateSql(req.sql);
    } finally {
      span.end();
    }
  });
  if (!validation.ok) {
    return { ok: false, error: { status: "sql_rejected", reason: validation.reason } };
  }

  // pk_live rejects writes before exec — `validateSql` accepts the verb
  // (the allowlist intentionally allows INSERT/UPDATE/DELETE), but
  // SK-APIKEYS-003 narrows pk_live to reads. Reuses the validator's
  // comment-stripped normalization so `/* x */ INSERT ...` can't smuggle
  // past this gate while the validator accepts it.
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
    result = await tracer.startActiveSpan("nlqdb.run.exec", async (span) => {
      try {
        return await deps.exec(db, req.sql);
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    });
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
