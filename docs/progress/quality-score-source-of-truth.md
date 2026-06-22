# Engine quality — source of truth (progress bar)

> **What this is.** The single progress tracker for **NL→SQL engine
> quality**: where the number is today, what we have tried to move it (and how
> much), and what we have **not** tried yet. A *log and a backlog*, not a
> decision record — every decision lives in its canonical home, referenced by
> ID (`CLAUDE.md` §P3).
>
> **Authority.** On any conflict the canonical sources win, in order:
> [`GLOBAL-025`](../decisions/GLOBAL-025-north-star.md) (KPI floors) ·
> [`GLOBAL-027`](../decisions/GLOBAL-027-pre-alpha-gate.md) (gate thresholds) ·
> [`quality-eval/FEATURE.md`](../features/quality-eval/FEATURE.md) (`Status:`) ·
> [`llm-router/FEATURE.md`](../features/llm-router/FEATURE.md) (system under
> test). If this file disagrees, they win and this file is the bug.
>
> **Scope guard.** Every entry stays inside the **strict-$0, no-credit-card**
> free approach ([`GLOBAL-013`](../decisions/GLOBAL-013-free-tier-bundle-budget.md) /
> [`GLOBAL-026`](../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md));
> frontier/agentic lanes are an *ablation reference* (`SK-QUAL-004`), not a
> place we spend to inflate the headline.

## 1. Why engine quality is the #1 acquisition lever (not just an engine nicety)

The pre-alpha gate ([`GLOBAL-027`](../decisions/GLOBAL-027-pre-alpha-gate.md))
blocks **every "do-work" surface** until the **free chain** clears **BIRD-dev
EX ≥ 0.65 AND Spider 2.0-lite EX ≥ 0.75**. That gate sits at the end of all five
canonical ICP flows ([`GLOBAL-032`](../decisions/GLOBAL-032-top-5-user-flows-canonical.md)):
every walker today reaches the first query and **dead-ends at gate-403**
(verified 2026-06-04). So free-chain BIRD/Spider EX is the valve on the inbound
funnel — moving it is moving acquisition. The gate surfaces render the two
numbers as live progress bars from `apps/api/src/gate/eval-baseline.ts`.

## 2. The progress bar (evidence-based; every number sourced)

| KPI (free chain) | Now | Gate floor (GLOBAL-027) | Phase-2 floor (GLOBAL-025) | Source |
|---|---|---|---|---|
| **BIRD-dev reasoning EX** (match among questions that produced SQL — capacity-independent) | **0.521** (was 0.354 on 2026-05-18) | — | — | canonical 500-q run 2026-06-19 (260/499); was 0.525 (261/497) on 2026-06-12 |
| BIRD-dev EX (raw — the gate metric) | **0.520** (was 0.522 on 2026-06-12; 0.318 on 2026-05-18) | ≥ 0.65 | ≥ 0.60 | canonical 500-q 6-provider GHA run 2026-06-19 (260/500, `no_sql` 1; 3 windows, `SK-QUAL-013`); flat vs 0.522 — McNemar b=38/c=37, p=0.50 |
| Spider 2.0-lite EX (raw) | **0.1852** (was 0.1704 on 2026-06-12; 0.12 on 2026-06-09) | ≥ 0.75 | report only (Phase-3 ≥ 0.15) | canonical 135-q GHA run 2026-06-17 after the Gemini free-tier key heal (25/135; reasoning EX 0.198; `no_sql` 36 → 9, now capacity-only); same-seed smoke 0.15 → 0.25 |
| free-vs-agentic-frontier delta | **null** (lane not yet run) | — | ≤ 25 pp (`SK-QUAL-004`) | `SK-QUAL-004`; agentic lane opt-in (`SK-QUAL-009`) |

**How to read the two BIRD rows.** Raw EX (the gate metric) also pays
chain-exhaustion `no_sql`; reasoning EX isolates SQL quality from capacity. T18
+ T19 closed the once-30–70% divergence (06-19 canonical `no_sql` is **1**). The
remaining gap to the floor is **SQL reasoning** (mismatches), not availability.

