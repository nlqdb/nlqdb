import { describe, expect, it } from "bun:test";
import { _testing, mcnemarRegression, type PairedOutcome } from "../src/significance.ts";

function pair(baseline: boolean, current: boolean): PairedOutcome {
  return { baseline, current };
}

describe("mcnemarRegression", () => {
  it("returns p=1 when the two runs agree on every question", () => {
    const out = mcnemarRegression([pair(true, true), pair(false, false), pair(true, true)]);
    expect(out.b).toBe(0);
    expect(out.c).toBe(0);
    expect(out.pValue).toBe(1);
  });

  it("uses exact binomial when discordant pairs < 25", () => {
    // 5 regressions, 0 improvements — strongly significant.
    const outcomes: PairedOutcome[] = [];
    for (let i = 0; i < 5; i++) outcomes.push(pair(true, false));
    const out = mcnemarRegression(outcomes);
    expect(out.method).toBe("exact-binomial");
    expect(out.b).toBe(5);
    expect(out.c).toBe(0);
    // P(X >= 5 | Binomial(5, 0.5)) = 1/32 = 0.03125.
    expect(out.pValue).toBeCloseTo(0.03125, 5);
  });

  it("never returns p < 0.05 when discordant counts are balanced", () => {
    const outcomes: PairedOutcome[] = [];
    for (let i = 0; i < 10; i++) outcomes.push(pair(true, false));
    for (let i = 0; i < 10; i++) outcomes.push(pair(false, true));
    const out = mcnemarRegression(outcomes);
    // Balanced — no regression direction. p > 0.5.
    expect(out.pValue).toBeGreaterThan(0.5);
  });

  it("switches to edwards-chi2 when discordant pairs >= 25", () => {
    const outcomes: PairedOutcome[] = [];
    // 18 regressions, 12 improvements — n=30, modestly significant.
    for (let i = 0; i < 18; i++) outcomes.push(pair(true, false));
    for (let i = 0; i < 12; i++) outcomes.push(pair(false, true));
    const out = mcnemarRegression(outcomes);
    expect(out.method).toBe("edwards-chi2");
    expect(out.b).toBe(18);
    expect(out.c).toBe(12);
    // Hand-calc: chi^2 = (|18-12|-1)^2/30 = 25/30 ≈ 0.833.
    // sqrt(0.833) ≈ 0.913, Φ(0.913) ≈ 0.8194, so p ≈ 0.18.
    expect(out.pValue).toBeGreaterThan(0.15);
    expect(out.pValue).toBeLessThan(0.22);
  });

  it("returns p > 0.5 when improvements dominate regressions (only flags regression direction)", () => {
    const outcomes: PairedOutcome[] = [];
    for (let i = 0; i < 5; i++) outcomes.push(pair(true, false)); // regressions
    for (let i = 0; i < 25; i++) outcomes.push(pair(false, true)); // improvements
    const out = mcnemarRegression(outcomes);
    expect(out.pValue).toBe(1);
  });

  it("flags a strong regression at p < 0.05 with 30+ pairs all in regression direction", () => {
    const outcomes: PairedOutcome[] = [];
    for (let i = 0; i < 30; i++) outcomes.push(pair(true, false));
    const out = mcnemarRegression(outcomes);
    expect(out.pValue).toBeLessThan(0.0001);
  });
});

describe("standardNormalCdf (sanity check on the A&S 26.2.17 approximation)", () => {
  it("returns 0.5 at z=0", () => {
    expect(_testing.standardNormalCdf(0)).toBeCloseTo(0.5, 6);
  });

  it("returns ~0.84 at z=1, ~0.975 at z=1.96, ~0.999 at z=3", () => {
    expect(_testing.standardNormalCdf(1)).toBeCloseTo(0.8413, 3);
    expect(_testing.standardNormalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(_testing.standardNormalCdf(3)).toBeCloseTo(0.9987, 3);
  });

  it("is symmetric about 0", () => {
    expect(_testing.standardNormalCdf(-1) + _testing.standardNormalCdf(1)).toBeCloseTo(1, 6);
  });
});
