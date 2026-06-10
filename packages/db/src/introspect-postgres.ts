// BYO Postgres connect-time schema introspection — reads the *live* schema
// of a user-supplied database so the `/v1/ask` planner has the same faithful
// "table names, columns + types, foreign keys" description the hosted create
// path gets from its compiled DDL (`orchestrate.ts` step 5). The decided BYO
// shape (`architecture.md §3.6.7`, `SK-DB-011`) pins this to a `pg_catalog`
// query at connect time, one table-card per existing table — no `pg_dump`.
//
// This is the next primitive in the BYO connect-path family, after the URL
// parser (`SK-DB-012`), the egress guard (`GLOBAL-035`), and the validation
// pipeline (`SK-DB-013`): once `validateByoConnection` clears a host and the
// caller has a live query function, this turns the user's existing schema into
// the read-model `registerByoDb` seals + writes to D1. It ships ahead of that
// caller, the same cadence the rest of the family followed.
//
// Three fixed `pg_catalog` queries regardless of table count (columns, primary
// keys, foreign keys) — never one-query-per-table — so introspecting a 200-table
// database is still three round-trips, not 200. All three read from `pg_catalog`
// (one visibility model: exactly what the connecting role can see) and use
// `format_type` for faithful rendered types (`character varying(255)`,
// `numeric(10,2)`, `text[]`, enum names) that `information_schema.columns` flattens
// to `ARRAY` / `USER-DEFINED`. Composite keys stay correctly ordered via
// `unnest(...) WITH ORDINALITY` over the `smallint[]` `conkey`/`confkey` arrays
// (the classic `information_schema` kcu↔ccu join cartesian-products composite FKs;
// the catalog arrays don't).
//
// Scope is the logical, queryable "existing table": ordinary + partitioned tables
// (`relkind IN ('r','p')`) that are not themselves a partition (`NOT relispartition`).
// Excluding `relispartition` rows drops the child partitions — which would otherwise
// duplicate one logical table as parent + N children, and (PG 11+) clone its foreign
// keys onto every child. Views / materialized views are a later, explicit decision,
// not a silent inclusion that would present a view as a table.

import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { PostgresQueryFn } from "./postgres.ts";

export type IntrospectedColumn = {
  name: string;
  // `format_type(atttypid, atttypmod)` rendering — the type as Postgres prints
  // it, e.g. `integer`, `character varying(255)`, `numeric(10,2)`, `text[]`.
  type: string;
  nullable: boolean;
};

export type IntrospectedTable = {
  name: string;
  columns: IntrospectedColumn[];
  // Primary-key columns in key order; empty when the table has no primary key.
  primaryKey: string[];
};

export type IntrospectedForeignKey = {
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
};

export type IntrospectedSchema = {
  schema: string;
  tables: IntrospectedTable[];
  foreignKeys: IntrospectedForeignKey[];
};

// All three queries take the target schema as `$1` (parameterised — never
// interpolated) and read only `pg_catalog`, so a role with no rights on a
// relation simply doesn't see it, consistently across columns/PK/FK.

const COLUMNS_SQL = `
SELECT c.relname AS table_name,
       a.attname AS column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull AS not_null
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1
  AND c.relkind IN ('r', 'p')
  AND NOT c.relispartition
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY c.relname, a.attnum`;

const PRIMARY_KEYS_SQL = `
SELECT c.relname AS table_name,
       a.attname AS column_name,
       k.ord     AS key_seq
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_namespace n ON n.oid = con.connamespace
JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
WHERE n.nspname = $1 AND con.contype = 'p' AND c.relkind IN ('r', 'p') AND NOT c.relispartition
ORDER BY c.relname, k.ord`;

const FOREIGN_KEYS_SQL = `
SELECT con.conname AS constraint_name,
       c.relname   AS from_table,
       fa.attname  AS from_column,
       rc.relname  AS to_table,
       ra.attname  AS to_column,
       k.ord       AS ord
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_namespace n ON n.oid = con.connamespace
JOIN pg_catalog.pg_class c  ON c.oid  = con.conrelid
JOIN pg_catalog.pg_class rc ON rc.oid = con.confrelid
JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS k(conkey, confkey, ord) ON true
JOIN pg_catalog.pg_attribute fa ON fa.attrelid = con.conrelid  AND fa.attnum = k.conkey
JOIN pg_catalog.pg_attribute ra ON ra.attrelid = con.confrelid AND ra.attnum = k.confkey
WHERE n.nspname = $1 AND con.contype = 'f' AND c.relkind IN ('r', 'p') AND NOT c.relispartition
ORDER BY c.relname, con.conname, k.ord`;

