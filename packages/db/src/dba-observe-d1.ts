// Tier 0 (catalog) observer for an attached Cloudflare D1 — the D1 twin of
// `observePostgresCatalog` (`GLOBAL-043` items 2 and 7, `002-rateme12-attach.md`
// §2): the same rule, the same `create_index` proposal, SQLite DDL. It needs
// only D1 Read.
//
// Rule: a foreign key with no index whose leading key columns are exactly its
// columns (any order) — joins on it and every `DELETE` on the parent scan the
// child. A child's `INTEGER PRIMARY KEY` is its rowid, so an FK on it is
// covered without an index. Partial indexes don't count.
//
// D1's authorizer refuses table-valued pragmas joined to a table
// (`pragma_foreign_key_list(t.name)` → SQLITE_AUTH) and binds no parameter
// into a `PRAGMA`, so the catalog is read per table — in three batched
// requests whatever the table count, never one request per table.
//
// D1 keeps no table size in its catalog. Row counts come from `sqlite_stat1`
// when an `ANALYZE` / `PRAGMA optimize` has written it, else 0; the observer
// never counts rows itself (a `COUNT(*)` is billed per row read).

import { type D1BatchFn, d1Literal } from "./d1/rest.ts";
import { withObserveSpan } from "./dba-observe-postgres.ts";
import { createD1IndexProposal, type Proposal } from "./dba-proposal.ts";
import type { Row } from "./types.ts";

// SQLite's own tables and D1's internal ones (`_cf_KV`, `_cf_METADATA`).
const isInternal = (name: string) => name.startsWith("sqlite_") || name.startsWith("_cf_");

export function observeD1Catalog(batch: D1BatchFn): Promise<Proposal[]> {
  return withObserveSpan(
    "observe_catalog",
    "main",
    async () => {
      const [tableList = []] = await batch(["PRAGMA table_list"]);
      const tables = tableList.filter(
        (t) => t["schema"] === "main" && t["type"] === "table" && !isInternal(String(t["name"])),
      );
      if (tables.length === 0) return [];
      const hasStats = tableList.some(
        (t) => t["schema"] === "main" && t["name"] === "sqlite_stat1",
      );

      const perTable = await batch([
        ...tables.flatMap((t) => {
          const name = d1Literal(String(t["name"]));
          return [
            `PRAGMA foreign_key_list(${name})`,
            `PRAGMA index_list(${name})`,
            `PRAGMA table_info(${name})`,
          ];
        }),
        ...(hasStats ? ["SELECT tbl, stat FROM sqlite_stat1"] : []),
      ]);
      const rowCounts = new Map<string, number>();
      for (const s of hasStats ? (perTable.at(-1) ?? []) : []) {
        const rows = Number.parseInt(String(s["stat"]), 10) || 0;
        rowCounts.set(String(s["tbl"]), Math.max(rowCounts.get(String(s["tbl"])) ?? 0, rows));
      }

      const candidates = tables.flatMap((t, i) => {
        const table = String(t["name"]);
        const fks = groupForeignKeys(perTable[i * 3] ?? []);
        const rowid = rowidAlias(t, perTable[i * 3 + 2] ?? []);
        const indexes = (perTable[i * 3 + 1] ?? [])
          .filter((ix) => Number(ix["partial"]) === 0)
          .map((ix) => String(ix["name"]));
        return fks
          .filter((fk) => !(fk.columns.length === 1 && fk.columns[0] === rowid))
          .map((fk) => ({ table, fk, indexes }));
      });
      if (candidates.length === 0) return [];

      // Key columns of every full index on a table with an FK candidate.
      const indexNames = [...new Set(candidates.flatMap((c) => c.indexes))];
      const indexInfo = await batch(indexNames.map((n) => `PRAGMA index_info(${d1Literal(n)})`));
      const keyColumns = new Map(
        indexNames.map((n, i) => [
          n,
          [...(indexInfo[i] ?? [])]
            .sort((a, b) => Number(a["seqno"]) - Number(b["seqno"]))
            .map((r) => (r["name"] === null ? null : String(r["name"]))),
        ]),
      );

      const all = candidates
        .filter(
          ({ fk, indexes }) => !indexes.some((n) => covers(keyColumns.get(n) ?? [], fk.columns)),
        )
        .map(({ table, fk }) =>
          createD1IndexProposal({
            tier: 0,
            table,
            columns: fk.columns,
            reason: `Foreign key ${table}(${fk.columns.join(", ")}) → ${fk.refTable} has no index: joins on it and deletes on ${fk.refTable} scan all of ${table}.`,
            evidence: { rowEstimate: rowCounts.get(table) ?? 0, tableBytes: 0 },
          }),
        );
      // FKs on the same column set (in any order) need one index, not two.
      const proposals = [
        ...new Map(all.map((p) => [`${p.table}\0${[...p.columns].sort()}`, p])).values(),
      ];
      proposals.sort(
        (a, b) =>
          b.evidence.rowEstimate - a.evidence.rowEstimate ||
          a.table.localeCompare(b.table) ||
          a.columns.join().localeCompare(b.columns.join()),
      );
      return proposals;
    },
    "sqlite",
  );
}

// `PRAGMA foreign_key_list` returns one row per (constraint id, column), `seq`
// in key order.
function groupForeignKeys(rows: Row[]): { refTable: string; columns: string[] }[] {
  const byId = new Map<number, { refTable: string; cols: [number, string][] }>();
  for (const r of rows) {
    const id = Number(r["id"]);
    const fk = byId.get(id) ?? { refTable: String(r["table"]), cols: [] };
    fk.cols.push([Number(r["seq"]), String(r["from"])]);
    byId.set(id, fk);
  }
  return [...byId.values()].map(({ refTable, cols }) => ({
    refTable,
    columns: cols.sort((a, b) => a[0] - b[0]).map(([, c]) => c),
  }));
}

// The column that is the table's rowid, if any: a sole `INTEGER PRIMARY KEY`
// on a rowid table (`table_list.wr` = 0).
function rowidAlias(table: Row, columns: Row[]): string | undefined {
  if (Number(table["wr"]) !== 0) return undefined;
  const pk = columns.filter((c) => Number(c["pk"]) > 0);
  const only = pk.length === 1 ? pk[0] : undefined;
  return only && String(only["type"]).toUpperCase() === "INTEGER"
    ? String(only["name"])
    : undefined;
}

// An index serves the FK lookup when its first n key columns are the n FK
// columns in any order. An expression key column (`name` null) never matches.
function covers(keys: (string | null)[], fkColumns: string[]): boolean {
  if (keys.length < fkColumns.length) return false;
  const lead = new Set(keys.slice(0, fkColumns.length));
  return fkColumns.every((c) => lead.has(c));
}
