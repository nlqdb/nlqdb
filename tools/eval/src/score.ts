// Execution-accuracy scoring per SK-QUAL-001 — BIRD's canonical EX metric +
// the Spider 2.0-lite multi-CSV column-major comparator (SK-QUAL-008).

import type { GoldCell, GoldTable } from "./csv.ts";
import type { ScoreOutcome } from "./types.ts";

type SqliteDatabase = {
  query: (sql: string) => { all: () => unknown[] };
  close: () => void;
};

type SqliteCtor = new (filename: string, opts?: { readonly?: boolean }) => SqliteDatabase;

let cachedSqlite: SqliteCtor | undefined;

// Dynamic specifier so tsc (which doesn't know bun:* schemes) still resolves the module.
async function loadSqlite(): Promise<SqliteCtor> {
  if (cachedSqlite) return cachedSqlite;
  const mod = (await import(/* @vite-ignore */ "bun:sqlite")) as { Database: SqliteCtor };
  cachedSqlite = mod.Database;
  return cachedSqlite;
}

export type ScoreInput = {
  dbPath: string;
  goldSql: string;
  predictedSql: string;
  timeoutMs?: number;
};

export type ScoreResult = {
  outcome: ScoreOutcome;
  error?: string;
};

const DEFAULT_TIMEOUT_MS = 5000;
const ERROR_MSG_CAP = 240;

function trimError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const single = msg.replace(/\s+/g, " ").trim();
  return single.length > ERROR_MSG_CAP ? `${single.slice(0, ERROR_MSG_CAP - 1)}…` : single;
}

