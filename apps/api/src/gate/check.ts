// `SK-GATE-002` — open iff both lanes meet target. Null counts as
// "not met". The closed branch carries every field the surface needs
// to render the progress UI without a second call (`SK-GATE-005`).

import type { EvalBaseline } from "./eval-baseline.ts";

export type LaneStatus = {
  accuracy: number | null;
  target: number;
  status: "met" | "below" | "unmeasured";
};

export type GateState =
  | { kind: "open"; bird: LaneStatus; spider: LaneStatus; measured_at: string }
  | { kind: "closed"; bird: LaneStatus; spider: LaneStatus; measured_at: string };

function laneStatus(accuracy: number | null, target: number): LaneStatus {
  if (accuracy === null) return { accuracy, target, status: "unmeasured" };
  return { accuracy, target, status: accuracy >= target ? "met" : "below" };
}

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
