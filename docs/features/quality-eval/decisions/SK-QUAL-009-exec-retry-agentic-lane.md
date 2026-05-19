# SK-QUAL-009 — Agentic exec-retry scaffold + `agentic-frontier` lane (slice 3c)

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Related:
[`SK-QUAL-004`](./SK-QUAL-004-free-vs-frontier-delta.md) (the headline
KPI this slice operationalises) and
[`SK-LLM-017`](../../llm-router/decisions/SK-LLM-017-hosted-premium-chain.md)
(production-side parallel; this slice is the eval-harness wiring).

- **Decision:** The eval harness gains a bounded exec-retry helper
  (`tools/eval/src/exec-retry.ts::withExecRetry`) that wraps every
  scaffolded lane's `plan() → score()` pair in a loop bounded by
  `lane.maxAttempts` (production matches at `3` per
  `apps/api/src/ask/retry.ts::RETRY_MAX_ATTEMPTS`). Only `exec_error`
  retries; `match`/`mismatch`/`no_sql`/`gold_error` are terminal. Each
  retry threads the previous attempt's SQL + execution error back into
  `PlanRequest.previousAttempt` (the field already plumbed for
  `GLOBAL-022` server-side retries). Two lanes scaffold: **`free`**
  (proves the "scaffolding compounds with the model" north-star bet at
  the cheap-model end) and **`agentic-frontier`** (a new lane wrapping
  the existing single-model frontier provider in the same loop, opt-in
  via `RUN_AGENTIC_FRONTIER=1`). The unscaffolded **`frontier`** lane
  stays exactly as today so the ablation comparison `frontier` →
  `agentic-frontier` directly measures scaffold value at the frontier
  end. The headline KPI `free_vs_agentic_frontier_delta` lands on
  `EvalReport` + `FeatureEvalWeeklyEvent` + the LogSnag `Eval weekly`
  card.
- **Core value:** Bullet-proof, Free, Honest latency
- **Why:** The Phase 2 BIRD-dev EM ≥ 80% floor
  ([`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md)) is
  single-model-unreachable — canonical-set agentic SOTA is
  77–82% (AskData+GPT-4o 77.64%, Agentar 74.90%). The 2026
  inference-time consensus for closing the gap converges on
  **exec-retry with execution-error feedback** — MAC-SQL's Refiner
  ablates at **+4.63 pp BIRD-dev EX**
  ([arXiv:2312.11242](https://arxiv.org/html/2312.11242v2),
  Refiner-off → 54.76% vs Refiner-on → 59.39%); CHESS's iterative Unit
  Tester loop ([arXiv:2405.16755](https://arxiv.org/html/2405.16755v1),
  65–71% BIRD); MAGIC's in-context self-correction guidelines
  ([arXiv:2406.12692](https://arxiv.org/pdf/2406.12692)); smolagents
  CodeAgent's ReAct loop. Per these, the smallest viable scaffold is a
  bounded exec-retry loop — the alternatives (LLM-critic ensembles,
  self-consistency-N-vote) bring 2× cost for marginal gain. Adding the
  same loop to **both** ends of the lane spectrum (free + agentic
  frontier) is the only configuration where the
  [`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md) bet
  "great on free LLMs ⇒ invincible on frontier LLMs — scaffolding
  compounds with the model" is empirically testable; lifting scaffold
  on only one lane conflates model-quality and scaffold gains.
- **Consequence in code:**
  - `tools/eval/src/exec-retry.ts` — new pure helper. `withExecRetry({maxAttempts, plan, request, score})` returns `{finalSql, finalModel, finalScore, attempts, attemptLog}`; throws on `maxAttempts < 1` and on caller-set `request.previousAttempt` so misuse fails loud.
  - `tools/eval/src/lanes.ts` — `Lane` widens to `{… maxAttempts: number}`; `free.maxAttempts = AGENTIC_MAX_ATTEMPTS` (3); `frontier.maxAttempts = 1` (unscaffolded reference per `SK-QUAL-004`); new `buildAgenticFrontierLane(env)` opt-in via truthy `RUN_AGENTIC_FRONTIER`.
  - `tools/eval/src/runner.ts` — `runOneQuestion` calls `withExecRetry` instead of the inline `plan()` + `score()`; per-question `attempts: number` lands on `QuestionResult` (omitted when `1` so pre-3c result rows stay byte-identical); per-lane `total_attempts` lands on `LaneSummary`. New `free_vs_agentic_frontier_delta` computed alongside `free_vs_frontier_delta`.
  - `tools/eval/src/types.ts` — `DispatchLane` widens to `"free" | "frontier" | "agentic-frontier"`; `QuestionResult.attempts?`, `LaneSummary.total_attempts?`, `EvalReport.free_vs_agentic_frontier_delta?` (optional on the read side for pre-3c baseline back-compat; the runner always emits them).
  - `packages/events/src/types.ts` — `FeatureEvalWeeklyEvent.freeVsAgenticFrontierDelta?: number | null` (optional for pre-3c producer back-compat).
  - `apps/api/src/events-feature.ts::recordEvalReport` — flows the new field through to the typed event; validator accepts it as optional.
  - `apps/events-worker/src/sinks/logsnag.ts` — adds `delta-agentic` tag + surfaces both deltas in the `Eval weekly` description.
  - `.github/workflows/quality-eval-bird-mini.yml` + `quality-eval-spider2-lite.yml` — new `include_agentic_frontier` dispatch input; `RUN_AGENTIC_FRONTIER=1` exported alongside the existing frontier toggle.
- **Alternatives rejected:**
  - **Scaffold only the frontier lane** — conflates model and scaffold gains; can't measure compounding; the north-star bet stays unprovable.
  - **Replace `frontier` with `agentic-frontier`** — destroys the unscaffolded single-model ablation reference baked into [`SK-QUAL-004`](./SK-QUAL-004-free-vs-frontier-delta.md) + `baseline-2026-06-15.json`. Two lanes is the cost of provability.
  - **Retry on `mismatch` too** — semantic mismatch has no concrete prompt feedback; retrying just rolls the dice. MAC-SQL retries only on exec errors and empty results; we skip empty-result retry because empty is a valid query answer and the false-positive cost (suppressing real zeros) outweighs the gain.
  - **Self-consistency N-vote / LLM-critic ensembles** ([Agentar-Scale-SQL arXiv:2509.24403](https://arxiv.org/abs/2509.24403), [CSC-SQL arXiv:2505.13271](https://arxiv.org/html/2505.13271v2)) — 2× provider cost; published gains marginal vs. exec-retry; defer until exec-retry's ceiling is measured.
  - **`sqlglot`-equivalent TypeScript syntax pre-check** before exec — `bun:sqlite`'s `db.query(sql).all()` already raises on syntax errors with a message the helper feeds back verbatim, so a separate parse-only step is dead code. The doc's earlier "cheap sqlglot pre-check" recommendation assumed `pg`-shaped exec was expensive; SQLite exec is microseconds, the optimisation has no payoff here.
  - **Higher max-attempts (5+)** — production runs at 3; matching keeps the eval measuring what production ships. Diminishing returns past 3 are documented across MAC-SQL / CHESS / RetrySQL papers.
  - **In-runner retry without a pure helper** — a free function is testable with a stub plan/score pair (13 cases in `test/exec-retry.test.ts`); the previous inline shape was untestable without a full database fixture.
