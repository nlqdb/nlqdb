import { neon } from "@neondatabase/serverless";
import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { DatabaseAdapter, QueryResult } from "./types.ts";

// The narrowest seam the adapter actually needs. Production code calls
// `neon(url).query(...)`; tests inject a fake matching this shape.
export type PostgresQueryFn = (
  sql: string,
  params: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>;

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
    async execute(sqlText: string, params: unknown[] = []): Promise<QueryResult> {
      const operation = detectOperation(sqlText);
      return tracer.startActiveSpan(
        "db.query",
        {
          attributes: {
            "db.system": "postgresql",
            "db.operation": operation,
          },
        },
        async (span) => {
          const startedAt = performance.now();
          try {
            const result = await query(sqlText, params);
            const rows = result.rows;
            return { rows, rowCount: result.rowCount ?? rows.length };
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
  return async (text, params) => {
    const result = await sql.query(text, params);
    return {
      rows: result.rows as Record<string, unknown>[],
      rowCount: result.rowCount,
    };
  };
}

// First whitespace-stripped keyword decides the operation. Anything
// outside the standard CRUD set rolls up to OTHER — keeps metric
// cardinality bounded (PERFORMANCE §3.3).
function detectOperation(sql: string): string {
  const head = sql.trimStart().slice(0, 16).toUpperCase();
  if (head.startsWith("SELECT")) return "SELECT";
  if (head.startsWith("INSERT")) return "INSERT";
  if (head.startsWith("UPDATE")) return "UPDATE";
  if (head.startsWith("DELETE")) return "DELETE";
  return "OTHER";
}
