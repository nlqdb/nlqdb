// BYO ClickHouse connect-time schema introspection — the deliberate ClickHouse
// parallel of `introspect-postgres.ts` (`SK-DB-014`), not a generalisation of
// it. Once the BYO ClickHouse connect path has validated a host
// (`validateByoConnection`, `SK-DB-013`) and opened a live query function, this
// turns the user's *existing* ClickHouse schema into the same faithful "table
// names, columns + types" read-model the `/v1/ask` planner gets for every other
// engine — except it is *read* from `system.*`, not authored. Pins the
// `system.columns` introspection clause of `SK-MULTIENG-005`
// (`architecture.md §3.6.7`); it ships ahead of its `clickhouse-byo.ts`
// adapter + `registerByoDb` callers, the same primitive-ahead-of-callers rhythm
// the rest of the BYO connect-path family followed.
//
// Two fixed `system.*` queries regardless of table count (never one-per-table,
// so a 200-table database is two round-trips, not 200), run concurrently:
//   • `system.tables` — the authoritative table list + the effective
//     `primary_key` expression, filtered to logical queryable tables.
//   • `system.columns` — every column's name + type, ordered by `position`.
// The `database` is always a bound `{database:String}` server-side parameter,
// never interpolated.
//
// Three ClickHouse-specific shapes the Postgres reader has no analogue for:
//   • No foreign keys. ClickHouse has none; the read-model carries no FK field
//     rather than inventing an empty one.
//   • The primary key is an *expression*, not a column list. `system.tables`
//     reports it verbatim (e.g. `toYYYYMM(event_date), user_id`) — and a
//     ClickHouse key need not be column-position-ordered, so reconstructing an
//     ordered column list from `is_in_primary_key` would be wrong. We surface
//     the expression string ClickHouse itself reports.
//   • Nullability is encoded in the *type* (`Nullable(T)`), not a flag column.
//     A column is nullable iff its outermost type is `Nullable(...)` —
//     `LowCardinality(Nullable(String))` is nullable; `Array(Nullable(String))`
//     is a non-nullable array of nullable elements, so a naïve substring test
//     would be wrong. `isNullable` unwraps one `LowCardinality(...)` then checks
//     the outermost wrapper. The full type string is kept verbatim for display.
//
// Scope is the logical queryable table: views / materialized views (engine
// names all contain `View`) and temporary tables are excluded in SQL, so a
// view never leaks back as a table — the parallel of the Postgres reader
// excluding child partitions + views.

import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  DB_NAMESPACE,
  DB_OPERATION_NAME,
  DB_SYSTEM,
  DB_SYSTEM_VALUE,
} from "./clickhouse-tinybird/otel-attrs.ts";
import type { Row } from "./types.ts";

// Injected query seam for a live BYO ClickHouse connection — the ClickHouse
// parallel of `PostgresQueryFn` (`SK-DB-006`). Production binds this to a
// `FORMAT JSON` query over the BYO host's HTTP interface (the future
// `clickhouse-byo.ts` adapter owns that client, `GLOBAL-021`); tests inject a
// stub keyed on the SQL. ClickHouse binds named params server-side via
// `{name:Type}` placeholders + `param_<name>` HTTP args, so params are
// name→string, never positional.
export type ClickhouseQueryFn = (
  sql: string,
  params: Record<string, string>,
  signal?: AbortSignal,
) => Promise<{ rows: Row[] }>;

export type IntrospectedClickhouseColumn = {
  name: string;
  // The ClickHouse type verbatim, as `system.columns` reports it — e.g.
  // `UInt64`, `Nullable(String)`, `LowCardinality(String)`, `Array(UInt8)`,
  // `DateTime64(3)`. Kept whole so the planner sees the real type.
  type: string;
  // Derived from `type`: true iff the column itself is `Nullable(...)`.
  nullable: boolean;
};

export type IntrospectedClickhouseTable = {
  name: string;
  columns: IntrospectedClickhouseColumn[];
  // The effective primary-key expression exactly as `system.tables` reports it
  // (`toYYYYMM(event_date), user_id`), or `""` for an engine with no primary
  // key. An expression, not a column list — see the file header.
  primaryKey: string;
};

export type IntrospectedClickhouseSchema = {
  database: string;
  tables: IntrospectedClickhouseTable[];
};

