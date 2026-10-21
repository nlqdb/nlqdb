// `POST /v1/insert` orchestrator (SK-SCHEMA-012, GLOBAL-041 Phase A step 10).
// Observe the DB's columns → `planInsert` → widen DDL (compiled, allow-listed)
// + the INSERT in ONE Neon transaction → CAS-rewrite `schema_hash`
// (SK-SCHEMA-011). There is no LLM dependency to inject: 0 `llm.*` spans
// under an insert holds by construction. A value that won't cast, or a row
// that duplicates a unique value, fails its row alone (GLOBAL-041 step 11):
// the batch's refusal triggers one read-only probe naming each such row, and
// the rest land.

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { classifyDataException } from "../ask/exec-classify.ts";
import type { RateLimiter } from "../ask/rate-limit.ts";
import { type AskError, type DbRecord, WriteConstraintError } from "../ask/types.ts";
import { classifyWriteConstraint } from "../ask/write-constraint.ts";
import { quoted, quoteIdent } from "../db-create/compile-ddl.ts";
import { compileWriteDdl } from "../db-create/compile-write-ddl.ts";
import type { DdlValidationResult, PgClient } from "../db-create/types.ts";
import {
  buildWidenBatch,
  executeWidenBatch,
  type WidenExecResult,
  widenedSchema,
} from "../db-create/widen-provision.ts";
import { rewriteWidenedSchema } from "../db-registry.ts";
import { type DbaChange, indexChange, recordDbaChanges, widenChanges } from "../dba-changes.ts";
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
  // Rows refused, each alone; every other row landed. `index` is the row's
  // position in the request.
  failed?: FailedRow[];
};

// `invalid_value`: `field` won't cast to the column's existing `type`.
// `duplicate`: the row repeats a unique value (`field`, comma-joined for a
// multi-column index) already stored or on an earlier row of the batch.
export type FailedRow =
  | { index: number; field: string; reason: "invalid_value"; type: string }
  | { index: number; field: string; reason: "duplicate" };

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

  // Each failure class gets one probe and one re-run without the rows it
  // names; a batch with both bad values and duplicates takes two. A keyed
  // write's duplicates upsert, so its unique refusals aren't probed.
  let live = req.rows.map((_, i) => i);
  const failed: FailedRow[] = [];
  let out = await write(deps, req, db, schemaName, req.rows);
  for (let pass = 0; pass < 2 && !out.ok; pass++) {
    const rows = live.map((i) => req.rows[i] as Record<string, unknown>);
    const { error } = out;
    const found =
      error.code === "invalid_value"
        ? await probeCasts(deps.pg, schemaName, req.table, rows)
        : error.code === "write_constraint" && error.kind === "unique" && !req.key?.length
          ? await probeDuplicates(deps.pg, schemaName, req.table, rows)
          : [];
    const refused = new Set(found.map((f) => f.index));
    if (refused.size === 0 || refused.size === rows.length) break;
    failed.push(...found.map((f) => ({ ...f, index: live[f.index] as number })));
    live = live.filter((_, j) => !refused.has(j));
    out = await write(
      deps,
      req,
      db,
      schemaName,
      live.map((i) => req.rows[i] as Record<string, unknown>),
    );
  }
  if (out.ok && failed.length) out.result.failed = failed.sort((a, b) => a.index - b.index);
  return out;
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
  // Every committed DDL statement goes to the change ledger with its inverse.
  const changes: DbaChange[] = widens ? widenChanges(plan, schemaName, ddl) : [];
  // A first-use key index is DDL the response owns up to, but not a widen:
  // `schema_hash` and the KPI-1 sample move only on a new table or field.
  const { uniqueIndex } = planned.value;
  if (uniqueIndex) {
    result.index = uniqueIndex.ddl;
    changes.push(indexChange(schemaName, table, uniqueIndex));
  }
  const ledger = recordDbaChanges(deps.d1, db.id, "insert", changes);
  if (!widens) {
    await ledger;
    return { ok: true, result, widened: false };
  }

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
  await ledger;
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
async function probeCasts(
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
        reason: "invalid_value" as const,
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

// The rows of a batch Postgres refused with a unique violation that repeat a
// unique value — one already stored, or one an earlier row of the batch
// carries (that earlier row lands). Each row is cast to the table's row type
// by `jsonb_populate_record`, so equality is the column type's own; a column
// the batch was about to add isn't in it, and a NULL never conflicts.
// Best-effort, as `probeCasts`: a failed probe leaves the whole-batch error.
async function probeDuplicates(
  pg: PgClient,
  schemaName: string,
  rawTable: string,
  rows: Record<string, unknown>[],
): Promise<FailedRow[]> {
  const table = columnName(rawTable);
  if (!table) return [];
  const fields = new Map<string, string>();
  const records = rows.map((row, i) => {
    const out: Record<string, unknown> = {};
    for (const [field, v] of Object.entries(row ?? {})) {
      const c = columnName(field);
      if (!c) continue;
      fields.set(`${i}\0${c}`, field);
      out[c] = v;
    }
    return out;
  });
  return trace.getTracer("@nlqdb/api").startActiveSpan("db.query", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "SELECT");
    try {
      const uniques = await pg.query<{ cols: string[] }>(UNIQUES_SQL, [schemaName, table]);
      const sets = uniques.rows.map((r) => r.cols);
      if (sets.length === 0) return [];
      const { rows: dup } = await pg.query<{ i: number; u: number }>(
        duplicatesSql(quoted(schemaName, table), sets),
        [JSON.stringify(records)],
      );
      span.setAttribute("nlqdb.insert.rows_refused", new Set(dup.map((d) => d.i)).size);
      const seen = new Set<number>();
      return dup.flatMap(({ i, u }) => {
        if (seen.has(i)) return [];
        seen.add(i);
        const cols = sets[u] ?? [];
        const field = cols.map((c) => fields.get(`${i}\0${c}`) ?? c).join(", ");
        return [{ index: i, field, reason: "duplicate" as const }];
      });
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      return [];
    } finally {
      span.end();
    }
  });
}

// One read-only query over every unique column set `u` of the table: a row
// whose set is fully non-NULL and either matches a stored row or repeats an
// earlier row of the batch. Identifiers come from `pg_index` and are quoted;
// the values travel as one jsonb param.
function duplicatesSql(target: string, sets: string[][]): string {
  const batch =
    "WITH b AS (SELECT (x.ord - 1)::int AS i, p AS r " +
    "FROM jsonb_array_elements($1::text::jsonb) WITH ORDINALITY AS x(v, ord) " +
    `CROSS JOIN LATERAL jsonb_populate_record(NULL::${target}, x.v) AS p)`;
  const arms = sets.map((cols, u) => {
    const col = (c: string) => `(b.r).${quoteIdent(c)}`;
    const picked = cols.map((c, k) => `${col(c)} AS k${k}`).join(", ");
    const set = cols.map(col).join(", ");
    const present = cols.map((c) => `${col(c)} IS NOT NULL`).join(" AND ");
    const stored = cols.map((c, k) => `t.${quoteIdent(c)} = d.k${k}`).join(" AND ");
    return (
      `SELECT d.i, ${u} AS u FROM (SELECT b.i, ${picked}, ` +
      `row_number() OVER (PARTITION BY ${set} ORDER BY b.i) AS n FROM b WHERE ${present}) d ` +
      `WHERE d.n > 1 OR EXISTS (SELECT 1 FROM ${target} t WHERE ${stored})`
    );
  });
  return `${batch} ${arms.join(" UNION ALL ")} ORDER BY 1, 2`;
}
