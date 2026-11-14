// Tier 1 (workload) observer for an attached Cloudflare D1 — the D1 twin of
// `observePostgresWorkload` (`GLOBAL-043` item 7, `002-rateme12-attach.md`
// §2): the app's own heavy query texts from `readD1QueryInsights`, turned into
// `create_index` proposals. Needs D1 Read for the plan and catalog.
//
// A query text yields a proposal when it is one table filtered by an AND of
// plain equalities and not aggregated, it keeps at most 5 % of the rows it reads (D1's
// `queryEfficiency`, writes for an UPDATE / DELETE), `EXPLAIN QUERY PLAN`
// scans that table, and no full index already leads with those columns.
// D1 strips bound parameters to `?` and binds none into an `EXPLAIN`, so the
// plan reads them as `NULL` — an equality on `NULL` plans like any other.
// A scan under a `LIMIT` can stop early, so the evidence is the per-run rows read, not the table's size.

import { type D1BatchFn, type D1QueryInsight, D1RestError, d1Literal } from "./d1/rest.ts";
import { covers, isInternal } from "./dba-observe-d1.ts";
import { createD1IndexProposal, type Proposal } from "./dba-proposal.ts";
import { withObserveSpan } from "./dba-span.ts";
import type { Row } from "./types.ts";

// Bounds the plans per observe to the heaviest texts — where an index pays back most.
const MAX_QUERIES = 20;
// A filter keeping more than this share of the rows it reads is better served by the scan.
const MAX_EFFICIENCY = 0.05;

