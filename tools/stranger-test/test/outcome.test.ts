import { describe, expect, test } from "bun:test";
import { classifyAsk, runOutcome } from "../src/outcome.ts";
import type { StepResult, StepStatus } from "../src/types.ts";

const s = (step: number, status: StepStatus): StepResult => ({
  step,
  description: `step ${step}`,
  status,
});

// The live 428 body, verbatim from the 2026-07-25 prod walk
// (GHA run 30143764445 / 30154906928).
const CHALLENGE_BODY =
  '{"error":{"status":"challenge_required","code":"challenge_required",' +
  '"action":"Complete the browser challenge to continue"}}';

describe("classifyAsk", () => {
  test("the live Turnstile rejection is blocked, not failed", () => {
    expect(classifyAsk(428, CHALLENGE_BODY)).toBe("blocked");
  });

  test("a real answer is ok", () => {
    expect(classifyAsk(200, "")).toBe("ok");
  });

  // Each of these would be a product regression the walker exists to catch;
  // scoring any of them `blocked` is the failure mode to avoid.
  test.each([
    [401, '{"error":{"code":"unauthorized"}}'],
    [429, '{"error":{"code":"rate_limited"}}'],
    [500, "internal error"],
    [502, ""],
    // 428 is minted in exactly one place in apps/api (the anon-create
    // Turnstile gate) — a 428 without the code is not that path.
    [428, '{"error":{"code":"precondition_required"}}'],
    // Body unreadable: fail loudly rather than assume the benign cause.
    [428, ""],
  ])("status %i is failed", (status, body) => {
    expect(classifyAsk(status, body)).toBe("fail");
  });

  test("a 200 is never downgraded by a body that mentions the code", () => {
    expect(classifyAsk(200, CHALLENGE_BODY)).toBe("ok");
  });
});

describe("runOutcome", () => {
  test("all ok → passed, no failed step", () => {
    expect(runOutcome([s(1, "ok"), s(2, "ok")])).toEqual({ state: "passed", failedStep: null });
  });

  test("a blocked step with no failure → blocked, and names no failed step", () => {
    expect(runOutcome([s(1, "ok"), s(2, "blocked"), s(3, "skip")])).toEqual({
      state: "blocked",
      failedStep: null,
    });
  });

  test("a failure before the block outranks it", () => {
    expect(runOutcome([s(1, "fail"), s(2, "blocked")])).toEqual({
      state: "failed",
      failedStep: 1,
    });
  });

  // The FLOW-003 shape: step 9 (/llms.txt) runs even when step 8 is blocked.
  // If `blocked` won here, a real content regression would ship unseen.
  test("a failure AFTER the block still outranks it", () => {
    expect(runOutcome([s(8, "blocked"), s(9, "fail")])).toEqual({
      state: "failed",
      failedStep: 9,
    });
  });

  test("reports the first failing step when several fail", () => {
    expect(runOutcome([s(1, "ok"), s(2, "fail"), s(3, "fail")]).failedStep).toBe(2);
  });

  test("skips alone are not a verdict", () => {
    expect(runOutcome([s(1, "ok"), s(2, "skip")]).state).toBe("passed");
  });

  // A zero-step walk means the walker never observed the surface at all.
  // Reading that as `passed` is the "green build ships nothing" shape.
  test("a walk with no steps is failed, not passed", () => {
    expect(runOutcome([])).toEqual({ state: "failed", failedStep: 0 });
  });
});
