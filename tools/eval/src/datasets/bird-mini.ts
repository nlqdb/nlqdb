// BIRD Mini-Dev SQLite loader — 500 SELECT-only instances across 11 DBs, CC-BY-SA-4.0.

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import type { BirdQuestion } from "../types.ts";

// HF's standard `data/<split>-NNNNN-of-NNNNN.json` sharded layout — pin to a revision once we record the slice-2 baseline.
const HF_SQLITE_JSON_URL =
  "https://huggingface.co/datasets/birdsql/bird_mini_dev/resolve/main/data/mini_dev_sqlite-00000-of-00001.json";

export type BirdLoaderOptions = {
  dataDir?: string;
  questionsJsonPath?: string;
  questionsJsonUrl?: string;
  limit?: number;
};

export type LoadedBird = {
  questions: BirdQuestion[];
  // Returns null on missing fixture so a partial cache doesn't crash the run — the runner records `gold_error` instead.
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

// BIRD's JSON uses `SQL` (caps); older mirrors lowercase to `sql` — accept both.
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
      // Nested `dev_databases/<id>/<id>.sqlite` is BIRD's layout; flat `dev_databases/<id>.sqlite` is the manual-cache fallback.
      const nested = join(dataDir, "dev_databases", db_id, `${db_id}.sqlite`);
      if (await fileExists(nested)) return nested;
      const flat = join(dataDir, "dev_databases", `${db_id}.sqlite`);
      if (await fileExists(flat)) return flat;
      return null;
    },
  };
}

export const _testing = { parseQuestions };
