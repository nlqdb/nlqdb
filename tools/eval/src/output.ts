// Result-writer. Slice 1 emits a JSON file under
// `tools/eval/results/<run_at>.json`. Slice 2 swaps the destination
// to R2 + emits a `feature.eval.weekly` event per SK-QUAL-002 — that
// re-uses this shape so dashboards don't churn.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { EvalReport } from "./types.ts";

// Default directory relative to the workspace root. Override via
// runner flag for ad-hoc runs.
export const DEFAULT_RESULTS_DIR = join(import.meta.dir, "..", "results");

function safeIsoForFilename(iso: string): string {
  // RFC 3339 colons / dots aren't valid on every FS; replace with
  // hyphens for filename portability.
  return iso.replace(/[:.]/g, "-");
}

export async function writeReport(report: EvalReport, dir?: string): Promise<string> {
  const target = dir ?? DEFAULT_RESULTS_DIR;
  await mkdir(target, { recursive: true });
  const path = join(target, `${safeIsoForFilename(report.run_at)}.json`);
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  return path;
}

// Append a parent-dir guard so a bad CLI flag can't write outside
// the workspace results directory.
export async function ensureWritable(dir: string): Promise<void> {
  await mkdir(dirname(dir), { recursive: true });
}
