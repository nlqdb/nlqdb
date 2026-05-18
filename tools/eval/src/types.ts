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
};
