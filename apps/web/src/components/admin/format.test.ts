// Pure-logic tests for the admin dashboard derivations (the repo's
// extracted-module convention — no DOM, plain bun test).

import { describe, expect, test } from "bun:test";
import type { GtmMetrics } from "../../lib/admin";
import { fillDays, fmtDateTime, fmtPct, funnelStages, sparkPoints, trendSeries } from "./format";

function metrics(overrides: Partial<GtmMetrics> = {}): GtmMetrics {
  return {
    generatedAt: "2026-07-19T12:00:00.000Z",
    users: {
      total: 9,
      strangers: 2,
      internal: 7,
      newestSignupAt: "2026-07-18T00:00:00.000Z",
      newestStrangerSignupAt: "2026-07-18T00:00:00.000Z",
      signupsByDay: [],
    },
    funnel: {
      anonDbsTotal: 10,
      dbsTotal: 12,
      dbsCreated7d: 3,
      adoptionsTotal: 4,
      adoptions7d: 1,
      adoptionRate: 0.4,
    },
    activation: {
      dbsStarted: 5,
      dbsActivated: 4,
      dbsWithSecondAsk: 2,
      first10SuccessRate: 0.882,
      strangersWithDb: 2,
      activatedStrangers: 1,
    },
    retention: {
      dbsActive7d: 3,
      dbsActive30d: 6,
      strangersActive7d: 1,
      strangersRetained7d: 1,
    },
    pmf: {
      premiumInterest: 1,
      payingCustomers: 0,
      customersByStatus: {},
      seanEllis: { runnable: false, activatedStrangers: 1, minActivated: 10 },
    },
    trend: [],
    ...overrides,
  };
}

describe("fmtPct", () => {
  test("formats a ratio and dashes a null (no fake 0%)", () => {
    expect(fmtPct(0.882)).toBe("88.2%");
    expect(fmtPct(0)).toBe("0.0%");
    expect(fmtPct(null)).toBe("—");
    expect(fmtPct(undefined)).toBe("—");
  });
});

describe("fmtDateTime", () => {
  test("renders a stable UTC minute and dashes bad input", () => {
    expect(fmtDateTime("2026-07-19T12:34:56.000Z")).toBe("2026-07-19 12:34Z");
    expect(fmtDateTime(null)).toBe("—");
    expect(fmtDateTime("not-a-date")).toBe("—");
  });
});

describe("fillDays", () => {
  test("fills calendar gaps with zero-days over the window", () => {
    const out = fillDays([{ day: "2026-07-18", total: 2, strangers: 1 }], 3, "2026-07-19");
    expect(out).toEqual([
      { day: "2026-07-17", total: 0, strangers: 0 },
      { day: "2026-07-18", total: 2, strangers: 1 },
      { day: "2026-07-19", total: 0, strangers: 0 },
    ]);
  });

  test("crosses month boundaries correctly", () => {
    const out = fillDays([], 2, "2026-07-01");
    expect(out.map((d) => d.day)).toEqual(["2026-06-30", "2026-07-01"]);
  });
});

describe("funnelStages", () => {
  test("orders the narrative and labels the unit per stage", () => {
    const stages = funnelStages(metrics());
    expect(stages.map((s) => s.value)).toEqual([10, 4, 2, 2, 1, 1]);
    expect(stages[0]?.unit).toBe("DBs");
    expect(stages[2]?.unit).toBe("users");
  });
});

describe("trendSeries", () => {
  test("sorts oldest→newest and zero-fills non-numeric values", () => {
    const trend = [
      { day: "2026-07-19", strangers: 3 },
      { day: "2026-07-17", strangers: 1 },
      { day: "2026-07-18" },
    ] as GtmMetrics["trend"];
    expect(trendSeries(trend, "strangers")).toEqual([1, 0, 3]);
  });
});

describe("sparkPoints", () => {
  test("maps values into the padded viewbox, max on top, zero on the floor", () => {
    const points = sparkPoints([0, 10], 120, 32);
    const [p0, p1] = points.split(" ");
    expect(p0).toBe("2.0,30.0");
    expect(p1).toBe("118.0,2.0");
  });

  test("returns empty for no data and centers a single point", () => {
    expect(sparkPoints([], 120, 32)).toBe("");
    expect(sparkPoints([5], 120, 32)).toBe("60.0,2.0");
  });
});
