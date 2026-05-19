import { describe, expect, it } from "bun:test";
import type { PlanRequest, PlanResponse } from "@nlqdb/llm";

import type { AttemptScore } from "../src/exec-retry.ts";
import { withExecRetry } from "../src/exec-retry.ts";

// Minimal request fixture — every test re-uses this so a code reviewer
// can focus on the retry shape instead of the plan-input plumbing.
const REQ: PlanRequest = {
  goal: "count cats",
  schema: "CREATE TABLE pet (id INTEGER, species TEXT)",
  dialect: "sqlite",
};

function makePlan(responses: Array<{ sql: string; model?: string }>) {
  let i = 0;
  const calls: PlanRequest[] = [];
  return {
    calls,
    plan: async (req: PlanRequest): Promise<PlanResponse> => {
      calls.push(req);
      const next = responses[i++];
      if (!next) throw new Error(`plan called more than ${responses.length} times`);
      return { sql: next.sql, model: next.model ?? "stub", confidence: 1 };
    },
  };
}

function makeScore(outcomes: AttemptScore[]) {
  let i = 0;
  const sqlsSeen: string[] = [];
  return {
    sqlsSeen,
    score: async (sql: string): Promise<AttemptScore> => {
      sqlsSeen.push(sql);
      const next = outcomes[i++];
      if (!next) throw new Error(`score called more than ${outcomes.length} times`);
      return next;
    },
  };
}

