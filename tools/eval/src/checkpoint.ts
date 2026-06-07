// SK-QUAL-011 — resumable-runner checkpoint. One JSONL line per scored
// (question_id, lane) pair so a run that hits a free-tier daily token
// cap mid-pass (the whole chain rate-limited, SK-LLM-030) can resume on
// the next dispatch instead of restarting and re-burning quota.
// Deterministic question order (SK-QUAL-011 sampling) makes "skip
// already-done" a plain set-membership test.

import { appendFile, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { DispatchLane, EvalDataset, QuestionResult } from "./types.ts";

// Per-(dataset, variant) partial file. The dataset name keeps a BIRD
// run's checkpoint from colliding with a Spider run's; the variant keeps
// the 4h sampled smoke slice from colliding with the weekly full run
// (different question sets must never share a checkpoint). `variant`
// defaults to "full"; the runner passes "smoke" for sampled runs.
export function checkpointPath(dir: string, dataset: EvalDataset, variant = "full"): string {
  return join(dir, `${dataset}.${variant}.partial.jsonl`);
}

export function checkpointKey(questionId: number, lane: DispatchLane): string {
  return `${questionId}:${lane}`;
}

export type Checkpoint = {
  // (question_id, lane) keys already scored — skipped on resume.
  done: Set<string>;
  // The scored rows themselves, replayed into the final report so a
  // resumed run produces the same scoring as a single-shot run.
  results: QuestionResult[];
};

// Load a checkpoint file. A missing file is a fresh run (empty
// checkpoint). JSONL is line-atomic, so a run killed mid-write can only
// leave a torn final line — we keep every line that parses and drop the
// tail, and the dropped pair simply re-runs on resume.
export async function loadCheckpoint(path: string): Promise<Checkpoint> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return { done: new Set(), results: [] };
  }
  const done = new Set<string>();
  const results: QuestionResult[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let row: QuestionResult;
    try {
      row = JSON.parse(line) as QuestionResult;
    } catch {
      continue; // torn final write — drop it; the pair re-scores.
    }
    results.push(row);
    done.add(checkpointKey(row.question_id, row.lane));
  }
  return { done, results };
}

// Append one scored row. Each call is a single line write, so a crash
// can only ever lose the in-flight line, never corrupt earlier rows.
export async function appendCheckpoint(path: string, row: QuestionResult): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(row)}\n`);
}

// Run finished cleanly — drop the checkpoint so the next dispatch starts
// fresh. Idempotent (`force`) so a re-run after a crash-on-complete is safe.
export async function completeCheckpoint(path: string): Promise<void> {
  await rm(path, { force: true });
}
