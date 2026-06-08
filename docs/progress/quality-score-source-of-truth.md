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
blocks **every "do-work" surface** until the **free chain** clears **BIRD-dev
EX ≥ 0.65 AND Spider 2.0-lite EX ≥ 0.75**. That gate sits at the end of all five
canonical ICP acquisition flows ([`GLOBAL-032`](../decisions/GLOBAL-032-top-5-user-flows-canonical.md);
FLOW-001…005 in [`automated-icp-validation-plan.md` §0.5](../research/automated-icp-validation-plan.md)):
every walker today reaches the first query and **dead-ends at gate-403**
(verified 2026-06-04). So free-chain BIRD/Spider EX is the literal valve on the
inbound funnel — moving it is moving acquisition, and the **planner model is the
dominant term** in that number.

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
model (T1) only clears these with spare per-minute quota at that instant;
the direct lever is more independent free capacity — the **Mistral tail
backstop (T11, `SK-LLM-028`)**. The 283 mismatches are the separate
SQL-reasoning gap; §3's prompt levers target **six named, prompt-addressable
sub-classes** of it — projection + REAL-cast (**T10**), NULL-safe extremum
(**T13**), count grain (**T14**), group-by grain (**T15**), implicit type
conversion (**T16**) — each §3 row carrying its own citation, while **T12**
removes an orthogonal name-keyed-scorer artifact. All shares of the 283 are
*unmeasured* until the next cron; the "How much" cells are literature/mechanism
estimates, not baseline counts.

> **How these numbers are produced.** `tools/eval/src/runner.ts` drives
> `router.ts::plan()` against the SQLite fixture and scores EX (BIRD
> positional-tuple multiset `SK-QUAL-010` · Spider multi-CSV `SK-QUAL-008`);
> the weekly crons (§6) diff `baseline-2026-06-15.json`. **PR CI never fires
> real keys** — mocked router (`SK-QUAL-002`).

## 3. What we have tried (with how, and how much)

Rows run reverse-chronological (newest first): **T16 (this PR) → T15 → T14 → T13 → T12 →
T11 → T10 → T9 → T7/T8 → T1 (Cerebras head) → T2…T6**. The `#` is a stable id,
not a rank — read recency from row order. "How much" is **measured** (from the
harness) or **est.** (from the cited paper/ablation).

