import { neon } from "@neondatabase/serverless";
import { dbDurationMs, redactPii } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { bufferedEngineResult } from "./engine-result.ts";
import type {
  DatabaseAdapter,
  EnginePlan,
  EngineResult,
  PostgresEngineMeta,
  Row,
} from "./types.ts";

// Internal call shape (`SK-DB-001` underlying `(sql, params)` preserved
// per `SK-DB-009`). Production wires this to `neon().query()`; tests
// inject a stub through the same `SK-DB-006` seam. `signal` is threaded
// so cancellation is testable through the injection point — production
// passes it via Neon's `fetchOptions.signal` to abort the in-flight
// fetch.
export type PostgresQueryFn = (
  sql: string,
  params: unknown[],
  signal?: AbortSignal,
) => Promise<{
  rows: Row[];
  rowCount?: number;
  command?: string;
  fields?: { name: string; dataTypeID: number }[];
}>;

export type PostgresAdapterOptions = {
  connectionString?: string;
  // Test override — if provided, used directly and `connectionString` is ignored.
  query?: PostgresQueryFn;
};

export function createPostgresAdapter(opts: PostgresAdapterOptions): DatabaseAdapter {
  const query = opts.query ?? buildNeonQuery(opts.connectionString);
  const tracer = trace.getTracer("@nlqdb/db");

  return {
    engine: "postgres",
    async execute(plan: EnginePlan, signal?: AbortSignal): Promise<EngineResult> {
      // The public signature is engine-agnostic; this adapter only
      // services the `postgres` variant. `db-registry` routes by
      // `engine` so a non-PG plan never reaches here in production —
      // the guard exists so the type narrowing below is sound.
      if (plan.engine !== "postgres") {
        throw new Error(`postgres adapter received non-postgres plan: ${plan.engine}`);
      }
      const sqlText = plan.sql;
      const params = plan.params ?? [];
      const operation = detectOperation(sqlText);
      return tracer.startActiveSpan(
        "db.query",
        {
          attributes: {
            "db.system": "postgresql",
            "db.statement": redactPii(sqlText),
            "db.operation": operation,
            "db.operation.name": operation,
          },
        },
        async (span) => {
          const startedAt = performance.now();
          try {
            // Pre-flight abort check — skip the round-trip if the
            // caller already cancelled.
            signal?.throwIfAborted();
            const result = await query(sqlText, params, signal);
            const meta: PostgresEngineMeta = {
              engine: "postgres",
              command: result.command ?? operation,
              rowCount: result.rowCount ?? result.rows.length,
            };
            if (result.fields) meta.fields = result.fields;
            return bufferedEngineResult(result.rows, meta);
          } catch (err) {
            span.recordException(err as Error);
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw err;
          } finally {
            const elapsed = performance.now() - startedAt;
            dbDurationMs().record(elapsed, { operation });
            span.end();
          }
        },
      );
    },
  };
}

function buildNeonQuery(connectionString: string | undefined): PostgresQueryFn {
  if (!connectionString) {
    throw new Error("createPostgresAdapter: connectionString or query override is required");
  }
  const sql = neon(connectionString, { fullResults: true });
  return async (text, params, signal) => {
    const result = await sql.query(text, params, signal ? { fetchOptions: { signal } } : undefined);
    return {
      rows: result.rows as Row[],
      rowCount: result.rowCount,
      command: result.command,
      fields: result.fields as { name: string; dataTypeID: number }[],
    };
  };
}

// Extract the SQL command name per OTel `db.operation.name` semantic
// convention — first keyword for DML / TCL / DCL, "VERB NOUN" pair for
// DDL (e.g. CREATE TABLE, DROP INDEX). Mirrors the approach in the
// official `@opentelemetry/instrumentation-pg`, which we can't reuse
// here because it hooks into the `pg` client, not Neon's HTTP driver.
//
// Cardinality is naturally bounded: SQL keywords are a finite set
// (~30) and DDL noun phrases add ~10 more — well within PERFORMANCE
// §3.3 limits.
const DDL_VERBS = new Set(["CREATE", "DROP", "ALTER", "TRUNCATE"]);

function detectOperation(sql: string): string {
  // Strip leading whitespace + line/block comments before tokenising.
  const stripped = sql.replace(/^(?:\s+|--[^\n]*\n?|\/\*[\s\S]*?\*\/)+/, "");
  const verbMatch = stripped.match(/^[A-Za-z]+/);
  if (!verbMatch) return "UNKNOWN";
  const verb = verbMatch[0].toUpperCase();
  if (!DDL_VERBS.has(verb)) return verb;
  const nounMatch = stripped.slice(verbMatch[0].length).match(/^\s+([A-Za-z]+)/);
  return nounMatch?.[1] ? `${verb} ${nounMatch[1].toUpperCase()}` : verb;
}