// Sorted-key JSON serialisation so multiset comparison is independent of SQLite's result column order; Uint8Array (blob rows) round-trips via base64.
function canonicalize(row: unknown): string {
  if (row === null || row === undefined) return "null";
  if (typeof row !== "object") return JSON.stringify(row);
  if (row instanceof Uint8Array) {
    return `b64:${Buffer.from(row).toString("base64")}`;
  }
  if (Array.isArray(row)) {
    return `[${row.map(canonicalize).join(",")}]`;
  }
  const obj = row as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`);
  return `{${pairs.join(",")}}`;
}

// Multiset equality matches BIRD's reference harness; sequence-strict when gold has ORDER BY.
function rowsMatch(a: unknown[], b: unknown[], ordered: boolean): boolean {
  if (a.length !== b.length) return false;
  const ac = a.map(canonicalize);
  const bc = b.map(canonicalize);
  if (ordered) {
    for (let i = 0; i < ac.length; i++) if (ac[i] !== bc[i]) return false;
    return true;
  }
  const tally = new Map<string, number>();
  for (const k of ac) tally.set(k, (tally.get(k) ?? 0) + 1);
  for (const k of bc) {
    const n = tally.get(k);
    if (!n) return false;
    if (n === 1) tally.delete(k);
    else tally.set(k, n - 1);
  }
  return tally.size === 0;
}

// BIRD gold SQL occasionally ships with a leading `-- difficulty: …` comment header.
function normalizeSql(sql: string): string {
  return sql
    .replace(/^\s*--.*$/gm, "")
    .replace(/;\s*$/, "")
    .trim();
}

function hasOrderBy(sql: string): boolean {
  return /\border\s+by\b/i.test(sql);
}

// SK-QUAL-008 — TS port of Spider 2.0's `compare_pandas_table` /
// `compare_multi_pandas_table` (evaluation_suite/evaluate_utils.py). Two
// invariants come from the canonical Python and must not drift:
//   1. Numeric tolerance is `abs_tol = 1e-2` (matches `math.isclose`).
//   2. The `ignore_order` sort key is `(x is None, str(x), is-numeric)` so
//      sort behaviour stays identical to upstream — diverging numbers here
//      would invalidate comparability with the Spider 2.0 leaderboard.
export const PANDAS_TOLERANCE = 0.01;

function isNullish(x: unknown): boolean {
  return x === null || x === undefined;
}

function isNumericLike(x: unknown): x is number | bigint {
  if (typeof x === "number") return Number.isFinite(x);
  return typeof x === "bigint";
}

type SortKey = readonly [boolean, string, boolean];

function sortKey(x: unknown): SortKey {
  // `String(null)` is "null" in JS — pin to "None" to keep the lexicographic
  // null-bucket position identical to Python's `str(None)`.
  const s = x === null || x === undefined ? "None" : String(x);
  return [isNullish(x), s, isNumericLike(x)];
}

function compareSortKeys(a: SortKey, b: SortKey): number {
  if (a[0] !== b[0]) return a[0] ? 1 : -1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  if (a[2] !== b[2]) return a[2] ? 1 : -1;
  return 0;
}

function cellsEqual(a: unknown, b: unknown): boolean {
  if (isNullish(a) && isNullish(b)) return true;
  if (isNumericLike(a) && isNumericLike(b)) {
    return Math.abs(Number(a) - Number(b)) <= PANDAS_TOLERANCE;
  }
  return a === b;
}

function vectorsMatch(v1: unknown[], v2: unknown[], ignoreOrder: boolean): boolean {
  if (v1.length !== v2.length) return false;
  let a1 = v1;
  let a2 = v2;
  if (ignoreOrder) {
    a1 = [...v1].sort((x, y) => compareSortKeys(sortKey(x), sortKey(y)));
    a2 = [...v2].sort((x, y) => compareSortKeys(sortKey(x), sortKey(y)));
  }
  for (let i = 0; i < a1.length; i++) {
    if (!cellsEqual(a1[i], a2[i])) return false;
  }
  return true;
}

// `compare_pandas_table` (evaluate_utils.py): "for every restricted gold
// column, the prediction must have at least one column whose values match".
// Predicted columns are never restricted — extra prediction columns are fine
// as long as every required gold column finds a home.
export function comparePandasTable(
  predColumns: GoldCell[][],
  goldColumns: GoldCell[][],
  conditionCols: number[],
  ignoreOrder: boolean,
): boolean {
  let restrictedGold = goldColumns;
  if (conditionCols.length > 0) {
    const picked: GoldCell[][] = [];
    for (const idx of conditionCols) {
      const col = goldColumns[idx];
      if (!col) return false;
      picked.push(col);
    }
    restrictedGold = picked;
  }
  for (const goldCol of restrictedGold) {
    let found = false;
    for (const predCol of predColumns) {
      if (vectorsMatch(goldCol, predCol, ignoreOrder)) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === "number");
}

// Mirror of `compare_multi_pandas_table`'s `multi_condition_cols`
// normalisation — flat list broadcasts across multiple golds; empty / single
// empty-sublist / null all degrade to "no restriction on any gold".
export function normaliseConditionCols(
  raw: number[] | number[][] | undefined | null,
  goldCount: number,
): number[][] {
  if (raw == null) return Array.from({ length: goldCount }, () => []);
  if (Array.isArray(raw)) {
    if (raw.length === 0) return Array.from({ length: goldCount }, () => []);
    if (raw.length === 1 && Array.isArray(raw[0]) && raw[0].length === 0) {
      return Array.from({ length: goldCount }, () => []);
    }
    if (goldCount > 1 && isNumberArray(raw)) {
      return Array.from({ length: goldCount }, () => raw);
    }
    if (raw.every((c) => Array.isArray(c))) return raw as number[][];
    // Single-gold flat list — pass through verbatim.
    return [raw as number[]];
  }
  return Array.from({ length: goldCount }, () => []);
}

export function compareMultiPandasTable(
  predColumns: GoldCell[][],
  goldTables: GoldTable[],
  conditionCols: number[] | number[][] | undefined | null,
  ignoreOrder: boolean,
): boolean {
  if (goldTables.length === 0) return false;
  const perGold = normaliseConditionCols(conditionCols, goldTables.length);
  for (let i = 0; i < goldTables.length; i++) {
    const goldCols = goldTables[i]?.cells ?? [];
    if (comparePandasTable(predColumns, goldCols, perGold[i] ?? [], ignoreOrder)) {
      return true;
    }
  }
  return false;
}

export type Spider2ScoreInput = {
  dbPath: string;
  predictedSql: string;
  goldTables: GoldTable[];
  conditionCols: number[] | number[][];
  ignoreOrder: boolean;
  timeoutMs?: number;
};

// Converts bun:sqlite's row-of-objects into the column-major shape the
// pandas comparator expects. Uses the first row's key order; SQLite preserves
// SELECT-clause order so this matches what the model produced.
function rowsToColumnMajor(rows: Record<string, unknown>[]): GoldCell[][] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0] ?? {});
  return keys.map((k) =>
    rows.map((r) => {
      const v = r[k];
      if (v === null || v === undefined) return null;
      if (typeof v === "number" || typeof v === "string") return v;
      if (typeof v === "bigint") return Number(v);
      // SQLite BLOB / boolean / fall-through — keep as a string so the
      // comparator at least gets a deterministic non-numeric value.
      return String(v);
    }),
  );
}

export async function scoreOneSpider2(input: Spider2ScoreInput): Promise<ScoreResult> {
  const Database = await loadSqlite();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const predictedSql = normalizeSql(input.predictedSql);
  if (predictedSql.length === 0) {
    return { outcome: "no_sql", error: "router returned empty SQL" };
  }
  if (input.goldTables.length === 0) {
    return { outcome: "gold_error", error: "no gold CSV(s) for this Spider 2.0 instance" };
  }
  const db = new Database(input.dbPath, { readonly: true });
  try {
    db.query(`PRAGMA busy_timeout = ${Math.max(1, Math.floor(timeoutMs))}`).all();
    let predictedRows: Record<string, unknown>[];
    try {
      predictedRows = db.query(predictedSql).all() as Record<string, unknown>[];
    } catch (err) {
      return { outcome: "exec_error", error: trimError(err) };
    }
    const predColumns = rowsToColumnMajor(predictedRows);
    const match = compareMultiPandasTable(
      predColumns,
      input.goldTables,
      input.conditionCols,
      input.ignoreOrder,
    );
    return match ? { outcome: "match" } : { outcome: "mismatch" };
  } finally {
    db.close();
  }
}

export async function scoreOne(input: ScoreInput): Promise<ScoreResult> {
  const Database = await loadSqlite();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const predictedSql = normalizeSql(input.predictedSql);
  if (predictedSql.length === 0) {
    return { outcome: "no_sql", error: "router returned empty SQL" };
  }
  const goldSql = normalizeSql(input.goldSql);
  const db = new Database(input.dbPath, { readonly: true });
  try {
    db.query(`PRAGMA busy_timeout = ${Math.max(1, Math.floor(timeoutMs))}`).all();
    let gold: unknown[];
    try {
      gold = db.query(goldSql).all();
    } catch (err) {
      return { outcome: "gold_error", error: trimError(err) };
    }
    let predicted: unknown[];
    try {
      predicted = db.query(predictedSql).all();
    } catch (err) {
      return { outcome: "exec_error", error: trimError(err) };
    }
    const ordered = hasOrderBy(goldSql);
    return rowsMatch(gold, predicted, ordered) ? { outcome: "match" } : { outcome: "mismatch" };
  } finally {
    db.close();
  }
}

export const _testing = {
  canonicalize,
  rowsMatch,
  hasOrderBy,
  normalizeSql,
  vectorsMatch,
  cellsEqual,
  sortKey,
  compareSortKeys,
  rowsToColumnMajor,
};
