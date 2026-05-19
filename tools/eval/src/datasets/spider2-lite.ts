// Spider 2.0-lite SQLite-subset loader — 135 `local###` rows from upstream
// xlang-ai/Spider2@main, scored via the canonical multi-CSV evaluator
// (SK-QUAL-008). Per-instance gold lives in `evaluation_suite/gold/exec_result/`
// (one `<id>.csv` or multiple `<id>_<a|b|...>.csv`), and the per-instance
// `condition_cols` + `ignore_order` come from
// `evaluation_suite/gold/spider2lite_eval.jsonl`. MIT.

import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

import { csvToGoldTable, type GoldTable } from "../csv.ts";
import type { EvalQuestion, Spider2EvalPayload } from "../types.ts";

// Canonical upstream — HF mirror was stale at 260/547 rows on 2026-05-19; pin to a commit SHA once SK-QUAL-005 records a Spider baseline.
const SPIDER2_LITE_RAW_BASE =
  "https://raw.githubusercontent.com/xlang-ai/Spider2/main/spider2-lite";
const SPIDER2_LITE_JSONL_URL = `${SPIDER2_LITE_RAW_BASE}/spider2-lite.jsonl`;
const SPIDER2_LITE_EVAL_JSONL_URL = `${SPIDER2_LITE_RAW_BASE}/evaluation_suite/gold/spider2lite_eval.jsonl`;
const SPIDER2_LITE_EXEC_RESULT_URL_BASE = `${SPIDER2_LITE_RAW_BASE}/evaluation_suite/gold/exec_result/`;
const SPIDER2_LITE_SQLITE_PREFIX = "local";
// Canonical `local\d+` shape — gates URL construction and cache reads against a tampered upstream JSONL smuggling path-traversal sequences.
const SPIDER2_LITE_LOCAL_RE = /^local\d+$/;
// CSV variant suffixes per Spider 2.0's `resolve_gold_paths`: `local###.csv` (single) or `local###_<a-z>.csv` (multi).
const SPIDER2_LITE_GOLD_CSV_RE = /^(local\d+)(?:_[a-z])?\.csv$/;
const FETCH_TIMEOUT_MS = 30_000;
const FETCH_RETRIES = 3;

export type Spider2LiteLoaderOptions = {
  // On-disk fixture root mirroring the upstream layout. Looks for:
  //   <dataDir>/resource/databases/spider2-localdb/<db>.sqlite  (canonical)
  //   <dataDir>/<db>.sqlite                                     (flat fallback)
  //   <dataDir>/evaluation_suite/gold/exec_result/<id>(_x).csv  (SK-QUAL-008)
  //   <dataDir>/evaluation_suite/gold/spider2lite_eval.jsonl    (SK-QUAL-008)
  dataDir?: string;
  questionsJsonlPath?: string;
  questionsJsonlUrl?: string;
  // Optional pre-downloaded eval JSONL path/URL — bypasses one network call.
  evalJsonlPath?: string;
  evalJsonlUrl?: string;
  // Cap question count after the `local###` filter (deterministic — first N rows).
  limit?: number;
  // Test-overridable fetch — production callers leave this unset.
  fetchImpl?: typeof fetch;
};

export type LoadedSpider2Lite = {
  questions: EvalQuestion[];
  // Null when no on-disk fixture exists — same fail-soft pattern as `bird-mini.ts` so a partial cache surfaces per question.
  resolveDbPath: (db_id: string) => Promise<string | null>;
};

// `external_knowledge` points at `resource/documents/<file>.md`; capture it without fetching the body (deferred to a follow-up slice).
export type RawSpider2LiteEntry = {
  instance_id: string;
  db: string;
  question: string;
  external_knowledge?: string | null;
};

// Per-instance metadata from `spider2lite_eval.jsonl`. `condition_cols`
// can be a flat `number[]` (broadcast across multi-gold) or `number[][]`
// (per-gold) — the comparator normalises both.
type RawEvalEntry = {
  instance_id: string;
  condition_cols?: number[] | number[][];
  ignore_order?: boolean;
};

