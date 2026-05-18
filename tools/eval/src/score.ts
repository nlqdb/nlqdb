// Execution-accuracy scoring per SK-QUAL-001 — BIRD's canonical EX metric.

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

export const _testing = { canonicalize, rowsMatch, hasOrderBy, normalizeSql };
