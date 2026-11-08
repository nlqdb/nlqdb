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
// attached schema with a selective AND of equality (or `= ANY`) filters, plus
// at most one range-filtered column, and no valid btree / hash index already
// leads with those columns (the range column last). Only
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

// One `(alias.column op value)` range term: `<`, `>`, `<=`, `>=` against a
// parameter, a constant, or the clock (`now() - '7 days'::interval`), which the
// planner folds to a value when it estimates. `BETWEEN` plans as two of them on
// one column. A btree on (equality columns…, range column) serves the AND of
// them as one index range, so `Plan Rows` is the share that index reads — on
// parameter bounds, the planner's default guess (1/3 one-sided, 0.5 % two-sided).
const CLOCK = String.raw`(?:now\(\)|CURRENT_DATE|CURRENT_TIMESTAMP|LOCALTIMESTAMP)`;
const RANGE_TERM = new RegExp(
  String.raw`\((?:${IDENT}\.(${IDENT})|\(${IDENT}\.(${IDENT})\)::text) (?:<|>|<=|>=) (?:${SCALAR}|${CLOCK}|\(${CLOCK} [-+] ${SCALAR}\))\)`,
  "g",
);

type SeqScanFilter = {
  table: string;
  // The index's key columns: the equality columns, then the range column.
  columns: string[];
  // The column a range term filters, last in `columns`; null with none.
  rangeColumn: string | null;
  // The columns the filter compares as `(column)::text`.
  textCast: string[];
  planRows: number;
};

type ReadFilter = Omit<SeqScanFilter, "table" | "planRows">;

// The filter as one index range, or null: only an AND of equalities (`= ANY`
// included) and range terms on one column. With any other term (an OR,
// `<> ALL`, a pattern, a second range column) `Plan Rows` would credit the
// index columns with selectivity they don't have alone.
function readFilter(filter: string): ReadFilter | null {
  const rest = filter
    .replace(EQUALITY_TERM, "")
    .replace(RANGE_TERM, "")
    .replace(/\bAND\b|[()\s]/g, "");
  if (rest !== "") return null;
  const column = (m: RegExpMatchArray) => unquote((m[1] ?? m[2]) as string);
  const equalities = [...filter.matchAll(EQUALITY_TERM)];
  const ranges = [...filter.matchAll(RANGE_TERM)];
  const rangeColumns = [...new Set(ranges.map(column))];
  if (rangeColumns.length > 1) return null;
  const eqColumns = [...new Set(equalities.map(column))];
  const rangeColumn = rangeColumns.find((c) => !eqColumns.includes(c)) ?? null;
  const columns = rangeColumn ? [...eqColumns, rangeColumn] : eqColumns;
  if (columns.length === 0) return null;
  const textCast = [...equalities, ...ranges]
    .filter((m) => m[2])
    .map((m) => unquote(m[2] as string));
  return { columns, rangeColumn, textCast: [...new Set(textCast)] };
}

