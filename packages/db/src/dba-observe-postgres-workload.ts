// Tier 1 (workload) observer for an attached Postgres (`GLOBAL-043` item 7):
// the app's own hot fingerprints from `pg_stat_statements`, turned into
// `create_index` proposals. Needs `pg_read_all_stats` and the extension
// installed in the attached database; Tier 0 (`dba-observe-postgres.ts`) works
// without either.
//
// `pg_stat_statements` counters are cumulative, so a window is the diff of two
// snapshots. They keep no percentiles: the window p95 is estimated as
// mean + 1.65 σ from the diffed counters and labelled an estimate (`GLOBAL-043`
// item 7). The same window, re-read after an apply, is what verify compares.
//
// A fingerprint yields a proposal when its plan (`EXPLAIN (GENERIC_PLAN)` on
// the normalized text, Postgres 16+ — never executed) seq-scans a table of the
// attached schema with a selective AND of equality filters, and no valid btree
// / hash index already leads with those columns.

import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { createIndexProposal, type Proposal } from "./dba-proposal.ts";
import type { PostgresQueryFn } from "./postgres.ts";

// The cumulative counters of one fingerprint (`queryid`), in ms.
export type StatementCounters = {
  query: string;
  calls: number;
  totalMs: number;
  // Σ t² — `pg_stat_statements` keeps population σ, so Σ t² = n (σ² + mean²).
  sumSquaresMs: number;
};

export type StatementSnapshot = Map<string, StatementCounters>;

// One fingerprint over a window between two snapshots.
export type FingerprintWindow = {
  fingerprint: string;
  query: string;
  calls: number;
  totalMs: number;
  meanMs: number;
  p95EstimateMs: number;
};

// Top-level statements of the attached database only: other databases on the
// cluster and statements nested in functions aren't this app's fingerprints.
const SNAPSHOT_SQL = `
SELECT s.queryid::text AS fingerprint,
       s.query,
       s.calls::float8 AS calls,
       s.total_exec_time::float8 AS total_ms,
       s.stddev_exec_time::float8 AS stddev_ms
FROM pg_stat_statements s
WHERE s.dbid = (SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database())
  AND s.toplevel AND s.queryid IS NOT NULL`;

export async function snapshotPostgresStatements(
  query: PostgresQueryFn,
): Promise<StatementSnapshot> {
  const { rows } = await query(SNAPSHOT_SQL, []);
  const snapshot: StatementSnapshot = new Map();
  for (const row of rows) {
    const calls = Number(row["calls"]);
    const totalMs = Number(row["total_ms"]);
    const mean = calls > 0 ? totalMs / calls : 0;
    const prev = snapshot.get(String(row["fingerprint"]));
    const counters = {
      query: String(row["query"]),
      calls,
      totalMs,
      sumSquaresMs: calls * (Number(row["stddev_ms"]) ** 2 + mean ** 2),
    };
    // One queryid can repeat per role: sum them, the fingerprint is the query.
    snapshot.set(
      String(row["fingerprint"]),
      prev
        ? {
            query: prev.query,
            calls: prev.calls + calls,
            totalMs: prev.totalMs + totalMs,
            sumSquaresMs: prev.sumSquaresMs + counters.sumSquaresMs,
          }
        : counters,
    );
  }
  return snapshot;
}

// The fingerprints that ran between `before` and `after`, most total time
// first. A fingerprint missing from `before`, or whose counters went backwards
// (a stats reset or eviction), counts from zero.
export function statementWindow(
  before: StatementSnapshot,
  after: StatementSnapshot,
): FingerprintWindow[] {
  const windows: FingerprintWindow[] = [];
  for (const [fingerprint, a] of after) {
    const b = before.get(fingerprint);
    const base = b && b.calls <= a.calls ? b : { calls: 0, totalMs: 0, sumSquaresMs: 0 };
    const calls = a.calls - base.calls;
    if (calls <= 0) continue;
    const totalMs = a.totalMs - base.totalMs;
    const meanMs = totalMs / calls;
    const variance = Math.max((a.sumSquaresMs - base.sumSquaresMs) / calls - meanMs ** 2, 0);
    windows.push({
      fingerprint,
      query: a.query,
      calls,
      totalMs,
      meanMs,
      p95EstimateMs: meanMs + 1.65 * Math.sqrt(variance),
    });
  }
  return windows.sort((x, y) => y.totalMs - x.totalMs);
}

// Bounds the EXPLAIN round-trips per observe to the window's heaviest
// fingerprints — where an index pays back the most.
const MAX_FINGERPRINTS = 20;
// An equality filter keeping more than this share of a table's rows is better
// served by the scan than by an index.
const MAX_SELECTIVITY = 0.05;

// Only single statements that can carry a WHERE; EXPLAIN without ANALYZE plans
// a write without running it.
const EXPLAINABLE = /^\s*(SELECT|UPDATE|DELETE|WITH)\b/i;

const IDENT = String.raw`(?:[A-Za-z_][\w$]*|"(?:[^"]|"")+")`;
const VALUE = String.raw`(?:\$\d+|\(\$\d+\)::[^()]+?|'(?:[^']|'')*'(?:::[\w ]+)?|-?\d+(?:\.\d+)?)`;
// One `(alias.column = value)` term of a VERBOSE plan's Filter.
const EQUALITY_TERM = new RegExp(String.raw`\(${IDENT}\.(${IDENT}) = ${VALUE}\)`, "g");

const unquote = (ident: string): string =>
  ident.startsWith('"') ? ident.slice(1, -1).replaceAll('""', '"') : ident;

