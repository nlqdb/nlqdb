# SK-QUAL-006 — McNemar's paired-binary test as a parallel regression trigger

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Parent decision:
[`SK-QUAL-002`](../FEATURE.md#sk-qual-002) (eval runs on demand and
emits `feature.eval.regression` on alert).

- **Decision:** Per-lane regression alerting fires on **two parallel
  triggers**: (1) the `SK-QUAL-002` 5-pp threshold on EA delta, and
  (2) **McNemar's exact-binomial test** (or Edwards' continuity-
  corrected χ² when discordant pairs ≥ 25) on the per-question paired
  outcomes, with α = 0.05 on the one-sided regression direction. Both
  triggers fire independently; each emits its own
  `feature.eval.regression` event so the on-call sees which signal
  fired. Concordant pairs (questions both runs agree on) are not used
  by McNemar, which is the correct test for "did this slice get worse
  on a non-trivial set of questions we used to get right?".
- **Core value:** Bullet-proof, Honest latency
- **Why:** At N≈500 the binomial standard error on raw EA is ~2.2 pp;
  a 5-pp drop can fire on noise (only ~2σ above zero), while a real
  3-pp drop that the threshold *would* miss is detectable via the
  paired test when most of the swing comes from previously-passing
  questions. The two triggers are complementary: threshold catches
  large-but-noisy drops the operator needs to see; McNemar catches
  small-but-real drops the operator would otherwise dismiss. 2026
  LLM-eval best practice (per VLDB / CIDR 2026 corpus and
  `arxiv.org/html/2601.02957`) recommends paired-difference tests over
  point-in-time thresholds for benchmarks below N ≈ 1,000.
- **Consequence in code:** `tools/eval/src/significance.ts` implements
  both branches (exact-binomial for n < 25 discordant pairs, Edwards
  χ² + Abramowitz & Stegun 26.2.17 Φ-approximation otherwise).
  `tools/eval/src/baseline.ts::compareToBaseline` joins the current
  run to the baseline by `question_id`, builds the paired-outcome
  list per lane, and emits one regression record per fired trigger.
  `apps/api/src/events-feature.ts::recordEvalReport` reads
  `report.baseline.lanes[*].regressions` and fans out one
  `feature.eval.regression` event per `(lane, trigger)`. No external
  statistics dependency — `Math.exp` / `Math.log` / `Math.SQRT2` is
  enough.
- **Alternatives rejected:**
  - **Threshold-only** — fragile at N=500; fires on noise above 2σ.
  - **McNemar-only** — operator's eye-test on a chart still sees a
    7-pp drop the test might miss in low-power cases; threshold +
    McNemar covers both failure modes.
  - **Bootstrap CI on EA delta** — same-population assumption is
    awkward when both runs hit the same question set; McNemar's
    paired form is statistically tighter.
  - **CUSUM / EWMA changepoint detection** (per
    `arxiv.org/html/2601.02957`) — overkill at this cadence;
    deferred until we have 12+ runs to fit a baseline
    distribution.
