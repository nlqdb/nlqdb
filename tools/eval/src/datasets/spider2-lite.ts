// Spider 2.0-lite SQLite-subset loader — per SK-QUAL-003 + SK-QUAL-007.
//
// Dataset shape verified against the canonical GitHub source
// (xlang-ai/Spider2@main, May 2026): 547 rows total; 135 SQLite questions
// filtered by `instance_id` prefix `local###`. Of those 135, only 24 ship a
// gold SQL file under `evaluation_suite/gold/sql/<instance_id>.sql` — the
// remainder are scored via the canonical Spider 2.0 multi-CSV result-set
// path in `evaluation_suite/gold/exec_result/`, deferred to a follow-up
// slice. This loader yields the 135 questions but pre-marks the 111 without
// a gold SQL so the runner emits `gold_error` (excluded from the EA
// denominator) instead of charging the LLM for an unevaluable run.
//
// License: MIT (https://github.com/xlang-ai/Spider2 — same upstream as BIRD).

import { readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

import type { EvalQuestion } from "../types.ts";

// Canonical source — HuggingFace mirror is stale (260 rows vs the repo's 547)
// so we fetch the upstream JSONL directly. Pin to a commit SHA once we
// record the slice-3 baseline so leaderboard churn can't bump our numbers.
const SPIDER2_LITE_JSONL_URL =
  "https://raw.githubusercontent.com/xlang-ai/Spider2/main/spider2-lite/spider2-lite.jsonl";
const SPIDER2_LITE_GOLD_SQL_URL_BASE =
  "https://raw.githubusercontent.com/xlang-ai/Spider2/main/spider2-lite/evaluation_suite/gold/sql/";
// `instance_id` prefix that flags an SQLite-flavoured row (vs `bq###` / `sf###` / `ga###`).
const SPIDER2_LITE_SQLITE_PREFIX = "local";
// Strict canonical shape — used to gate on-disk cache reads + URL building
// so a tampered upstream JSONL can't smuggle a path-traversal sequence into
// `join(dataDir, "gold-sql", instance_id)`.
const SPIDER2_LITE_LOCAL_RE = /^local\d+$/;

export type Spider2LiteLoaderOptions = {
  // On-disk fixture root — same shape as the upstream repo: contains
  // `resource/databases/spider2-localdb/<db>.sqlite` and (optionally)
  // a `gold-sql/` cache of pre-fetched `<instance_id>.sql` files.
  dataDir?: string;
  // Path to a pre-downloaded `spider2-lite.jsonl`; bypasses the fetch.
  questionsJsonlPath?: string;
  // Override the upstream URL (test injection point or commit-pin).
  questionsJsonlUrl?: string;
  // Cap question count (deterministic — first N rows after `local###` filter).
  limit?: number;
  // Per-request fetch implementation — defaulted to global `fetch`; tests
  // override with a stub that resolves canned responses without network.
  fetchImpl?: typeof fetch;
};

export type LoadedSpider2Lite = {
  questions: EvalQuestion[];
  // Returns null when no on-disk fixture exists — same fail-soft pattern as
  // `bird-mini.ts`, so a partial cache surfaces as `gold_error` per question
  // and one missing DB doesn't kill the run.
  resolveDbPath: (db_id: string) => Promise<string | null>;
};

// `external_knowledge` is a filename pointing at `resource/documents/<file>.md`;
// we capture it but don't fetch the body (deferred to a follow-up slice).
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
  // Reject any row whose `instance_id` doesn't match the canonical
  // `local\d+` shape — defence in depth against a tampered upstream JSONL
  // smuggling path-traversal into the gold-SQL fetch / cache read.
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

// Read gold SQL for one instance, trying a local cache first and then the
// upstream raw URL. Returns null when the instance has no gold SQL file at
// all — the official Spider 2.0 eval uses gold CSV result-sets for those,
// which the runner doesn't yet score (slice 3b).
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
  const res = await fetchImpl(`${SPIDER2_LITE_GOLD_SQL_URL_BASE}${instance_id}.sql`);
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
    const res = await fetchImpl(url);
    if (!res.ok) {
      throw new Error(`spider2-lite: fetch ${url} failed: ${res.status} ${res.statusText}`);
    }
    raw = await res.text();
  }
  const allEntries = parseJsonl(raw);
  const sqliteEntries = allEntries.filter(isSqliteRow);
  const sliced = opts.limit ? sqliteEntries.slice(0, Math.max(0, opts.limit)) : sqliteEntries;

  // Gold-SQL hydration runs in parallel (small list, network-bound). A 404
  // on any single instance is normal — it means that row uses the CSV
  // result-set eval path which slice 3b will pick up. Surface other
  // failures so a transient GitHub outage doesn't quietly poison the run.
  const goldByInstance = new Map<string, string | null>();
  await Promise.all(
    sliced.map(async (e) => {
      goldByInstance.set(e.instance_id, await loadGoldSql(e.instance_id, opts.dataDir, fetchImpl));
    }),
  );

  const questions: EvalQuestion[] = sliced.map((e, idx) => ({
    // Numeric `question_id` keeps the report shape uniform across datasets;
    // the original `instance_id` is preserved for baseline-pair joining and
    // debugging.
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
      // `basename` strips any path-traversal sequence smuggled in via a
      // tampered upstream `db` field — same defence-in-depth as the
      // `SPIDER2_LITE_LOCAL_RE` gate on `instance_id`.
      const safe = basename(db_id);
      if (safe !== db_id || safe.length === 0) return null;
      // Canonical path per the upstream README quickstart step 1.
      const canonical = join(dataDir, "resource", "databases", "spider2-localdb", `${safe}.sqlite`);
      if (await fileExists(canonical)) return canonical;
      // Flat fallback for operator-curated caches that don't preserve the
      // upstream nesting.
      const flat = join(dataDir, `${safe}.sqlite`);
      if (await fileExists(flat)) return flat;
      return null;
    },
  };
}

export const _testing = { parseJsonl, isSqliteRow };
