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
| BIRD-dev EX | **0.318** (159/500) | ≥ 0.65 | ≥ 0.60 | `tools/eval/baseline-2026-06-15.json` (run 2026-05-18, **pre-T12 name-keyed scorer** — a lower bound; cited 31.8% in GLOBAL-027) |
| Spider 2.0-lite EX | **null** (not yet measured) | ≥ 0.75 | report only (Phase-3 ≥ 0.15) | loader+scorer shipped (`SK-QUAL-007`/`SK-QUAL-008`); first measure pending Tue cron |
| free-vs-agentic-frontier delta | **null** (lane not yet run) | — | ≤ 25 pp (`SK-QUAL-004`) | `SK-QUAL-004`; agentic lane opt-in (`SK-QUAL-009`) |

**BIRD baseline failure breakdown** (the 500-question run, for targeting):
match 159 · **mismatch 283** · **no_sql 51** · exec_error 7 · gold_error 0.
**All 51** `no_sql` (10.2%) carry `llm.plan: all providers in chain failed`
(33 + 17 + 1 by breaker reason, counted across `baseline-2026-06-15.json`
`results[]`). They are a **free-tier capacity / rate-limit exhaustion**
loss — the circuit breaker
(`SK-LLM-005`) opened on the planner head and the chain ran out of
fallbacks — **not** an instruction-following loss. A stronger *head*
model (T1) only clears these when it has spare per-minute quota at that
instant; the direct lever is more independent free capacity, now shipped
as the **Mistral tail backstop (T11, `SK-LLM-028`)**. The 283 mismatches
are the separate SQL-reasoning gap; within it, three **prompt-addressable**
sub-classes — extra-column projection (Open-SQL
[arXiv:2405.06674](https://arxiv.org/pdf/2405.06674)) and SQLite
integer-division truncation vs BIRD's REAL-cast ratio gold (both **T10**),
and NULL-as-false-minimum on unfiltered ascending extremum ordering (BIRD's
dirty-data NULLs; SQLite sorts NULL first; **T13**) — are targeted in §3. A
further, orthogonal slice is a *scorer* artifact (name-keyed
scoring counted correct values with a differing alias/casing as `mismatch`) —
**T12** removes it (§3). All shares of the 283 are *unmeasured* until the
next cron; the rows' "How much" are literature/mechanism estimates, not
baseline counts.

> **How these numbers are produced.** `tools/eval/src/runner.ts` drives
> `router.ts::plan()`, executes against the SQLite fixture, and scores EX
> (BIRD positional-tuple multiset per `SK-QUAL-010` · Spider multi-CSV per
> `SK-QUAL-008`). Weekly crons (`quality-eval-bird-mini.yml` Mon ·
> `quality-eval-spider2-lite.yml` Tue, 04:00 UTC) diff against
> `baseline-2026-06-15.json` and emit `feature.eval.*`. **PR CI never fires
> real provider keys** — mocked router (`SK-QUAL-002`).

## 3. What we have tried (with how, and how much)

Rows run reverse-chronological (newest first): **T13 (this PR) → T12 → T11 →
T10 → T9 → T7/T8 → T1 (Cerebras head) → T2…T6**. The `#` is a stable row id,
not a rank — read recency from row order, not the number. "How much" is
**measured** (from the harness) or **est.** (from the cited paper/ablation).

| # | Lever | How exactly | How much | Canonical home / status |
|---|---|---|---|---|
| T13 | **NULL-safe extremum ordering directive** | One `PLAN_DIRECTIVES` bullet (`SK-LLM-018`): filter the ranked column (`WHERE <col> IS NOT NULL`) before an `ORDER BY … LIMIT` extremum. `SK-LLM-026` exemplar 3 refit to a direct `ORDER BY price ASC LIMIT 1` so the guard is demonstrated, not just stated. Prompt-only, ≈25 tokens | **est. small, pending measure** — a value-correctness sub-class the schema-link / projection / REAL-cast rules miss: SQLite sorts NULL first ([SQLite](https://www.sqlite.org/lang_select.html)), so an unfiltered ascending `LIMIT 1` returns a NULL as a false minimum on BIRD's dirty-data NULLs ([arXiv:2305.03111](https://arxiv.org/pdf/2305.03111)). Dialect-portable (postgres `NULLS LAST`) ⇒ lifts **BIRD**, plausibly **Spider**, regression-bounded | [`SK-LLM-029`](../features/llm-router/decisions/SK-LLM-029-null-safe-extremum.md) — shipped (this PR), **awaiting first cron** |
| T12 | **BIRD scorer parity: positional value tuples, column names ignored** | `scoreOne` reads result rows as positional tuples (bun:sqlite `.values()`) instead of name-keyed objects (`.all()`), so output aliases / function-name casing no longer enter the comparison — matching canonical BIRD `set(cursor.fetchall())` (verified against BIRD [`evaluation.py`](https://github.com/AlibabaResearch/DAMO-ConvAI/blob/main/bird/llm/src/evaluation.py), 2026-06). Spider `rowsToColumnMajor` transpose also moves to `.values()` so same-named predicted columns stay distinct. Multiset + ORDER-BY strictness retained (conservative lower bound) | **measurement fix that *removes deflation* — magnitude pending cron.** The 0.318 baseline was scored name-keyed, so an *unmeasured* share of its 283 mismatches were correct values penalised only for a differing alias/casing — those now score `match`. Lifts **BIRD**; the duplicate-column fix removes a rare **Spider** false-mismatch; neither regresses | [`SK-QUAL-010`](../features/quality-eval/decisions/SK-QUAL-010-bird-positional-tuple-parity.md) — shipped (#340), **awaiting first cron + baseline re-seed** |
| T11 | **Mistral capacity backstop at the planner-chain tail** | `createMistralProvider` (`mistral-large-latest`, card-free renewable Experiment tier, verified live 2026-06) appended behind OpenRouter on `plan` / `schema_infer` in **both** production + eval (§5 eval-mirrors-production). Fires only when the whole head chain is exhausted | **est. up to +10.2 pp BIRD ceiling, pending measure** — targets the 51/500 (10.2%) `all providers in chain failed` `no_sql` losses (§2) with an **independent** free-tier RPM pool the head chain doesn't share. Tail-only ⇒ **strictly additive**: converts `no_sql → match` without touching a passing row ⇒ can lift BIRD/Spider and **cannot regress** them. Recovered share measured next cron | [`SK-LLM-028`](../features/llm-router/decisions/SK-LLM-028-mistral-capacity-backstop.md) — shipped (#338), **awaiting first cron** |
| T10 | **Result-shape directives: exact projection + REAL-cast ratios** | Two `PLAN_DIRECTIVES` bullets (`SK-LLM-018`): select exactly the goal's columns (no extras); cast one operand of an integer ratio to REAL so SQLite doesn't truncate. `SK-LLM-026` exemplar 2 refit. Prompt-only | **est. small–moderate, pending measure** — two mismatch sub-classes schema-link rules miss: extra-column projection (Open-SQL [arXiv:2405.06674](https://arxiv.org/pdf/2405.06674)) and integer-division truncation vs BIRD's REAL-cast ratio gold. Extra columns change the tuple ⇒ lifts **BIRD**; Spider tolerates extra pred cols (`score.ts:152`) ⇒ no regression. ≈40 tokens/call | [`SK-LLM-027`](../features/llm-router/decisions/SK-LLM-027-result-shape-directives.md) — shipped, **awaiting first cron** |
| T9 | **Static few-shot exemplars in the plan prompt (DAIL-SQL)** | `PLAN_SYSTEM` = `PLAN_DIRECTIVES` (`SK-LLM-018`) + a `PLAN_FEW_SHOT` block of **3** static Question→strict-JSON exemplars covering the four `SK-LLM-018` behaviours | **est. moderate, pending measure** — few-shot Question→SQL pairs are the biggest prompt-only lever (DAIL-SQL [arXiv:2308.15363](https://arxiv.org/abs/2308.15363); optimal 3–5 shots; largest on small/open models). Static = the **format** half of DAIL-SQL's +5–8 pp; retrieval is §4 #1. Dataset-agnostic ⇒ **BIRD + Spider**. ≈250–350 tokens/call | [`SK-LLM-026`](../features/llm-router/decisions/SK-LLM-026-static-few-shot-plan-exemplars.md) — shipped, **awaiting first cron** |
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
   DAIL-SQL arXiv:2308.15363). Not tried: needs an exemplar pool + a
   similarity index (new dependency + a retrieval hop on the hot `plan`
   call), so it is **gated on whether T9's static cron delta justifies the
   complexity** (`CLAUDE.md` §P5). The binding free-tier limit is the
   per-minute token quota, so measure exemplar count vs EX before expanding.
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
4. **A second card-free tail backstop beyond Mistral (T11).** A *second*
   independent free-tier entry would further harden the 10.2%
   chain-exhaustion tail. `NVIDIA_API_KEY` (build.nvidia.com) is card-free
   + OpenAI-compatible but its free tier is a **finite ~5,000-credit pool**
   (2026-06), not renewable — same `GLOBAL-013` failure as the rejected
   `COHERE_TRIAL_API_KEY`, so **not** added until NVIDIA exposes a renewable
   tier. Re-rank only if the T11 cron shows residual chain-exhaustion `no_sql`.
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

## 6. Verification log + next measurement

The dated, evidence-referenced log of every shipped lever lives in
[`quality-score-verification-log.md`](./quality-score-verification-log.md)
(append-only; split out per `CLAUDE.md` §D4 so this tracker stays under the
20 KB cap). The §3 table above is the current-state view of the same levers.

> **Next measurement that moves this bar:** the first
> `quality-eval-bird-mini.yml` (Mon) + `quality-eval-spider2-lite.yml`
> (Tue) cron after T1/T7/T8/T9/T10/T11/T12/T13 land — it measures the **combined**
> effect of the Cerebras head, the static few-shot + result-shape +
> NULL-safe-extremum prompt levers, the Mistral tail capacity backstop, the
> earlier robustness levers, **and the T12 scorer-parity fix**, not any one
> alone; that run also re-seeds the baseline under the corrected scorer
> (`SK-QUAL-005`), so its diff is read as a one-time migration.
> Both workflows already wire all six card-free free-chain keys (`lanes.ts`),
> mirrored to GitHub Actions secrets by
> [`scripts/mirror-secrets-gha.sh`](../../scripts/mirror-secrets-gha.sh)
> (verified by `scripts/verify-secrets.sh`), so the cron runs the real
> Cerebras-led, Mistral-backstopped chain unattended — no human step required.