| # | Lever | How exactly | How much | Canonical home / status |
|---|---|---|---|---|
| T16 | **Numeric-text-cast directive (CAST `TEXT`-declared columns used numerically)** | One `PLAN_DIRECTIVES` bullet (`SK-LLM-018`): when the schema declares a column `TEXT` but the goal compares/orders/min-maxes it numerically, `CAST(<col> AS REAL)`. Prompt-only, ≈55 tokens; directive-only (keeps T9's cron clean) | **est. small–moderate, pending measure** — **Implicit Type Conversion** (C1, [arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)), the logic-error sub-class the other directives all miss: SQLite gives a `TEXT` column text affinity and compares it lexicographically (`'100' < '9'`; [SQLite §3.1+§4.2](https://sqlite.org/datatype3.html)), silently returning a wrong result. BIRD-weighted (real-world schemas store numbers as text far more than Spider's clean ones); the *numerical-use* scope keeps it off `INTEGER`/`REAL` columns and bounds regression (a numeric string and its number cast equal); dialect-portable ⇒ plausibly lifts **BIRD + Spider** | [`SK-LLM-035`](../features/llm-router/decisions/SK-LLM-035-numeric-text-cast-directive.md) — shipped (this PR), **awaiting first cron** |
| T15 | **Group-by-grain directive (per-group GROUP BY alignment)** | One `PLAN_DIRECTIVES` bullet (`SK-LLM-018`): match aggregation grain to the goal — `GROUP BY` the grouping column on a "per/each/by `<category>`" goal, omit `GROUP BY` for one overall total, and *in an aggregate query* every non-aggregated SELECT column must appear in `GROUP BY`. Prompt-only, ≈45 tokens; directive-only (keeps T9's cron clean) | **est. small–moderate, pending measure** — **Unaligned Aggregation Structure** (E5, [arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)): a missing per-group `GROUP BY` collapses a per-group answer to one global aggregate (cardinality mismatch failing both scorers). Standard SQL ⇒ dialect-portable ⇒ lifts **BIRD + Spider**; over-grouping guard-bounded (overall-total + aggregate-query scope), the non-aggregated-column rule curbs SQLite's arbitrary bare-aggregate pick (detail in [`SK-LLM-034`](../features/llm-router/decisions/SK-LLM-034-group-by-grain-directive.md)) | [`SK-LLM-034`](../features/llm-router/decisions/SK-LLM-034-group-by-grain-directive.md) — shipped (#354), **awaiting first cron** |
| T14 | **Count-grain directive (COUNT DISTINCT vs COUNT(\*); SELECT DISTINCT)** | One `PLAN_DIRECTIVES` bullet (`SK-LLM-018`): count/list at the goal's grain — `COUNT(DISTINCT <col>)` (not `COUNT(*)`) for distinct/different/unique entities or counts across a one-to-many join, `SELECT DISTINCT` for distinct-value lists, otherwise keep intended duplicates. Prompt-only, ≈50 tokens; directive-only (keeps T9's cron clean) | **est. small–moderate, pending measure** — the two *named* §2 sub-classes (**Wrong COUNT Object** + **Missing DISTINCT**, [arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)) the other rules miss. Dialect-portable ⇒ lifts **BIRD + Spider**; over-`DISTINCT` guard-bounded (detail in [`SK-LLM-032`](../features/llm-router/decisions/SK-LLM-032-count-grain-directive.md)) | [`SK-LLM-032`](../features/llm-router/decisions/SK-LLM-032-count-grain-directive.md) — shipped (#348), **awaiting first cron** |
| T13 | **NULL-safe extremum ordering directive** | One `PLAN_DIRECTIVES` bullet (`SK-LLM-018`): filter the ranked column (`WHERE <col> IS NOT NULL`) before an `ORDER BY … LIMIT` extremum. `SK-LLM-026` exemplar 3 refit to demonstrate it. Prompt-only, ≈25 tokens | **est. small, pending measure** — the false-minimum sub-class the other rules miss: SQLite sorts NULL first ([SQLite](https://www.sqlite.org/lang_select.html)), so an unfiltered ascending `LIMIT 1` returns a NULL as a false minimum on BIRD's dirty-data NULLs ([arXiv:2305.03111](https://arxiv.org/pdf/2305.03111)). Dialect-portable ⇒ lifts **BIRD**, plausibly **Spider** | [`SK-LLM-029`](../features/llm-router/decisions/SK-LLM-029-null-safe-extremum.md) — shipped (#345), **awaiting first cron** |
| T12 | **BIRD scorer parity: positional value tuples, column names ignored** | `scoreOne` + the Spider `rowsToColumnMajor` transpose read positional tuples (bun:sqlite `.values()`) not name-keyed objects, so output aliases / casing no longer false-mismatch — matching canonical BIRD `set(fetchall())` (verified against [`evaluation.py`](https://github.com/AlibabaResearch/DAMO-ConvAI/blob/main/bird/llm/src/evaluation.py), 2026-06); multiset + ORDER-BY strictness retained (conservative lower bound) | **measurement fix that *removes deflation* — magnitude pending cron.** The 0.318 baseline was scored name-keyed, so an *unmeasured* share of its 283 mismatches were correct values penalised for a differing alias/casing — those now score `match`. Lifts **BIRD**; removes a rare **Spider** false-mismatch; neither regresses | [`SK-QUAL-010`](../features/quality-eval/decisions/SK-QUAL-010-bird-positional-tuple-parity.md) — shipped (#340), **awaiting first cron + baseline re-seed** |
| T11 | **Mistral capacity backstop at the planner-chain tail** | `createMistralProvider` (`mistral-large-latest`, card-free Experiment tier) appended behind OpenRouter on `plan` / `schema_infer` in **both** production + eval (§5). Fires only when the whole head chain is exhausted | **est. up to +10.2 pp BIRD ceiling, pending measure** — targets the 51/500 (10.2%) `all providers in chain failed` `no_sql` losses (§2) with an **independent** free-tier RPM pool the head chain doesn't share. Tail-only ⇒ **strictly additive**: converts `no_sql → match` without touching a passing row ⇒ can lift BIRD/Spider, **cannot regress** | [`SK-LLM-028`](../features/llm-router/decisions/SK-LLM-028-mistral-capacity-backstop.md) — shipped (#338), **awaiting first cron** |
| T10 | **Result-shape directives: exact projection + REAL-cast ratios** | Two `PLAN_DIRECTIVES` bullets (`SK-LLM-018`): select exactly the goal's columns (no extras); cast one operand of an integer ratio to REAL so SQLite doesn't truncate. `SK-LLM-026` exemplar 2 refit. Prompt-only | **est. small–moderate, pending measure** — extra-column projection (Open-SQL [arXiv:2405.06674](https://arxiv.org/pdf/2405.06674)) + integer-division truncation vs BIRD's REAL-cast gold ⇒ lifts **BIRD**; Spider tolerates extra pred cols (`score.ts:152`) ⇒ no regression. ≈40 tok/call | [`SK-LLM-027`](../features/llm-router/decisions/SK-LLM-027-result-shape-directives.md) — shipped, **awaiting first cron** |
| T9 | **Static few-shot exemplars in the plan prompt (DAIL-SQL)** | `PLAN_SYSTEM` = `PLAN_DIRECTIVES` (`SK-LLM-018`) + a `PLAN_FEW_SHOT` block of **3** static Question→strict-JSON exemplars covering the four `SK-LLM-018` behaviours | **est. moderate, pending measure** — few-shot Question→SQL pairs are the biggest prompt-only lever (DAIL-SQL [arXiv:2308.15363](https://arxiv.org/abs/2308.15363); 3–5 shots). Static = the **format** half of its +5–8 pp (retrieval §4 #1); dataset-agnostic ⇒ **BIRD + Spider**. ≈250–350 tok/call | [`SK-LLM-026`](../features/llm-router/decisions/SK-LLM-026-static-few-shot-plan-exemplars.md) — shipped, **awaiting first cron** |
| T7 | **JSON-recovery fallback for reasoning-head preamble leaks** | `parseJsonResponse` extracts the first brace-balanced `{…}` (string-aware) when strict parse throws; runs only after the strict path fails | **est. small but every-leg** — recovers `parse`→`no_sql` losses from the `gpt-oss-120b` reasoning head leaking preamble into structured output (Groq/OpenAI reports, 2026-06); strictly additive (can't regress the happy path) | [`SK-LLM-025`](../features/llm-router/decisions/SK-LLM-025-json-recovery-fallback.md) — shipped, **awaiting first cron** |
| T8 | **Greedy decoding parity (temperature 0) on the Workers AI leg** | `workers-ai.ts` body `{ messages }` → `{ messages, temperature: 0 }`, matching Cerebras/Gemini/Groq/OpenRouter (Workers AI default is a stochastic 0.6) | **reproducibility-positive; small, unmeasured EX** on the 4th-in-chain leg — greedy is the single-pass text-to-SQL EX standard, and a deterministic leg keeps the `SK-QUAL-006` McNemar baseline clean | [`SK-LLM-024`](../features/llm-router/decisions/SK-LLM-024-greedy-decoding-parity.md) — shipped |
| T1 | **Cerebras (gpt-oss-120b) leads the planner tier** | New free provider `createCerebrasProvider`; `plan`/`schema_infer` chain → `[cerebras, gemini, groq, workers-ai, openrouter]`, identical in eval + prod | **est. large, pending measure** — frontier-class open reasoning model (≈ o4-mini), card-free, replaces Gemini-Flash as primary planner; next cron produces the delta vs 0.318 | [`SK-LLM-023`](../features/llm-router/decisions/SK-LLM-023-cerebras-planner-tier.md) — shipped, **awaiting first cron** |
| T2 | **Agentic exec-retry scaffold** | `withExecRetry` wraps `plan()→score()`, bounded 3 attempts, exec-error-only, threads `previousAttempt` | **est. +4.6 pp** (MAC-SQL Refiner BIRD-dev ablation, arXiv:2312.11242) | [`SK-QUAL-009`](../features/quality-eval/FEATURE.md) — shipped on `free` + `agentic-frontier` lanes |
| T3 | **Schema-fidelity planner prompt** | `PLAN_SYSTEM` directives: schema-link only literal tables/cols, verbatim casing, dialect-strict, use BIRD `Evidence:` | **est. +3–5 pp** on small models (DIN/C3/DAIL-SQL) | [`SK-LLM-018`](../features/llm-router/decisions/SK-LLM-018-schema-fidelity-prompt.md) — shipped |
| T4–T6 | **Non-accuracy enablers (shipped)** | T4 BIRD `evidence` → plan goal (`runner.ts`); T5 hedged planner race (`SK-LLM-014`); T6 Spider 2.0-lite canonical scorer — TS `compare_pandas_table` port, all 135 `local###` rows (`SK-QUAL-008`) | none are accuracy levers — T4 published-score **parity**, T5 a **latency** win, T6 **measurement** (unblocks the Spider KPI) | shipped |

## 4. What we have NOT tried yet (ranked backlog, all free)

Ranked by expected pp-per-effort on the **free chain**. Each is
card-free and agent-runnable; promote into an `SK-*`/`GLOBAL-*` before
implementing (`CLAUDE.md` §P4).

1. **Similarity-retrieved few-shot exemplars (full DAIL-SQL).** The
   *static* 3-shot exemplars shipped (T9 / `SK-LLM-026`); the **retrieval**
   half — masked-question similarity selection from an exemplar pool — is
   the larger remaining DAIL-SQL gain (est. +3–5 pp beyond static;
   DAIL-SQL arXiv:2308.15363). Needs an exemplar pool + similarity index
   (new dep + a retrieval hop on hot `plan`), so it is **gated on whether
   T9's static cron delta justifies the complexity** (`CLAUDE.md` §P5).
2. **Schema-linking / value retrieval (M-Schema + column pruning).**
   Feed only the goal-relevant subset of the schema + sample cell-values
   (est. +3–6 pp; reduces the 283 mismatches). Not tried — the runner sends
   full DDL verbatim.
3. **Self-consistency majority vote (free, N small).** Sample N=3 plans
   at temperature > 0, execute each, majority-vote the result set.
   Dominated at 2× cost on *frontier* but **on the free chain the tokens
   are free** — worth a measured ablation before dismissing (`SK-QUAL-004`).
4. **A second card-free tail backstop beyond Mistral (T11).** A *second*
   independent free-tier entry would further harden the 10.2%
   chain-exhaustion tail, but the obvious candidate `NVIDIA_API_KEY` is a
   **finite ~5,000-credit pool** (2026-06), not renewable — a `GLOBAL-013`
   failure like the rejected Cohere trial. Re-rank only if the T11 cron
   shows residual chain-exhaustion `no_sql`.
5. **Corrected-set evaluation (BIRD Mini-Dev 52.8% annotation errors).**
   Score against the UIUC `Arcwise-Plat-SQL`/`-Plat` corrected variants
   and report Spearman rank-correlation vs canonical (not McNemar —
   gold differs). Measurement honesty, not accuracy; gated on a license
   check (`SK-QUAL-003`).
6. **Internal `db.create` accepted-answer eval (third dataset).** The
   production-shape dataset that "matters most" (`SK-QUAL-003`); blocked
   on a privacy-stripped R2 export. **No user data ever** enters the harness.
7. **Per-stage confidence calibration → hard-plan routing.** Replace the
   placeholder `confidence: 1.0` with harness-calibrated floors so
   `SK-LLM-022`'s hard-plan threshold fires on the right questions — depends
   on the harness emitting per-question confidence.

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
  single-pass planner (self-consistency-N, §4 #3, would sample on a
  *separate* code path).

## 6. Verification log + next measurement

The dated, evidence-referenced log of every shipped lever lives in
[`quality-score-verification-log.md`](./quality-score-verification-log.md)
(append-only; split out per `CLAUDE.md` §D4). The §3 table above is the
current-state view of the same levers.

> **Next measurement that moves this bar:** the first
> `quality-eval-bird-mini.yml` (Mon) + `quality-eval-spider2-lite.yml`
> (Tue) cron after T1/T7/T8/T9/T10/T11/T12/T13/T14/T15/T16 land — it measures the **combined**
> effect of the Cerebras head, the §3 prompt levers (T9/T10/T13/T14/T15/T16), the
> Mistral tail capacity backstop, the earlier robustness levers, **and the T12
> scorer-parity fix**, not any one alone; that run also re-seeds the baseline
> under the corrected scorer (`SK-QUAL-005`), so its diff is read as a one-time
> migration. Both workflows already wire all six card-free free-chain keys
> (`lanes.ts`), mirrored to GitHub Actions secrets by
> [`scripts/mirror-secrets-gha.sh`](../../scripts/mirror-secrets-gha.sh)
> (verified by `scripts/verify-secrets.sh`), so the cron runs the real chain
> unattended — no human step required.
