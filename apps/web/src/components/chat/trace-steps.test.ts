import { describe, expect, test } from "bun:test";
import { displayTraceSteps } from "./trace-steps";

const seededPending = [
  { name: "cache_lookup", status: "pending" as const },
  { name: "plan", status: "pending" as const },
  { name: "validate", status: "pending" as const },
  { name: "exec", status: "pending" as const },
  { name: "summarize", status: "pending" as const },
];

const allOk = seededPending.map((s) => ({ ...s, status: "ok" as const }));

describe("displayTraceSteps", () => {
  test("in-flight reply keeps its live pipeline, spinners and all", () => {
    // GLOBAL-011: while streaming, pending steps ARE the live trace.
    expect(displayTraceSteps(seededPending, "pending")).toEqual(seededPending);
  });

  test("confirm gate keeps pending steps — the reply is still active", () => {
    const gated = [...allOk.slice(0, 3), { name: "confirm_required", status: "pending" as const }];
    expect(displayTraceSteps(gated, "needs-confirm")).toEqual(gated);
  });

  test("settled non-stream ok drops all seeded-pending steps (no spinner-lie)", () => {
    // The bug: a non-stream `ask()` ok reply carried 5 pending steps forever.
    expect(displayTraceSteps(seededPending, "ok")).toEqual([]);
  });

  test("settled created reply drops seeded-pending steps", () => {
    expect(displayTraceSteps(seededPending, "created")).toEqual([]);
  });

  test("cache-hit stream: keeps the steps that ran, drops the skipped ones", () => {
    const cacheHit = [
      { name: "cache_lookup", status: "ok" as const },
      { name: "plan", status: "pending" as const },
      { name: "validate", status: "pending" as const },
      { name: "exec", status: "pending" as const },
      { name: "summarize", status: "ok" as const },
    ];
    expect(displayTraceSteps(cacheHit, "ok")).toEqual([
      { name: "cache_lookup", status: "ok" },
      { name: "summarize", status: "ok" },
    ]);
  });

  test("mid-pipeline error: shows where it failed, drops never-run steps", () => {
    const failed = [
      { name: "cache_lookup", status: "ok" as const },
      { name: "plan", status: "ok" as const },
      { name: "validate", status: "error" as const },
      { name: "exec", status: "pending" as const },
      { name: "summarize", status: "pending" as const },
    ];
    expect(displayTraceSteps(failed, "error")).toEqual([
      { name: "cache_lookup", status: "ok" },
      { name: "plan", status: "ok" },
      { name: "validate", status: "error" },
    ]);
  });

  test("fully-settled ok stream is unchanged (filter is a no-op)", () => {
    expect(displayTraceSteps(allOk, "ok")).toEqual(allOk);
  });
});
