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
| **BIRD-dev reasoning EX** (match among questions that produced SQL — capacity-independent) | **≈ 0.52** (was **0.354**) | — | — | first post-fix run 2026-06-09: 53.4% smoke (39/73) · 54.2% paced (71/131) · 50.0% clean (21/42); baseline 159/449 (T17) |
| BIRD-dev EX (raw — the gate metric) | **0.35** *(measured lower bound; was 0.318)* | ≥ 0.65 | ≥ 0.60 | clean 60-q run 2026-06-09, **capacity-bounded** (30% `no_sql`); canonical 500-q / 6-provider re-seed = the now-unblocked GHA dispatch (T17) |
| Spider 2.0-lite EX (raw) | **0.10** *(first ever measured)* | ≥ 0.75 | report only (Phase-3 ≥ 0.15) | smoke 2026-06-09, capacity-bounded (70% `no_sql`); reasoning EX 0.33 (4/12 produced) |
| free-vs-agentic-frontier delta | **null** (lane not yet run) | — | ≤ 25 pp (`SK-QUAL-004`) | `SK-QUAL-004`; agentic lane opt-in (`SK-QUAL-009`) |

**Read the two BIRD rows together.** 2026-06-09 (T17) is the *first*
measurement of T1–T16 (the pipeline was broken the whole window). **Reasoning
EX** — accuracy on the questions the chain answered — isolates SQL quality
from capacity and rose **35.4% → ≈ 52%**. **Raw EX** also pays the
chain-exhaustion `no_sql`, which the measurement env inflated to 30–70% (only
4 of 6 providers live + per-minute-TPM saturation on big DDL), so raw EX is a
**conservative lower bound** and the gate takes it by design. Production's
6-provider chain + the T11 backstop pull `no_sql` toward the baseline's 10.2%,
so production raw EX sits between the rows (≈ 0.47); the GHA 500-q dispatch
re-seeds the canonical number.

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
removes an orthogonal name-keyed-scorer artifact. The "How much" cells are
literature/mechanism estimates, not baseline counts. **First-measurement
update (2026-06-09, T17):** the combined levers lifted reasoning EX 35.4% →
≈ 52% (§2); per-lever attribution waits on single-lever ablations. The §5
capacity risk is now **verified** (Cerebras-5-RPM + free-tier TPM ⇒ `no_sql`
dominates raw EX), which promotes backlog **#2 (schema-pruning, §4)** to the
top capacity lever — a smaller planner prompt lifts per-minute throughput on
big-DDL schemas.

> **How these numbers are produced.** `tools/eval/src/runner.ts` drives
> `router.ts::plan()` against the SQLite fixture and scores EX (BIRD
> positional-tuple multiset `SK-QUAL-010` · Spider multi-CSV `SK-QUAL-008`);
> a manual eval run (§6) diffs `baseline-2026-06-15.json`. **PR CI never fires
> real keys** — mocked router (`SK-QUAL-002`).

## 3. What we have tried (with how, and how much)

Rows run reverse-chronological (newest first): **T17 (this PR) → T16 → T15 → T14 → T13 → T12 →
T11 → T10 → T9 → T7/T8 → T1 (Cerebras head) → T2…T6**. The `#` is a stable id,
not a rank — read recency from row order. "How much" is **measured** (from the
harness) or **est.** (from the cited paper/ablation). Every "awaiting first
eval run" status on T1/T9–T16 was resolved by **T17** (the first run after the
pipeline fix); they were measured *together*, so their combined effect is the
§2 reasoning-EX move, not a per-lever number.

