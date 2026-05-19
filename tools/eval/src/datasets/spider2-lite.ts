// Spider 2.0-lite SQLite-subset loader (SK-QUAL-007) — 135 `local###` rows from upstream xlang-ai/Spider2@main, 24 scored via gold SQL today, the rest deferred to slice 3b's multi-CSV scorer; MIT.

import { readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

import type { EvalQuestion } from "../types.ts";

// Canonical upstream — the HuggingFace mirror was stale at 260 / 547 rows on 2026-05-19; pin to a commit SHA once SK-QUAL-005 records a Spider baseline.
const SPIDER2_LITE_JSONL_URL =
  "https://raw.githubusercontent.com/xlang-ai/Spider2/main/spider2-lite/spider2-lite.jsonl";
const SPIDER2_LITE_GOLD_SQL_URL_BASE =
  "https://raw.githubusercontent.com/xlang-ai/Spider2/main/spider2-lite/evaluation_suite/gold/sql/";
const SPIDER2_LITE_SQLITE_PREFIX = "local";
// Canonical `local\d+` shape — gates URL construction and cache reads against a tampered upstream JSONL smuggling path-traversal sequences.
const SPIDER2_LITE_LOCAL_RE = /^local\d+$/;
// Per-request fetch timeout — GitHub raw can hang under load; cap so a single slow body doesn't burn the workflow's 60-min budget.
const FETCH_TIMEOUT_MS = 30_000;
const FETCH_RETRIES = 3;

export type Spider2LiteLoaderOptions = {
  // On-disk fixture root mirroring the upstream `resource/databases/spider2-localdb/<db>.sqlite` + optional `gold-sql/` cache layout.
  dataDir?: string;
  // Pre-downloaded JSONL — bypasses the network entirely.
  questionsJsonlPath?: string;
  // Override the upstream URL — test injection point or commit-pin.
  questionsJsonlUrl?: string;
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

function parseJsonl(raw: string): RawSpider2LiteEntry[] {
  const out: RawSpider2LiteEntry[] = [];
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(
        `spider2-lite: line ${i + 1} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const e = parsed as Partial<RawSpider2LiteEntry>;
    if (!e.instance_id || !e.db || !e.question) {
      throw new Error(
        `spider2-lite: line ${i + 1} missing required fields (instance_id/db/question); got keys=${Object.keys(
          (parsed as object) ?? {},
        ).join(",")}`,
      );
    }
    out.push({
      instance_id: e.instance_id,
      db: e.db,
      question: e.question,
      external_knowledge: e.external_knowledge ?? null,
    });
  }
  return out;
}

function isSqliteRow(e: RawSpider2LiteEntry): boolean {
  if (!e.instance_id.startsWith(SPIDER2_LITE_SQLITE_PREFIX)) return false;
  // Defence in depth — reject tampered `instance_id` that would smuggle path-traversal into the gold-SQL URL or cache read.
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

// Returns null on 404 (canonical: that row uses the multi-CSV scorer instead) so a partial-gold dataset surfaces as `gold_error` per row, never as a hard load failure.
async function loadGoldSql(
  instance_id: string,
  dataDir: string | undefined,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  if (dataDir) {
    const cached = join(dataDir, "gold-sql", `${instance_id}.sql`);
    if (await fileExists(cached)) {
      return (await readFile(cached, "utf8")).trim() || null;
    }
  }
  const url = `${SPIDER2_LITE_GOLD_SQL_URL_BASE}${instance_id}.sql`;
  const res = await fetchWithRetry(url, fetchImpl);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `spider2-lite: gold SQL fetch for ${instance_id} failed: ${res.status} ${res.statusText}`,
    );
  }
  const text = (await res.text()).trim();
  return text.length === 0 ? null : text;
}

export async function loadSpider2Lite(
  opts: Spider2LiteLoaderOptions = {},
): Promise<LoadedSpider2Lite> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let raw: string;
  if (opts.questionsJsonlPath) {
    raw = await readFile(opts.questionsJsonlPath, "utf8");
  } else {
    const url = opts.questionsJsonlUrl ?? SPIDER2_LITE_JSONL_URL;
    const res = await fetchWithRetry(url, fetchImpl);
    if (!res.ok) {
      throw new Error(`spider2-lite: fetch ${url} failed: ${res.status} ${res.statusText}`);
    }
    raw = await res.text();
  }
  const allEntries = parseJsonl(raw);
  const sqliteEntries = allEntries.filter(isSqliteRow);
  const sliced = opts.limit ? sqliteEntries.slice(0, Math.max(0, opts.limit)) : sqliteEntries;

  // Hydrate gold SQL in parallel — small N (≤135), network-bound; the retry helper absorbs transient 429 / 5xx so a one-off GitHub outage doesn't poison the run.
  const goldByInstance = new Map<string, string | null>();
  await Promise.all(
    sliced.map(async (e) => {
      goldByInstance.set(e.instance_id, await loadGoldSql(e.instance_id, opts.dataDir, fetchImpl));
    }),
  );

  const questions: EvalQuestion[] = sliced.map((e, idx) => ({
    // Positional `question_id` keeps the report shape uniform across datasets; `instance_id` preserves the string key for baseline-pair joining.
    question_id: idx,
    instance_id: e.instance_id,
    db_id: e.db,
    question: e.question,
    evidence: "",
    sql: goldByInstance.get(e.instance_id) ?? "",
  }));

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

export const _testing = { parseJsonl, isSqliteRow };
