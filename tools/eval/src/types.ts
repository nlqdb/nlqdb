// Canonical eval-harness types. One question = one BIRD-shaped tuple
// (db_id, question, gold SQL, optional evidence hint). The runner walks
// the question list, asks the LLM router for SQL, executes both gold
// and predicted SQL on the same SQLite fixture, and compares result
// sets per SK-QUAL-001's execution-accuracy metric.

export type DispatchLane = "free" | "frontier";

// Shape mirrors `birdsql/bird_mini_dev` on Hugging Face: `db_id`,
// `question`, `evidence`, `SQL` (gold). Extras the loader may emit
// (question_id, difficulty) are kept optional to avoid coupling the
// runner to BIRD versions.
export type BirdQuestion = {
  question_id: number;
  db_id: string;
  question: string;
  evidence: string;
  sql: string;
  difficulty?: "simple" | "moderate" | "challenging";
};

export type ScoreOutcome =
  // Result sets matched (order-insensitive for non-ORDER-BY queries,
  // order-sensitive when gold SQL contains `order by`).
  | "match"
  // SQL parsed and executed but result set differs from gold.
  | "mismatch"
  // SQL failed to execute (syntax / unknown column / runtime error).
  | "exec_error"
  // LLM router returned no SQL (provider error, refusal, empty body).
  | "no_sql"
  // Gold SQL itself failed to execute on the fixture (data drift /
  // dataset bug). Surfaced separately so it doesn't inflate the
  // mismatch denominator.
  | "gold_error";

export type QuestionResult = {
  question_id: number;
  db_id: string;
  lane: DispatchLane;
  outcome: ScoreOutcome;
  // The SQL the router emitted (or empty on `no_sql`). Capped at 4 KB
  // so a runaway prompt response can't blow up the results JSON.
  predicted_sql: string;
  model: string;
  // ms from `plan()` call to provider response. Failures record the
  // wall-clock until the throw.
  latency_ms: number;
  // One-sentence error excerpt for `exec_error` / `no_sql` / `gold_error`.
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
  // Execution-Match score = match / (attempted - gold_error). Gold
  // errors are dataset bugs and don't penalize the model.
  execution_accuracy: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
};

export type EvalReport = {
  // ISO-8601 UTC. Slice-2 baseline will pin `tools/eval/baseline-2026-06-15.json`
  // off this field per SK-QUAL-005.
  run_at: string;
  dataset: "bird-mini-dev-sqlite";
  // Question count actually attempted (may be < dataset size when
  // `--limit` is passed to the runner).
  question_count: number;
  lanes: LaneSummary[];
  // Free-vs-frontier delta (frontier_em - free_em). Headline KPI per
  // SK-QUAL-004. `null` when only one lane ran (e.g. no frontier key).
  free_vs_frontier_delta: number | null;
  // Per-question detail — sized to fit in one Grafana annotation /
  // R2 upload. Capped to 5000 entries; slice 2's full-500 run sits
  // comfortably under that.
  results: QuestionResult[];
};