describe("withExecRetry", () => {
  it("first-try success — no retry, one attempt logged", async () => {
    const plan = makePlan([{ sql: "SELECT 1" }]);
    const score = makeScore([{ outcome: "match" }]);
    const result = await withExecRetry({
      maxAttempts: 3,
      request: REQ,
      plan: plan.plan,
      score: score.score,
    });
    expect(result.attempts).toBe(1);
    expect(result.finalScore.outcome).toBe("match");
    expect(plan.calls).toHaveLength(1);
    expect(plan.calls[0]?.previousAttempt).toBeUndefined();
  });

  it("retries on exec_error and threads previousAttempt into the next plan call", async () => {
    const plan = makePlan([{ sql: "BROKEN" }, { sql: "SELECT 1", model: "model-attempt-2" }]);
    const score = makeScore([
      { outcome: "exec_error", error: "syntax error near BROKEN" },
      { outcome: "match" },
    ]);
    const result = await withExecRetry({
      maxAttempts: 3,
      request: REQ,
      plan: plan.plan,
      score: score.score,
    });
    expect(result.attempts).toBe(2);
    expect(result.finalScore.outcome).toBe("match");
    expect(result.finalSql).toBe("SELECT 1");
    expect(result.finalModel).toBe("model-attempt-2");
    // The retry MUST feed the prior attempt's SQL + error back into the
    // planner so the LLM has concrete material to differentiate on.
    expect(plan.calls[1]?.previousAttempt).toEqual({
      sql: "BROKEN",
      error: "syntax error near BROKEN",
    });
  });

  it("exhausts the budget when every attempt errors and returns the final attempt's outcome", async () => {
    const plan = makePlan([{ sql: "A" }, { sql: "B" }, { sql: "C" }]);
    const score = makeScore([
      { outcome: "exec_error", error: "e1" },
      { outcome: "exec_error", error: "e2" },
      { outcome: "exec_error", error: "e3" },
    ]);
    const result = await withExecRetry({
      maxAttempts: 3,
      request: REQ,
      plan: plan.plan,
      score: score.score,
    });
    expect(result.attempts).toBe(3);
    expect(result.finalScore.outcome).toBe("exec_error");
    expect(result.finalScore.error).toBe("e3");
    expect(plan.calls).toHaveLength(3);
  });

  it("does NOT retry on mismatch (semantic correctness, prompt feedback unclear)", async () => {
    const plan = makePlan([{ sql: "SELECT 0" }]);
    const score = makeScore([{ outcome: "mismatch" }]);
    const result = await withExecRetry({
      maxAttempts: 3,
      request: REQ,
      plan: plan.plan,
      score: score.score,
    });
    expect(result.attempts).toBe(1);
    expect(result.finalScore.outcome).toBe("mismatch");
  });

  it("does NOT retry on no_sql (upstream chain already exhausted)", async () => {
    const plan = makePlan([{ sql: "" }]);
    const score = makeScore([{ outcome: "no_sql", error: "router returned empty SQL" }]);
    const result = await withExecRetry({
      maxAttempts: 3,
      request: REQ,
      plan: plan.plan,
      score: score.score,
    });
    expect(result.attempts).toBe(1);
    expect(result.finalScore.outcome).toBe("no_sql");
  });

  it("does NOT retry on gold_error (dataset bug — retrying can't fix the gold)", async () => {
    const plan = makePlan([{ sql: "SELECT 1" }]);
    const score = makeScore([{ outcome: "gold_error", error: "corrupt sqlite" }]);
    const result = await withExecRetry({
      maxAttempts: 3,
      request: REQ,
      plan: plan.plan,
      score: score.score,
    });
    expect(result.attempts).toBe(1);
    expect(result.finalScore.outcome).toBe("gold_error");
  });

  it("maxAttempts=1 is the identity path (no retry, no second plan call)", async () => {
    const plan = makePlan([{ sql: "BROKEN" }]);
    const score = makeScore([{ outcome: "exec_error", error: "e" }]);
    const result = await withExecRetry({
      maxAttempts: 1,
      request: REQ,
      plan: plan.plan,
      score: score.score,
    });
    expect(result.attempts).toBe(1);
    expect(result.finalScore.outcome).toBe("exec_error");
    expect(plan.calls).toHaveLength(1);
  });

  it("stops retrying once a terminal outcome lands mid-budget", async () => {
    const plan = makePlan([{ sql: "BROKEN" }, { sql: "SELECT 1" }]);
    const score = makeScore([{ outcome: "exec_error", error: "e1" }, { outcome: "match" }]);
    const result = await withExecRetry({
      maxAttempts: 5,
      request: REQ,
      plan: plan.plan,
      score: score.score,
    });
    expect(result.attempts).toBe(2);
    expect(plan.calls).toHaveLength(2);
  });

  it("records the full per-attempt log (sql + outcome + error)", async () => {
    const plan = makePlan([
      { sql: "A", model: "m1" },
      { sql: "B", model: "m2" },
    ]);
    const score = makeScore([{ outcome: "exec_error", error: "e1" }, { outcome: "match" }]);
    const result = await withExecRetry({
      maxAttempts: 3,
      request: REQ,
      plan: plan.plan,
      score: score.score,
    });
    expect(result.attemptLog).toEqual([
      { attempt: 1, sql: "A", model: "m1", outcome: "exec_error", error: "e1" },
      { attempt: 2, sql: "B", model: "m2", outcome: "match" },
    ]);
  });

  it("propagates a plan() throw (helper does not swallow planner failures)", async () => {
    const plan = {
      plan: async (): Promise<PlanResponse> => {
        throw new Error("provider 503");
      },
    };
    const score = makeScore([]);
    await expect(
      withExecRetry({
        maxAttempts: 3,
        request: REQ,
        plan: plan.plan,
        score: score.score,
      }),
    ).rejects.toThrow(/provider 503/);
  });

  it("rejects maxAttempts < 1 (programmer error)", async () => {
    const plan = makePlan([]);
    const score = makeScore([]);
    await expect(
      withExecRetry({
        maxAttempts: 0,
        request: REQ,
        plan: plan.plan,
        score: score.score,
      }),
    ).rejects.toThrow(/maxAttempts must be >= 1/);
  });

  it("rejects request.previousAttempt at the call site (helper owns the plumbing)", async () => {
    const plan = makePlan([]);
    const score = makeScore([]);
    await expect(
      withExecRetry({
        maxAttempts: 3,
        request: { ...REQ, previousAttempt: { sql: "x", error: "y" } },
        plan: plan.plan,
        score: score.score,
      }),
    ).rejects.toThrow(/previousAttempt must be unset/);
  });

  it("substitutes a stand-in error message when an exec_error came back without one", async () => {
    const plan = makePlan([{ sql: "BROKEN" }, { sql: "SELECT 1" }]);
    const score = makeScore([{ outcome: "exec_error" }, { outcome: "match" }]);
    await withExecRetry({
      maxAttempts: 3,
      request: REQ,
      plan: plan.plan,
      score: score.score,
    });
    // Whatever placeholder we send must NOT be empty — empty error
    // strings make the next prompt useless.
    expect(plan.calls[1]?.previousAttempt?.error).toBeTruthy();
    expect(plan.calls[1]?.previousAttempt?.error?.length).toBeGreaterThan(0);
  });
});
