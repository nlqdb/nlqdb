# SK-QUAL-004 — Three dispatch lanes per run: free, single-model frontier (ablation reference), agentic-frontier; the deltas are reported, never a KPI

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md).

- **Decision:** The harness reports execution-match accuracy under
  **three dispatch lanes** ([`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)):
  the **free chain** (the production `/v1/ask` chain), **single-model
  frontier** (Sonnet 4.6 / GPT-5 / Gemini 2.5 Pro class, no orchestration —
  the unscaffolded ablation reference) and **agentic-frontier** (frontier
  model + planner + validator + exec-retry per `SK-QUAL-009`). Every lane
  answers the same questions back-to-back, so the two deltas
  (`free_vs_frontier_delta`, `free_vs_agentic_frontier_delta`) are
  per-question, not per-run-average. Both are **reported, never a KPI, never
  a floor** — the regression alarm (`SK-QUAL-002`) watches the free lane
  only, because that is what every user on the strict-$0 tier hits.
- **Core value:** Bullet-proof, Free, Honest latency
- **Why:** Reporting only free accuracy hides whether the engine has
  headroom; reporting only frontier hides the free-tier experience. The
  agentic-vs-single-model split exists because the 2026 canonical BIRD-dev
  leaderboard separates them (single-model ≈ 73 %; agentic SOTA ≈ 77–82 %;
  the ~93 % figures some papers cite are on the Arcwise-corrected variant).
  The deltas stopped being a KPI with `GLOBAL-041`: the product bet is the
  DBA, and a lane comparison is diagnostic for engine work, not a number a
  phase should gate on.
- **Consequence in code:** `tools/eval/src/lanes.ts` builds the lanes;
  `frontier` stays `maxAttempts: 1` (unscaffolded) so the ablation reference
  holds; frontier lanes run on the capability `plan` budget (`SK-QUAL-022`).
  Both delta fields land on `EvalReport` and `FeatureEvalWeeklyEvent` and on
  the LogSnag card (`delta-agentic` tag); the BYOLLM lane is instrumented
  when an opt-in eval key is configured but gates nothing.
- **Alternatives rejected:**
  - One average accuracy number — hides which lane is regressing.
  - A single delta field that switches meaning once the agentic lane
    shipped — makes McNemar / Spearman comparisons unreadable across runs.
  - Delta as the headline KPI with Phase 2 / Phase 3 floors (the prior
    stance) — retired by `GLOBAL-041`.
