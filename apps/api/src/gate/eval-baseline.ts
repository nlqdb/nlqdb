// Canonical eval-baseline source. The `quality-eval` run PRs
// updates to this file when a fresh BIRD/Spider run lands; there is no
// runtime KV/D1 read for these values (`SK-GATE-001`).
//
// `spider_accuracy: null` is the deliberate today-state — `SK-QUAL-003`
// slice 3 hasn't shipped the Spider 2.0-lite loader yet — and is
// treated as "not met" by `gateState`.

export type EvalBaseline = {
  bird_accuracy: number | null;
  spider_accuracy: number | null;
  bird_target: number;
  spider_target: number;
  measured_at: string;
};

export const EVAL_BASELINE = {
  bird_accuracy: 0.318,
  spider_accuracy: null,
  bird_target: 0.65,
  spider_target: 0.75,
  measured_at: "2026-05-18T22:42:29.917Z",
} as const satisfies EvalBaseline;
