// Baseline comparison + regression detection (SK-QUAL-002 / SK-QUAL-005 / SK-QUAL-006).
// Reads a pinned baseline JSON (same shape as `EvalReport`), diffs lane EAs
// against the current run, and runs McNemar on per-question paired outcomes
// to flag statistically meaningful regressions. The harness emits both
// triggers separately — a 5 pp drop with p>0.05 is still a real number for
// the operator to see; an 8 pp drop where McNemar disagrees with the EA
// delta points at a noise/sample issue worth investigating.

import { readFile } from "node:fs/promises";

import { mcnemarRegression, type PairedOutcome } from "./significance.ts";
import type {
  BaselineComparison,
  DispatchLane,
  EvalReport,
  LaneRegression,
  QuestionResult,
} from "./types.ts";

// 5 percentage points per the SK-QUAL-002 starting heuristic. We hold this
// in code (not a flag) so a slipping baseline can't be hidden by tuning the
// threshold; revisions move through a code change + decision update.
export const REGRESSION_THRESHOLD_PP = 0.05;
// p < 0.05 paired McNemar — see SK-QUAL-006 for the rationale; the test
// factors out questions both runs agree on, so this fires on a smaller
// per-question budget than the threshold trigger.
export const MCNEMAR_ALPHA = 0.05;

export async function readBaseline(path: string): Promise<EvalReport> {
  const txt = await readFile(path, "utf8");
  const parsed = JSON.parse(txt) as EvalReport;
  if (!parsed.lanes || !parsed.results) {
    throw new Error(`baseline ${path} missing required fields (lanes/results)`);
  }
  return parsed;
}

// Build the per-question paired outcome list for one lane. Joins by
// `question_id`; missing on either side is dropped (the operator will see
// the count mismatch in the regression event).
function pairedOutcomesForLane(
  lane: DispatchLane,
  baseline: QuestionResult[],
  current: QuestionResult[],
): PairedOutcome[] {
  const baselineByQ = new Map<number, QuestionResult>();
  for (const r of baseline) {
    if (r.lane === lane) baselineByQ.set(r.question_id, r);
  }
  const out: PairedOutcome[] = [];
  for (const r of current) {
    if (r.lane !== lane) continue;
    const b = baselineByQ.get(r.question_id);
    if (!b) continue;
    out.push({
      baseline: b.outcome === "match",
      current: r.outcome === "match",
    });
  }
  return out;
}

export function compareToBaseline(baseline: EvalReport, current: EvalReport): BaselineComparison {
  const lanes: LaneRegression[] = [];
  for (const currLane of current.lanes) {
    const baseLane = baseline.lanes.find((l) => l.lane === currLane.lane);
    if (!baseLane) {
      // First time we've seen this lane (e.g. frontier added after the
      // baseline was minted). Report it without flagging a regression.
      lanes.push({
        lane: currLane.lane,
        baseline_execution_accuracy: null,
        current_execution_accuracy: currLane.execution_accuracy,
        delta_pp: null,
        mcnemar: null,
        regressions: [],
      });
      continue;
    }
    const deltaPp = currLane.execution_accuracy - baseLane.execution_accuracy;
    const paired = pairedOutcomesForLane(currLane.lane, baseline.results, current.results);
    const mc = mcnemarRegression(paired);
    const regressions: LaneRegression["regressions"] = [];
    // SK-QUAL-002 threshold trigger — negative delta beyond the floor.
    if (deltaPp <= -REGRESSION_THRESHOLD_PP) {
      regressions.push({ trigger: "threshold", pValue: null });
    }
    // SK-QUAL-006 McNemar trigger — paired test factoring out stable Qs.
    // Only fire when there are discordant pairs *and* the test is significant;
    // a p-value of 1 (no discordant pairs) wouldn't fire the threshold either.
    if (mc.b > mc.c && mc.pValue < MCNEMAR_ALPHA) {
      regressions.push({ trigger: "mcnemar", pValue: mc.pValue });
    }
    lanes.push({
      lane: currLane.lane,
      baseline_execution_accuracy: baseLane.execution_accuracy,
      current_execution_accuracy: currLane.execution_accuracy,
      delta_pp: deltaPp,
      mcnemar: { b: mc.b, c: mc.c, pValue: mc.pValue, method: mc.method },
      regressions,
    });
  }
  return {
    baseline_run_at: baseline.run_at,
    baseline_question_count: baseline.question_count,
    lanes,
  };
}
