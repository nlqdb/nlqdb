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
    expect(classifyAsk(428, CHALLENGE_BODY, true)).toBe("blocked");
  });

  test("a real answer is ok", () => {
    expect(classifyAsk(200, "", false)).toBe("ok");
  });

  // Each of these would be a product regression the walker exists to catch;
  // scoring any of them `blocked` is the failure mode to avoid. Passed with
  // `challengeEngaged` true so it is the status/body pair being asserted.
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
    // Pins the substring to the *code*: the real envelope's prose says
    // "Complete the browser challenge", so matching on "challenge" alone
    // would widen the gate to any 428 that merely mentions one.
    [
      428,
      '{"error":{"code":"precondition_required","action":"Complete the browser challenge to continue."}}',
    ],
  ])("status %i is failed", (status, body) => {
    expect(classifyAsk(status, body, true)).toBe("fail");
  });

  // The run-56 shape: the API 428s but the client never ran the widget (no
  // sitekey / api.js blocked), so the 428 is terminal for real visitors too.
  test("a challenge the client never engaged is failed, not blocked", () => {
    expect(classifyAsk(428, CHALLENGE_BODY, false)).toBe("fail");
  });

  test("a 200 is never downgraded by a body that mentions the code", () => {
    expect(classifyAsk(200, CHALLENGE_BODY, true)).toBe("ok");
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

  // Same shape as the zero-step walk: nothing was asserted, so there is no
  // observation to call green. `passed` requires at least one `ok`.
  test("a walk of nothing but skips is failed, not passed", () => {
    expect(runOutcome([s(1, "skip"), s(2, "skip")])).toEqual({ state: "failed", failedStep: 0 });
  });

  // A status outside the union (a hand-edited artifact, a future StepStatus
  // this function was not taught) must not read as green.
  test("an unrecognised status is failed, not passed", () => {
    expect(runOutcome([{ step: 1, description: "s1", status: "weird" as StepStatus }]).state).toBe(
      "failed",
    );
  });
});
