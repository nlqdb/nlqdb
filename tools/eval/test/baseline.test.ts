import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { compareToBaseline, readBaseline } from "../src/baseline.ts";
import type { EvalReport, QuestionResult } from "../src/types.ts";

function laneSummary(lane: "free" | "frontier", match: number, attempted: number) {
  return {
    lane,
    attempted,
    match,
    mismatch: attempted - match,
    exec_error: 0,
    no_sql: 0,
    gold_error: 0,
    execution_accuracy: match / attempted,
    p50_latency_ms: 100,
    p95_latency_ms: 200,
  };
}

function qr(
  question_id: number,
  lane: "free" | "frontier",
  outcome: QuestionResult["outcome"],
): QuestionResult {
  return {
    question_id,
    db_id: "test",
    lane,
    outcome,
    predicted_sql: "",
    model: "test",
    latency_ms: 100,
  };
}

function makeReport(args: {
  run_at: string;
  laneMatches: Record<"free" | "frontier", number>;
  attempted: number;
  perQuestionFreeMatches: boolean[];
  perQuestionFrontierMatches?: boolean[];
}): EvalReport {
  const results: QuestionResult[] = [];
  for (let i = 0; i < args.attempted; i++) {
    results.push(qr(i, "free", args.perQuestionFreeMatches[i] ? "match" : "mismatch"));
    if (args.perQuestionFrontierMatches) {
      results.push(qr(i, "frontier", args.perQuestionFrontierMatches[i] ? "match" : "mismatch"));
    }
  }
  const lanes = [laneSummary("free", args.laneMatches.free, args.attempted)];
  if (args.perQuestionFrontierMatches) {
    lanes.push(laneSummary("frontier", args.laneMatches.frontier, args.attempted));
  }
  return {
    run_at: args.run_at,
    dataset: "bird-mini-dev-sqlite",
    question_count: args.attempted,
    lanes,
    free_vs_frontier_delta: args.perQuestionFrontierMatches
      ? (args.laneMatches.frontier - args.laneMatches.free) / args.attempted
      : null,
    results,
  };
}

