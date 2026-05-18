// Execution-accuracy scoring per SK-QUAL-001. Compares two SQL queries'
// result sets on the same SQLite database. The metric is BIRD's
// canonical EX (Execution Accuracy): rows match iff the result-set
// multisets match. ORDER BY in the gold SQL flips comparison to
// sequence-equality so an unordered shuffle doesn't false-positive.
//
// Imports `bun:sqlite` lazily so non-Bun consumers (typecheck-only
// builds, vitest under Node) can still load the module. Vitest in this
// workspace runs on Bun (per the workspace's bun-types), so the lazy
// import resolves on first call.

import type { ScoreOutcome } from "./types.ts";

type SqliteDatabase = {
  query: (sql: string) => { all: () => unknown[] };
  close: () => void;
};

type SqliteCtor = new (filename: string, opts?: { readonly?: boolean }) => SqliteDatabase;

let cachedSqlite: SqliteCtor | undefined;

async function loadSqlite(): Promise<SqliteCtor> {
  if (cachedSqlite) return cachedSqlite;
  // bun:sqlite is the runtime SQLite driver in Bun. We import it via
  // dynamic specifier so module resolution doesn't fail under
  // typecheck (tsc doesn't know bun:* schemes).
  const mod = (await import(/* @vite-ignore */ "bun:sqlite")) as { Database: SqliteCtor };
  cachedSqlite = mod.Database;
  return cachedSqlite;
}

export type ScoreInput = {
  // Path to the SQLite DB file. Opened readonly.
  dbPath: string;
  goldSql: string;
  predictedSql: string;
  // Per-query SQL timeout in ms. SQLite is in-process so this only
  // bounds runaway recursive CTEs / cartesian products; default 5 s.
  timeoutMs?: number;
};

export type ScoreResult = {
  outcome: ScoreOutcome;
  error?: string;
};

const DEFAULT_TIMEOUT_MS = 5000;

// Cap on error messages emitted in results JSON. GLOBAL-012 wants
// one-sentence errors; 240 chars is roughly that.
const ERROR_MSG_CAP = 240;

function trimError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const single = msg.replace(/\s+/g, " ").trim();
  return single.length > ERROR_MSG_CAP ? `${single.slice(0, ERROR_MSG_CAP - 1)}…` : single;
}

// Canonical JSON form for a SQLite row tuple. Used to multiset-compare
// rows independent of column-naming or ordering noise. JSON is enough
// because SQLite returns scalars (number/string/null/bigint/Uint8Array)
// — BigInts round-trip via toString and Uint8Arrays via base64.
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

// Multiset equality — two arrays of rows match iff every canonicalized
// row appears the same number of times. Order-insensitive when caller
// passes `ordered=false`. SK-QUAL-001 commits to "result-set match",
// and BIRD's reference harness uses multisets too.
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

// Strip trailing `;`, whitespace, and BIRD's occasional gold-SQL
// comment header so the parser sees a clean statement.
function normalizeSql(sql: string): string {
  return sql
    .replace(/^\s*--.*$/gm, "")
    .replace(/;\s*$/, "")
    .trim();
}

function hasOrderBy(sql: string): boolean {
  // Conservative — comments aren't yet stripped from gold SQL, so
  // require a word-boundary at both ends.
  return /\border\s+by\b/i.test(sql);
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
    // SQLite `busy_timeout` PRAGMA bounds lock waits; for an in-process
    // readonly DB this only matters for the timeout cap.
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

// Exposed for unit tests that want to compare two known result sets
// without touching SQLite.
export const _testing = { canonicalize, rowsMatch, hasOrderBy, normalizeSql };
