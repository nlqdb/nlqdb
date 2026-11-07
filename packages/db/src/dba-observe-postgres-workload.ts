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
// attached schema with a selective AND of equality (or `= ANY`) filters, and
// no valid btree / hash index already leads with those columns. Only
// fingerprints naming a relation of the attached schema are planned: on a
// managed host the heaviest statements are often the host's own (auth,
// storage, realtime, its dashboard), and they would spend the per-observe
// EXPLAIN budget on tables nlqdb never proposes for.

import { createIndexProposal, type Proposal } from "./dba-proposal.ts";
import { withDbaSpan, withObserveSpan } from "./dba-span.ts";
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

// One read of every fingerprint's counters — an observe window's ends, and a
// verify window's — under the loop's span (`GLOBAL-014`).
export function snapshotPostgresStatements(
  query: PostgresQueryFn,
  schema: string,
): Promise<StatementSnapshot> {
  return withDbaSpan("db.observe", "snapshot_statements", schema, async () => {
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
  });
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
// fingerprints — where an index pays back the most. Sized to plan a whole
// app's explainable fingerprints (the spike's: 32) in one observe.
const MAX_FINGERPRINTS = 50;
// An equality filter keeping more than this share of a table's rows is better
// served by the scan than by an index.
const MAX_SELECTIVITY = 0.05;

// Only single statements that can carry a WHERE; EXPLAIN without ANALYZE plans
// a write without running it.
const EXPLAINABLE = /^\s*(SELECT|UPDATE|DELETE|WITH)\b/i;

const IDENT = String.raw`(?:[A-Za-z_][\w$]*|"(?:[^"]|"")+")`;
const IDENTS = new RegExp(IDENT, "g");
const unquote = (ident: string): string =>
  ident.startsWith('"') ? ident.slice(1, -1).replaceAll('""', '"') : ident;

// The relations of `schema` a fingerprint can scan: tables, partitioned
// tables, views and materialized views (a view's plan scans its base tables).
const RELATIONS_SQL = `
SELECT c.relname FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm')`;

// The window's fingerprints Tier 1 plans, heaviest first: explainable single
// statements that name a relation of `schema` (an unquoted identifier folded
// to lower case, as Postgres does). A name shared with another schema's table
// costs one EXPLAIN; the plan's schema check then drops it.
async function tier1Candidates(
  query: PostgresQueryFn,
  schema: string,
  window: FingerprintWindow[],
): Promise<FingerprintWindow[]> {
  const { rows } = await query(RELATIONS_SQL, [schema]);
  const relations = new Set(rows.map((r) => String(r["relname"])));
  const namesRelation = (sql: string) =>
    [...sql.matchAll(IDENTS)].some(([id]) =>
      relations.has(id.startsWith('"') ? unquote(id) : id.toLowerCase()),
    );
  return window.filter(
    (w) => EXPLAINABLE.test(w.query) && !w.query.includes(";") && namesRelation(w.query),
  );
}

const SCALAR = String.raw`(?:\$\d+|\(\$\d+\)::[^()]+?|'(?:[^']|'')*'(?:::[\w ]+)?|-?\d+(?:\.\d+)?)`;
// `= ANY (array)`: an `IN` list or PostgREST's `in` filter, planned as
// `ANY ($1)`, `ANY (ARRAY[$1, $2])`, `ANY ((ARRAY[$1, $2])::text[])` or a
// constant `ANY ('{…}'::type[])`. A btree on the column serves it like an
// equality, and the generic plan's `Plan Rows` already assumes its length.
// The elements are parameters or constants only: a column or a function call
// in the list (`ARRAY[u.b]`) is not a lookup an index on the column serves.
const ELEMENT = String.raw`(?:\$\d+|\(\$\d+\)::[^()\],]+|'(?:[^']|'')*'(?:::[\w ]+)?|-?\d+(?:\.\d+)?)`;
const ELEMENTS = String.raw`ARRAY\[${ELEMENT}(?:, ${ELEMENT})*\]`;
const ARRAY = String.raw`ANY \((?:\$\d+|${ELEMENTS}|\(${ELEMENTS}\)::[\w ]+\[\]|'(?:[^']|'')*'::[\w ]+\[\])\)`;
// One `(alias.column = value)` term of a VERBOSE plan's Filter. A varchar
// column (Rails' and Django's string) plans relabelled as
// `((alias.column)::text = value)`, which a plain index on it still serves;
// the table check confirms that column really is varchar.
const EQUALITY_TERM = new RegExp(
  String.raw`\((?:${IDENT}\.(${IDENT})|\(${IDENT}\.(${IDENT})\)::text) = (?:${ARRAY}|${SCALAR})\)`,
  "g",
);

type PlanNode = {
  "Node Type"?: string;
  "Relation Name"?: string;
  Schema?: string;
  "Plan Rows"?: number;
  "Parallel Aware"?: boolean;
  "Workers Planned"?: number;
  Filter?: string;
  Plans?: PlanNode[];
};

type SeqScanFilter = {
  table: string;
  columns: string[];
  // The columns the filter compares as `(column)::text`.
  textCast: string[];
  planRows: number;
};

// The plan's seq scans on `schema` whose filter is only an AND of plain
// equalities (`= ANY` included): with any other term (a range, an OR, `<> ALL`)
// `Plan Rows` would credit the equality columns with selectivity they don't
// have alone.
function seqScanFilters(node: PlanNode, schema: string, out: SeqScanFilter[] = [], workers = 0) {
  const filter = node.Filter;
  const planWorkers = node["Workers Planned"] ?? workers;
  if (
    node["Node Type"] === "Seq Scan" &&
    node.Schema === schema &&
    node["Relation Name"] &&
    filter &&
    filter.replace(EQUALITY_TERM, "").replace(/\bAND\b|[()\s]/g, "") === ""
  ) {
    const terms = [...filter.matchAll(EQUALITY_TERM)];
    const columns = [...new Set(terms.map((m) => unquote((m[1] ?? m[2]) as string)))];
    // A parallel scan's `Plan Rows` is per process: scale it back by Postgres'
    // own divisor (costsize.c `get_parallel_divisor`, leader participating).
    const divisor = node["Parallel Aware"] ? planWorkers + Math.max(0, 1 - 0.3 * planWorkers) : 1;
    if (columns.length > 0) {
      out.push({
        table: node["Relation Name"],
        columns,
        textCast: terms.filter((m) => m[2]).map((m) => unquote(m[2] as string)),
        planRows: (node["Plan Rows"] ?? 0) * divisor,
      });
    }
  }
  for (const child of node.Plans ?? []) seqScanFilters(child, schema, out, planWorkers);
  return out;
}

// The table's size, whether every column exists (a `::text`-compared one as
// varchar), and whether a valid,
// non-partial btree / hash index's first n key columns are exactly the n
// columns (in any order) — the same coverage rule as Tier 0's FK check.
const TABLE_CHECK_SQL = `
WITH cols AS (SELECT json_array_elements_text($3::text::json) AS name)
SELECT GREATEST(c.reltuples, 0)::float8 AS row_estimate,
       pg_catalog.pg_total_relation_size(c.oid)::float8 AS table_bytes,
       (SELECT count(*) FROM pg_catalog.pg_attribute a
         WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
           AND a.attname IN (SELECT name FROM cols)
           AND (a.attname NOT IN (SELECT json_array_elements_text($4::text::json))
                OR a.atttypid = 'pg_catalog.varchar'::pg_catalog.regtype))::int AS known_columns,
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
       ) THEN 1 ELSE 0 END AS covered,
       c.relkind = 'm' AS is_matview,
       c.relispartition AS is_partition,
       CASE WHEN c.relispartition THEN pg_catalog.pg_partition_root(c.oid)::oid::int8 END AS root_oid,
       CASE WHEN c.relispartition THEN (SELECT count(*) FROM pg_catalog.pg_inherits h WHERE h.inhparent = pg_catalog.pg_partition_root(c.oid))::int END AS siblings,
       CASE WHEN c.relispartition THEN (SELECT pg_catalog.pg_get_partkeydef(pg_catalog.pg_partition_root(c.oid))) END AS partkey
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1 AND c.relname = $2 AND (c.relkind = 'r' OR c.relkind = 'm')`;

// Where each planned fingerprint dropped out, counted per observe and set on
// the span; the spike's CI log prints it (counts only, never a query).
export type Tier1Funnel = {
  // Candidates before the per-observe cap; those past it wait for a later observe.
  candidates: number;
  planned: number;
  unplanned: number;
  // Seq scan nodes on the attached schema that filter rows, and those whose
  // filter is an AND of equalities (the only shape Tier 1 proposes for).
  filteredScans: number;
  equalityScans: number;
  // Not a plain table of the schema: a partition, a materialized view, or
  // gone since the plan.
  partitions: number;
  matviews: number;
  notTable: number;
  covered: number;
  unknownColumns: number;
  unanalyzed: number;
  unselective: number;
  // Each unselective scan's estimated share of its table's rows, in whole %.
  unselectivePct: number[];
};

export const newTier1Funnel = (): Tier1Funnel => ({
  candidates: 0,
  planned: 0,
  unplanned: 0,
  filteredScans: 0,
  equalityScans: 0,
  partitions: 0,
  matviews: 0,
  notTable: 0,
  covered: 0,
  unknownColumns: 0,
  unanalyzed: 0,
  unselective: 0,
  unselectivePct: [],
});

function countFilteredScans(node: PlanNode, schema: string): number {
  const here = node["Node Type"] === "Seq Scan" && node.Schema === schema && node.Filter ? 1 : 0;
  return (node.Plans ?? []).reduce((n, child) => n + countFilteredScans(child, schema), here);
}

// Turn the window's hot fingerprints into Tier 1 proposals, heaviest first;
// one proposal per (table, column set). A fingerprint that doesn't plan under
// the observer's role (search_path, a dropped table, a missing privilege,
// Postgres < 16) is skipped and counted on the span, never guessed at; a
// failure the server didn't answer (a lost connection) or a catalog query
// failure throws (`GLOBAL-012`) rather than read as "nothing to change".
export function observePostgresWorkload(
  query: PostgresQueryFn,
  schema: string,
  window: FingerprintWindow[],
  funnel: Tier1Funnel = newTier1Funnel(),
): Promise<Proposal[]> {
  return withObserveSpan("observe_workload", schema, async (span) => {
    const proposals = new Map<string, Proposal>();
    const candidates = await tier1Candidates(query, schema, window);
    funnel.candidates = candidates.length;
    for (const w of candidates.slice(0, MAX_FINGERPRINTS)) {
      let plan: PlanNode;
      try {
        const { rows } = await query(`EXPLAIN (GENERIC_PLAN, VERBOSE, FORMAT JSON) ${w.query}`, []);
        const raw = Object.values(rows[0] ?? {})[0];
        plan = (typeof raw === "string" ? JSON.parse(raw) : raw)[0].Plan;
      } catch (err) {
        // postgres.js and Neon both set `severity` on an error the server sent.
        if (!(err as { severity?: unknown }).severity) throw err;
        funnel.unplanned++;
        continue;
      }
      funnel.planned++;
      funnel.filteredScans += countFilteredScans(plan, schema);
      for (const scan of seqScanFilters(plan, schema)) {
        funnel.equalityScans++;
        const key = `${scan.table}\0${[...scan.columns].sort()}`;
        if (proposals.has(key)) continue;
        const { rows } = await query(TABLE_CHECK_SQL, [
          schema,
          scan.table,
          JSON.stringify(scan.columns),
          JSON.stringify(scan.textCast),
        ]);
        const t = rows[0];
        if (!t) {
          funnel.notTable++;
          continue;
        }
        if (t["is_partition"] === true) {
          funnel.partitions++;
          // ONE-OFF PROBE (removed before merge)
          (funnel as unknown as { probe: unknown[] }).probe ??= [];
          (funnel as unknown as { probe: unknown[] }).probe.push({
            fp: candidates.indexOf(w),
            root: Number(t["root_oid"]) % 997,
            siblings: t["siblings"],
            byKey: String(t["partkey"]).split(" ")[0],
            keyHit: scan.columns.some((c) => String(t["partkey"]).includes(c)),
            nCols: scan.columns.length,
            rows: Math.round(Number(t["row_estimate"])),
            pct: Math.round((100 * scan.planRows) / Math.max(1, Number(t["row_estimate"]))),
          });
          continue;
        }
        if (t["is_matview"] === true) {
          funnel.matviews++;
          continue;
        }
        if (Number(t["covered"]) === 1) {
          funnel.covered++;
          continue;
        }
        if (Number(t["known_columns"]) !== scan.columns.length) {
          funnel.unknownColumns++;
          continue;
        }
        const rowEstimate = Number(t["row_estimate"]);
        if (rowEstimate <= 0) {
          funnel.unanalyzed++;
          continue;
        }
        if (scan.planRows / rowEstimate > MAX_SELECTIVITY) {
          funnel.unselective++;
          funnel.unselectivePct.push(Math.round((100 * scan.planRows) / rowEstimate));
          // ONE-OFF PROBE
          (funnel as unknown as { probeRows: unknown[] }).probeRows ??= [];
          (funnel as unknown as { probeRows: unknown[] }).probeRows.push([Math.round(rowEstimate), Math.round(scan.planRows)]);
          continue;
        }
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
    // snake_case like every other attribute; `nlqdb.dba.unplanned` matches D1's.
    for (const [k, v] of Object.entries(funnel))
      span.setAttribute(`nlqdb.dba.${k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`, v);
    return [...proposals.values()];
  });
}
