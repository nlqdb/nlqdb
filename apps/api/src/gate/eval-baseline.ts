// Canonical eval-baseline source. The `quality-eval` run PRs
// updates to this file when a fresh BIRD/Spider run lands; there is no
// runtime KV/D1 read for these values (`SK-GATE-001`).
//
// 2026-06-09 — first measurement after the eval pipeline was unblocked
// (gdown 6 had broken every run since 2026-05-30; see
// `docs/progress/quality-score-verification-log.md`). Both values are
// **conservative measured lower bounds**: the measurement env ran only 4
// of 6 free providers and free-tier per-minute TPM saturates on the
// big-DDL schemas, so chain-exhaustion `no_sql` (30% BIRD / 70% Spider)
// drags raw EX below the engine's capacity-independent reasoning EX
// (match among questions that produced SQL: ~52% BIRD, ~19% Spider — up
// from the 2026-05-18 baseline's 35.4% BIRD). A lower bound is the right
// choice for a gate where opening early is the costly failure. The
// canonical full-500 / 6-provider re-seed is the (now-unblocked) GHA
// `quality-eval-*.yml` dispatch. Both lanes remain below target ⇒ gate
// stays closed.

export type EvalBaseline = {
  bird_accuracy: number | null;
  spider_accuracy: number | null;
  bird_target: number;
  spider_target: number;
  measured_at: string;
};

export const EVAL_BASELINE = {
  bird_accuracy: 0.35,
  spider_accuracy: 0.12,
  bird_target: 0.65,
  spider_target: 0.75,
  measured_at: "2026-06-09T16:03:00.000Z",
} as const satisfies EvalBaseline;