**Where the losses are now** (canonical 500-q BIRD run, 2026-06-19): match 260 ·
**mismatch 238** · exec_error 1 · `no_sql` 1 — the loss is now almost purely
**SQL reasoning** (mismatches). The `SK-QUAL-014` classifier buckets the 238
(`bun analyze-mismatches`, tags non-exclusive): `literal_diff` **90** ·
`agg_fn_diff` 58 · `more_subqueries` 43 · `missing_DISTINCT` 42 ·
`col_count_diff` 37 · `fewer_tables` 33 · `extra_DISTINCT` 31 ·
`other_predicate_or_value` 30. **The literal axis re-ranks §4 #2a
(value-retrieval) down:** `literal_diff` is the *largest* tag (90, 38%) yet
**`literal_only` is 0** (`literal_case_only` 6; `date_literal_only` 2 total / 0
standalone, §4 #2c) — *no* mismatch is recoverable by fixing literals alone
(each rides a structural error), falsifying the "do-first" read the
`SK-QUAL-015` 12.8% column-name ceiling implied (§4 #2). **Schema-link recall
is *not* the bottleneck either**
(`fewer_tables` 33/238, pre-T21); the dominant mass is structural **reasoning**
(grain, subquery shape), now **saturated** on directives (06-19 re-run flat,
McNemar p=0.50) ⇒ the path to the floor is the *reasoning* levers (§4 #1
similarity-retrieved few-shot, §4 #3 self-consistency). Spider's
residual `no_sql` is **9** (capacity-only post-Gemini-heal, §6); its
newly-answered questions mostly produced *wrong* SQL ⇒ SQL reasoning too —
column pruning (§4 #2b) helps it via *distractor* removal (T19: 0.15 → 0.25).

> **How these numbers are produced.** `tools/eval/src/runner.ts` drives
> `router.ts::plan()` over the SQLite fixture, scores EX (BIRD `SK-QUAL-010` ·
> Spider `SK-QUAL-008`); `bun analyze-mismatches` buckets mismatches
> (`SK-QUAL-014`), `bun column-coverage` the column-prune ceiling
> (`SK-QUAL-015`). **PR CI never fires real keys** (`SK-QUAL-002`).

## 3. What we have tried (with how, and how much)

Rows run reverse-chronological (newest first). The `#` is a stable id, not a
rank. "How much" is **measured** (from the harness) or **est.** (from the
cited paper/ablation). T1/T9–T16 shipped unmeasured (the pipeline was broken
until T17) and were first measured *together* in T17; T18+T19 have a clean
same-seed A/B.

| # | Lever | How exactly | How much | Canonical home / status |
|---|---|---|---|---|
| T23 | **Similarity-retrieved few-shot — core + mask + pool + T9 ablation** | Pure `few-shot-select.ts`: value + schema-identifier masking (`maskWithSchema`, table/column words → `col`, so same-shape questions over *unrelated* schemas collapse to one skeleton — DAIL §4.1 cross-domain) + masked-token Jaccard + schema-aware top-k `selectExemplarsForSchema`. Curated pool (12 rows, one per `SK-QUAL-014` bucket) + `buildPlanSystem(goal,schema,k)`: the per-lever **T9 ablation** — default off ⇒ static `PLAN_SYSTEM`; `k>0` (eval only) swaps in the retrieved prefix. §4 #1 retrieval half; ≈+3–5 pp beyond static T9. | **measured (offline):** precision@1 = 12/12, lift +0.595; ablation off-path byte-identical, retrieved `k=3` prefix 0.935× static (token-negative). Prod byte-identical (T8 + baselines untouched); EX → next dispatch A/B | [`SK-LLM-041`](../features/llm-router/decisions/SK-LLM-041-similarity-retrieved-few-shot.md) — core + mask + pool + T9 ablation shipped; only hot-path embedding index follows |
| T22 | **Aggregate-filter HAVING directive** | One `PLAN_DIRECTIVES` bullet: a threshold on a group's aggregate goes in HAVING after GROUP BY, not WHERE. Covers the **HAVING half** of E5 *Unaligned Aggregation Structure* that T15 (GROUP BY half) left; "keep per-row predicates in WHERE" bounds the regression. ≈55 tok | **prompt-only; saturated — 06-19 BIRD re-run flat** (McNemar p=0.50) | [`SK-LLM-040`](../features/llm-router/decisions/SK-LLM-040-aggregate-filter-having-directive.md) — shipped |
| T21 | **Join-bridge recall in schema pruning** | T19's FK closure was outbound-only; a junction table linking two goal-matched tables via generic FK names (`a`/`b`) matched no path and got dropped, making the join unplannable. `pruneSchemaForGoal` now also keeps any table that `REFERENCES` ≥ 2 goal-matched tables, seeded from the goal-matched set only ⇒ recall-monotonic + distractor-bounded | **measured (unit):** synthetic `student↔enroll↔course` bridge dropped → kept; one-endpoint referencer stays out. Recall monotone over T19. Real EX → next eval | [`SK-LLM-037`](../features/llm-router/decisions/SK-LLM-037-goal-relevant-schema-pruning.md) rev — shipped |
| T20 | **Capacity-honest budget stop** | Budget-stop on every-attempt ∈ {`rate_limited`,`circuit_open`}, one bounded `--capacity-wait-ms` retry, SHA-keyed resume — fixes the 2026-06-11 run scoring 246 breaker-wall rows as `no_sql` | **measurement honesty** — keeps a breaker wall out of the scores | [`SK-QUAL-013`](../features/quality-eval/decisions/SK-QUAL-013-capacity-honest-budget-stop.md) — shipped |
| T19 | **Goal-relevant schema pruning (planner prompt)** | `buildPlanUser` prunes the embedded DDL via pure `pruneSchemaForGoal`: keep token-matched tables + `REFERENCES` closure; full schema on any doubt (< 2 KB, < 5 tables, zero matches, ≥ 0.9 kept, unparseable, retry). Offline-verified first: 99.8% gold-table recall on BIRD-dev 500, −7.1% schema chars (Spider −26.5%) | **measured (A/B with T18):** same-seed BIRD smoke raw EX **37.3% → 51.3%**, `no_sql` 47 → 1; reproduced at 48.7% next quota-day. Capacity + distractor-removal lever (C3-SQL arXiv:2307.07306, RSL-SQL arXiv:2411.00073) | [`SK-LLM-037`](../features/llm-router/decisions/SK-LLM-037-goal-relevant-schema-pruning.md) — shipped |
| T18 | **Workers-AI planner leg revived (structured response)** | The provider's string-only check rejected exactly the successful `plan` calls (REST returns pre-parsed JSON; `workers-ai:parse` on every chain-exhaustion row) — the free chain ran 5-of-6 since the leg shipped. Accept string *or* object | **measured (A/B with T19):** the leg answered 105/149 produced questions (0 in every prior run) — biggest single capacity recovery | [`SK-LLM-036`](../features/llm-router/decisions/SK-LLM-036-workers-ai-structured-response.md) — shipped |
| T17 | **Unblock + first-ever measurement of the eval pipeline** | gdown 6.1.0 dropped `--fuzzy` ⇒ every eval run since 2026-05-30 exit-2'd at fixture download, so T1/T9–T16 were never measured. Fix: BIRD → Aliyun OSS mirror, Spider → canonical `uc?id=` URL; `--throttle-ms` pacing ([`SK-QUAL-012`](../features/quality-eval/decisions/SK-QUAL-012-throttle-paced-measurement.md)) | **measured (first ever):** reasoning EX 35.4% → ≈ 52% (BIRD); Spider first-measured (reasoning 0.19 / raw 0.12, capacity-bounded). Verified the §5 capacity risk | #362 — shipped + measured |
| T16 | **Numeric-text-cast directive** | One `PLAN_DIRECTIVES` bullet: CAST a `TEXT`-declared column used numerically (`'100' < '9'` lexicographic trap). ≈55 tok | targets *Implicit Type Conversion* (C1, [arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)) | [`SK-LLM-035`](../features/llm-router/decisions/SK-LLM-035-numeric-text-cast-directive.md) — shipped (#356); measured combined in T17 |
| T15 | **Group-by-grain directive** | One bullet: GROUP BY on "per/each/by" goals, omit for one total; non-aggregated SELECT columns must appear in GROUP BY. ≈45 tok | targets *Unaligned Aggregation Structure* (E5, arXiv:2501.09310) | [`SK-LLM-034`](../features/llm-router/decisions/SK-LLM-034-group-by-grain-directive.md) — shipped (#354); measured combined in T17 |
| T14 | **Count-grain directive** | One bullet: `COUNT(DISTINCT)` for distinct entities / one-to-many joins; `SELECT DISTINCT` for distinct lists; else keep duplicates. ≈50 tok | targets *Wrong COUNT Object* + *Missing DISTINCT* (arXiv:2501.09310) | [`SK-LLM-032`](../features/llm-router/decisions/SK-LLM-032-count-grain-directive.md) — shipped (#348); measured combined in T17 |
| T13 | **NULL-safe extremum directive** | One bullet: `WHERE <col> IS NOT NULL` before `ORDER BY … LIMIT`. ≈25 tok | SQLite sorts NULL first ⇒ false minimum on BIRD's dirty NULLs ([arXiv:2305.03111](https://arxiv.org/pdf/2305.03111)) | [`SK-LLM-029`](../features/llm-router/decisions/SK-LLM-029-null-safe-extremum.md) — shipped (#345); measured combined in T17 |
| T12 | **BIRD scorer parity (positional value tuples)** | `scoreOne` + Spider transpose read positional tuples (`.values()`), matching canonical BIRD `set(fetchall())` — aliases/casing no longer false-mismatch; multiset + ORDER-BY strictness retained | removes scorer deflation vs the name-keyed 0.318 baseline | [`SK-QUAL-010`](../features/quality-eval/decisions/SK-QUAL-010-bird-positional-tuple-parity.md) — shipped (#340); measured combined in T17 |
| T11 | **Mistral capacity backstop (chain tail)** | `mistral-large-latest` (card-free Experiment tier) appended behind OpenRouter on `plan`/`schema_infer`, prod + eval. Tail-only ⇒ strictly additive | **measured:** answered 5–21 questions per 150-q smoke, inverse to head availability | [`SK-LLM-028`](../features/llm-router/decisions/SK-LLM-028-mistral-capacity-backstop.md) — shipped (#338); measured combined in T17 |
| T10 | **Result-shape directives (projection + REAL-cast)** | Two bullets: select exactly the goal's columns; cast one operand of an integer ratio to REAL. ≈40 tok | extra-column projection (Open-SQL [arXiv:2405.06674](https://arxiv.org/pdf/2405.06674)) + integer-division truncation | [`SK-LLM-027`](../features/llm-router/decisions/SK-LLM-027-result-shape-directives.md) — shipped; measured combined in T17 |
| T9 | **Static few-shot exemplars (DAIL-SQL format half)** | `PLAN_SYSTEM` = directives + 3 static Question→strict-JSON exemplars. ≈250–350 tok/call | few-shot is the biggest prompt-only lever (DAIL-SQL [arXiv:2308.15363](https://arxiv.org/abs/2308.15363)); retrieval half = T23 (§4 #1) | [`SK-LLM-026`](../features/llm-router/decisions/SK-LLM-026-static-few-shot-plan-exemplars.md) — shipped; T9 ablated by T23 |
| T7 | **JSON-recovery fallback (reasoning-head preamble leaks)** | `parseJsonResponse` extracts the first brace-balanced `{…}` after strict parse fails | recovers `parse`→`no_sql` losses from `gpt-oss-120b` preamble leaks; strictly additive | [`SK-LLM-025`](../features/llm-router/decisions/SK-LLM-025-json-recovery-fallback.md) — shipped |
| T8 | **Greedy decoding parity (Workers-AI temperature 0)** | `{ messages, temperature: 0 }`, matching every other leg | reproducibility invariant for the `SK-QUAL-006` McNemar baseline | [`SK-LLM-024`](../features/llm-router/decisions/SK-LLM-024-greedy-decoding-parity.md) — shipped |
| T1 | **Cerebras (gpt-oss-120b) leads the planner tier** | `plan`/`schema_infer` chain → `[cerebras, gemini, groq, workers-ai, openrouter, mistral]`, identical eval + prod | frontier-class open reasoning head, card-free; answers most questions when within its ~5 RPM | [`SK-LLM-023`](../features/llm-router/decisions/SK-LLM-023-cerebras-planner-tier.md) — shipped; measured combined in T17 |
| T2–T6 | **Scaffold + measurement enablers** | T2 `withExecRetry` (3 attempts, exec-error-only) · T3 schema-fidelity directives (`SK-LLM-018`) · T4 BIRD `evidence` → goal · T5 hedged planner race (`SK-LLM-014`) · T6 Spider canonical scorer port | T2 est. +4.6 pp (MAC-SQL arXiv:2312.11242); T3 est. +3–5 pp (DIN/C3/DAIL); T4 parity, T5 latency, T6 measurement | shipped |

## 4. What we have NOT tried yet (ranked backlog, all free)

Ranked by expected pp-per-effort on the **free chain**. Each is card-free and
agent-runnable; promote into an `SK-*`/`GLOBAL-*` before implementing
(`CLAUDE.md` §P4).

1. **Similarity-retrieved few-shot exemplars (full DAIL-SQL).** Core + masking +
   schema-aware selector + the **curated pool (12 rows, precision@1 = 12/12)** +
   the **per-lever T9 ablation `buildPlanSystem` ALL SHIPPED 2026-06-21** (T23 /
   `SK-LLM-041`): default off ⇒ static `PLAN_SYSTEM` byte-for-byte; the eval
   `--retrieve-exemplars k` flag swaps it for the retrieved prefix (0.935× the
   static token budget), so the next dispatch A/Bs greedy-static vs
   greedy-retrieved (est. +3–5 pp, arXiv:2308.15363). **Only the hot-path
   embedding index over a larger pool remains.** EX delta = next dispatch.
2. **Value retrieval + column-level pruning (the M-Schema half T19 left) —
   DEMOTED 2026-06-19 by the `SK-QUAL-014` literal axis.** The column-name
   ceiling (`SK-QUAL-015`: 12.8% of needed columns named by *value*) implied
   value-retrieval was the additive, do-first top lever; the literal-diff
   measurement on the *real* 06-19 baseline (§2: `literal_only` = 0) overturns
   that — a sample-value prompt flips ~0 rows standalone. So value-retrieval is
   re-ranked **below** the reasoning levers (#3/#1); revisit only *coupled* with
   a structural lever. The prod side is additionally blocked on an unresolved
   privacy decision — feeding user cell-values to the free third-party chain —
   see `quality-eval/FEATURE.md` Open questions.
   - **2b. Column pruning (recall-gated).** Token-only pruning drops 40% of
     needed columns ⇒ unsafe without the key-protection rule, and even then
     ~87%-capped; its win is mainly Spider distractor removal (T19:
     0.15→0.25). Gate: run `SK-QUAL-015` against introspected DDL for
     per-column recall ≥ a T19-grade floor before wiring into `buildPlanUser`.
   - **2c. Date-literal normalisation directive — FALSIFIED standalone
     2026-06-20.** `SK-QUAL-014` date sub-axis: `date_literal_only` = 2 total,
     **0 standalone** (every date diff also carries a structural error) ⇒ parked,
     same verdict as #2a. Rationale: `SK-QUAL-014` body.
3. **Self-consistency majority vote (N=3, free tokens) — the top reasoning
   lever; built end-to-end bar dispatch, SHIPPED 2026-06-20/21 (`SK-QUAL-017`).**
   Sample N plans at temperature > 0 on a separate code path, execute,
   majority-vote the **result set** (the answer, not the SQL string) — attacks
   the dominant *structural-reasoning* mass (grain/shape) §2 isolated. Vote core
   + execution half + `PlanRequest.temperature` sampling + runner
   `--self-consistency N`/`--sc-temperature T` + the smoke `workflow_dispatch`
   vehicle (no-emit, baseline-safe) all shipped + offline-proven; only the EX
   dispatch remains. Free-chain cost is quota.
4. **A second card-free tail backstop beyond Mistral (T11).** `NVIDIA_API_KEY`
   is a finite ~5,000-credit pool — a `GLOBAL-013` failure; re-rank only if
   post-T18 runs still show chain-exhaustion `no_sql`.
5. **Corrected-set evaluation (BIRD 52.8% annotation errors).** Score against
   UIUC corrected variants, report Spearman vs canonical — honesty, not
   accuracy; license check first (`SK-QUAL-003`).
6. **Internal `db.create` accepted-answer eval.** Blocked on a privacy-stripped
   R2 export; **no user data ever** enters the harness.
7. **Per-stage confidence calibration → hard-plan routing.** Replace the
   `confidence: 1.0` placeholder with harness-calibrated floors so
   `SK-LLM-022`'s threshold fires on the right questions.

## 5. Guardrails — what would *degrade* a KPI (don't)

- **Spending to inflate the headline.** The headline is the **free** chain
  and the free-vs-frontier delta (`SK-QUAL-004`); a frontier win that widens
  the delta is a regression on the north-star (`GLOBAL-025`).
- **Eval ≠ production chain.** The eval free lane MUST mirror
  `apps/api/src/llm-router.ts` (`tools/eval/src/lanes.ts` comment). T19
  holds this by construction — prod and eval share `buildPlanUser`.
- **Optimising BIRD alone.** Two thresholds force generalisation
  (`GLOBAL-027`); move both or neither.
- **PR CI firing real keys.** Keep it mocked (`SK-QUAL-002`).
- **Overlapping or back-to-back eval dispatches.** Two runs share every
  free-tier quota: the 2026-06-10 Spider smoke that overlapped a BIRD run
  and the 2026-06-11 full run dispatched 4th-that-night were both
  quota-confounded and had to be discarded. Dispatch sequentially, on a
  fresh quota window, one dataset at a time.
- **A low-RPM provider at the chain head can starve capacity.** Cerebras
  free tier is ~5 RPM / 30K TPM; `--throttle-ms` pacing (`SK-QUAL-012`) +
  the T11/T18 fallbacks absorb it, and T20 keeps any residual wall out of
  the scores — but don't add another low-RPM head.
- **A non-deterministic free-chain leg.** Greedy `temperature: 0` on every
  planner leg (T8) is a reproducibility invariant; self-consistency (§4 #3)
  must sample on a separate code path.

## 6. Verification log + next measurement

The dated, evidence-referenced log of every shipped lever lives in
[`quality-score-verification-log.md`](./quality-score-verification-log.md)
(append-only; split out per `CLAUDE.md` §D4). §3 above is the current-state
view of the same levers.

> **Measurement state.** Canonical numbers + sourcing are in §2 (mirrored to
> `eval-baseline.ts`); full runs are sequential per §5, resumed across quota
> windows (`SK-QUAL-013`), dispatched via the `GH_TOKEN_WORKFLOW` PAT (no human
> click). The flat 06-19 BIRD re-run **confirms the directive levers have
> saturated**, and the `SK-QUAL-014` literal + date axes (`literal_only` /
> `date_literal_only` standalone both 0, §2) **falsify value-retrieval as the
> top lever**. **Next:** both reasoning levers are now built end-to-end bar the
> canonical dispatch — §4 **#3 self-consistency** (`SK-QUAL-017`: vote + sampling
> + runner + smoke dispatch vehicle) and §4 **#1 similarity-retrieved few-shot**
> (`SK-LLM-041`: core + mask + pool + the **T9 ablation `buildPlanSystem` +
> `--retrieve-exemplars` flag shipped 2026-06-21**; only the hot-path embedding
> index remains). Both EX deltas = the next canonical dispatch. value-retrieval
> (#2a) demoted + privacy-gated; T19 per-lever ablation still pending.
