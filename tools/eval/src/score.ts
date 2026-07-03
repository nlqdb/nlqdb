// Execution-accuracy scoring per SK-QUAL-001 — BIRD's canonical EX metric +
// the Spider 2.0-lite multi-CSV column-major comparator (SK-QUAL-008).

import type { GoldCell, GoldTable } from "./csv.ts";
import type { ScoreOutcome } from "./types.ts";

// SK-QUAL-021 — every gold/predicted statement executes inside a killable
// subprocess (`sql-exec-child.ts`) with a hard deadline. In-process
// bun:sqlite `.values()` is synchronous and uninterruptible, so one
// runaway predicted query (cartesian join over BIRD's larger fixtures)
// froze the whole runner until the CI ceiling — no budget-stop, no
// checkpoint growth, and a deterministic resume order replayed the same
// poison pair every window. SIGKILL at the deadline turns that into a
// scored timeout, matching canonical BIRD `evaluation.py`'s `func_timeout`.
const SQL_EXEC_CHILD = new URL("./sql-exec-child.ts", import.meta.url).pathname;
// Spawn/parse overhead lives outside the query budget so a query that
// finishes just under `timeoutMs` isn't killed by process startup cost.
const KILL_GRACE_MS = 500;

type BoundedExec = { rows: unknown[][] } | { error: string; timedOut?: true };

function reviveCell(v: unknown): unknown {
  if (v !== null && typeof v === "object" && "__b64" in (v as Record<string, unknown>)) {
    return new Uint8Array(Buffer.from((v as { __b64: string }).__b64, "base64"));
  }
  return v;
}

