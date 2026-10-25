// Tier 0 (catalog) observer for an attached Postgres — the first proposals a
// user sees after attach, before any workload snapshot exists (`GLOBAL-043`
// item 7, `END_GOAL.md` happy-path row 2). It needs only catalog reads, so it
// works on a role without `pg_read_all_stats` and on a DB without
// `pg_stat_statements`.
//
// First rule: a foreign key with no index whose leading columns cover it. The
// app's joins on that key and every `DELETE` / key `UPDATE` on the referenced
// table scan the whole referencing table. One fixed `pg_catalog` query for the
// whole schema, never one per table.
//
// An index "covers" the FK when its first n key columns are exactly the n FK
// columns in any order (an equality lookup can use any permutation). Partial
// and invalid (failed `CONCURRENTLY`) indexes don't count. Child partitions are
// skipped: their FKs are clones of the parent's, the same as `introspect-postgres.ts`.

import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { createIndexProposal, type Proposal } from "./dba-proposal.ts";
import type { PostgresQueryFn } from "./postgres.ts";

// One row per (constraint, column), in key order — grouped in JS so no driver
// has to parse a Postgres array (the BYO socket runs with `fetch_types: false`).
const UNINDEXED_FOREIGN_KEYS_SQL = `
SELECT c.relname   AS table_name,
       con.conname AS constraint_name,
       a.attname   AS column_name,
       rc.relname  AS ref_table,
       GREATEST(c.reltuples, 0)::float8 AS row_estimate,
       pg_catalog.pg_total_relation_size(c.oid)::float8 AS table_bytes
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_namespace n ON n.oid = con.connamespace
JOIN pg_catalog.pg_class c  ON c.oid  = con.conrelid
JOIN pg_catalog.pg_class rc ON rc.oid = con.confrelid
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
WHERE n.nspname = $1 AND con.contype = 'f' AND NOT c.relispartition
  AND NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index i
    WHERE i.indrelid = con.conrelid AND i.indisvalid AND i.indpred IS NULL
      AND (i.indkey::int2[])[0:cardinality(con.conkey) - 1] @> con.conkey
  )
ORDER BY c.relname, con.conname, k.ord`;

// Observe one schema and return its Tier 0 proposals, largest table first —
// where a missing FK index costs the most. A healthy schema returns `[]`
// ("nothing worth changing yet"), never an invented proposal. One `db.observe`
// span per call (`GLOBAL-014`); throws on a query failure (`GLOBAL-012`).
export async function observePostgresCatalog(
  query: PostgresQueryFn,
  schema: string,
): Promise<Proposal[]> {
  const tracer = trace.getTracer("@nlqdb/db");
  return tracer.startActiveSpan(
    "db.observe",
    {
      attributes: {
        "db.system": "postgresql",
        "db.operation.name": "observe_catalog",
        "db.namespace": schema,
      },
    },
    async (span) => {
      const startedAt = performance.now();
      try {
        const { rows } = await query(UNINDEXED_FOREIGN_KEYS_SQL, [schema]);
        const byConstraint = new Map<string, { row: (typeof rows)[number]; columns: string[] }>();
        for (const row of rows) {
          // Constraint names are unique per table, not per schema.
          const key = `${String(row["table_name"])}\0${String(row["constraint_name"])}`;
          const entry = byConstraint.get(key) ?? { row, columns: [] };
          entry.columns.push(String(row["column_name"]));
          byConstraint.set(key, entry);
        }
        const proposals = [...byConstraint.values()].map(({ row, columns }) => {
          const table = String(row["table_name"]);
          return createIndexProposal({
            tier: 0,
            schema,
            table,
            columns,
            reason: `Foreign key ${table}(${columns.join(", ")}) → ${String(row["ref_table"])} has no index: joins on it and deletes on ${String(row["ref_table"])} scan all of ${table}.`,
            evidence: {
              rowEstimate: Number(row["row_estimate"]),
              tableBytes: Number(row["table_bytes"]),
            },
          });
        });
        proposals.sort(
          (a, b) =>
            b.evidence.tableBytes - a.evidence.tableBytes ||
            a.table.localeCompare(b.table) ||
            a.columns.join().localeCompare(b.columns.join()),
        );
        span.setAttribute("nlqdb.dba.proposals", proposals.length);
        return proposals;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        dbDurationMs().record(performance.now() - startedAt, { operation: "observe_catalog" });
        span.end();
      }
    },
  );
}
