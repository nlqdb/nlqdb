// Canonical eval-baseline source. The `quality-eval` run PRs
// updates to this file when a fresh BIRD/Spider run lands; there is no
// runtime KV/D1 read for these values (`SK-GATE-001`).
//
// 2026-06-12 — first complete 6-provider canonical runs (BIRD 500-q +
// Spider 135-q GHA dispatches, sequential, resumed across quota windows
// per `SK-QUAL-013`): BIRD raw EX 0.522 (261/500, chain-exhaustion
// `no_sql` 3 vs the 2026-05-18 baseline's 51), Spider raw EX 0.1704
// (23/135; its remaining `no_sql` 36 are oversized-DDL request failures,
// not rate-limit walls — see `quality-score-source-of-truth.md` §2).
// Both lanes remain below target ⇒ gate stays closed.

export type EvalBaseline = {
  bird_accuracy: number | null;
  spider_accuracy: number | null;
  bird_target: number;
  spider_target: number;
  measured_at: string;
};

export const EVAL_BASELINE = {
  bird_accuracy: 0.522,
  spider_accuracy: 0.1704,
  bird_target: 0.65,
  spider_target: 0.75,
  measured_at: "2026-06-12T07:30:09.249Z",
} as const satisfies EvalBaseline;
