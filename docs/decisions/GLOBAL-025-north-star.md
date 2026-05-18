# GLOBAL-025 — North-star: engine quality, onboarding, UX

- **Decision:** nlqdb has three permanent product north-stars and **every
  shipped feature must measurably advance at least one of them**:

  1. **Engine quality** — **two layers, one pillar.**
     - **NL→SQL accuracy engine** — measured by
       [`quality-eval`](../features/quality-eval/FEATURE.md) on BIRD-dev
       and Spider 2.0-lite plus an internal eval over `db.create`
       schemas. Reported per
       [`llm-router`](../features/llm-router/FEATURE.md) tier and
       **separately on the free-tier chain vs frontier models** (the
       "free-vs-frontier delta") so we can see scaffolding compounding.
     - **Data engine** — multi-engine adapter + workload analyzer +
       migration orchestrator
       ([`db-adapter`](../features/db-adapter/FEATURE.md),
       [`multi-engine-adapter`](../features/multi-engine-adapter/FEATURE.md),
       [`engine-migration`](../features/engine-migration/FEATURE.md)).
       Measured by automatic-migration success rate (Phase 3 exit gate),
       cross-engine read-result equivalence (dual-read verification),
       and engine-classify accuracy.
     **Both layers fail in the same way to the user** — "the answer
     came back wrong" — so they share the pillar even though the
     subsystems are different. KPIs for both live in the table below.
  2. **Seamless onboarding** — a stranger reaches first answer in
     ≤ 60 s with no config. Measured by TTFV p50/p95, first-query
     success rate, and the unguided user-test pass-rate already in
     [`phase-plan.md` §2 exit gate](../phase-plan.md).
  3. **Seamless UX** — once on-ramp lands, every subsequent
     interaction stays trustworthy and recoverable. Measured by
     destructive-op retry rate
     ([`trust-ux`](../features/trust-ux/FEATURE.md)),
     recoverable-failure recovery rate
     ([`GLOBAL-022`](./GLOBAL-022-recoverable-failures-retry-to-success.md)),
     and the Sean-Ellis "very disappointed" share
     ([`founder-playbook.md` §2](../founder-playbook.md)).

  Concrete KPI targets and review cadence live in §**KPI table** below.

