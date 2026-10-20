// `POST /v1/insert` orchestrator (SK-SCHEMA-012, GLOBAL-041 Phase A step 10).
// Observe the DB's columns → `planInsert` → widen DDL (compiled, allow-listed)
// + the INSERT in ONE Neon transaction → CAS-rewrite `schema_hash`
// (SK-SCHEMA-011). There is no LLM dependency to inject: 0 `llm.*` spans
// under an insert holds by construction. A value that won't cast fails its
// row alone (END_GOAL "Value doesn't fit"): the batch's refusal triggers one
// read-only probe naming each such row, and the rest land.

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { classifyDataException } from "../ask/exec-classify.ts";
import type { RateLimiter } from "../ask/rate-limit.ts";
import { type AskError, type DbRecord, WriteConstraintError } from "../ask/types.ts";
import { classifyWriteConstraint } from "../ask/write-constraint.ts";
import { quoted } from "../db-create/compile-ddl.ts";
import { compileWriteDdl } from "../db-create/compile-write-ddl.ts";
import type { DdlValidationResult, PgClient } from "../db-create/types.ts";
import {
  buildWidenBatch,
  executeWidenBatch,
  type WidenExecResult,
  widenedSchema,
} from "../db-create/widen-provision.ts";
import { rewriteWidenedSchema } from "../db-registry.ts";
import { columnName, type ObservedSchema, planInsert, type UniqueKeys } from "./plan.ts";

export type InsertRequest = {
  dbId: string;
  table: string;
  rows: Record<string, unknown>[];
  // Upsert on these fields (GLOBAL-041 Phase A step 11); empty = plain insert.
  key?: string[];
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
  // The `CREATE UNIQUE INDEX` a keyed write ran on its key's first use.
  index?: string;
  // Rows refused because a value won't cast to its column's existing type;
  // every other row landed. `index` is the row's position in the request.
  failed?: FailedRow[];
};

export type FailedRow = { index: number; field: string; type: string };

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

// A keyed write's arbiter candidates: the table's plain-column, non-partial
// unique indexes (its primary key included), each as its column names.
const UNIQUES_SQL =
  "SELECT array_agg(a.attname::text) AS cols FROM pg_index i " +
  "JOIN pg_class c ON c.oid = i.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace " +
  "CROSS JOIN LATERAL unnest(i.indkey::int2[]) AS k(attnum) " +
  "JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum " +
  "WHERE n.nspname = $1 AND c.relname = $2 AND i.indisunique AND i.indpred IS NULL " +
  "AND i.indexprs IS NULL GROUP BY i.indexrelid";

// Which (row, field) values won't cast to their stored column's type — the
// soft-error check Postgres 16 added, so a bad value never aborts the probe.
// One jsonb param keeps a 1 000-row batch under the bind limit. A column the
// batch was about to add doesn't exist yet, so it never matches. A JSON
// column, or a domain over one, binds every value as its JSON text (`plan.ts`
// `param`), so it always fits and is skipped — probing the raw `"up"` would
// refuse a row that lands.
const PROBE_SQL =
  "SELECT p.i, p.c, format_type(a.atttypid, a.atttypmod) AS type " +
  "FROM jsonb_to_recordset($1::text::jsonb) AS p(i int, c text, v text) " +
  "JOIN pg_attribute a ON a.attrelid = to_regclass($2) AND a.attname = p.c " +
  "AND a.attnum > 0 AND NOT a.attisdropped " +
  "JOIN pg_type t ON t.oid = a.atttypid " +
  "AND COALESCE(NULLIF(t.typbasetype, 0), t.oid) NOT IN ('json'::regtype, 'jsonb'::regtype) " +
  "WHERE NOT pg_input_is_valid(p.v, format_type(a.atttypid, a.atttypmod)) ORDER BY p.i";

// A concurrent insert widened the same table/column first (42P07 / 42701):
// re-observe once and re-plan against the shape it left.
const RACED = new Set(["42P07", "42701", "42710"]);

const fail = (error: InsertError, widened = false): InsertOutcome => ({
  ok: false,
  error,
  widened,
});

export async function orchestrateInsert(
  deps: InsertDeps,
  req: InsertRequest,
): Promise<InsertOutcome> {
  const tracer = trace.getTracer("@nlqdb/api");

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

  const out = await write(deps, req, db, schemaName, req.rows);
  if (out.ok || out.error.code !== "invalid_value") return out;
  const failed = await probeRows(deps.pg, schemaName, req.table, req.rows);
  const refused = new Set(failed.map((f) => f.index));
  if (refused.size === 0 || refused.size === req.rows.length) return out;
  const rest = await write(
    deps,
    req,
    db,
    schemaName,
    req.rows.filter((_, i) => !refused.has(i)),
  );
  if (rest.ok) rest.result.failed = failed;
  return rest;
}

