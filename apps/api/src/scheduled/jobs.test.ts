// SK-HDC-023 — job selection off the scheduled minute + per-job isolation.

import { describe, expect, it, vi } from "vitest";
import { at, dueJobs, JOBS, type Job, runDueJobs, weekdaysBetween, weeklyAt } from "./jobs.ts";

// 2026-09-07 is a Monday.
const utc = (day: number, hh: number, mm: number) => Date.UTC(2026, 8, day, hh, mm);
const MON = 7;
const TUE = 8;
const FRI = 11;
const SAT = 12;
const SUN = 13;

const due = (t: number) => dueJobs(JOBS, t).map((j) => j.name);

describe("time predicates", () => {
  it("at() matches the exact UTC minute only", () => {
    expect(at(4)(new Date(utc(MON, 4, 0)))).toBe(true);
    expect(at(4)(new Date(utc(MON, 4, 4)))).toBe(false);
    expect(at(4, 4)(new Date(utc(MON, 4, 4)))).toBe(true);
  });
  it("weeklyAt() uses getUTCDay (0 = Sun)", () => {
    expect(weeklyAt(1, 6)(new Date(utc(MON, 6, 0)))).toBe(true);
    expect(weeklyAt(1, 6)(new Date(utc(SUN, 6, 0)))).toBe(false);
  });
  it("weekdaysBetween() is hour-inclusive, Mon-Fri", () => {
    const w = weekdaysBetween(13, 21);
    expect(w(new Date(utc(MON, 13, 0)))).toBe(true);
    expect(w(new Date(utc(FRI, 21, 56)))).toBe(true);
    expect(w(new Date(utc(MON, 12, 56)))).toBe(false);
    expect(w(new Date(utc(FRI, 22, 0)))).toBe(false);
    expect(w(new Date(utc(SAT, 13, 0)))).toBe(false);
  });
});

describe("JOBS selection by scheduledTime", () => {
  const DAILY = ["anon_db_sweep", "gtm_snapshot", "premium_meter_reconcile", "workload_analyser"];

  it("04:00 weekday → the four daily jobs, in order, no keep-warm", () => {
    expect(due(utc(TUE, 4, 0))).toEqual(DAILY);
  });
  it("04:00 Sunday → the four daily jobs", () => {
    expect(due(utc(SUN, 4, 0))).toEqual(DAILY);
  });
  it("13:00 Mon → keep-warm only", () => {
    expect(due(utc(MON, 13, 0))).toEqual(["neon_keep_warm"]);
  });
  it("12:56 Mon → nothing (window not open)", () => {
    expect(due(utc(MON, 12, 56))).toEqual([]);
  });
  it("21:56 Fri → keep-warm (last tick of the window)", () => {
    expect(due(utc(FRI, 21, 56))).toEqual(["neon_keep_warm"]);
  });
  it("22:00 Fri → nothing (window closed)", () => {
    expect(due(utc(FRI, 22, 0))).toEqual([]);
  });
  it("13:00 Sat → nothing (weekend)", () => {
    expect(due(utc(SAT, 13, 0))).toEqual([]);
  });
  it("Mon 06:00 → ICP pipeline only", () => {
    expect(due(utc(MON, 6, 0))).toEqual(["icp_pipeline"]);
  });
  it("Tue 06:00 → nothing", () => {
    expect(due(utc(TUE, 6, 0))).toEqual([]);
  });
});

describe("runDueJobs", () => {
  it("runs due jobs in order and isolates a failure", async () => {
    const ran: string[] = [];
    const jobs: Job[] = [
      { name: "a", when: () => true, run: async () => void ran.push("a") },
      {
        name: "boom",
        when: () => true,
        run: async () => {
          throw new Error("nope");
        },
      },
      { name: "skipped", when: () => false, run: async () => void ran.push("skipped") },
      { name: "c", when: () => true, run: async () => void ran.push("c") },
    ];
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await runDueJobs(jobs, utc(MON, 4, 0), {} as Cloudflare.Env);
    expect(ran).toEqual(["a", "c"]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(error.mock.calls[0]?.[0] as string)).toEqual({
      msg: "scheduled_job_failed",
      job: "boom",
      message: "nope",
    });
    error.mockRestore();
  });
});