async function runSqlBounded(dbPath: string, sql: string, timeoutMs: number): Promise<BoundedExec> {
  const proc = Bun.spawn([process.execPath, SQL_EXEC_CHILD, dbPath, String(timeoutMs)], {
    stdin: new TextEncoder().encode(sql),
    stdout: "pipe",
    stderr: "pipe",
  });
  let killed = false;
  const timer = setTimeout(() => {
    killed = true;
    proc.kill(9);
  }, timeoutMs + KILL_GRACE_MS);
  const [text, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  clearTimeout(timer);
  if (killed) {
    return { error: `sql execution exceeded ${timeoutMs}ms — killed (SK-QUAL-021)`, timedOut: true };
  }
  if (exitCode !== 0) return { error: `sql exec child exited with code ${exitCode}` };
  try {
    const parsed = JSON.parse(text) as
      | { ok: true; rows: unknown[][] }
      | { ok: false; error: string };
    if (!parsed.ok) return { error: parsed.error };
    return { rows: parsed.rows.map((row) => (row as unknown[]).map(reviveCell)) };
  } catch (err) {
    return { error: `sql exec child produced invalid output: ${trimError(err)}` };
  }
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

// Stable serialisation for the BIRD multiset comparison. Rows arrive as
// positional tuples (`.values()`), so a tuple's cells compare by position;
// nested objects fall back to sorted-key form, and Uint8Array (blob) cells
// round-trip via base64.
function canonicalize(row: unknown): string {
  if (row === null || row === undefined) return "null";
  // `JSON.stringify` throws on bigint; normalise to the numeric form so a
  // bigint cell compares equal to the same value returned as a number.
  if (typeof row === "bigint") return JSON.stringify(Number(row));
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

// Stable fingerprint of an executed result set, consistent with `rowsMatch`
// semantics: two row sets that compare equal under `rowsMatch(_, _, ordered)`
// share a fingerprint and unequal ones differ. The self-consistency vote
// (SK-QUAL-017) uses it to cluster N sampled plans by the *answer* they
// return (the rows), not the SQL string. Multiset (sorted) by default so
// order-irrelevant queries that mean the same thing agree; `ordered` keeps
// sequence identity when the question is order-sensitive.
export function fingerprintRows(rows: unknown[][], ordered: boolean): string {
  const lines = rows.map((r) => canonicalize(r));
  if (!ordered) lines.sort();
  // Lead with the row count so `[]` and a single empty-tuple row can't collide.
  return `${rows.length}\n${lines.join("\n")}`;
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

// Exported: the self-consistency vote clusters under the same order-sensitivity
// the scorer applies, so it must read the gold's ORDER BY the same way.
export function hasOrderBy(sql: string): boolean {
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

// Transposes bun:sqlite's positional rows (`.values()`) into the column-major
// shape the pandas comparator expects. Positional, not name-keyed: SQLite
// emits values in SELECT-clause order, and same-named predicted columns
// (e.g. `SELECT name, name`) would collapse under an object's keys but must
// survive as distinct columns the gold can match against (SK-QUAL-010).
function rowsToColumnMajor(rows: unknown[][]): GoldCell[][] {
  if (rows.length === 0) return [];
  const colCount = rows[0]?.length ?? 0;
  const cols: GoldCell[][] = [];
  for (let c = 0; c < colCount; c++) {
    cols.push(
      rows.map((r) => {
        const v = r[c];
        if (v === null || v === undefined) return null;
        if (typeof v === "number" || typeof v === "string") return v;
        if (typeof v === "bigint") return Number(v);
        // SQLite BLOB / boolean / fall-through — keep as a string so the
        // comparator at least gets a deterministic non-numeric value.
        return String(v);
      }),
    );
  }
  return cols;
}

export async function scoreOneSpider2(input: Spider2ScoreInput): Promise<ScoreResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const predictedSql = normalizeSql(input.predictedSql);
  if (predictedSql.length === 0) {
    return { outcome: "no_sql", error: "router returned empty SQL" };
  }
  if (input.goldTables.length === 0) {
    return { outcome: "gold_error", error: "no gold CSV(s) for this Spider 2.0 instance" };
  }
  const predicted = await runSqlBounded(input.dbPath, predictedSql, timeoutMs);
  if ("error" in predicted) return { outcome: "exec_error", error: predicted.error };
  const predColumns = rowsToColumnMajor(predicted.rows);
  const match = compareMultiPandasTable(
    predColumns,
    input.goldTables,
    input.conditionCols,
    input.ignoreOrder,
  );
  return match ? { outcome: "match" } : { outcome: "mismatch" };
}

// SK-QUAL-017 — execute a predicted SQL read-only and return its
// positional-tuple rows (the `.values()` shape `fingerprintRows` clusters
// on), or `null` when the SQL is empty or fails to execute — the no-vote
// signal `majorityVote` treats as a non-voting candidate. This is the
// execution half of the self-consistency lever: the vote needs each sampled
// plan's *rows*, which only a DB round-trip supplies. It shares the exact
// SQLite loader / busy-timeout / `normalizeSql` path as `scoreOne`'s
// prediction read, so a sampled candidate executes byte-identically to how
// the winner is later scored.
export async function executeRows(
  dbPath: string,
  sql: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown[][] | null> {
  const normalized = normalizeSql(sql);
  if (normalized.length === 0) return null;
  const result = await runSqlBounded(dbPath, normalized, timeoutMs);
  return "error" in result ? null : result.rows;
}

export async function scoreOne(input: ScoreInput): Promise<ScoreResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const predictedSql = normalizeSql(input.predictedSql);
  if (predictedSql.length === 0) {
    return { outcome: "no_sql", error: "router returned empty SQL" };
  }
  const goldSql = normalizeSql(input.goldSql);
  // `.values()` (positional tuples), not `.all()` (name-keyed objects):
  // canonical BIRD compares `set(cursor.fetchall())` over tuples, so output
  // column names / aliases / function casing are ignored. `.all()` folded
  // them into the row identity, false-mismatching correct answers whose
  // aliases differed from gold (SK-QUAL-010).
  const gold = await runSqlBounded(input.dbPath, goldSql, timeoutMs);
  if ("error" in gold) return { outcome: "gold_error", error: gold.error };
  const predicted = await runSqlBounded(input.dbPath, predictedSql, timeoutMs);
  if ("error" in predicted) return { outcome: "exec_error", error: predicted.error };
  const ordered = hasOrderBy(goldSql);
  return rowsMatch(gold.rows, predicted.rows, ordered)
    ? { outcome: "match" }
    : { outcome: "mismatch" };
}

export const _testing = {
  canonicalize,
  rowsMatch,
  normalizeSql,
  vectorsMatch,
  cellsEqual,
  sortKey,
  compareSortKeys,
  rowsToColumnMajor,
};