// Observe → plan → one transaction (re-planned once on a widen race) → CAS.
async function write(
  deps: InsertDeps,
  req: InsertRequest,
  db: DbRecord,
  schemaName: string,
  rows: Record<string, unknown>[],
): Promise<InsertOutcome> {
  const tracer = trace.getTracer("@nlqdb/api");
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
        const table = columnName(req.table);
        let uniques: UniqueKeys = [];
        if (req.key?.length && table && out.has(table)) {
          const res = await deps.pg.query<{ cols: string[] }>(UNIQUES_SQL, [schemaName, table]);
          uniques = res.rows.map((r) => r.cols);
        }
        return { schema: out, uniques };
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        return null;
      } finally {
        span.end();
      }
    });
    if (!observed) return fail({ code: "db_unreachable" });

    planned = planInsert(observed.schema, schemaName, req.table, rows, req.key, observed.uniques);
    if (!planned.ok) return fail({ code: "invalid_body", reason: planned.reason });
    const { plan, inserts, widens, sequence, uniqueIndex } = planned.value;
    const [first, ...rest] = inserts;
    if (!first) return fail({ code: "internal_error" });

    let statements = [{ sql: "SET LOCAL statement_timeout = '30s'" }, first];
    ddl = [];
    if (widens) {
      const compiled = compileWriteDdl(plan, schemaName);
      if (!compiled.ok) return fail({ code: "internal_error" }, true);
      const validation = deps.validateCompiledDdl(compiled.statements);
      if (!validation.ok) return fail({ code: "internal_error" }, true);
      const batch = await buildWidenBatch({
        schemaName,
        tenantId: db.tenantId,
        plan,
        insert: first,
      });
      if (!batch.ok) return fail({ code: "internal_error" }, true);
      statements = batch.statements;
      ddl = compiled.statements;
    }
    // The key's index and the sequence lift run right before the inserts.
    const before = sequence ? [sequence] : [];
    if (uniqueIndex) {
      const { lock, ddl: index } = uniqueIndex;
      if (!deps.validateCompiledDdl([lock, index]).ok)
        return fail({ code: "internal_error" }, widens);
      before.unshift({ sql: lock }, { sql: index });
    }
    statements.splice(-1, 0, ...before);
    statements.push(...rest);
    exec = await executeWidenBatch({ pg: deps.pg }, statements);
    if (exec.ok || !RACED.has(exec.sqlState ?? "")) break;
  }
  if (!exec || !planned?.ok) return fail({ code: "internal_error" });
  const { table, plan, widens, inserts } = planned.value;

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

  const landed = exec.results.slice(-inserts.length);
  const result: InsertResult = {
    rows: landed.flatMap((r) => r.rows),
    rowCount: landed.reduce((n, r) => n + r.rowCount, 0),
    table,
  };
  // A first-use key index is DDL the response owns up to, but not a widen:
  // `schema_hash` and the KPI-1 sample move only on a new table or field.
  if (planned.value.uniqueIndex) result.index = planned.value.uniqueIndex.ddl;
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

// The refused rows of a batch Postgres rejected with a data exception, each
// with the field and the column type it won't cast to. Arrays bind as
// Postgres array literals, not text, so they aren't probed. Best-effort: a
// failed probe (or a pre-16 Postgres) leaves the whole-batch error standing.
async function probeRows(
  pg: PgClient,
  schemaName: string,
  rawTable: string,
  rows: Record<string, unknown>[],
): Promise<FailedRow[]> {
  const table = columnName(rawTable);
  if (!table) return [];
  const cells: { i: number; c: string; v: string }[] = [];
  const fields = new Map<string, string>();
  for (const [i, row] of rows.entries()) {
    for (const [field, v] of Object.entries(row ?? {})) {
      const c = columnName(field);
      if (!c || v === null || v === undefined || Array.isArray(v)) continue;
      fields.set(`${i}\0${c}`, field);
      cells.push({ i, c, v: typeof v === "object" ? JSON.stringify(v) : String(v) });
    }
  }
  return trace.getTracer("@nlqdb/api").startActiveSpan("db.query", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "SELECT");
    try {
      const { rows: bad } = await pg.query<{ i: number; c: string; type: string }>(PROBE_SQL, [
        JSON.stringify(cells),
        quoted(schemaName, table),
      ]);
      span.setAttribute("nlqdb.insert.rows_refused", new Set(bad.map((b) => b.i)).size);
      return bad.map((b) => ({
        index: b.i,
        field: fields.get(`${b.i}\0${b.c}`) ?? b.c,
        type: b.type,
      }));
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      return [];
    } finally {
      span.end();
    }
  });
}
