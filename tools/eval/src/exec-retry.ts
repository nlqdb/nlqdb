// SK-QUAL-009 — agentic exec-retry scaffold. Wraps plan + score in a
// bounded retry loop that feeds the previous attempt's failed SQL +
// execution error back into the next plan() call via `previousAttempt`.
//
// The 2026 inference-time consensus for exec-retry: MAC-SQL's Refiner
// (+4.63 pp BIRD-dev EX ablation, [arXiv:2312.11242]), CHESS's Unit
// Tester loop ([arXiv:2405.16755]), MAGIC's self-correction guidelines
// ([arXiv:2406.12692]). RetrySQL ([arXiv:2507.02529]) is training-time
// data augmentation, not inference-time — cited corrected in
// `quality-eval/FEATURE.md`.

import type { PlanRequest, PlanResponse } from "@nlqdb/llm";

import type { ScoreOutcome } from "./types.ts";

// Outcomes that justify a retry (the planner emitted parsable SQL that
// reached the DB but failed at execution time, so the error message is
// concrete prompt feedback). Anything else is terminal:
//   • match / mismatch  → semantic correctness, prompt feedback unclear
//   • no_sql            → upstream chain already exhausted (or empty
//                         string output), retry would re-hit the same
//                         exhausted chain
//   • gold_error        → dataset bug; retrying can't fix the gold
const RETRYABLE_OUTCOMES = new Set<ScoreOutcome>(["exec_error"]);

export type AttemptScore = {
  outcome: ScoreOutcome;
  error?: string;
};

export type AttemptRecord = {
  attempt: number;
  sql: string;
  model: string;
  outcome: ScoreOutcome;
  error?: string;
};

export type ExecRetryInput = {
  // Inclusive max attempts. 1 = no retry (identity behaviour). The
  // production retry budget in `apps/api/src/ask/retry.ts` is 3 — match
  // it so the eval measures what production ships.
  maxAttempts: number;
  // Plan call. Mirrors `LLMRouter["plan"]` but accepts an injected
  // `previousAttempt` overlay so callers can't accidentally pass a
  // stale request.
  plan: (req: PlanRequest) => Promise<PlanResponse>;
  // Base plan request. The retry loop layers `previousAttempt` on top
  // for attempts > 1 — caller must not pre-populate it.
  request: PlanRequest;
  // Score the predicted SQL. Pure function shape so the helper stays
  // engine-agnostic — same retry logic covers BIRD's gold-SQL EX scorer
  // and Spider 2.0's multi-CSV scorer.
  score: (sql: string) => Promise<AttemptScore>;
};

export type ExecRetryResult = {
  // The final attempt's plan output; what the runner records as
  // `predicted_sql` and `model`.
  finalSql: string;
  finalModel: string;
  finalScore: AttemptScore;
  // How many attempts actually executed (1..maxAttempts). 1 on first-
  // try success; > 1 only when an earlier attempt hit `exec_error`.
  attempts: number;
  // Full per-attempt log so the runner can persist enough trace state
  // for post-hoc analysis (which attempt finally matched, what errors
  // earlier attempts hit). Capped at maxAttempts length.
  attemptLog: AttemptRecord[];
};

export async function withExecRetry(input: ExecRetryInput): Promise<ExecRetryResult> {
  if (input.maxAttempts < 1) {
    throw new Error(`withExecRetry: maxAttempts must be >= 1 (got ${input.maxAttempts})`);
  }
  if (input.request.previousAttempt !== undefined) {
    throw new Error(
      "withExecRetry: request.previousAttempt must be unset — the helper owns retry-context plumbing",
    );
  }
  const log: AttemptRecord[] = [];
  let previousAttempt: PlanRequest["previousAttempt"];
  for (let attempt = 1; attempt <= input.maxAttempts; attempt++) {
    const req: PlanRequest = previousAttempt
      ? { ...input.request, previousAttempt }
      : input.request;
    const planRes = await input.plan(req);
    const sql = planRes.sql ?? "";
    const scoreRes = await input.score(sql);
    log.push({
      attempt,
      sql,
      model: planRes.model,
      outcome: scoreRes.outcome,
      ...(scoreRes.error ? { error: scoreRes.error } : {}),
    });
    const isTerminal = !RETRYABLE_OUTCOMES.has(scoreRes.outcome);
    if (isTerminal || attempt === input.maxAttempts) {
      return {
        finalSql: sql,
        finalModel: planRes.model,
        finalScore: scoreRes,
        attempts: attempt,
        attemptLog: log,
      };
    }
    previousAttempt = {
      sql,
      error: scoreRes.error ?? "execution failed (no error message)",
    };
  }
  // Unreachable — the loop returns on the maxAttempts iteration.
  throw new Error("withExecRetry: loop exhausted without returning");
}

export const _testing = { RETRYABLE_OUTCOMES };
