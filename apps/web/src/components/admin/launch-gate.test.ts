// Pure-logic tests for the SK-GTM-008 launch-gate composition (the
// repo's extracted-module convention — no DOM, plain bun test). The
// assertions that matter are honesty ones: an unmeasurable criterion
// must never render a number, and a static one must always name its
// as-of date.

import { describe, expect, test } from "bun:test";
import type { GtmMetrics } from "../../lib/admin";
import { GATE_STATIC, gateGreenCount, launchGateCriteria } from "./launch-gate";

function gate(overrides: Partial<GtmMetrics["launchGate"]> = {}): GtmMetrics {
  return {
    launchGate: {
      memoryPresetEnabled: false,
      memoryDbs: 0,
      memoryDbsInternal: 0,
      memoryFirst10Asks: 0,
      memoryFirst10Ok: 0,
      memoryAsksMcp: 0,
      memoryAsksTotal: 0,
      memoryFirst10SuccessRate: null,
      memoryLastQueriedAt: null,
      ...overrides,
    },
  } as GtmMetrics;
}

describe("launchGateCriteria", () => {
  test("renders the five SK-PIVOT-016 criteria, none green before the workload runs", () => {
    const criteria = launchGateCriteria(gate());
    expect(criteria.map((c) => c.n)).toEqual([1, 2, 3, 4, 5]);
    expect(gateGreenCount(criteria)).toBe(0);
  });

  test("criterion 1 shows an honest zero with the MEMORY_PRESET reason, not a placeholder", () => {
    const dark = launchGateCriteria(gate())[0];
    expect(dark?.value).toBe("0 / 100");
    expect(dark?.measurement).toBe("live");
    expect(dark?.detail).toContain("MEMORY_PRESET` is off");

    const on = launchGateCriteria(gate({ memoryPresetEnabled: true }))[0];
    expect(on?.value).toBe("0 / 100");
    expect(on?.detail).toContain("MEMORY_PRESET` is on");
  });

  test("criterion 1 counts real public-MCP asks once a memory DB exists", () => {
    const c = launchGateCriteria(gate({ memoryDbs: 2, memoryAsksMcp: 37, memoryAsksTotal: 52 }))[0];
    expect(c?.value).toBe("37 / 100");
    expect(c?.state).toBe("in-progress");
    expect(c?.measurement).toBe("live");
    expect(c?.detail).toContain("asks_mcp");
    // The old saturated rendering ("≥ N / 100 (lower bound)") is gone.
    expect(c?.value).not.toContain("(lower bound)");
    expect(c?.value).not.toContain("≥");
  });

  test("criterion 1 goes green when public-MCP asks reach the target", () => {
    const c = launchGateCriteria(
      gate({ memoryDbs: 2, memoryAsksMcp: 100, memoryAsksTotal: 140 }),
    )[0];
    expect(c?.value).toBe("100 / 100");
    expect(c?.state).toBe("green");
  });

  test("criterion 2 says not-measurable at N = 0 and goes live from the counters", () => {
    const zero = launchGateCriteria(gate())[1];
    expect(zero?.value).toBe("N = 0 — workload not started");
    expect(zero?.state).toBe("not-started");

    const partial = launchGateCriteria(
      gate({
        memoryDbs: 1,
        memoryFirst10Asks: 10,
        memoryFirst10Ok: 9,
        memoryFirst10SuccessRate: 0.9,
      }),
    )[1];
    expect(partial?.value).toBe("90.0%");
    expect(partial?.state).toBe("in-progress");
    expect(partial?.measurement).toBe("live");

    const green = launchGateCriteria(
      gate({
        memoryDbs: 1,
        memoryFirst10Asks: 20,
        memoryFirst10Ok: 19,
        memoryFirst10SuccessRate: 0.95,
      }),
    )[1];
    expect(green?.state).toBe("green");
  });

  test("every static criterion names an as-of date or its owning slice", () => {
    for (const c of launchGateCriteria(gate()).filter((x) => x.measurement === "static")) {
      expect(`${c.value} ${c.detail}`).toMatch(/20\d\d-\d\d-\d\d|slice D-\d\d/);
    }
  });

  test("criterion 4 renders the last known temporal value, labeled static", () => {
    const c = launchGateCriteria(gate())[3];
    expect(c?.value).toBe(
      `${GATE_STATIC.temporal.pass} / ${GATE_STATIC.temporal.total} (synthetic + ops corpus)`,
    );
    expect(c?.measurement).toBe("static");
    expect(c?.detail).toContain(GATE_STATIC.temporal.asOf);
  });

  test("criterion 5 is the unshipped D-06 dashboard, not this founder view", () => {
    const c = launchGateCriteria(gate())[4];
    expect(c?.value).toBe("unshipped");
    expect(c?.detail).toContain("D-06");
    expect(c?.detail).toContain("NOT that dashboard");
  });
});
