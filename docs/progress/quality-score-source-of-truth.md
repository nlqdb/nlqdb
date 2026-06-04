# Engine quality — source of truth (progress bar)

> **What this is.** The single progress tracker for **NL→SQL engine
> quality**: where the number is today, exactly what we have tried to
> move it (and how much), and what we have **not** tried yet. It is a
> *log and a backlog*, not a decision record — every decision lives in
> its canonical home and is referenced here by ID (per `CLAUDE.md` §P3).
>
> **Authority.** On any conflict, the canonical sources win, in this
> order: [`GLOBAL-025`](../decisions/GLOBAL-025-north-star.md) (KPI
> floors) · [`GLOBAL-027`](../decisions/GLOBAL-027-pre-alpha-gate.md)
> (gate thresholds) · [`quality-eval/FEATURE.md`](../features/quality-eval/FEATURE.md)
> (`Status:` line, the canonical measurement status) ·
> [`llm-router/FEATURE.md`](../features/llm-router/FEATURE.md) (the
> system under test). If this file disagrees with them, **they win** and
> this file is the bug.
>
> **Scope guard.** Every entry here stays inside the **strict-$0,
> no-credit-card** free approach per
> [`GLOBAL-013`](../decisions/GLOBAL-013-free-tier-bundle-budget.md) /
> [`GLOBAL-026`](../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).
> Frontier/agentic lanes are an *ablation reference* (`SK-QUAL-004`), not
> a place we spend to inflate the headline.

## 1. Why engine quality is the #1 acquisition lever (not just an engine nicety)

The pre-alpha gate ([`GLOBAL-027`](../decisions/GLOBAL-027-pre-alpha-gate.md))
blocks **every "do-work" surface** until the **free chain** clears
**BIRD-dev EX ≥ 0.65 AND Spider 2.0-lite EX ≥ 0.75** simultaneously.
That gate sits at the end of all five canonical ICP acquisition flows
([`GLOBAL-032`](../decisions/GLOBAL-032-top-5-user-flows-canonical.md);
FLOW-001…005 in
[`automated-icp-validation-plan.md` §0.5](../research/automated-icp-validation-plan.md)):
every walker today reaches the first query and **dead-ends at gate-403**
(verified 2026-06-04). So free-chain BIRD/Spider EX is the literal valve
on the entire inbound funnel — moving it is moving acquisition, and the
**planner model is the dominant term** in that number.

## 2. The progress bar (evidence-based; every number sourced)

| KPI (free chain) | Now | Gate floor (GLOBAL-027) | Phase-2 floor (GLOBAL-025) | Source |
|---|---|---|---|---|
| BIRD-dev EX | **0.318** (159/500) | ≥ 0.65 | ≥ 0.60 | `tools/eval/baseline-2026-06-15.json` (run 2026-05-18); cited 31.8% in GLOBAL-027 |
| Spider 2.0-lite EX | **null** (not yet measured) | ≥ 0.75 | report only (Phase-3 ≥ 0.15) | loader+scorer shipped (`SK-QUAL-007`/`SK-QUAL-008`); first measure pending Tue cron |
| free-vs-agentic-frontier delta | **null** (lane not yet run) | — | ≤ 25 pp (`SK-QUAL-004`) | `SK-QUAL-004`; agentic lane opt-in (`SK-QUAL-009`) |

**BIRD baseline failure breakdown** (the 500-question run, for targeting):
match 159 · **mismatch 283** · **no_sql 51** · exec_error 7 · gold_error 0.
The 51 `no_sql` (10.2%) are questions where the planner emitted no
parseable SQL JSON at all — a pure instruction-following loss a stronger
planner recovers cheaply; the 283 mismatches are the real SQL-reasoning
gap.

> **How these numbers are produced.** `tools/eval/src/runner.ts` drives
> `packages/llm/src/router.ts::plan()` over each dataset, executes the
> SQL against the SQLite fixture, and scores execution-accuracy (BIRD
> multiset EX / Spider multi-CSV per `SK-QUAL-008`). The weekly crons
> ([`quality-eval-bird-mini.yml`](../../.github/workflows/quality-eval-bird-mini.yml)
> Mon 04:00 UTC · [`quality-eval-spider2-lite.yml`](../../.github/workflows/quality-eval-spider2-lite.yml)
> Tue 04:00 UTC) diff against `baseline-2026-06-15.json` and emit
> `feature.eval.*`. **PR CI never fires real provider keys** — it
> typechecks + unit-tests with a mocked router (`SK-QUAL-002`).

## 3. What we have tried (with how, and how much)

Ordered newest first. "How much" = the measured or evidence-based size
of the lever; **measured** numbers come from the harness, **est.** from
the cited paper/ablation.

