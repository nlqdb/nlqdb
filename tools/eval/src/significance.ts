// McNemar's paired-binary test (SK-QUAL-006). Slice-2 regression detection.
// At N=500, the binomial SE on accuracy is ~2.2 pp, so the 5-pp WoW threshold
// in SK-QUAL-002 can fire on noise. McNemar runs on the per-question paired
// outcome (baseline match vs current match), which factors out questions that
// are stable across the two runs and tests only the discordant pairs — the
// right test for "did this slice make us worse on a non-trivial number of
// questions that we used to get right?".
//
// We implement the exact binomial form (recommended when discordant pairs
// b+c < 25) and Edwards' continuity-corrected chi-squared for large samples.
// No external dependency — `Math.pow / Math.exp / Math.log` is enough.

export type McNemarOutcome = {
  // Discordant pair counts. b = baseline correct, current wrong (regression).
  // c = baseline wrong, current correct (improvement). Concordant pairs
  // (both right or both wrong) are not used by McNemar.
  b: number;
  c: number;
  // One-sided p-value: P(regression observed under H0 of no difference).
  // We test the one-sided direction "current is worse than baseline" so
  // the alert only fires on regression, not on improvement.
  pValue: number;
  // Which branch of the formula fired — useful for debugging boundary cases.
  method: "exact-binomial" | "edwards-chi2";
};

// Cutoff per the standard McNemar recommendation. Below 25 discordant pairs,
// the chi-squared approximation can over-reject; the exact binomial is the
// safe call.
const EXACT_BINOMIAL_CUTOFF = 25;

export type PairedOutcome = {
  baseline: boolean;
  current: boolean;
};

// One-sided regression test. `outcomes` is the list of per-question paired
// match/mismatch flags across the two runs. Returns the p-value plus the
// raw counts so the caller can show "n questions went from right to wrong"
// in the alert body.
export function mcnemarRegression(outcomes: PairedOutcome[]): McNemarOutcome {
  let b = 0; // baseline right, current wrong (regression direction)
  let c = 0; // baseline wrong, current right (improvement direction)
  for (const o of outcomes) {
    if (o.baseline && !o.current) b += 1;
    else if (!o.baseline && o.current) c += 1;
  }
  const n = b + c;
  if (n === 0) {
    // No discordant pairs — the two runs agree on every question. p=1 by definition.
    return { b, c, pValue: 1, method: "exact-binomial" };
  }
  if (n < EXACT_BINOMIAL_CUTOFF) {
    return { b, c, pValue: exactBinomialOneSided(b, n), method: "exact-binomial" };
  }
  return { b, c, pValue: edwardsChi2OneSided(b, c), method: "edwards-chi2" };
}

// One-sided exact binomial: P(X >= b | X ~ Binomial(n, 0.5)).
// Sums tail probabilities directly. n is small (< EXACT_BINOMIAL_CUTOFF) so
// log-space isn't needed.
function exactBinomialOneSided(b: number, n: number): number {
  let sum = 0;
  for (let k = b; k <= n; k++) {
    sum += binomialPmf(n, k, 0.5);
  }
  // Clamp because tail summation can drift past 1.0 on extreme inputs.
  return Math.min(1, sum);
}

function binomialPmf(n: number, k: number, p: number): number {
  return binomialCoeff(n, k) * p ** k * (1 - p) ** (n - k);
}

function binomialCoeff(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < kk; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

// Edwards' continuity-corrected chi-squared: χ² = (|b - c| - 1)² / (b + c).
// We convert to a one-sided p-value via the survival function of χ²₁ — but
// only if b > c (regression direction). When c >= b the data is on the
// improvement side, so the regression p-value is by definition > 0.5.
function edwardsChi2OneSided(b: number, c: number): number {
  if (b <= c) return 1;
  const diff = Math.abs(b - c);
  const chi2 = (diff - 1) ** 2 / (b + c);
  // χ²₁ is the square of a standard normal, so P(χ²₁ ≥ x) = 2 · (1 − Φ(√x)).
  // One-sided regression p-value = P(χ²₁ ≥ x) / 2 = 1 − Φ(√x).
  return 1 - standardNormalCdf(Math.sqrt(chi2));
}

// Abramowitz & Stegun 26.2.17 — closed-form Φ approximation with max abs
// error 7.5e-8. Plenty for the p<0.05 threshold; avoids a stats dependency.
function standardNormalCdf(x: number): number {
  if (x < 0) return 1 - standardNormalCdf(-x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * (x / Math.SQRT2));
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp((-x * x) / 2);
  return 0.5 * (1 + y);
}

export const _testing = { exactBinomialOneSided, edwardsChi2OneSided, standardNormalCdf };
