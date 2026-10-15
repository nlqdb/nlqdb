// `POST /v1/insert` orchestrator (SK-SCHEMA-012, GLOBAL-041 Phase A step 10).
// Observe the DB's columns → `planInsert` → widen DDL (compiled, allow-listed)
// + the INSERT in ONE Neon transaction → CAS-rewrite `schema_hash`
// (SK-SCHEMA-011). There is no LLM dependency to inject: 0 `llm.*` spans
// under an insert holds by construction.

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { classifyDataException } from "../ask/exec-classify.ts";
import type { RateLimiter } from "../ask/rate-limit.ts";
import { type AskError, type DbRecord, WriteConstraintError } from "../ask/types.ts";
import { classifyWriteConstraint } from "../ask/write-constraint.ts";
import { compileWriteDdl } from "../db-create/compile-write-ddl.ts";
import type { DdlValidationResult, PgClient } from "../db-create/types.ts";
import {
  buildWidenBatch,
  executeWidenBatch,
  type WidenExecResult,
  widenedSchema,
} from "../db-create/widen-provision.ts";
import { rewriteWidenedSchema } from "../db-registry.ts";
import { type ObservedSchema, planInsert } from "./plan.ts";

export type InsertRequest = {
  dbId: string;
  table: string;
  rows: Record<string, unknown>[];
  userId: string;
  rateLimitBucketKey?: string;
};

export type InsertResult = {
  rows: Record<string, unknown>[];
  rowCount: number;
  table: string;
  // Same shape as `/v1/ask`'s `trace.widen` (SK-TRUST-002): present only when
  // the insert created a table or column.
  widen?: { tables: string[]; ddl: string[]; schema_rewritten: boolean };
};

export type InsertError =
  | AskError
  | { code: "invalid_body"; reason: string }
  | { code: "invalid_request"; message: string }
  | { code: "internal_error" };

export type InsertOutcome =
  | { ok: true; result: InsertResult; widened: boolean }
  // `widened` on a failure: the write named an unseen table/field, so it
  // counts against KPI 1 (`inserts_infer_failed`).
  | { ok: false; error: InsertError; widened: boolean };

export type InsertDeps = {
  resolveDb: (id: string, tenantId: string) => Promise<DbRecord | null>;
  rateLimiter: RateLimiter;
  // Shared Neon OWNER — CREATE TABLE / ALTER need it (as `extendWrite`).
  pg: PgClient;
  d1: D1Database;
  validateCompiledDdl: (statements: string[]) => DdlValidationResult;
};

const OBSERVE_SQL =
  "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = $1";

// A concurrent insert widened the same table/column first (42P07 / 42701):
// re-observe once and re-plan against the shape it left.
const RACED = new Set(["42P07", "42701", "42710"]);

export async function orchestrateInsert(
  deps: InsertDeps,
  req: InsertRequest,
): Promise<InsertOutcome> {
  const tracer = trace.getTracer("@nlqdb/api");
  const fail = (error: InsertError, widened = false): InsertOutcome => ({
    ok: false,
    error,
    widened,
  });

  const decision = await tracer.startActiveSpan("nlqdb.ratelimit.check", async (span) => {
    try {
      return await deps.rateLimiter.check(req.rateLimitBucketKey ?? req.userId);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
  if (!decision.allowed) {
    const { limit, count, resetAt } = decision;
    return fail({ code: "rate_limited", limit, count, resetAt });
  }

  const db = await deps.resolveDb(req.dbId, req.userId);
  if (!db) return fail({ code: "db_not_found" });
  if (db.engine !== "postgres" || db.connectionBlob) {
    return fail({
      code: "invalid_request",
      message: "insert() writes to nlqdb-hosted Postgres databases only.",
    });
  }
  const schemaName = db.id.startsWith("db_") ? db.id.slice(3) : db.id;

  let exec: WidenExecResult | null = null;
  let planned: ReturnType<typeof planInsert> | null = null;
  let ddl: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const observed = await tracer.startActiveSpan("db.query", async (span) => {
      span.setAttribute("db.system", "postgresql");
      span.setAttribute("db.operation", "SELECT");
      try {
        const { rows } = await deps.pg.query<{
          table_name: string;
          column_name: string;
          data_type: string;
        }>(OBSERVE_SQL, [schemaName]);
        const out: ObservedSchema = new Map();
        for (const r of rows) {
          const cols = out.get(r.table_name) ?? new Map<string, string>();
          cols.set(r.column_name, r.data_type);
          out.set(r.table_name, cols);
        }
        return out;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        return null;
      } finally {
        span.end();
      }
    });
    if (!observed) return fail({ code: "db_unreachable" });

    planned = planInsert(observed, schemaName, req.table, req.rows);
    if (!planned.ok) return fail({ code: "invalid_body", reason: planned.reason });
    const { plan, insert, widens } = planned.value;

    let statements = [{ sql: "SET LOCAL statement_timeout = '30s'" }, insert];
    ddl = [];
    if (widens) {
      const compiled = compileWriteDdl(plan, schemaName);
      if (!compiled.ok) return fail({ code: "internal_error" }, true);
      const validation = deps.validateCompiledDdl(compiled.statements);
      if (!validation.ok) return fail({ code: "internal_error" }, true);
      const batch = await buildWidenBatch({ schemaName, tenantId: db.tenantId, plan, insert });
      if (!batch.ok) return fail({ code: "internal_error" }, true);
      statements = batch.statements;
      ddl = compiled.statements;
    }
    if (planned.value.sequence) statements.splice(-1, 0, planned.value.sequence);
    exec = await executeWidenBatch({ pg: deps.pg }, statements);
    if (exec.ok || !RACED.has(exec.sqlState ?? "")) break;
  }
  if (!exec || !planned?.ok) return fail({ code: "internal_error" });
  const { table, plan, widens } = planned.value;

  if (!exec.ok) {
    const constraint = classifyWriteConstraint(exec.error)?.cause;
    if (constraint instanceof WriteConstraintError) {
      return fail(
        { code: "write_constraint", kind: constraint.kind, ...constraint.target },
        widens,
      );
    }
    const pgCode = classifyDataException(exec.error);
    if (pgCode) return fail({ code: "invalid_value", pgCode }, widens);
    return fail(
      exec.reason === "widen_ddl_failed" ? { code: "internal_error" } : { code: "db_unreachable" },
      widens,
    );
  }

  const last = exec.results.at(-1);
  const result: InsertResult = {
    rows: last?.rows ?? [],
    rowCount: last?.rowCount ?? 0,
    table,
  };
  if (!widens) return { ok: true, result, widened: false };

  // Best-effort CAS (SK-SCHEMA-011): the rows already committed.
  let schemaRewritten = false;
  const next = widenedSchema(db.schemaText ?? "", plan, schemaName);
  if (next.ok && db.schemaHash) {
    try {
      ({ updated: schemaRewritten } = await rewriteWidenedSchema(deps.d1, {
        id: db.id,
        tenantId: db.tenantId,
        expectedHash: db.schemaHash,
        schemaText: next.schemaText,
        schemaHash: next.schemaHash,
      }));
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "insert_schema_rewrite_failed",
          dbId: db.id,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
  result.widen = {
    tables: [
      ...new Set([
        ...plan.create_tables.map((t) => t.name),
        ...plan.add_columns.map((c) => c.table),
      ]),
    ],
    ddl,
    schema_rewritten: schemaRewritten,
  };
  return { ok: true, result, widened: true };
}