function parseJsonl<T>(raw: string, label: string, requireKeys: (e: Partial<T>) => boolean): T[] {
  const out: T[] = [];
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(
        `${label}: line ${i + 1} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const e = parsed as Partial<T>;
    if (!requireKeys(e)) {
      throw new Error(
        `${label}: line ${i + 1} missing required fields; got keys=${Object.keys(
          (parsed as object) ?? {},
        ).join(",")}`,
      );
    }
    out.push(e as T);
  }
  return out;
}

function parseQuestionsJsonl(raw: string): RawSpider2LiteEntry[] {
  const rows = parseJsonl<RawSpider2LiteEntry>(raw, "spider2-lite", (e) =>
    Boolean(e.instance_id && e.db && e.question),
  );
  // Normalise optional `external_knowledge` to `null` (matches the slice-3a contract — every row carries the field even when upstream omits it).
  return rows.map((e) => ({
    instance_id: e.instance_id,
    db: e.db,
    question: e.question,
    external_knowledge: e.external_knowledge ?? null,
  }));
}

function parseEvalJsonl(raw: string): RawEvalEntry[] {
  return parseJsonl<RawEvalEntry>(
    raw,
    "spider2-lite-eval",
    (e) => typeof e.instance_id === "string" && e.instance_id.length > 0,
  );
}

function isSqliteRow(e: RawSpider2LiteEntry): boolean {
  if (!e.instance_id.startsWith(SPIDER2_LITE_SQLITE_PREFIX)) return false;
  // Defence in depth — reject tampered `instance_id` that would smuggle path-traversal into a downstream URL or cache read.
  return SPIDER2_LITE_LOCAL_RE.test(e.instance_id);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

// Retry transient errors (429 / 5xx / network) with exponential backoff so a single GitHub rate-limit or stream drop doesn't kill the weekly cron.
async function fetchWithRetry(url: string, fetchImpl: typeof fetch): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < FETCH_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, Math.min(8_000, 1_000 * 2 ** (attempt - 1))));
    }
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.status !== 429 && res.status < 500) return res;
      lastError = new Error(`spider2-lite: ${url} returned ${res.status} ${res.statusText}`);
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error(`spider2-lite: ${url} failed after ${FETCH_RETRIES} attempts`);
}

async function fetchTextOrNull(url: string, fetchImpl: typeof fetch): Promise<string | null> {
  const res = await fetchWithRetry(url, fetchImpl);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`spider2-lite: fetch ${url} failed: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

// Enumerates `local###(_[a-z])?.csv` siblings from a cached `exec_result/` directory.
async function listCachedGoldCsvs(
  instance_id: string,
  cachedExecResultDir: string,
): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(cachedExecResultDir);
  } catch {
    return [];
  }
  const matches: string[] = [];
  for (const name of entries) {
    const m = SPIDER2_LITE_GOLD_CSV_RE.exec(name);
    if (m && m[1] === instance_id) matches.push(name);
  }
  // Sort gives a stable scoring order: `<id>.csv` first (no suffix sorts before `_a`), then `_a`, `_b`, etc.
  matches.sort();
  return matches.map((n) => join(cachedExecResultDir, n));
}

// Loads gold CSVs for one instance. When `cachedExecResultDir` is set, the
// on-disk cache is **authoritative** — instances with no cached CSVs return
// an empty array (the run reports `gold_error` for them) rather than
// silently reaching out to the network mid-cron. Network probing fires only
// when no cache root exists at all (dev / first-time local run), probing
// `<id>.csv` then `<id>_a..z.csv` to the first 404 per the canonical
// `resolve_gold_paths` pattern.
async function loadGoldCsvs(
  instance_id: string,
  cachedExecResultDir: string | undefined,
  fetchImpl: typeof fetch,
): Promise<GoldTable[]> {
  if (cachedExecResultDir) {
    const files = await listCachedGoldCsvs(instance_id, cachedExecResultDir);
    if (files.length === 0) return [];
    const texts = await Promise.all(files.map((p) => readFile(p, "utf8")));
    return texts.map(csvToGoldTable);
  }
  // Network probe — try `<id>.csv` first; on 404 fall back to suffixes a..z.
  const tables: GoldTable[] = [];
  const bare = await fetchTextOrNull(
    `${SPIDER2_LITE_EXEC_RESULT_URL_BASE}${instance_id}.csv`,
    fetchImpl,
  );
  if (bare !== null) {
    tables.push(csvToGoldTable(bare));
    return tables;
  }
  for (let code = 97 /* 'a' */; code <= 122 /* 'z' */; code++) {
    const suffix = String.fromCharCode(code);
    const text = await fetchTextOrNull(
      `${SPIDER2_LITE_EXEC_RESULT_URL_BASE}${instance_id}_${suffix}.csv`,
      fetchImpl,
    );
    if (text === null) break;
    tables.push(csvToGoldTable(text));
  }
  return tables;
}

async function loadEvalIndex(
  opts: Spider2LiteLoaderOptions,
  fetchImpl: typeof fetch,
): Promise<Map<string, RawEvalEntry>> {
  let raw: string | null = null;
  if (opts.evalJsonlPath) {
    raw = await readFile(opts.evalJsonlPath, "utf8");
  } else if (opts.dataDir) {
    const cached = join(opts.dataDir, "evaluation_suite", "gold", "spider2lite_eval.jsonl");
    if (await fileExists(cached)) raw = await readFile(cached, "utf8");
  }
  if (raw === null) {
    const url = opts.evalJsonlUrl ?? SPIDER2_LITE_EVAL_JSONL_URL;
    const res = await fetchWithRetry(url, fetchImpl);
    if (!res.ok) {
      throw new Error(`spider2-lite: fetch ${url} failed: ${res.status} ${res.statusText}`);
    }
    raw = await res.text();
  }
  const entries = parseEvalJsonl(raw);
  const index = new Map<string, RawEvalEntry>();
  for (const e of entries) index.set(e.instance_id, e);
  return index;
}