// Introspect one schema of a live Postgres database into a faithful read-model.
// `query` is the injected seam (`SK-DB-006`) — production passes a function
// bound to the BYO connection; tests pass a stub keyed on the SQL. Emits one
// `db.introspect` span for the whole connect-time read (`GLOBAL-014`) — not one
// per query — and records its latency into `nlqdb.db.duration_ms{operation=introspect}`.
// Throws on a query failure (fail-loud, `GLOBAL-012`); the caller surfaces it as
// a connect error and never seals.
export async function introspectPostgres(
  query: PostgresQueryFn,
  schema: string,
): Promise<IntrospectedSchema> {
  const tracer = trace.getTracer("@nlqdb/db");
  return tracer.startActiveSpan(
    "db.introspect",
    {
      attributes: {
        "db.system": "postgresql",
        "db.operation.name": "introspect",
        // Schema is the user's own object name — useful on a connect-debug
        // span, and span attributes don't count against the metric-label
        // cardinality budget (`docs/performance.md §3.3`) the way labels do.
        "db.namespace": schema,
      },
    },
    async (span) => {
      const startedAt = performance.now();
      try {
        // Independent reads — run them concurrently so a wide schema costs one
        // round-trip of latency, not three.
        const [columns, primaryKeys, foreignKeys] = await Promise.all([
          query(COLUMNS_SQL, [schema]),
          query(PRIMARY_KEYS_SQL, [schema]),
          query(FOREIGN_KEYS_SQL, [schema]),
        ]);
        return assemble(columns.rows, primaryKeys.rows, foreignKeys.rows, schema);
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

// Fold the three flat result sets into the nested read-model. Each query's
// `ORDER BY` is load-bearing: columns by `(table, attnum)`, PK rows by key seq,
// FK rows by `(from_table, conname, ord)` so one constraint's pairs stay
// contiguous (see the FK loop) — a single in-order pass then preserves all
// ordering without re-sorting.
function assemble(
  columnRows: Record<string, unknown>[],
  pkRows: Record<string, unknown>[],
  fkRows: Record<string, unknown>[],
  schema: string,
): IntrospectedSchema {
  const tables = new Map<string, IntrospectedTable>();
  const tableFor = (name: string): IntrospectedTable => {
    let t = tables.get(name);
    if (!t) {
      t = { name, columns: [], primaryKey: [] };
      tables.set(name, t);
    }
    return t;
  };

  for (const row of columnRows) {
    tableFor(String(row["table_name"])).columns.push({
      name: String(row["column_name"]),
      type: String(row["data_type"]),
      // `attnotnull` arrives as a SQL boolean; a NOT NULL column is non-nullable.
      nullable: row["not_null"] !== true,
    });
  }

  // A PK can only exist on a table that has columns, so the table is already in
  // the map; appending in key-seq order reproduces the key.
  for (const row of pkRows) {
    const t = tables.get(String(row["table_name"]));
    if (t) t.primaryKey.push(String(row["column_name"]));
  }

  // Group FK rows by `(from_table, constraint_name)`: a constraint name is
  // unique per table, not per schema, so two tables can both own an
  // `fk_account` — keying on the name alone would merge them into one corrupt
  // FK. The `\0` joiner can't occur in a Postgres identifier, so the pair can't
  // alias. Rows arrive ordered by `(from_table, conname, ord)`, so each
  // constraint's column pairs append in order.
  const fks = new Map<string, IntrospectedForeignKey>();
  for (const row of fkRows) {
    const key = `${String(row["from_table"])}\0${String(row["constraint_name"])}`;
    let fk = fks.get(key);
    if (!fk) {
      fk = {
        fromTable: String(row["from_table"]),
        fromColumns: [],
        toTable: String(row["to_table"]),
        toColumns: [],
      };
      fks.set(key, fk);
    }
    fk.fromColumns.push(String(row["from_column"]));
    fk.toColumns.push(String(row["to_column"]));
  }

  return {
    schema,
    // Stable table order so a re-introspect produces an identical read-model
    // (and a stable `schema_text`/`schema_hash` downstream).
    tables: [...tables.values()].sort((a, b) => a.name.localeCompare(b.name)),
    foreignKeys: [...fks.values()],
  };
}
