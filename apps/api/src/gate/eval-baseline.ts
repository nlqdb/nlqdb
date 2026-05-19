// Canonical source of the BIRD/Spider numbers that drive `GLOBAL-027`'s
// pre-alpha gate. This file IS the contract — there is no runtime KV /
// D1 read for these values (see `SK-GATE-001`).
//
// **How this file changes:** the `quality-eval` weekly cron
// (`.github/workflows/quality-eval-bird-mini.yml`) opens a PR that
// amends `bird_accuracy` / `spider_accuracy` / `measured_at` whenever
// a successful run lands. Targets are change-controlled by humans —
// editing them is a `GLOBAL-027` supersession, not a routine cron edit.
//
// **How the gate flips open:** when both `bird_accuracy` and
// `spider_accuracy` are non-null and meet their target, `gateState()`
// in `check.ts` returns `"open"` and `middleware.ts` short-circuits
// to `next()`. There is no separate kill-switch — the file IS the
// kill-switch. To re-close the gate intentionally, lower a number.
//
// `spider_accuracy: null` is the deliberate today-state: Phase 2
// slice 3 of `quality-eval` hasn't shipped the Spider 2.0-lite loader
// yet, so the lane is structurally unmeasured. `gateState()` treats
// null as "not met" and the surface renders an honest "not yet
// measured" line for that lane.

export type EvalBaseline = {
  /** BIRD-dev execution-accuracy on the free LLM chain, 0..1. `null` if unmeasured. */
  bird_accuracy: number | null;
  /** Spider 2.0-lite execution-accuracy on the free LLM chain, 0..1. `null` if unmeasured. */
  spider_accuracy: number | null;
  /** Target both lanes must meet (or exceed). Change-controlled by `GLOBAL-027`. */
  bird_target: number;
  spider_target: number;
  /** ISO-8601 UTC timestamp of the eval run that produced these numbers. */
  measured_at: string;
};

// Source of truth for today's numbers. BIRD value is from
// `tools/eval/baseline-2026-06-15.json` (free lane EA 0.318).
// Spider is null until `SK-QUAL-003` slice 3 ships.
//
// `as const satisfies EvalBaseline` so a typo in the shape is a
// compile error here, not a runtime crash on the hot path.
export const EVAL_BASELINE = {
  bird_accuracy: 0.318,
  spider_accuracy: null,
  bird_target: 0.65,
  spider_target: 0.75,
  measured_at: "2026-05-18T22:42:29.917Z",
} as const satisfies EvalBaseline;