| # | Lever | How exactly | How much | Canonical home / status |
|---|---|---|---|---|
| T1 | **Cerebras (gpt-oss-120b) leads the planner tier** | New free provider `createCerebrasProvider`; `plan`/`schema_infer` chain → `[cerebras, gemini, groq, workers-ai, openrouter]`, identical in eval + prod | **est. large, pending measure** — frontier-class open reasoning model (≈ o4-mini), card-free, replaces Gemini-Flash as primary planner; next cron produces the delta vs 0.318 | [`SK-LLM-023`](../features/llm-router/decisions/SK-LLM-023-cerebras-planner-tier.md) — shipped, **awaiting first cron** |
| T2 | **Agentic exec-retry scaffold** | `withExecRetry` wraps `plan()→score()`, bounded 3 attempts, exec-error-only, threads `previousAttempt` | **est. +4.6 pp** (MAC-SQL Refiner BIRD-dev ablation, arXiv:2312.11242) | [`SK-QUAL-009`](../features/quality-eval/FEATURE.md) — shipped on `free` + `agentic-frontier` lanes |
| T3 | **Schema-fidelity planner prompt** | `PLAN_SYSTEM` directives: schema-link only literal tables/cols, verbatim casing, dialect-strict, use BIRD `Evidence:` | **est. +3–5 pp** on small models (DIN/C3/DAIL-SQL) | [`SK-LLM-018`](../features/llm-router/decisions/SK-LLM-018-schema-fidelity-prompt.md) — shipped |
| T4 | **BIRD `evidence` fed into the goal** | runner concatenates annotator evidence into the plan goal | published BIRD scores are non-comparable without it (parity, not gain) | `runner.ts::runOneQuestion` — shipped |
| T5 | **Hedged planner race** | `plan`/`schema_infer` race provider[0]+[1] after 800 ms head-start | latency win, not accuracy; Cerebras-first usually wins pre-hedge | [`SK-LLM-014`](../features/llm-router/decisions/SK-LLM-014-hedged-request-race.md) — shipped |
| T6 | **Spider 2.0-lite canonical scorer** | TS port of `compare_pandas_table`; all 135 `local###` rows scoreable | unblocks the Spider KPI (measurement, not accuracy) | [`SK-QUAL-008`](../features/quality-eval/FEATURE.md) — shipped |

## 4. What we have NOT tried yet (ranked backlog, all free)

Ranked by expected pp-per-effort on the **free chain**. Each is
card-free and agent-runnable; promote into an `SK-*`/`GLOBAL-*` before
implementing (`CLAUDE.md` §P4).

1. **Few-shot exemplars in the plan prompt (DAIL-SQL).** Masked-question
   similarity few-shot is the single biggest prompt-only jump in the
   literature (est. +5–8 pp; DAIL-SQL arXiv:2308.15363). Not yet tried —
   `PLAN_SYSTEM` is zero-shot. gpt-oss-120b's 131K window fits exemplars;
   the binding free-tier limit is the per-minute token quota, so few-shot
   trades daily token budget for accuracy — measure exemplar count vs EX.
   **Highest expected ROI.**
2. **Schema-linking / value retrieval (M-Schema + column pruning).**
   Feed only the goal-relevant subset of the schema + sample
   cell-values, in the M-Schema representation (est. +3–6 pp; reduces
   the 283 mismatches and helps large schemas stay under the context
   cap). Not tried — the runner sends the full DDL verbatim.
3. **Self-consistency majority vote (free, N small).** Sample N=3 plans
   at temperature > 0, execute each, majority-vote the result set.
   Dominated at 2× cost on *frontier* (`SK-QUAL-004` open question) but
   **on the free chain the tokens are free** — worth an explicit
   measured ablation before dismissing.
4. **Diversify free planner providers as failover quality, not just
   capacity.** `MISTRAL_API_KEY`, `NVIDIA_API_KEY` (build.nvidia.com),
   `COHERE_TRIAL_API_KEY` are all card-free and present in the eval/CI
   env but unused. Candidate failover entries behind Cerebras if its
   measured delta disappoints (`SK-LLM-023` alternatives).
5. **Corrected-set evaluation (BIRD Mini-Dev 52.8% annotation errors).**
   Score against the UIUC `Arcwise-Plat-SQL`/`-Plat` corrected variants
   and report Spearman rank-correlation vs canonical (not McNemar —
   gold differs). Measurement honesty, not accuracy. Open question under
   `SK-QUAL-003`; gated on a license check.
6. **Internal `db.create` accepted-answer eval (third dataset).** The
   production-shape dataset that "matters most" (`SK-QUAL-003`); blocked
   on a privacy-stripped R2 export. **No user data ever** enters the
   harness (`quality-eval` Open questions).
7. **Per-stage confidence calibration → hard-plan routing.** Replace the
   placeholder `confidence: 1.0` with harness-calibrated floors so
   `SK-LLM-022`'s hard-plan threshold fires on the right questions.
   Depends on the harness emitting per-question confidence.

## 5. Guardrails — what would *degrade* a KPI (don't)

- **Spending to inflate the headline.** The headline is the **free**
  chain and the **free-vs-frontier delta** (`SK-QUAL-004`); a frontier
  win that widens the delta is a regression on the north-star, not a
  gain (`GLOBAL-025`).
- **Eval ≠ production chain.** The eval free lane MUST mirror
  `apps/api/src/llm-router.ts` (`tools/eval/src/lanes.ts` comment) — a
  divergence makes the cron measure a system we don't ship.
- **Optimising BIRD alone.** Two thresholds force generalisation
  (`GLOBAL-027`); BIRD-only rewards memorising its 11 schemas. Move both
  or neither.
- **PR CI firing real keys.** Real provider calls on a PR leak the
  card-free budget and make CI flaky (`SK-QUAL-002`). Keep it mocked.

## 6. Verification log

| Date | Event | Evidence |
|---|---|---|
| 2026-05-18 | Free-chain BIRD baseline = 0.318 (159/500) | `baseline-2026-06-15.json` |
| 2026-06-04 | All 5 ICP flows verified reaching gate-403 (engine bottleneck) | `automated-icp-validation-plan.md` §0.5 table |
| 2026-06-04 | **T1 shipped** — Cerebras planner lane (`SK-LLM-023`); awaiting first cron to measure delta vs 0.318 | this PR |

> **Next measurement that moves this bar:** the first
> `quality-eval-bird-mini.yml` cron after T1 lands. It must run with the
> `CEREBRAS_API_KEY` GitHub Actions secret set (see PR description — a
> human must add it to repo secrets and the Worker if not already
> mirrored); without it the chain falls over to the Gemini-first
> order (eval lane omits Cerebras; prod auth-fails-over) and the bar
> does not move.
