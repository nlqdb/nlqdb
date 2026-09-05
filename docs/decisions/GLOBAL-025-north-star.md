# GLOBAL-025 — North-star: engine quality, onboarding, UX, performance

- **Decision:** nlqdb has **four** permanent product north-stars and
  **every shipped feature must measurably advance at least one of them
  AND must not degrade any of the others**:

  1. **Engine quality** — **the autonomous DBA**
     ([`GLOBAL-041`](./GLOBAL-041-autonomous-dba.md)): schema inference +
     evolution + optimizer. Measured by the three `GLOBAL-041` KPIs —
     **first-insert inference rate**, **evolution-without-user-action
     rate**, **optimizer yield** — whose definitions and floors live only in
     that file (owners: [`schema-widening`](../features/schema-widening/FEATURE.md),
     [`engine-migration`](../features/engine-migration/FEATURE.md)).
     NL→SQL is the *interface* layer of the same pillar: an app whose data
     was never modeled by hand addresses it through `/v1/ask`, so a wrong
     answer fails the user the same way a failed insert does. Its accuracy
     ([`quality-eval`](../features/quality-eval/FEATURE.md), BIRD-dev +
     Spider 2.0-lite) is a **regression alarm, not a KPI**.
  2. **Seamless onboarding** — a stranger reaches first answer in
     ≤ 60 s with no config. Measured by TTFV p50/p95, first-10-queries
     success rate, and the unguided user-test pass rate.
  3. **Seamless UX** — once on-ramp lands, every subsequent
     interaction stays trustworthy and recoverable. Measured by
     destructive-op retry rate
     ([`trust-ux`](../features/trust-ux/FEATURE.md)),
     recoverable-failure recovery rate
     ([`GLOBAL-022`](./GLOBAL-022-recoverable-failures-retry-to-success.md)),
     and the Sean-Ellis "very disappointed" share
     ([`founder-playbook.md` §2](../founder-playbook.md)).
  4. **Performance** — every interaction is fast enough that latency
     doesn't dominate the experience. Measured by p50/p95 `/v1/ask`
     latency (cache hit / cache miss), cold-start latency, and CLI
     start time. Per-stage budgets and the span/metric catalog live
     in [`docs/performance.md`](../performance.md).

  Concrete floors live in §**KPI table** below. The "must not degrade"
  half of the rule is binary — no per-PR drift allowance. Weekly KPI
  snapshots are the canonical truth; sustained week-over-week degradation
  is investigated and reverted.