// The plan's seq scans on `schema` whose filter Tier 1 reads (`readFilter`).
function seqScanFilters(node: PlanNode, schema: string, out: SeqScanFilter[] = [], workers = 0) {
  const filter = node.Filter;
  const planWorkers = node["Workers Planned"] ?? workers;
  if (
    node["Node Type"] === "Seq Scan" &&
    node.Schema === schema &&
    node["Relation Name"] &&
    filter
  ) {
    const read = readFilter(filter);
    // A parallel scan's `Plan Rows` is per process: scale it back by Postgres'
    // own divisor (costsize.c `get_parallel_divisor`, leader participating).
    const divisor = node["Parallel Aware"] ? planWorkers + Math.max(0, 1 - 0.3 * planWorkers) : 1;
    if (read) {
      out.push({
        table: node["Relation Name"],
        ...read,
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
// columns (in any order) — the same coverage rule as Tier 0's FK check — with
// the range column ($5, if any) the nth of a btree: an index leading with the
// range column reads every row in the range, and a hash index serves no range.
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
           AND ($5::text IS NULL OR am.amname = 'btree' AND $5::text = (
                 SELECT a.attname::text FROM pg_catalog.pg_attribute a
                  WHERE a.attrelid = c.oid
                    AND a.attnum = (i.indkey::int2[])[(SELECT count(*) FROM cols)::int - 1]))
       ) THEN 1 ELSE 0 END AS covered,
       c.relispartition AS is_partition
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind = 'r'`;

// Where each planned fingerprint dropped out, counted per observe and set on
// the span; the spike's CI log prints it (counts only, never a query).
export type Tier1Funnel = {
  // Candidates before the per-observe cap; those past it wait for a later observe.
  candidates: number;
  planned: number;
  unplanned: number;
  // The SQLSTATE each unplanned fingerprint failed with.
  unplannedCodes: string[];
  // Seq scan nodes on the attached schema that filter rows, and those whose
  // filter Tier 1 reads: an AND of equalities, with at most one range column
  // (`rangeScans` of them have one).
  filteredScans: number;
  readScans: number;
  rangeScans: number;
  // The shape of each filtered scan Tier 1 doesn't read:
  // `or`, `range`, `pattern` (LIKE / regex) or `other`.
  unreadShapes: string[];
  // Not a plain table of the schema (a materialized view, or dropped since
  // the plan).
  notTable: number;
  covered: number;
  unknownColumns: number;
  unanalyzed: number;
  unselective: number;
  // Each unselective scan's estimated share of its table's rows, in whole %,
  // and that table's row estimate (a one-sided range on a parameter always
  // reads as the planner's default third; its table's size says if it matters).
  unselectivePct: number[];
  unselectiveRows: number[];
  // A selective, unindexed lookup on one partition: the index belongs on the
  // partitioned parent (built per partition, then attached), a multi-statement
  // apply the loop doesn't run yet.
  partitions: number;
};

export const newTier1Funnel = (): Tier1Funnel => ({
  candidates: 0,
  planned: 0,
  unplanned: 0,
  unplannedCodes: [],
  filteredScans: 0,
  readScans: 0,
  rangeScans: 0,
  unreadShapes: [],
  notTable: 0,
  covered: 0,
  unknownColumns: 0,
  unanalyzed: 0,
  unselective: 0,
  unselectivePct: [],
  unselectiveRows: [],
  partitions: 0,
});

// A plan over hundreds of partitions repeats one reason per partition: the
// per-scan lists stop at this many so the span stays small; the counts stay exact.
const MAX_REASONS = 50;
const noteReason = <T>(list: T[], reason: T) => {
  if (list.length < MAX_REASONS) list.push(reason);
};

// The shape a filter Tier 1 doesn't read yet takes — counts the next shape to
// read, never prints the filter. `range` here is one Tier 1 can't serve with
// one index: two range columns, or a bound it can't read as a value.
function filterShape(filter: string): string {
  if (/\bOR\b/.test(filter)) return "or";
  if (/ (?:<|>|<=|>=) /.test(filter)) return "range";
  if (/ (?:~~\*?|!~~\*?|~\*?|!~\*?) /.test(filter)) return "pattern";
  return "other";
}

function countFilteredScans(node: PlanNode, schema: string, funnel: Tier1Funnel): void {
  const filter = node["Node Type"] === "Seq Scan" && node.Schema === schema && node.Filter;
  if (filter) {
    funnel.filteredScans++;
    if (!readFilter(filter)) noteReason(funnel.unreadShapes, filterShape(filter));
  }
  for (const child of node.Plans ?? []) countFilteredScans(child, schema, funnel);
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
        noteReason(funnel.unplannedCodes, String((err as { code?: unknown }).code ?? "unknown"));
        continue;
      }
      funnel.planned++;
      countFilteredScans(plan, schema, funnel);
      for (const scan of seqScanFilters(plan, schema)) {
        funnel.readScans++;
        if (scan.rangeColumn) funnel.rangeScans++;
        // The equality columns in any order, the range column last.
        const equalities = scan.columns.filter((c) => c !== scan.rangeColumn).sort();
        const key = `${scan.table}\0${equalities}\0${scan.rangeColumn ?? ""}`;
        if (proposals.has(key)) continue;
        const { rows } = await query(TABLE_CHECK_SQL, [
          schema,
          scan.table,
          JSON.stringify(scan.columns),
          JSON.stringify(scan.textCast),
          scan.rangeColumn,
        ]);
        const t = rows[0];
        if (!t) {
          funnel.notTable++;
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
          noteReason(funnel.unselectivePct, Math.round((100 * scan.planRows) / rowEstimate));
          noteReason(funnel.unselectiveRows, Math.round(rowEstimate));
          continue;
        }
        if (t["is_partition"] === true) {
          funnel.partitions++;
          continue;
        }
        proposals.set(
          key,
          createIndexProposal({
            tier: 1,
            schema,
            table: scan.table,
            columns: scan.columns,
            reason: `A query that ran ${w.calls} times (mean ${w.meanMs.toFixed(2)} ms, p95 ≈ ${w.p95EstimateMs.toFixed(2)} ms est.) scans all of ${scan.table} to filter on ${scan.columns.join(", ")}${scan.rangeColumn ? ` (a range on ${scan.rangeColumn})` : ""}; an index on them serves it directly.`,
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
