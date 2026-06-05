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
**All 51** `no_sql` (10.2%) carry the error `llm.plan: all providers in
chain failed` — 33× (`gemini:circuit_open, groq:circuit_open…`), 17×
(`gemini:circuit_open, groq:http_4xx…`), 1× (`gemini:network…`), counted
across `baseline-2026-06-15.json` `results[]`. They are a **free-tier
capacity / rate-limit exhaustion** loss — the circuit breaker
(`SK-LLM-005`) opened on the planner head and the chain ran out of
fallbacks — **not** an instruction-following loss. A stronger *head*
model (T1) only clears these when it has spare per-minute quota at that
instant; the direct lever for them is more independent free capacity (§4
item 4). The 283 mismatches are the separate SQL-reasoning gap.

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

Rows run reverse-chronological (newest first): **T9 (this PR) → T7/T8 →
T1 (Cerebras head) → T2…T6**. The `#` is a stable row id (assigned in
order added), **not** a rank — read recency from the row order and the
"Canonical home / status" column, not from the number. "How much" = the
measured or evidence-based size of the lever; **measured** numbers come
from the harness, **est.** from the cited paper/ablation.

| # | Lever | How exactly | How much | Canonical home / status |
|---|---|---|---|---|
| T9 | **Static few-shot exemplars in the plan prompt (DAIL-SQL)** | `PLAN_SYSTEM` splits into `PLAN_DIRECTIVES` (`SK-LLM-018`) + a new `PLAN_FEW_SHOT` block of **3** static, dialect-portable Question→strict-JSON exemplars that between them demonstrate all four `SK-LLM-018` behaviours: verbatim casing + JOIN, `Evidence:`-formula application, dialect-strict output (exemplar 3 labelled `postgres` vs `sqlite`, `LIMIT`-not-`TOP` top-N idiom), and the strict-JSON shape; `JSON.stringify`-built answers, no per-provider plumbing | **est. moderate, pending measure** — few-shot Question→SQL pairs are the biggest prompt-only text-to-SQL lever (DAIL-SQL [arXiv:2308.15363](https://arxiv.org/abs/2308.15363); optimal 3–5 shots, diminishing past it; largest on the small/open models the free chain runs). The static set captures the **format/organization** half of DAIL-SQL's +5–8 pp; the similarity-retrieval half is a separate future lever (§4 #1). Dataset-agnostic ⇒ lifts **BIRD + Spider** alike. Adds ≈250–350 input tokens/call — the free-tier per-minute-quota tradeoff, measured on the next cron | [`SK-LLM-026`](../features/llm-router/decisions/SK-LLM-026-static-few-shot-plan-exemplars.md) — shipped (this PR), **awaiting first cron** |
| T7 | **JSON-recovery fallback for reasoning-head preamble leaks** | `parseJsonResponse` extracts the first brace-balanced `{…}` (string-aware) when strict parse throws; runs only after the strict path fails | **est. small but every-leg** — recovers `parse`→`no_sql` losses caused by the `gpt-oss-120b` reasoning head leaking preamble text into structured output (Groq/OpenAI `gpt-oss` reports, 2026-06); forward-looking for the new head, strictly additive (can't regress the happy path) | [`SK-LLM-025`](../features/llm-router/decisions/SK-LLM-025-json-recovery-fallback.md) — shipped, **awaiting first cron** |
| T8 | **Greedy decoding parity (temperature 0) on the Workers AI leg** | `workers-ai.ts` body `{ messages }` → `{ messages, temperature: 0 }`, matching Cerebras/Gemini/Groq/OpenRouter (Workers AI default is a stochastic 0.6) | **reproducibility-positive; small, unmeasured EX** on the 4th-in-chain leg — greedy is the single-pass text-to-SQL EX standard, and a deterministic leg keeps the `SK-QUAL-006` McNemar baseline clean | [`SK-LLM-024`](../features/llm-router/decisions/SK-LLM-024-greedy-decoding-parity.md) — shipped |
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

1. **Similarity-retrieved few-shot exemplars (full DAIL-SQL).** The
   *static* 3-shot exemplars shipped (T9 / `SK-LLM-026`); the **retrieval**
   half — masked-question similarity selection from an exemplar pool — is
   the larger remaining DAIL-SQL gain (est. +3–5 pp beyond static;
   DAIL-SQL arXiv:2308.15363). Not tried: it needs an exemplar pool + a
   masked-question similarity index — a new dependency plus a retrieval
   hop on the hot `plan` call — so it is **gated on whether T9's static
   cron delta justifies the complexity** (`CLAUDE.md` §P5). gpt-oss-120b's
   131K window fits more exemplars; the binding free-tier limit is the
   per-minute token quota, so measure exemplar count vs EX before
   expanding.
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
4. **Capacity backstop for the 10.2% chain-exhaustion `no_sql`.** §2
   re-verifies that **all 51** `no_sql` are `all providers in chain failed`
   (not reasoning losses), so a stronger planner *head* (T1) does not by
   itself clear them — and a low-RPM head (Cerebras free tier is ~5 RPM /
   30K TPM, verified against Cerebras docs 2026-06) can even *raise*
   chain-exhaustion under load (measure on the next cron, §5). The direct
   lever is more independent free capacity: `MISTRAL_API_KEY`,
   `NVIDIA_API_KEY` (build.nvidia.com) are card-free, present in the
   eval/CI env, and unused (`COHERE_TRIAL_API_KEY` is a time-boxed *trial*
   → fails `GLOBAL-013`). **Open decision (not yet taken):** `SK-LLM-023`
   rejected a capacity backstop on the rationale that "the free chain
   rarely fully fails"; the baseline's 10.2% full-chain-failure rate
   contradicts that, so whether to add a tail backstop / extra failover
   entry is a live `SK-LLM-*` decision to raise with the owner before
   implementing (`CLAUDE.md` §P1).
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
- **A low-RPM provider at the chain *head* can starve capacity.** The
  Cerebras free tier is ~5 RPM / 30K TPM (verified against Cerebras docs,
  2026-06); leading the planner with it (T1) must be checked on the next
  cron for whether it *raises* the §2 chain-exhaustion `no_sql` rate, not
  only whether it lifts EX — a head that 429s before its fallbacks
  recover trades reasoning gain for availability loss.
- **A non-deterministic free-chain leg.** Greedy `temperature: 0` on
  every planner leg (T8 / `SK-LLM-024`) is a reproducibility invariant:
  a stochastic leg flips per-question outcomes run-to-run, inflating the
  `SK-QUAL-006` McNemar discordant cells and making the cron measure a
  system that varies between runs. Don't reintroduce sampling on the
  single-pass planner (self-consistency-N, §4 #3, samples on a *separate*
  code path if it ever lands).

## 6. Verification log

| Date | Event | Evidence |
|---|---|---|
| 2026-05-18 | Free-chain BIRD baseline = 0.318 (159/500) | `baseline-2026-06-15.json` |
| 2026-06-04 | All 5 ICP flows verified reaching gate-403 (engine bottleneck) | `automated-icp-validation-plan.md` §0.5 table |
| 2026-06-04 | **T1 shipped** — Cerebras planner lane (`SK-LLM-023`); awaiting first cron to measure delta vs 0.318 | #317 |
| 2026-06-05 | **Correction (evidence-based):** all 51 baseline `no_sql` re-verified as chain-exhaustion (`all providers in chain failed`; 33 + 17 + 1 by breaker reason), **not** instruction-following losses — §2 + §4 + §5 updated; capacity-backstop framed as an open decision against `SK-LLM-023`'s "rarely fully fails" rationale | `baseline-2026-06-15.json` `results[]` (script-counted) |
| 2026-06-05 | **Free-chain planner robustness shipped:** greedy-decoding parity on the Workers AI leg (T8 / `SK-LLM-024`) + reasoning-preamble JSON-recovery fallback (T7 / `SK-LLM-025`). Both land before the first post-T1 cron, so that cron measures the combined T1+T7+T8 effect; neither is measured yet | `packages/llm` unit tests green; evidence base in the SK-LLM-024/025 bodies |
| 2026-06-05 | **Static few-shot exemplars shipped (this PR):** `PLAN_SYSTEM` gains a 3-shot `PLAN_FEW_SHOT` block (T9 / `SK-LLM-026`) demonstrating the `SK-LLM-018` schema-fidelity behaviours. Prompt-only, dataset-agnostic (BIRD + Spider), zero new dependency; not measured on a PR (`SK-QUAL-002`) — folds into the next cron's combined delta | `packages/llm` unit tests green (124 passing, incl. the new few-shot contract tests); evidence base in the `SK-LLM-026` body |

> **Next measurement that moves this bar:** the first
> `quality-eval-bird-mini.yml` (Mon) + `quality-eval-spider2-lite.yml`
> (Tue) cron after T1/T7/T8/T9 land — it measures the **combined** effect
> of the Cerebras head plus this PR's static few-shot lever and the two
> earlier robustness levers, not any one alone.
> Both workflows already wire `CEREBRAS_API_KEY` + the four other
> card-free free-chain keys (`GEMINI_API_KEY`, `GROQ_API_KEY`,
> `OPENROUTER_API_KEY`, `CF_AI_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`), and all
> five are mirrored to GitHub Actions secrets by
> [`scripts/mirror-secrets-gha.sh`](../../scripts/mirror-secrets-gha.sh)
> (and verified by `scripts/verify-secrets.sh`), so the cron runs the
> real Cerebras-led chain unattended — no human step required.