- **Core value:** Bullet-proof, Honest latency, Free, Tax-free integration
- **Why:** With a strict-$0 budget, multi-surface scope, and a
  pre-PMF posture, a multi-surface team drifts into shipping what's
  easy rather than what wins. The three north-stars name the three
  orthogonal failure modes ("we built a thing nobody trusts" / "they
  never reached it" / "the second click broke them") and force every
  PR to declare which one it moves. The bet is asymmetric: **make it
  great on free LLMs and the gap to competitors widens — not narrows —
  when frontier models drop in price or capability**, because our
  scaffolding (planner, validator, plan-cache, schema retrieval,
  trust UX) compounds with whatever model is underneath. The Spider
  2.0 frontier in 2026 is 5–23% — proof that engine work, not model
  picking, is where the moat lives. See
  [`GLOBAL-026`](./GLOBAL-026-llm-strategy-byollm-hosted-premium.md)
  for the LLM strategy this compass implies.
- **Consequence in code & docs:**
  - Every `FEATURE.md` adds a `## Contribution to north-star` section
    (one short paragraph: which of {engine, onboarding, UX} the
    feature moves and by what mechanism). New features carry the
    line; existing features grow it on their next edit.
  - The KPI table below is the **single source of truth** for north-star
    metrics. Implementation lives in
    [`quality-eval/FEATURE.md`](../features/quality-eval/FEATURE.md)
    (engine), [`onboarding/FEATURE.md`](../features/onboarding/FEATURE.md)
    (onboarding), and [`trust-ux/FEATURE.md`](../features/trust-ux/FEATURE.md)
    (UX).
  - Phase exit gates in [`phase-plan.md`](../phase-plan.md) name
    KPI thresholds, not feature lists. A phase doesn't roll over
    until its north-star KPI clears the bar.
  - Weekly review reads the KPI table; regression on any KPI by the
    `alert` threshold (below) pages the on-call per
    [`SK-QUAL-002`](../features/quality-eval/FEATURE.md).
- **Alternatives rejected:**
  - **Single NSM** (e.g. "weekly answered questions") — too reductive.
    Engine / onboarding / UX fail independently; one number hides
    which one is regressing.
  - **No NSM** (the prior state) — drift risk under strict-$0 + multi-
    surface scope.
  - **Growth-style NSM** (DAU, conversion %) — premature pre-PMF;
    biases work toward distribution before quality is provable.
  - **OKRs instead of KPIs** — quarterly noise; KPIs with weekly cron
    + per-PR contribution line are tighter and lighter.

## KPI table — the unambiguous bar

KPI columns:
- **Baseline (2026-05):** measured today, or `tbd-by-<date>` if the
  instrument is not yet shipped.
- **Phase 2 floor / Phase 3 floor:** the value below which a phase
  rollover is blocked (per [`phase-plan.md` §3, §4](../phase-plan.md)).
- **Alert:** week-over-week delta that pages on-call (per
  [`SK-QUAL-002`](../features/quality-eval/FEATURE.md)).
- **Owner:** the FEATURE.md that owns the measurement.

### Engine quality — NL→SQL layer

| KPI | Baseline (2026-05) | Phase 2 floor | Phase 3 floor | Alert | Owner |
|---|---|---|---|---|---|
| BIRD-dev execution match (free chain) | tbd-by-2026-06-15 (target ≥ 70%) | ≥ 72% | ≥ 78% | −5 pts wk/wk | `quality-eval` |
| BIRD-dev execution match (frontier — Claude Sonnet 4.6 / GPT-5 class) | tbd-by-2026-06-15 (target ≥ 90%) | ≥ 88% | ≥ 92% | −3 pts wk/wk | `quality-eval` |
| Spider 2.0-lite execution match (free chain) | tbd-by-2026-06-15 | report only | ≥ 15% | regression -3 pts | `quality-eval` |
| Spider 2.0-lite execution match (frontier) | tbd-by-2026-06-15 | report only | ≥ 25% | regression -3 pts | `quality-eval` |
| **Free-vs-frontier delta** (frontier EM − free EM, BIRD-dev) | tbd | **≤ 22 pts** | **≤ 14 pts** | +3 pts wk/wk (gap widening) | `quality-eval` |
| Validator false-positive rate (correct plan blocked) | tbd-by-2026-07-01 | ≤ 2% | ≤ 1% | +1 pt wk/wk | `ask-pipeline` |
| Refuse-on-low-confidence rate (vs hallucinated answer rate) | tbd | refuse > hallucinate | refuse > hallucinate × 3 | inversion pages | `trust-ux` |

The **free-vs-frontier delta is the headline NL→SQL number.** It is
what proves "great on free LLMs ⇒ invincible on frontier LLMs": as
our scaffolding improves, the delta narrows; when it narrows past
the Phase 3 floor, the moat is real.

### Engine quality — data-engine layer

| KPI | Baseline (2026-05) | Phase 2 floor | Phase 3 floor | Alert | Owner |
|---|---|---|---|---|---|
| Engine-classify accuracy (right engine picked per query, vs gold label) | tbd-by-2026-07-01 | ≥ 90% | ≥ 97% | −2 pts wk/wk | `multi-engine-adapter` |
| Dual-read result equivalence (cross-engine same row-set on identical query) | n/a until 2nd engine | n/a | 100% (any divergence pages) | any divergence | `engine-migration` |
| Auto-migration success rate (Phase 3 exit gate) | n/a | n/a | ≥ 100 successful, 0 user-visible downtime | any failed cutover | `engine-migration` |
| Workload-analyzer "right-engine" recommendation latency | tbd | n/a | ≤ 7 days from steady-state pattern detection to migration plan | regression alerts | `engine-migration` |

These KPIs come online as the data engine ships (workload analyzer +
multi-engine adapter are Phase 3; dual-read + auto-migration are
Phase 3 exit-gate items). They are listed here so the pillar is
complete and the docs commit to measuring them when the slices land.

### Onboarding

| KPI | Baseline (2026-05) | Phase 2 floor | Phase 3 floor | Alert | Owner |
|---|---|---|---|---|---|
| TTFV — median seconds, landing → first answer | tbd-by-2026-06-01 | ≤ 60 s | ≤ 30 s | +10 s wk/wk | `onboarding` |
| TTFV — p95 seconds, landing → first answer | tbd | ≤ 120 s | ≤ 60 s | +20 s wk/wk | `onboarding` |
| First-query success rate (correct answer to first NL question) | tbd | ≥ 70% | ≥ 85% | −5 pts wk/wk | `onboarding` |
| Unguided user-test pass rate (4/5 strangers complete the 60s flow) | per Phase 1 gate | 4/5 | 5/5 | regression blocks rollover | `onboarding` |
| Drop-off rate landing → first query | tbd | ≤ 25% | ≤ 15% | +5 pts wk/wk | `onboarding` |

### UX

| KPI | Baseline (2026-05) | Phase 2 floor | Phase 3 floor | Alert | Owner |
|---|---|---|---|---|---|
| Destructive-op retry rate (per Phase 1.5 gate) | tbd-by-2026-06-01 | measurable reduction vs no-preview baseline | ≤ 5% | regression blocks rollover | `trust-ux` |
| Sean-Ellis "very disappointed" share | tbd-by-2026-08-01 | ≥ 25% | ≥ 40% (PMF) | regression blocks rollover | `founder-playbook` |
| Session retention (% of users running ≥ 2 queries per session) | tbd | ≥ 60% | ≥ 75% | −5 pts wk/wk | `web-app` |
| Recoverable-failure recovery rate (`GLOBAL-022`) — % of recoverable errors retried-to-success without surfacing | tbd | ≥ 95% | ≥ 99% | regression alerts | `observability` |

## How measurement is operationalized

- **Instrument source.** Engine KPIs come from the weekly
  `tools/eval/cron.ts` (see
  [`SK-QUAL-002`](../features/quality-eval/FEATURE.md)). Onboarding
  and UX KPIs come from the existing event pipeline (`packages/events`,
  see [`GLOBAL-024`](./GLOBAL-024-demand-signal-telemetry.md)) plus
  the `nlqdb.surface` label introduced in
  [`phase-plan.md` §3](../phase-plan.md). Sean-Ellis is a manual
  monthly cadence per
  [`founder-playbook.md` §2](../founder-playbook.md).
- **Where the dashboard lives.** Grafana board
  `dashboards/north-star.json` (planned with first `quality-eval`
  commit). Weekly snapshot posts to LogSnag channel `#north-star`.
- **What "tbd-by-<date>" means.** A baseline must be measured before
  the listed date; the owning FEATURE.md is responsible for shipping
  the instrument. Missing the date triggers a P2 follow-up.
- **What floors do.** Phase rollover does not happen until the
  floor is met. A floor miss is not a bug — it's a signal that the
  next slice should be engine / onboarding / UX work, not new
  surfaces.

## Mapping to existing decisions

This GLOBAL is a compass, not a contradiction. It *names* what the
following decisions already implied:

- [`GLOBAL-011`](./GLOBAL-011-honest-latency.md) — honest latency is
  a UX KPI input.
- [`GLOBAL-012`](./GLOBAL-012-one-sentence-errors.md) — one-sentence
  errors compound into the retry-rate metric.
- [`GLOBAL-020`](./GLOBAL-020-zero-config-first-60s.md) — zero-config
  is the onboarding mechanism; this GLOBAL sets its measurement.
- [`GLOBAL-022`](./GLOBAL-022-recoverable-failures-retry-to-success.md)
  — recovery-rate becomes a UX KPI here.
- [`GLOBAL-023`](./GLOBAL-023-trust-ux-baseline.md) — trust UX is
  the UX north-star mechanism.
- [`GLOBAL-024`](./GLOBAL-024-demand-signal-telemetry.md) — demand
  signal is the instrument that makes these KPIs measurable.
- [`GLOBAL-026`](./GLOBAL-026-llm-strategy-byollm-hosted-premium.md)
  — LLM strategy is the lever for the engine north-star.

## Supersedes

- Prior `docs/architecture.md §11` risks-table line: "Our moat is multi-engine auto-migration, not NL→SQL. Stay focused on Phase 3."
  - **Replacement:** NL→SQL accuracy IS a moat, jointly with multi-engine auto-migration. The moat is the engine-quality scaffolding (planner, validator, plan-cache, schema retrieval, hedged race, trust UX) that compounds with every model release. `quality-eval` measures it via the free-vs-frontier delta KPI.