type PlanNode = {
  "Node Type"?: string;
  "Relation Name"?: string;
  Schema?: string;
  "Plan Rows"?: number;
  Filter?: string;
  Plans?: PlanNode[];
};

type SeqScanFilter = { table: string; columns: string[]; planRows: number };

// The plan's seq scans on `schema` whose filter is an AND of plain equalities.
function seqScanFilters(node: PlanNode, schema: string, out: SeqScanFilter[] = []) {
  const filter = node.Filter;
  if (
    node["Node Type"] === "Seq Scan" &&
    node.Schema === schema &&
    node["Relation Name"] &&
    filter &&
    !/\bOR\b/.test(filter)
  ) {
    const columns = [
      ...new Set([...filter.matchAll(EQUALITY_TERM)].map((m) => unquote(m[1] as string))),
    ];
    if (columns.length > 0) {
      out.push({ table: node["Relation Name"], columns, planRows: node["Plan Rows"] ?? 0 });
    }
  }
  for (const child of node.Plans ?? []) seqScanFilters(child, schema, out);
  return out;
}

// The table's size, whether every column exists, and whether a valid,
// non-partial btree / hash index's first n key columns are exactly the n
// columns (in any order) — the same coverage rule as Tier 0's FK check.
const TABLE_CHECK_SQL = `
WITH cols AS (SELECT json_array_elements_text($3::text::json) AS name)
SELECT GREATEST(c.reltuples, 0)::float8 AS row_estimate,
       pg_catalog.pg_total_relation_size(c.oid)::float8 AS table_bytes,
       (SELECT count(*) FROM pg_catalog.pg_attribute a
         WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
           AND a.attname IN (SELECT name FROM cols))::int AS known_columns,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_catalog.pg_index i
         JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
         JOIN pg_catalog.pg_am am ON am.oid = ic.relam
         WHERE i.indrelid = c.oid AND i.indisvalid AND i.indpred IS NULL
           AND am.amname IN ('btree', 'hash')
           AND i.indnkeyatts >= (SELECT count(*) FROM cols)
           AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                  FROM unnest((i.indkey::int2[])[0:(SELECT count(*) FROM cols)::int - 1]) AS k(attnum)
                  JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum)
             = (SELECT array_agg(name ORDER BY name) FROM cols)
       ) THEN 1 ELSE 0 END AS covered
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind = 'r' AND NOT c.relispartition`;

// Turn the window's hot fingerprints into Tier 1 proposals, heaviest first;
// one proposal per (table, column set). A fingerprint that doesn't plan under
// the observer's role (search_path, a dropped table, Postgres < 16) is skipped
// and counted on the span, never guessed at. One `db.observe` span per call
// (`GLOBAL-014`); a catalog query failure throws (`GLOBAL-012`).
export async function observePostgresWorkload(
  query: PostgresQueryFn,
  schema: string,
  window: FingerprintWindow[],
): Promise<Proposal[]> {
  const tracer = trace.getTracer("@nlqdb/db");
  return tracer.startActiveSpan(
    "db.observe",
    {
      attributes: {
        "db.system": "postgresql",
        "db.operation.name": "observe_workload",
        "db.namespace": schema,
      },
    },
    async (span) => {
      const startedAt = performance.now();
      try {
        const proposals = new Map<string, Proposal>();
        let unplanned = 0;
        const candidates = window
          .filter((w) => EXPLAINABLE.test(w.query) && !w.query.includes(";"))
          .slice(0, MAX_FINGERPRINTS);
        for (const w of candidates) {
          let plan: PlanNode;
          try {
            const { rows } = await query(
              `EXPLAIN (GENERIC_PLAN, VERBOSE, FORMAT JSON) ${w.query}`,
              [],
            );
            const raw = Object.values(rows[0] ?? {})[0];
            plan = (typeof raw === "string" ? JSON.parse(raw) : raw)[0].Plan;
          } catch {
            unplanned++;
            continue;
          }
          for (const scan of seqScanFilters(plan, schema)) {
            const key = `${scan.table}\0${[...scan.columns].sort()}`;
            if (proposals.has(key)) continue;
            const { rows } = await query(TABLE_CHECK_SQL, [
              schema,
              scan.table,
              JSON.stringify(scan.columns),
            ]);
            const t = rows[0];
            if (!t || Number(t["covered"]) === 1) continue;
            if (Number(t["known_columns"]) !== scan.columns.length) continue;
            const rowEstimate = Number(t["row_estimate"]);
            if (rowEstimate <= 0 || scan.planRows / rowEstimate > MAX_SELECTIVITY) continue;
            proposals.set(
              key,
              createIndexProposal({
                tier: 1,
                schema,
                table: scan.table,
                columns: scan.columns,
                reason: `A query that ran ${w.calls} times (mean ${w.meanMs.toFixed(2)} ms, p95 ≈ ${w.p95EstimateMs.toFixed(2)} ms est.) scans all of ${scan.table} to filter on ${scan.columns.join(", ")}; an index on them serves it directly.`,
                evidence: {
                  rowEstimate,
                  tableBytes: Number(t["table_bytes"]),
                  workload: {
                    fingerprint: w.fingerprint,
                    calls: w.calls,
                    meanMs: w.meanMs,
                    p95EstimateMs: w.p95EstimateMs,
                  },
                },
              }),
            );
          }
        }
        span.setAttribute("nlqdb.dba.proposals", proposals.size);
        span.setAttribute("nlqdb.dba.unplanned", unplanned);
        return [...proposals.values()];
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        dbDurationMs().record(performance.now() - startedAt, { operation: "observe_workload" });
        span.end();
      }
    },
  );
}
