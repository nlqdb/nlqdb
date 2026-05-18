// Canonical eval-harness types per SK-QUAL-001's execution-accuracy metric.

export type DispatchLane = "free" | "frontier";

// Shape mirrors `birdsql/bird_mini_dev` on HuggingFace; extras kept optional so the runner doesn't couple to BIRD versions.
export type BirdQuestion = {
  question_id: number;
  db_id: string;
  question: string;
  evidence: string;
  sql: string;
  difficulty?: "simple" | "moderate" | "challenging";
};

export type ScoreOutcome =
  | "match"
  | "mismatch"
  | "exec_error"
  | "no_sql"
  // Gold SQL itself failed to execute — surfaced separately so dataset bugs don't inflate the mismatch denominator.
  | "gold_error";

export type QuestionResult = {
  question_id: number;
  db_id: string;
  lane: DispatchLane;
  outcome: ScoreOutcome;
  // Capped at 4 KB so a runaway prompt response can't blow up the results JSON.
  predicted_sql: string;
  model: string;
  latency_ms: number;
  // Capped at 240 chars per GLOBAL-012 ("one-sentence errors").
  error?: string;
};

export type LaneSummary = {
  lane: DispatchLane;
  attempted: number;
  match: number;
  mismatch: number;
  exec_error: number;
  no_sql: number;
  gold_error: number;
  // EA = match / (attempted - gold_error) — dataset bugs excluded from denominator.
  execution_accuracy: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
};

export type EvalReport = {
  // ISO-8601 UTC; the slice-2 baseline snapshot pins off this per SK-QUAL-005.
  run_at: string;
  dataset: "bird-mini-dev-sqlite";
  question_count: number;
  lanes: LaneSummary[];
  // Headline KPI per SK-QUAL-004; `null` when only one lane ran.
  free_vs_frontier_delta: number | null;
  results: QuestionResult[];
  // Set when the runner was given a baseline file (SK-QUAL-002/006); the
  // weekly cron then emits `feature.eval.weekly` always + `feature.eval.regression`
  // per (lane, trigger) listed under `lanes[*].regressions`.
  baseline?: BaselineComparison;
};

// SK-QUAL-006 — paired McNemar result on per-question outcomes.
export type McNemarResult = {
  b: number;
  c: number;
  pValue: number;
  method: "exact-binomial" | "edwards-chi2";
};

export type LaneRegression = {
  lane: DispatchLane;
  // null when this lane wasn't in the baseline (newly added).
  baseline_execution_accuracy: number | null;
  current_execution_accuracy: number;
  // current_EA − baseline_EA (signed; negative = regression).
  delta_pp: number | null;
  mcnemar: McNemarResult | null;
  // SK-QUAL-002 / SK-QUAL-006: zero, one, or both triggers can fire on the
  // same lane in the same run. The producer emits one event per trigger so
  // the on-call sees both signals.
  regressions: Array<{
    trigger: "threshold" | "mcnemar";
    pValue: number | null;
  }>;
};

export type BaselineComparison = {
  baseline_run_at: string;
  baseline_question_count: number;
  lanes: LaneRegression[];
};
