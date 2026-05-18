// BIRD Mini-Dev SQLite loader. The official dataset ships at
// https://huggingface.co/datasets/birdsql/bird_mini_dev — JSON variants
// `mini_dev_sqlite.json`, `mini_dev_postgresql.json`, `mini_dev_mysql.json`.
// For SK-QUAL-001 we use the SQLite variant: 500 SELECT-only instances
// across 11 SQLite databases, CC-BY-SA-4.0 licensed.
//
// The SQLite database files themselves are distributed via Google
// Drive (per the BIRD README), so the runner expects them to live on
// disk at `${BIRD_DATA_DIR}/dev_databases/<db_id>/<db_id>.sqlite`.
// The accompanying CI workflow downloads them once and caches.

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import type { BirdQuestion } from "../types.ts";

// HuggingFace's `resolve/main` returns the raw file. The dataset is
// sharded by HF's standard `data/<split>-NNNNN-of-NNNNN.json` layout;
// `mini_dev_sqlite` is one shard (00000-of-00001 as of 2026-05).
// Slice 2 may pin to a specific revision once we record the baseline.
const HF_SQLITE_JSON_URL =
  "https://huggingface.co/datasets/birdsql/bird_mini_dev/resolve/main/data/mini_dev_sqlite-00000-of-00001.json";

export type BirdLoaderOptions = {
  // Local directory containing `dev_databases/<db_id>/<db_id>.sqlite`.
  // Required for execution-accuracy scoring; loader still returns
  // questions when absent so the harness can dry-run on metadata.
  dataDir?: string;
  // Optional override for the questions JSON path. When set, reads
  // from disk instead of fetching from HuggingFace — used in tests
  // and in the CI workflow once `dev_data.json` is cached.
  questionsJsonPath?: string;
  // Override the HuggingFace URL — useful for tests that need to
  // assert no network fetch happens.
  questionsJsonUrl?: string;
  // Cap the question count. Returned subset is `questions.slice(0, n)`
  // — deterministic across runs.
  limit?: number;
};

export type LoadedBird = {
  questions: BirdQuestion[];
  // Absolute path resolver `(db_id) => sqlite_path`. Returns null when
  // the fixture is missing on disk; the runner records `gold_error` in
  // that case so a partial fixture set doesn't crash a whole run.
  resolveDbPath: (db_id: string) => Promise<string | null>;
};

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

// Shape the loader normalizes from. BIRD's JSON uses `SQL` (caps);
// older mirrors lowercase to `sql`. Accept both.
type RawBirdEntry = {
  question_id?: number;
  db_id: string;
  question: string;
  evidence?: string;
  SQL?: string;
  sql?: string;
  difficulty?: string;
};

function normalizeDifficulty(d?: string): BirdQuestion["difficulty"] {
  if (d === "simple" || d === "moderate" || d === "challenging") return d;
  return undefined;
}

function parseQuestions(raw: unknown): BirdQuestion[] {
  if (!Array.isArray(raw)) {
    throw new Error("bird-mini: questions JSON is not an array");
  }
  const out: BirdQuestion[] = [];
  raw.forEach((entry, i) => {
    const e = entry as RawBirdEntry;
    const sql = e.SQL ?? e.sql;
    if (!e.db_id || !e.question || !sql) {
      throw new Error(
        `bird-mini: entry ${i} missing required fields (db_id/question/SQL); got keys=${Object.keys(
          e ?? {},
        ).join(",")}`,
      );
    }
    out.push({
      question_id: e.question_id ?? i,
      db_id: e.db_id,
      question: e.question,
      evidence: e.evidence ?? "",
      sql,
      difficulty: normalizeDifficulty(e.difficulty),
    });
  });
  return out;
}

export async function loadBirdMini(opts: BirdLoaderOptions = {}): Promise<LoadedBird> {
  let raw: unknown;
  if (opts.questionsJsonPath) {
    const txt = await readFile(opts.questionsJsonPath, "utf8");
    raw = JSON.parse(txt);
  } else {
    const url = opts.questionsJsonUrl ?? HF_SQLITE_JSON_URL;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`bird-mini: fetch ${url} failed: ${res.status} ${res.statusText}`);
    }
    raw = await res.json();
  }
  const all = parseQuestions(raw);
  const questions = opts.limit ? all.slice(0, Math.max(0, opts.limit)) : all;
  const dataDir = opts.dataDir;
  return {
    questions,
    resolveDbPath: async (db_id) => {
      if (!dataDir) return null;
      // BIRD's layout: dev_databases/<db_id>/<db_id>.sqlite. Falls back
      // to dev_databases/<db_id>.sqlite for flat caches.
      const nested = join(dataDir, "dev_databases", db_id, `${db_id}.sqlite`);
      if (await fileExists(nested)) return nested;
      const flat = join(dataDir, "dev_databases", `${db_id}.sqlite`);
      if (await fileExists(flat)) return flat;
      return null;
    },
  };
}

export const _testing = { parseQuestions };