function buildPayload(
  goldTables: GoldTable[],
  evalEntry: RawEvalEntry | undefined,
): Spider2EvalPayload | undefined {
  if (goldTables.length === 0) return undefined;
  return {
    gold_tables: goldTables,
    // `ignore_order` is always `true` in the upstream eval JSONL today;
    // default to `true` so a missing entry doesn't silently flip the
    // comparator into sequence-strict mode.
    ignore_order: evalEntry?.ignore_order ?? true,
    condition_cols: evalEntry?.condition_cols ?? [],
  };
}

export async function loadSpider2Lite(
  opts: Spider2LiteLoaderOptions = {},
): Promise<LoadedSpider2Lite> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let raw: string | null = null;
  if (opts.questionsJsonlPath) {
    raw = await readFile(opts.questionsJsonlPath, "utf8");
  } else if (opts.dataDir) {
    // Cache-aware: the sparse-clone workflow ships `spider2-lite.jsonl` alongside the eval/gold tree, so this branch keeps the questions read in lockstep with the eval-JSONL + gold-CSV cache.
    const cached = join(opts.dataDir, "spider2-lite.jsonl");
    if (await fileExists(cached)) raw = await readFile(cached, "utf8");
  }
  if (raw === null) {
    const url = opts.questionsJsonlUrl ?? SPIDER2_LITE_JSONL_URL;
    const res = await fetchWithRetry(url, fetchImpl);
    if (!res.ok) {
      throw new Error(`spider2-lite: fetch ${url} failed: ${res.status} ${res.statusText}`);
    }
    raw = await res.text();
  }
  const allEntries = parseQuestionsJsonl(raw);
  const sqliteEntries = allEntries.filter(isSqliteRow);
  const sliced = opts.limit ? sqliteEntries.slice(0, Math.max(0, opts.limit)) : sqliteEntries;

  const cachedExecResultDir = opts.dataDir
    ? join(opts.dataDir, "evaluation_suite", "gold", "exec_result")
    : undefined;
  const haveCachedExecDir = cachedExecResultDir
    ? await directoryExists(cachedExecResultDir)
    : false;
  const effectiveCacheDir = haveCachedExecDir ? cachedExecResultDir : undefined;

  // Load gold CSVs + eval metadata in parallel — small N (≤135), I/O-bound.
  const [evalIndex, goldByInstance] = await Promise.all([
    loadEvalIndex(opts, fetchImpl),
    (async () => {
      const m = new Map<string, GoldTable[]>();
      await Promise.all(
        sliced.map(async (e) => {
          m.set(e.instance_id, await loadGoldCsvs(e.instance_id, effectiveCacheDir, fetchImpl));
        }),
      );
      return m;
    })(),
  ]);

  const questions: EvalQuestion[] = sliced.map((e, idx) => {
    const goldTables = goldByInstance.get(e.instance_id) ?? [];
    const payload = buildPayload(goldTables, evalIndex.get(e.instance_id));
    const q: EvalQuestion = {
      // Positional `question_id` keeps the report shape uniform across datasets; `instance_id` preserves the string key for baseline-pair joining.
      question_id: idx,
      instance_id: e.instance_id,
      db_id: e.db,
      question: e.question,
      evidence: "",
      // Spider 2.0 scoring is multi-CSV only — gold SQL is unused even when it ships upstream.
      sql: "",
    };
    if (payload) q.spider2 = payload;
    return q;
  });

  const dataDir = opts.dataDir;
  return {
    questions,
    resolveDbPath: async (db_id) => {
      if (!dataDir) return null;
      // `basename` strips any traversal smuggled in via a tampered `db` field — same defence-in-depth as the `instance_id` regex gate.
      const safe = basename(db_id);
      if (safe !== db_id || safe.length === 0) return null;
      const canonical = join(dataDir, "resource", "databases", "spider2-localdb", `${safe}.sqlite`);
      if (await fileExists(canonical)) return canonical;
      // Flat fallback for hand-curated caches that don't mirror the upstream nesting.
      const flat = join(dataDir, `${safe}.sqlite`);
      if (await fileExists(flat)) return flat;
      return null;
    },
  };
}

export const _testing = { parseQuestionsJsonl, parseEvalJsonl, isSqliteRow };