const IDENT = String.raw`(?:[A-Za-z_][\w$]*|"(?:[^"]|"")+"|\`(?:[^\`]|\`\`)+\`|\[[^\]]+\])`;
const VALUE = String.raw`(?:\?\d*|NULL|-?\d+(?:\.\d+)?|'(?:[^']|'')*')`;
const TAIL = String.raw`(?:\s+(?:ORDER\s+BY|LIMIT|RETURNING)\b[\s\S]*)?\s*;?\s*$`;
const SHAPES = [
  new RegExp(
    String.raw`^\s*SELECT\s[\s\S]+?\sFROM\s+(${IDENT})(?:\s+(?:AS\s+)?(${IDENT}))?\s+WHERE\s+([\s\S]+?)${TAIL}`,
    "i",
  ),
  new RegExp(String.raw`^\s*DELETE\s+FROM\s+(${IDENT})()\s+WHERE\s+([\s\S]+?)${TAIL}`, "i"),
  new RegExp(
    String.raw`^\s*UPDATE\s+(?:OR\s+\w+\s+)?(${IDENT})()\s+SET\s[\s\S]+?\sWHERE\s+([\s\S]+?)${TAIL}`,
    "i",
  ),
];
const TERM = new RegExp(String.raw`^\(?\s*(?:(${IDENT})\.)?(${IDENT})\s*=\s*${VALUE}\s*\)?$`, "i");
// A join, a subquery or a compound has more than one table: out of scope.
const MULTI_TABLE = /\bJOIN\b|\(\s*SELECT\b|\b(UNION|INTERSECT|EXCEPT)\b|\bFROM\b[\s\S]*\bFROM\b/i;
// An aggregate returns fewer rows than its filter keeps, so D1's efficiency can't vouch for it.
const AGGREGATE =
  /\b(?:count|sum|avg|total|min|max|group_concat)\s*\(|\bGROUP\s+BY\b|\bDISTINCT\b/i;
const KEYWORDS = /^(WHERE|ORDER|LIMIT|SET)$/i;

function unquote(ident: string): string {
  const q = ident[0];
  if (q === '"' || q === "`") return ident.slice(1, -1).replaceAll(q + q, q);
  return q === "[" ? ident.slice(1, -1) : ident;
}

type Filter = { table: string; alias: string; columns: string[] };

// The query's one table, its alias and the equality columns, or null when the
// text isn't that shape (any other term — a range, an OR, an IN — would
// credit the equality columns with selectivity they don't have alone).
function equalityFilter(query: string): Filter | null {
  // D1 runs every statement in a request's `sql`, so only one may reach the
  // plan: any `;` but a trailing one (even in a literal) rejects the text.
  if (query.replace(/;\s*$/, "").includes(";")) return null;
  const literalFree = query.replace(/'(?:[^']|'')*'/g, "''");
  if (MULTI_TABLE.test(literalFree) || AGGREGATE.test(literalFree)) return null;
  if (/^\s*UPDATE\b[\s\S]*\bFROM\b/i.test(literalFree)) return null;
  for (const shape of SHAPES) {
    const m = shape.exec(query);
    if (!m) continue;
    const table = unquote(m[1] as string);
    const alias = m[2] && !KEYWORDS.test(m[2]) ? unquote(m[2]) : table;
    const columns: string[] = [];
    for (const term of (m[3] as string).split(/\s+AND\s+/i)) {
      const t = TERM.exec(term.trim());
      if (!t) return null;
      if (t[1] && unquote(t[1]) !== alias && unquote(t[1]) !== table) return null;
      columns.push(unquote(t[2] as string));
    }
    return { table, alias, columns: [...new Set(columns)] };
  }
  return null;
}

// `?` / `?NNN` outside string literals → `NULL`.
const unbound = (query: string): string =>
  query
    .split(/('(?:[^']|'')*')/)
    .map((part, i) => (i % 2 ? part : part.replace(/\?\d*/g, "NULL")))
    .join("");

// The texts Tier 1 would plan, heaviest rows read first: one app table under
// an equality filter that keeps at most 5 % of the rows it reads. Needs no
// request, so it reads a workload before the plan's D1 Read is granted.
export function d1WorkloadCandidates(
  insights: D1QueryInsight[],
): { insight: D1QueryInsight; filter: Filter }[] {
  return [...insights]
    .sort((a, b) => b.totalRowsRead - a.totalRowsRead)
    .flatMap((insight) => {
      const kept = /^\s*SELECT\b/i.test(insight.query) ? insight.rowsReturned : insight.rowsWritten;
      if (insight.rowsRead <= 0 || kept / insight.rowsRead > MAX_EFFICIENCY) return [];
      const filter = equalityFilter(insight.query);
      return filter && !isInternal(filter.table) ? [{ insight, filter }] : [];
    });
}

// Turn the window's heavy query texts into Tier 1 proposals, heaviest rows
// read first; one per (table, column set). A text that doesn't plan (a dropped
// table or column) is skipped and counted on the span; a request failure that
// isn't the plan's throws (`GLOBAL-012`).
export function observeD1Workload(
  batch: D1BatchFn,
  insights: D1QueryInsight[],
): Promise<Proposal[]> {
  return withObserveSpan(
    "observe_workload",
    "main",
    async (span) => {
      const candidates = d1WorkloadCandidates(insights).slice(0, MAX_QUERIES);
      if (candidates.length === 0) return [];

      // One request for every plan; a failing one (D1 runs a request as one
      // transaction) sends each plan alone so the rest still count.
      const plans = candidates.map((c) => `EXPLAIN QUERY PLAN ${unbound(c.insight.query)}`);
      let planned: (Row[] | null)[];
      try {
        planned = await batch(plans);
      } catch (err) {
        if (!isSqlError(err)) throw err;
        planned = [];
        for (const plan of plans) {
          planned.push(
            await batch([plan]).then(
              ([rows]) => rows ?? [],
              (e) => {
                if (!isSqlError(e)) throw e;
                return null;
              },
            ),
          );
        }
      }
      span.setAttribute("nlqdb.dba.unplanned", planned.filter((p) => p === null).length);
      const scanning = candidates.filter(({ filter }, i) =>
        (planned[i] ?? []).some((r) =>
          new RegExp(`^SCAN (?:TABLE )?${regexLiteral(filter.alias)}$`, "i").test(
            String(r["detail"]),
          ),
        ),
      );
      if (scanning.length === 0) return [];

      // The catalog of each scanned table: its columns, full indexes and own spelling.
      const tables = [...new Set(scanning.map((c) => c.filter.table))];
      const catalog = await batch(
        tables.flatMap((t) => [
          `PRAGMA table_info(${d1Literal(t)})`,
          `PRAGMA index_list(${d1Literal(t)})`,
          `PRAGMA table_list(${d1Literal(t)})`,
        ]),
      );
      const indexNames = [
        ...new Set(
          tables.flatMap((_, i) =>
            (catalog[i * 3 + 1] ?? [])
              .filter((ix) => Number(ix["partial"]) === 0)
              .map((ix) => String(ix["name"])),
          ),
        ),
      ];
      const indexInfo = await batch(indexNames.map((n) => `PRAGMA index_info(${d1Literal(n)})`));
      const keyColumns = new Map(
        indexNames.map((n, i) => [
          n,
          [...(indexInfo[i] ?? [])]
            .sort((a, b) => Number(a["seqno"]) - Number(b["seqno"]))
            .map((r) => (r["name"] === null ? null : String(r["name"]))),
        ]),
      );

      const proposals = new Map<string, Proposal>();
      for (const { insight, filter } of scanning) {
        const i = tables.indexOf(filter.table);
        // SQLite names are case-insensitive: compare and propose in the catalog's
        // spelling, so the DDL matches Tier 0's for the same index.
        const table = (catalog[i * 3 + 2] ?? []).find(
          (t) => t["schema"] === "main" && t["type"] === "table",
        )?.["name"];
        if (typeof table !== "string" || isInternal(table)) continue;
        const known = new Map(
          (catalog[i * 3] ?? []).map((c) => [String(c["name"]).toLowerCase(), String(c["name"])]),
        );
        const columns = [...new Set(filter.columns.map((c) => known.get(c.toLowerCase())))];
        if (!columns.every((c): c is string => c !== undefined)) continue;
        const key = `${table}\0${[...columns].sort()}`;
        if (proposals.has(key)) continue;
        const indexes = (catalog[i * 3 + 1] ?? [])
          .filter((ix) => Number(ix["partial"]) === 0)
          .map((ix) => String(ix["name"]));
        if (indexes.some((n) => covers(keyColumns.get(n) ?? [], columns))) continue;
        const rowsRead = Math.round(insight.rowsRead);
        proposals.set(
          key,
          createD1IndexProposal({
            tier: 1,
            table,
            columns,
            reason: `A query that ran ${insight.calls} times (mean ${insight.meanMs.toFixed(2)} ms) reads ${rowsRead} rows of ${table} each run to filter on ${columns.join(", ")}; an index on them serves it directly.`,
            evidence: {
              rowEstimate: rowsRead,
              tableBytes: 0,
              d1Workload: {
                query: insight.query,
                calls: insight.calls,
                meanMs: insight.meanMs,
                rowsRead: insight.rowsRead,
                rowsReturned: insight.rowsReturned,
              },
            },
          }),
        );
      }
      return [...proposals.values()];
    },
    "sqlite",
  );
}

// D1 answers a statement it can't prepare with a 400; anything else
// (auth, network, a 5xx) is the request's, not the plan's.
const isSqlError = (err: unknown) => err instanceof D1RestError && err.status === 400;

const regexLiteral = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
