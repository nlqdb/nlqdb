# SK-QUAL-004 — Free-vs-agentic-frontier delta is the headline KPI; single-model frontier reports informationally

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md).

- **Decision:** The harness reports execution-match accuracy under
  **three dispatch lanes** ([`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)):
  the **free chain** (Gemini Flash → Groq → Workers-AI → OpenRouter
  free), **single-model frontier** (Sonnet 4.6 / GPT-5 / Gemini 2.5 Pro
  class, no orchestration — informational), and **agentic-frontier**
  (frontier model + planner + validator + retry per `SK-LLM-017`; the
  system class on the leading edge of the BIRD-dev canonical
  leaderboard per 2026 SOTA). The **free-vs-agentic-frontier delta** is
  the single most-watched number. Narrowing delta = nlqdb's scaffolding
  (planner, validator, plan-cache, schema retrieval, few-shot, retry)
  is compounding. Widening delta = we're shipping distribution faster
  than engine work. **Slice 1 shipped the free + single-model frontier
  lanes;** the agentic lane lands in slice 3c (depends on `SK-LLM-017`
  orchestration exposing a `plan()`-compatible callable).
- **Core value:** Bullet-proof, Free, Honest latency
- **Why:** Without this number, the "great-on-free-LLMs ⇒
  invincible-on-frontier-LLMs" thesis is unfalsifiable. Reporting only
  frontier accuracy hides the free-tier user experience; reporting only
  free accuracy hides whether the engine has headroom. The delta makes
  both visible in one number, with target trajectory in
  [`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md): ≤ 25 pp
  (Phase 2 floor) → ≤ 16 pp (Phase 3 floor). The 2026 BIRD leaderboard
  reality — single-model frontier ≈ 73% (Gemini-SQL 73.27% dev);
  **agentic SOTA on canonical BIRD-dev ≈ 77-82%** (AskData+GPT-4o
  77.64% dev / 81.95% test; Agentar-Scale-SQL 74.90% / 81.67%); the
  ~93% range some 2026 papers cite (e.g. ReViSQL) is measured on the
  **Arcwise-corrected** variant only, not the canonical set — is what
  forces the agentic-vs-single-model split. Pre-2026-05 the docs
  assumed single-model frontier could clear 88%; revised based on
  live leaderboard verification 2026-05-19.
- **Consequence in code:** `tools/eval/lanes.ts` selects the dispatch
  lane per run; the same questions are evaluated through both lanes
  back-to-back so the delta is per-question, not per-run-average
  (cancels noise). BYOLLM lane is also instrumented when an opt-in
  eval key is configured, but does not gate any floor — BYOLLM
  accuracy depends on the user's key, not on our work.
  `report.free_vs_frontier_delta` keeps its name (back-compat with
  slice-1 baselines); the field stores the agentic-frontier delta once
  that lane ships.
- **Alternatives rejected:**
  - One average accuracy number — hides which lane is regressing.
  - Per-tier accuracy without a delta — forces every reader to do the
    subtraction; team focus dissipates.
  - Delta tracked only on BIRD — too narrow; the internal eval's
    delta is the production-shape one.
  - **Single-model frontier only** — caps the visible ceiling at ~73%
    and makes the moat thesis untestable; agentic-frontier is the
    right comparator for "what does *nlqdb the system* achieve on a
    frontier model".