- **Core value:** Bullet-proof, Honest latency, Free, Tax-free integration
- **Why:** With a strict-$0 budget, multi-surface scope, and a
  pre-PMF posture, a multi-surface team drifts into shipping what's
  easy rather than what wins. The four north-stars name the four
  orthogonal failure modes ("we built a thing nobody trusts" / "they
  never reached it" / "the second click broke them" / "every click
  is slow enough that nothing else matters") and force every PR to
  declare which one it moves — and to prove it didn't break the
  others. The LLM bet is asymmetric: **make it great on free LLMs and the
  gap to competitors widens — not narrows — when frontier models drop in
  price or capability**, because the scaffolding (planner, validator,
  plan-cache, schema retrieval, trust UX) compounds with whatever model is
  underneath. See
  [`GLOBAL-026`](./GLOBAL-026-llm-strategy-byollm-hosted-premium.md)
  for the LLM strategy this compass implies.
- **Consequence in code & docs:**
  - Every PR body names the pillar it advances and confirms none degrades
    (`CLAUDE.md` §8).
  - The KPI table below is the **single source of truth** for the
    onboarding / UX / performance floors; the engine floors are
    `GLOBAL-041`'s. Instruments live in
    [`onboarding/FEATURE.md`](../features/onboarding/FEATURE.md),
    [`trust-ux/FEATURE.md`](../features/trust-ux/FEATURE.md),
    [`docs/performance.md`](../performance.md).
  - Phase exit gates in [`phase-plan.md`](../phase-plan.md) are the
    `GLOBAL-041` phase gates: Phase 2 exits on Phase A alone; Phase 3 exits
    on Phase B plus the floors below.
  - `/weekly` reads the KPI table; regression on any KPI by its `alert`
    delta is that week's worst finding; sustained degradation on any pillar
    triggers a revert of the slice that caused it, regardless of which
    pillar the slice was advancing.
- **Alternatives rejected:**
  - **Single NSM** (e.g. "weekly answered questions") — too reductive.
    Engine / onboarding / UX fail independently; one number hides
    which one is regressing.
  - **No NSM** (the prior state) — drift risk under strict-$0 + multi-
    surface scope.
  - **Growth-style NSM** (DAU, conversion %) — premature pre-PMF;
    biases work toward distribution before quality is provable.
    *Amended in part by
    [`GLOBAL-038`](./GLOBAL-038-gtm-pmf-instrumentation.md): acquisition
    metrics are measured continuously on a canonical live instrument; the
    four pillars above remain the product compass, and `GLOBAL-041` sets
    the operating focus.*
  - **OKRs instead of KPIs** — quarterly noise; KPIs with a measurement
    instrument are tighter and lighter.
  - **A `## Contribution to north-star` section in every FEATURE.md** —
    mandated 2026-05, adopted by 6 of 43 features; the PR body already
    carries the claim, so the section only duplicated it.

## KPI table — the unambiguous bar

Columns: **Current** — the latest measured value, or `unmeasured` (the owning
FEATURE.md ships the instrument; no dated deadline). **Floor** — the value
below which the named phase does not roll over
([`phase-plan.md`](../phase-plan.md)). **Alert** — the week-over-week delta
that makes a KPI `/weekly`'s worst finding. **Owner** — the FEATURE.md that
owns the measurement.

### Engine quality — the autonomous DBA (`GLOBAL-041`)

Definitions and floors are canonical in `GLOBAL-041`; this table only
routes.

| KPI | Current | Floor | Alert | Owner |
|---|---|---|---|---|
| **1. First-insert inference rate** | unmeasured — instrument = the Phase A dogfood workload (`/daily` writes through `@nlqdb/sdk`; first 200 unseen-field inserts in a 14-day window) | ≥ 95 % at Phase A exit (= Phase 2 exit) · ≥ 99 % at Phase B exit | any miss on the dogfood workload is inspected the same run | `schema-widening` |
| **2. Evolution-without-user-action rate** | unmeasured — Phase B instrument | ≥ 90 % at Phase B exit | −5 pp wk/wk | `schema-widening` |
| **3. Optimizer yield** | unmeasured — Phase B instrument | ≥ 1 applied / active DB / month; median p95 improvement ≥ 20 %; 0 un-undone regressions > 10 % | any un-undone regression | `engine-migration` |
| Cross-engine dual-read equivalence | unmeasured — Phase C | 100 % | any divergence | `engine-migration` |
| **BIRD-dev / Spider 2.0-lite accuracy** | last green run in `tools/eval/baseline-*.json` | **regression alarm only, not a KPI** — CI fails on > 5 pp drop vs last green on the fixed sample (`SK-QUAL-002`); no floor, no phase gate | a red alarm is a bug | `quality-eval` |

### Onboarding

| KPI | Current | Floor (Phase 3 exit = `GLOBAL-041` Phase B) | Alert | Owner |
|---|---|---|---|---|
| TTFV — median seconds, landing → first answer | unmeasured (stranger N = 0) | ≤ 60 s | +10 s wk/wk | `onboarding` |
| TTFV — p95 seconds, landing → first answer | unmeasured | ≤ 120 s | +20 s wk/wk | `onboarding` |
| First-10-queries success rate (share of a new user/DB's first 10 `/v1/ask` calls answered — 2xx, non-refused) | instrument live (`SK-ONBOARD-006`); stranger N = 0 | ≥ 95 % | −5 pts wk/wk | `onboarding` |
| Unguided user-test pass rate (strangers completing the 60 s flow) | unmeasured | 5/5 | regression blocks rollover | `onboarding` |
| Drop-off rate landing → first query | unmeasured | ≤ 15 % | +5 pts wk/wk | `onboarding` |

### UX

| KPI | Current | Floor (Phase 3 exit) | Alert | Owner |
|---|---|---|---|---|
| Destructive-op retry rate | unmeasured | ≤ 5 % | regression blocks rollover | `trust-ux` |
| Sean-Ellis "very disappointed" share | unmeasured (survey live, `SK-GTM-006`) | ≥ 40 % (PMF) | regression blocks rollover | `founder-playbook` |
| Session retention (% of users running ≥ 2 queries per session) | unmeasured | ≥ 75 % | −5 pts wk/wk | `web-app` |
| Recoverable-failure recovery rate (`GLOBAL-022`) | unmeasured | ≥ 99 % | regression alerts | `observability` |

### Performance

Per-stage budgets and the span/metric catalog live in
[`docs/performance.md`](../performance.md); the floors below are the
headline user-visible numbers from `architecture.md §0`.

| KPI | Current | Floor (Phase 3 exit) | Alert | Owner |
|---|---|---|---|---|
| p50 `/v1/ask` latency — cache hit | 16.4 ms wall-time p50, all routes (2026-07-27) | ≤ 250 ms | +50 ms wk/wk | `performance.md` |
| p95 `/v1/ask` latency — cache miss | 1.48 s wall-time p95, all routes (2026-07-27) | ≤ 1.0 s | +200 ms wk/wk | `performance.md` |
| Cold-start latency (warm Worker p99) | unmeasured | ≤ 500 ms | +100 ms wk/wk | `performance.md` |
| CLI start time (`nlq` no-op) | 5 ms (`SK-CLI-001`) | ≤ 20 ms | regression alerts | `cli` |
| Error rate (5xx, rolling 1 h, per route) | per `performance.md §1` | < 0.1 % | any breach pages | `performance.md` |

## How measurement is operationalized

- **Engine KPI 1** reads the two `/v1/ask` write-path counters over the
  dogfood workload (`GLOBAL-041`). **Onboarding and UX KPIs** come from the
  event pipeline (`packages/events`,
  [`GLOBAL-024`](./GLOBAL-024-demand-signal-telemetry.md)) plus the
  `nlqdb.surface` label; first-10-queries reads the D1 `first10_*` counters
  (`SK-ONBOARD-006`). Sean-Ellis is captured in-product (`SK-GTM-006`) and
  read on `/app/admin`. **Performance** reads the OTel catalog in
  `docs/performance.md`.
- **Where the numbers surface:** `docs/scorecard.md` (regenerated by
  `/daily`) and `/app/admin` (`GLOBAL-038`).
- **What floors do.** Phase rollover does not happen until the floor is
  met. A floor miss is not a bug — it is the signal that the next slice is
  engine / onboarding / UX work, not a new surface.

## Mapping to existing decisions

This GLOBAL is a compass, not a contradiction. It *names* what the
following decisions already implied:
[`GLOBAL-011`](./GLOBAL-011-honest-latency.md) (honest latency → UX input) ·
[`GLOBAL-012`](./GLOBAL-012-one-sentence-errors.md) (one-sentence errors →
retry rate) · [`GLOBAL-020`](./GLOBAL-020-zero-config-first-60s.md)
(zero-config → the onboarding mechanism) ·
[`GLOBAL-022`](./GLOBAL-022-recoverable-failures-retry-to-success.md)
(recovery rate → UX KPI) ·
[`GLOBAL-023`](./GLOBAL-023-trust-ux-baseline.md) (trust UX → the UX
mechanism) · [`GLOBAL-024`](./GLOBAL-024-demand-signal-telemetry.md) (the
instrument) ·
[`GLOBAL-026`](./GLOBAL-026-llm-strategy-byollm-hosted-premium.md) (LLM
strategy for the interface layer) ·
[`GLOBAL-041`](./GLOBAL-041-autonomous-dba.md) (the engine pillar's KPIs,
phases and operating focus).