describe("compareToBaseline", () => {
  it("reports zero regressions when current run matches baseline", () => {
    const matches = Array(50).fill(true);
    const baseline = makeReport({
      run_at: "2026-05-01T00:00:00Z",
      laneMatches: { free: 50, frontier: 50 },
      attempted: 50,
      perQuestionFreeMatches: matches,
    });
    const current = makeReport({
      run_at: "2026-05-08T00:00:00Z",
      laneMatches: { free: 50, frontier: 50 },
      attempted: 50,
      perQuestionFreeMatches: matches,
    });
    const cmp = compareToBaseline(baseline, current);
    expect(cmp.lanes[0]?.regressions).toEqual([]);
    expect(cmp.lanes[0]?.delta_pp).toBe(0);
    expect(cmp.lanes[0]?.mcnemar?.pValue).toBe(1);
  });

  it("fires threshold trigger when delta is <= -5 pp", () => {
    const baseMatches = Array(100).fill(true);
    // 10 questions flip true → false in current → 10pp drop.
    const currMatches = [...baseMatches];
    for (let i = 0; i < 10; i++) currMatches[i] = false;
    const baseline = makeReport({
      run_at: "2026-05-01T00:00:00Z",
      laneMatches: { free: 100, frontier: 100 },
      attempted: 100,
      perQuestionFreeMatches: baseMatches,
    });
    const current = makeReport({
      run_at: "2026-05-08T00:00:00Z",
      laneMatches: { free: 90, frontier: 100 },
      attempted: 100,
      perQuestionFreeMatches: currMatches,
    });
    const cmp = compareToBaseline(baseline, current);
    const free = cmp.lanes[0];
    expect(free?.delta_pp).toBeCloseTo(-0.1, 5);
    expect(free?.regressions.some((r) => r.trigger === "threshold")).toBe(true);
    // 10 regressions, 0 improvements → McNemar exact-binomial fires too.
    expect(free?.regressions.some((r) => r.trigger === "mcnemar")).toBe(true);
  });

  it("does not fire threshold for a small 2 pp drop but McNemar can fire if many discordant pairs are regression-direction", () => {
    const baseMatches = Array(50).fill(true);
    // Exactly 1 question regresses. 2 pp drop.
    const currMatches = [...baseMatches];
    currMatches[0] = false;
    const baseline = makeReport({
      run_at: "2026-05-01T00:00:00Z",
      laneMatches: { free: 50, frontier: 50 },
      attempted: 50,
      perQuestionFreeMatches: baseMatches,
    });
    const current = makeReport({
      run_at: "2026-05-08T00:00:00Z",
      laneMatches: { free: 49, frontier: 50 },
      attempted: 50,
      perQuestionFreeMatches: currMatches,
    });
    const cmp = compareToBaseline(baseline, current);
    const free = cmp.lanes[0];
    expect(free?.delta_pp).toBeCloseTo(-0.02, 5);
    // 2 pp < 5 pp → no threshold trigger.
    expect(free?.regressions.some((r) => r.trigger === "threshold")).toBe(false);
    // Single discordant pair → exact binomial p=0.5; no McNemar trigger.
    expect(free?.regressions.some((r) => r.trigger === "mcnemar")).toBe(false);
  });

  it("reports a newly-added lane with delta_pp=null and no regression", () => {
    const baseline: EvalReport = makeReport({
      run_at: "2026-05-01T00:00:00Z",
      laneMatches: { free: 40, frontier: 40 },
      attempted: 50,
      perQuestionFreeMatches: Array(50)
        .fill(true)
        .map((_, i) => i < 40),
    });
    // Add a frontier lane that wasn't in the baseline.
    const current = makeReport({
      run_at: "2026-05-08T00:00:00Z",
      laneMatches: { free: 40, frontier: 45 },
      attempted: 50,
      perQuestionFreeMatches: Array(50)
        .fill(true)
        .map((_, i) => i < 40),
      perQuestionFrontierMatches: Array(50)
        .fill(true)
        .map((_, i) => i < 45),
    });
    const cmp = compareToBaseline(baseline, current);
    const frontier = cmp.lanes.find((l) => l.lane === "frontier");
    expect(frontier?.baseline_execution_accuracy).toBeNull();
    expect(frontier?.delta_pp).toBeNull();
    expect(frontier?.mcnemar).toBeNull();
    expect(frontier?.regressions).toEqual([]);
  });

  it("does not fire on improvements (negative regression direction)", () => {
    const baseMatches = Array(100).fill(false);
    // 30 questions flip false → true → 30pp gain.
    const currMatches = [...baseMatches];
    for (let i = 0; i < 30; i++) currMatches[i] = true;
    const baseline = makeReport({
      run_at: "2026-05-01T00:00:00Z",
      laneMatches: { free: 0, frontier: 0 },
      attempted: 100,
      perQuestionFreeMatches: baseMatches,
    });
    const current = makeReport({
      run_at: "2026-05-08T00:00:00Z",
      laneMatches: { free: 30, frontier: 0 },
      attempted: 100,
      perQuestionFreeMatches: currMatches,
    });
    const cmp = compareToBaseline(baseline, current);
    const free = cmp.lanes[0];
    expect(free?.delta_pp).toBeCloseTo(0.3, 5);
    expect(free?.regressions).toEqual([]);
  });
});

describe("readBaseline", () => {
  it("rejects a file missing required fields", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nlqdb-baseline-"));
    try {
      const path = join(dir, "bad.json");
      writeFileSync(path, JSON.stringify({ run_at: "x" }));
      await expect(readBaseline(path)).rejects.toThrow(/missing required fields/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("round-trips a valid baseline", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nlqdb-baseline-"));
    try {
      const report = makeReport({
        run_at: "2026-05-01T00:00:00Z",
        laneMatches: { free: 5, frontier: 5 },
        attempted: 10,
        perQuestionFreeMatches: Array(10)
          .fill(true)
          .map((_, i) => i < 5),
      });
      const path = join(dir, "ok.json");
      writeFileSync(path, JSON.stringify(report));
      const loaded = await readBaseline(path);
      expect(loaded.lanes).toHaveLength(1);
      expect(loaded.results).toHaveLength(10);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
