// Pure gate-state decision. No IO. `SK-GATE-002`: gate is open IFF
// both lanes have a numeric value meeting their target. Null on
// either side keeps the gate closed (treated as "not met"), which is
// also the today-state for the still-unshipped Spider lane.
//
// The closed branch carries every field the surface needs to render
// the progress UI without a second call (`SK-GATE-005`).

import type { EvalBaseline } from "./eval-baseline.ts";

export type LaneStatus = {
  accuracy: number | null;
  target: number;
  /** `met` when `accuracy >= target`; `below` for numeric-but-low; `unmeasured` for null. */
  status: "met" | "below" | "unmeasured";
};

export type GateState =
  | { kind: "open"; bird: LaneStatus; spider: LaneStatus; measured_at: string }
  | { kind: "closed"; bird: LaneStatus; spider: LaneStatus; measured_at: string };

function laneStatus(accuracy: number | null, target: number): LaneStatus {
  if (accuracy === null) return { accuracy, target, status: "unmeasured" };
  return { accuracy, target, status: accuracy >= target ? "met" : "below" };
}

/**
 * Compute the gate state from a baseline snapshot. Returns `open` only when
 * BOTH lanes are met. Pure / synchronous / no IO — safe to call on the hot path.
 */
export function gateState(baseline: EvalBaseline): GateState {
  const bird = laneStatus(baseline.bird_accuracy, baseline.bird_target);
  const spider = laneStatus(baseline.spider_accuracy, baseline.spider_target);
  const open = bird.status === "met" && spider.status === "met";
  return {
    kind: open ? "open" : "closed",
    bird,
    spider,
    measured_at: baseline.measured_at,
  };
}