// Both queries take the target database as `{database:String}` (bound
// server-side, never interpolated). `system.tables` is the authoritative table
// set — `engine NOT LIKE '%View%'` drops View / MaterializedView / LiveView /
// WindowView (and keeps every other queryable engine: MergeTree, Dictionary,
// Distributed, Buffer, …), and `is_temporary = 0` drops session-temporary
// tables — so a column whose table isn't in this set (a view's column) is
// dropped on assembly.
const TABLES_SQL = `SELECT name, primary_key
FROM system.tables
WHERE database = {database:String}
  AND engine NOT LIKE '%View%'
  AND is_temporary = 0
ORDER BY name`;

// `position` orders columns within a table the way the table declares them;
// we order by it but don't surface it. No FK query — ClickHouse has no FKs.
const COLUMNS_SQL = `SELECT table, name, type
FROM system.columns
WHERE database = {database:String}
ORDER BY table, position`;

// Introspect one database of a live ClickHouse instance into a faithful
// read-model. `query` is the injected seam — production passes a function bound
// to the BYO connection; tests pass a stub keyed on the SQL. Emits one
// `db.introspect` span for the whole connect-time read (`GLOBAL-014`) — not one
// per query — recording into `nlqdb.db.duration_ms{operation=introspect}` (the
// same operation label as the Postgres reader; the engine shows on the span's
// `db.system`, not the metric). Throws fail-loud (`GLOBAL-012`) on a query
// failure so the caller surfaces a connect error and never seals.
export async function introspectClickhouse(
  query: ClickhouseQueryFn,
  database: string,
): Promise<IntrospectedClickhouseSchema> {
  const tracer = trace.getTracer("@nlqdb/db");
  return tracer.startActiveSpan(
    "db.introspect",
    {
      attributes: {
        [DB_SYSTEM]: DB_SYSTEM_VALUE,
        [DB_OPERATION_NAME]: "introspect",
        // The user's own database name — useful on a connect-debug span, and
        // span attributes don't count against the metric-label cardinality
        // budget (`docs/performance.md §3.3`) the way labels do.
        [DB_NAMESPACE]: database,
      },
    },
    async (span) => {
      const startedAt = performance.now();
      try {
        // Independent reads — run concurrently so a wide schema costs one
        // round-trip of latency, not two.
        const [tables, columns] = await Promise.all([
          query(TABLES_SQL, { database }),
          query(COLUMNS_SQL, { database }),
        ]);
        return assemble(tables.rows, columns.rows, database);
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        dbDurationMs().record(performance.now() - startedAt, { operation: "introspect" });
        span.end();
      }
    },
  );
}

// A column is nullable iff its *outermost* type is `Nullable(...)`. Unwrap one
// `LowCardinality(...)` first — `LowCardinality(Nullable(String))` is a nullable
// column — but stop there: `Array(Nullable(String))` is a non-nullable array
// whose elements are nullable, so an inner `Nullable(` must not count.
function isNullable(type: string): boolean {
  let t = type.trim();
  const lc = "LowCardinality(";
  if (t.startsWith(lc) && t.endsWith(")")) t = t.slice(lc.length, -1).trim();
  return t.startsWith("Nullable(");
}

// Fold the two flat result sets into the nested read-model. `system.tables` is
// authoritative: it seeds the table map (name + primary-key expression), and a
// column whose `table` isn't in that map — a view's column — is dropped.
// Within a table, columns arrive in `position` order. The final table list is
// sorted in JS so the read-model is deterministic regardless of result-set
// order (a stable `schema_text`/`schema_hash` downstream).
function assemble(
  tableRows: Row[],
  columnRows: Row[],
  database: string,
): IntrospectedClickhouseSchema {
  const tables = new Map<string, IntrospectedClickhouseTable>();
  for (const row of tableRows) {
    const name = String(row["name"]);
    tables.set(name, { name, columns: [], primaryKey: String(row["primary_key"] ?? "") });
  }

  for (const row of columnRows) {
    const t = tables.get(String(row["table"]));
    // A column whose table isn't in the authoritative set (a view / temp
    // table) is not part of the queryable schema.
    if (!t) continue;
    const type = String(row["type"]);
    t.columns.push({ name: String(row["name"]), type, nullable: isNullable(type) });
  }

  return {
    database,
    tables: [...tables.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
