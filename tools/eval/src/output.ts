// JSON report writer; slice 2 will swap the destination to R2 + emit a `feature.eval.weekly` event per SK-QUAL-002.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { EvalReport } from "./types.ts";

export const DEFAULT_RESULTS_DIR = join(import.meta.dir, "..", "results");

// RFC-3339 colons and dots aren't valid filenames on every FS.
function safeIsoForFilename(iso: string): string {
  return iso.replace(/[:.]/g, "-");
}

export async function writeReport(report: EvalReport, dir?: string): Promise<string> {
  const target = dir ?? DEFAULT_RESULTS_DIR;
  await mkdir(target, { recursive: true });
  const path = join(target, `${safeIsoForFilename(report.run_at)}.json`);
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  return path;
}