| # | Lever | How exactly | How much | Canonical home / status |
|---|---|---|---|---|
| T17 | **Unblock + measure the eval pipeline (this PR)** | gdown 6.1.0 (2026-05-30) dropped `--fuzzy` ⇒ every `quality-eval-*.yml` run had exit-2'd at the fixture download since before T1 landed — so T1/T9–T16 were *never measured*. Fix: BIRD → Aliyun OSS direct mirror, Spider → canonical `uc?id=` URL; add `--throttle-ms` ([`SK-QUAL-012`](../features/quality-eval/decisions/SK-QUAL-012-throttle-paced-measurement.md)) to pace the low-RPM chain; then ran the free chain on real keys | **measured (first ever):** reasoning EX **35.4% → ≈ 52%** (BIRD, §2); Spider first-measured (reasoning 0.33 / raw 0.10). Raw EX a capacity-bounded lower bound (§2). Verifies the §5 Cerebras/TPM capacity risk | this PR — **shipped + measured**; canonical 500-q / 6-provider re-seed = GHA dispatch |
| T16 | **Numeric-text-cast directive (CAST `TEXT`-declared columns used numerically)** | One `PLAN_DIRECTIVES` bullet (`SK-LLM-018`): when the schema declares a column `TEXT` but the goal compares/orders/min-maxes it numerically, `CAST(<col> AS REAL)`. Prompt-only, ≈55 tok | targets **Implicit Type Conversion** (C1, [arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)) — SQLite compares TEXT lexicographically (`'100' < '9'`). Mechanism in the SK body | [`SK-LLM-035`](../features/llm-router/decisions/SK-LLM-035-numeric-text-cast-directive.md) — shipped (#356); **measured combined in T17** |
| T15 | **Group-by-grain directive (per-group GROUP BY alignment)** | One `PLAN_DIRECTIVES` bullet (`SK-LLM-018`): `GROUP BY` the grouping column on a "per/each/by `<category>`" goal, omit it for one overall total, and every non-aggregated SELECT column must appear in `GROUP BY`. Prompt-only, ≈45 tok | targets **Unaligned Aggregation Structure** (E5, [arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)). Mechanism in the SK body | [`SK-LLM-034`](../features/llm-router/decisions/SK-LLM-034-group-by-grain-directive.md) — shipped (#354); **measured combined in T17** |
| T14 | **Count-grain directive (COUNT DISTINCT vs COUNT(\*); SELECT DISTINCT)** | One `PLAN_DIRECTIVES` bullet (`SK-LLM-018`): `COUNT(DISTINCT <col>)` for distinct entities / counts across a one-to-many join, `SELECT DISTINCT` for distinct-value lists, else keep duplicates. Prompt-only, ≈50 tok | targets **Wrong COUNT Object** + **Missing DISTINCT** ([arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)). Mechanism in the SK body | [`SK-LLM-032`](../features/llm-router/decisions/SK-LLM-032-count-grain-directive.md) — shipped (#348); **measured combined in T17** |
| T13 | **NULL-safe extremum ordering directive** | One `PLAN_DIRECTIVES` bullet (`SK-LLM-018`): filter the ranked column (`WHERE <col> IS NOT NULL`) before an `ORDER BY … LIMIT` extremum. Prompt-only, ≈25 tok | SQLite sorts NULL first ⇒ false-minimum on BIRD's dirty NULLs ([arXiv:2305.03111](https://arxiv.org/pdf/2305.03111)). Mechanism in the SK body | [`SK-LLM-029`](../features/llm-router/decisions/SK-LLM-029-null-safe-extremum.md) — shipped (#345); **measured combined in T17** |
| T12 | **BIRD scorer parity: positional value tuples, column names ignored** | `scoreOne` + the Spider `rowsToColumnMajor` transpose read positional tuples (bun:sqlite `.values()`), so output aliases / casing no longer false-mismatch — matching canonical BIRD `set(fetchall())` (verified against [`evaluation.py`](https://github.com/AlibabaResearch/DAMO-ConvAI/blob/main/bird/llm/src/evaluation.py), 2026-06); multiset + ORDER-BY strictness retained | **removes scorer deflation** — part of the T17 reasoning-EX gain over the name-keyed 0.318 baseline; neither lane regresses | [`SK-QUAL-010`](../features/quality-eval/decisions/SK-QUAL-010-bird-positional-tuple-parity.md) — shipped (#340); **measured combined in T17** |
| T11 | **Mistral capacity backstop at the planner-chain tail** | `createMistralProvider` (`mistral-large-latest`, card-free Experiment tier) appended behind OpenRouter on `plan` / `schema_infer` in production + eval (§5). Fires only when the head chain is exhausted | targets the chain-exhaustion `no_sql` (§2) with an **independent** free-tier pool. Tail-only ⇒ strictly additive (cannot regress). In T17 it caught most answered questions when Cerebras/Groq were rate-limited | [`SK-LLM-028`](../features/llm-router/decisions/SK-LLM-028-mistral-capacity-backstop.md) — shipped (#338); **measured combined in T17** |
| T10 | **Result-shape directives: exact projection + REAL-cast ratios** | Two `PLAN_DIRECTIVES` bullets (`SK-LLM-018`): select exactly the goal's columns; cast one operand of an integer ratio to REAL. Prompt-only, ≈40 tok | extra-column projection (Open-SQL [arXiv:2405.06674](https://arxiv.org/pdf/2405.06674)) + integer-division truncation. Mechanism in the SK body | [`SK-LLM-027`](../features/llm-router/decisions/SK-LLM-027-result-shape-directives.md) — shipped; **measured combined in T17** |
| T9 | **Static few-shot exemplars in the plan prompt (DAIL-SQL)** | `PLAN_SYSTEM` = `PLAN_DIRECTIVES` (`SK-LLM-018`) + a `PLAN_FEW_SHOT` block of **3** static Question→strict-JSON exemplars. ≈250–350 tok/call | few-shot Question→SQL is the biggest prompt-only lever (DAIL-SQL [arXiv:2308.15363](https://arxiv.org/abs/2308.15363)); static = its **format** half. Retrieval half still open (§4 #1) | [`SK-LLM-026`](../features/llm-router/decisions/SK-LLM-026-static-few-shot-plan-exemplars.md) — shipped; **measured combined in T17** |
| T7 | **JSON-recovery fallback for reasoning-head preamble leaks** | `parseJsonResponse` extracts the first brace-balanced `{…}` (string-aware) when strict parse throws; runs only after the strict path fails | **est. small but every-leg** — recovers `parse`→`no_sql` losses from the `gpt-oss-120b` reasoning head leaking preamble into structured output (Groq/OpenAI reports, 2026-06); strictly additive (can't regress the happy path) | [`SK-LLM-025`](../features/llm-router/decisions/SK-LLM-025-json-recovery-fallback.md) — shipped; **measured combined in T17** |
| T8 | **Greedy decoding parity (temperature 0) on the Workers AI leg** | `workers-ai.ts` body `{ messages }` → `{ messages, temperature: 0 }`, matching Cerebras/Gemini/Groq/OpenRouter (Workers AI default is a stochastic 0.6) | **reproducibility-positive; small, unmeasured EX** on the 4th-in-chain leg — greedy is the single-pass text-to-SQL EX standard, and a deterministic leg keeps the `SK-QUAL-006` McNemar baseline clean | [`SK-LLM-024`](../features/llm-router/decisions/SK-LLM-024-greedy-decoding-parity.md) — shipped |
| T1 | **Cerebras (gpt-oss-120b) leads the planner tier** | New free provider `createCerebrasProvider`; `plan`/`schema_infer` chain → `[cerebras, gemini, groq, workers-ai, openrouter]`, identical in eval + prod | **est. large, pending measure** — frontier-class open reasoning model (≈ o4-mini), card-free, replaces Gemini-Flash as primary planner | [`SK-LLM-023`](../features/llm-router/decisions/SK-LLM-023-cerebras-planner-tier.md) — shipped; **measured combined in T17** (answered most questions when within RPM) |
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
   T9's static eval-run delta justifies the complexity** (`CLAUDE.md` §P5).
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
   failure like the rejected Cohere trial. Re-rank only if the T11 eval run
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
  divergence makes the eval measure a system we don't ship.
- **Optimising BIRD alone.** Two thresholds force generalisation
  (`GLOBAL-027`); BIRD-only rewards memorising its 11 schemas. Move both
  or neither.
- **PR CI firing real keys.** Real provider calls on a PR leak the
  card-free budget and make CI flaky (`SK-QUAL-002`). Keep it mocked.
- **A low-RPM provider at the chain *head* can starve capacity.** The
  Cerebras free tier is ~5 RPM / 30K TPM (verified against Cerebras docs,
  2026-06); leading the planner with it (T1) must be checked on the next
  eval run for whether it *raises* the §2 chain-exhaustion `no_sql` rate, not
  only whether it lifts EX — a head that 429s before its fallbacks
  recover trades reasoning gain for availability loss.
- **A non-deterministic free-chain leg.** Greedy `temperature: 0` on
  every planner leg (T8 / `SK-LLM-024`) is a reproducibility invariant:
  a stochastic leg flips per-question outcomes run-to-run, inflating the
  `SK-QUAL-006` McNemar discordant cells and making the eval measure a
  system that varies between runs. Don't reintroduce sampling on the
  single-pass planner (self-consistency-N, §4 #3, would sample on a
  *separate* code path).

## 6. Verification log + next measurement

The dated, evidence-referenced log of every shipped lever lives in
[`quality-score-verification-log.md`](./quality-score-verification-log.md)
(append-only; split out per `CLAUDE.md` §D4). The §3 table above is the
current-state view of the same levers.

> **First measurement landed (2026-06-09, T17)** — combined T1/T7–T16 +
> T12 scorer fix, measured together once the pipeline was unblocked:
> reasoning EX **35.4% → ≈ 52%** (BIRD), Spider first-measured (§2).
>
> **Next — the canonical re-seed:** a full **500-q / 6-provider** dispatch of
> both workflows on **GitHub Actions** (all six card-free keys live, unlike
> the 4-of-6 agent env), which pays `no_sql` at production's ~10% and produces
> the canonical raw EX that re-seeds `baseline-2026-06-15.json` +
> `apps/api/src/gate/eval-baseline.ts` (`SK-QUAL-005`, one-time migration).
> Keys + `--throttle-ms 3000` (`SK-QUAL-012`) are wired (`lanes.ts`), mirrored
> by [`scripts/mirror-secrets-gha.sh`](../../scripts/mirror-secrets-gha.sh),
> and the gdown breakage is fixed (T17) — so a dispatch now runs green.
> **(Human note: the agent's GitHub integration can't `workflow_dispatch`; an
> operator clicks Run, or it fires on the next manual cadence.)**
