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
inbound funnel — moving it is moving acquisition. The gate surfaces render the
two numbers as live progress bars from `apps/api/src/gate/eval-baseline.ts`,
so every entry in §2 is also what a blocked user sees.

## 2. The progress bar (evidence-based; every number sourced)

| KPI (free chain) | Now | Gate floor (GLOBAL-027) | Phase-2 floor (GLOBAL-025) | Source |
|---|---|---|---|---|
| **BIRD-dev reasoning EX** (match among questions that produced SQL — capacity-independent) | **0.525** (was 0.354 on 2026-05-18) | — | — | canonical 500-q run 2026-06-12 (261/497); post-T18/T19 smokes read 51.7% / 50.7% |
| BIRD-dev EX (raw — the gate metric) | **0.522** (was 0.35 lower bound; 0.318 on 2026-05-18) | ≥ 0.65 | ≥ 0.60 | canonical 500-q 6-provider GHA run 2026-06-12 (261/500, `no_sql` 3; resumed across 5 quota windows per `SK-QUAL-013`); same-seed smoke A/B 0.3733 → 0.5133 |
| Spider 2.0-lite EX (raw) | **0.1852** (was 0.1704 on 2026-06-12; 0.12 on 2026-06-09) | ≥ 0.75 | report only (Phase-3 ≥ 0.15) | canonical 135-q GHA run 2026-06-17 after the Gemini free-tier key heal (25/135; reasoning EX 0.198; `no_sql` 36 → 9, now capacity-only); same-seed smoke 0.15 → 0.25 |
| free-vs-agentic-frontier delta | **null** (lane not yet run) | — | ≤ 25 pp (`SK-QUAL-004`) | `SK-QUAL-004`; agentic lane opt-in (`SK-QUAL-009`) |

**How to read the two BIRD rows.** Raw EX (the gate metric) also pays
chain-exhaustion `no_sql`; reasoning EX isolates SQL quality from capacity.
Until 2026-06-10 the two diverged hard (`no_sql` 30–70% in measurement envs).
The second lever wave closed most of the divergence: the revived Workers-AI
leg (T18) + schema pruning (T19) cut same-seed smoke `no_sql` **47 → 1** and
lifted raw EX **37.3% → 51.3%**, and the harness now refuses to score a
rate-limit breaker wall as `no_sql` at all (T20). The remaining gap to the
gate floor is **SQL reasoning** (mismatches), no longer availability — §4's
levers target it.

**Where the losses are now** (canonical 500-q run, 2026-06-12): match 261 ·
**mismatch 236** · exec_error 0 · `no_sql` 3 — on BIRD the loss is now
almost purely **SQL reasoning** (mismatches). The offline mismatch classifier
([`SK-QUAL-014`](../features/quality-eval/decisions/SK-QUAL-014-offline-mismatch-classifier.md),
`bun run --filter @nlqdb/eval classify-mismatches`) buckets those 236 by the
axis predicted vs gold SQL diverge on: **table_set 72 · value_diff 62 · agg_fn
61 · subquery 54 · distinct 48 · order_limit 23 · group_by 20** (a mismatch can
hit several axes). The mass is **broad — no single class > ~31%** — which
favours the broad-spectrum §4 levers (retrieved few-shot #1, value retrieval
#2) over another narrow directive beyond T10–T16. A first ad-hoc cut put
table_set at 57%; a quoted-identifier (`"transactions_1k"`) parse bug inflated
it — the corrected, quote-aware classifier is pinned by tests. A date-format
trap (plausible from spot-checks) measured small (2 separator diffs / 9
`substr`), so it is **not** a lever. Spider's residual `no_sql` was **36/135** on the
2026-06-12 run — dominated by **`gemini:http_4xx`** (the shared free-tier
`GEMINI_API_KEY` was denied; `SK-LLM-039`) plus `mistral:network`, **not** an
oversized-DDL problem (falsified offline 2026-06-13: all 135 SQLite-subset
schemas are ≤ 7,520 chars / ~1,880 tok, p90 ~1,531 — a ~1.9 K-tok schema
can't overflow Gemini's 1 M ctx or Mistral's 128 K). **The 2026-06-17 re-run
after the key was restored confirms it:** `no_sql` dropped **36 → 9** and the
`no_sql_reasons` tally carries **no `gemini:http_4xx` / `auth_denied`** —
Gemini now answers, and the residual 9 are capacity-only (`circuit_open`
across providers + `mistral:network` + `workers-ai:parse`). Raw EX rose
0.1704 → 0.1852, but the 27 newly-answered questions mostly produced *wrong*
SQL (reasoning EX 0.232 → 0.198), so the Spider bottleneck is now **SQL
reasoning, not availability** — §4's levers. Column-level pruning (§4 #2)
still helps Spider via *distractor* removal (T19's table-pruning lifted the
smoke 0.15 → 0.25), not the residual capacity `no_sql`.

> **How these numbers are produced.** `tools/eval/src/runner.ts` drives
> `router.ts::plan()` against the SQLite fixture and scores EX (BIRD
> positional-tuple multiset `SK-QUAL-010` · Spider multi-CSV `SK-QUAL-008`);
> a manual eval run (§6) diffs `baseline-2026-06-15.json`. **PR CI never fires
> real keys** — mocked router (`SK-QUAL-002`).

## 3. What we have tried (with how, and how much)

Rows run reverse-chronological (newest first). The `#` is a stable id, not a
rank. "How much" is **measured** (from the harness) or **est.** (from the
cited paper/ablation). T1/T9–T16 shipped unmeasured (the pipeline was broken
until T17) and were first measured *together* in T17; T18+T19 have a clean
same-seed A/B.

| # | Lever | How exactly | How much | Canonical home / status |
|---|---|---|---|---|
| T20 | **Capacity-honest budget stop (this PR)** | Autopsy of the first full 500-q dispatch (2026-06-11, raw 0.214): 246/283 `no_sql` rows were all-`circuit_open` fast-fails — a 429 opens the breaker for its `Retry-After` window, so the all-`rate_limited` stop predicate never matched the wall; the run also overlapped three smokes (quota confound) ⇒ **discarded for scoring**. Fix: budget-stop on every-attempt ∈ {`rate_limited`,`circuit_open`}, one bounded `--capacity-wait-ms` retry (≤ 5/run), SHA-keyed full-run resume cache | **measurement honesty, not accuracy** — stops a breaker wall from scoring as engine failure; raw EX becomes resumable-complete instead of capacity-poisoned | [`SK-QUAL-013`](../features/quality-eval/decisions/SK-QUAL-013-capacity-honest-budget-stop.md) — this PR |
| T19 | **Goal-relevant schema pruning (planner prompt)** | `buildPlanUser` prunes the embedded DDL via pure `pruneSchemaForGoal`: keep token-matched tables + `REFERENCES` closure; full schema on any doubt (< 2 KB, < 5 tables, zero matches, ≥ 0.9 kept, unparseable, retry). Offline-verified first: 99.8% gold-table recall on BIRD-dev 500, −7.1% schema chars (Spider −26.5%) | **measured (A/B with T18):** same-seed BIRD smoke raw EX **37.3% → 51.3%**, `no_sql` 47 → 1; reproduced at 48.7% next quota-day. Capacity + distractor-removal lever (C3-SQL arXiv:2307.07306, RSL-SQL arXiv:2411.00073) | [`SK-LLM-037`](../features/llm-router/decisions/SK-LLM-037-goal-relevant-schema-pruning.md) — shipped (this PR) |
| T18 | **Workers-AI planner leg revived (structured response)** | The REST endpoint returns valid-JSON model output **pre-parsed as an object**; the provider's string-only check rejected exactly the successful `plan` calls (`workers-ai:parse` on every chain-exhaustion row) — the free chain had effectively run 5-of-6 since the leg shipped. Accept string *or* object; re-serialize objects into the shared JSON parser | **measured (A/B with T19, above):** the leg answered 105/149 produced questions in the A/B run (0 in every prior run) — the biggest single capacity recovery so far | [`SK-LLM-036`](../features/llm-router/decisions/SK-LLM-036-workers-ai-structured-response.md) — shipped (this PR) |
| T17 | **Unblock + first-ever measurement of the eval pipeline** | gdown 6.1.0 dropped `--fuzzy` ⇒ every eval run since 2026-05-30 exit-2'd at fixture download, so T1/T9–T16 were never measured. Fix: BIRD → Aliyun OSS mirror, Spider → canonical `uc?id=` URL; `--throttle-ms` pacing ([`SK-QUAL-012`](../features/quality-eval/decisions/SK-QUAL-012-throttle-paced-measurement.md)) | **measured (first ever):** reasoning EX 35.4% → ≈ 52% (BIRD); Spider first-measured (reasoning 0.19 / raw 0.12, capacity-bounded). Verified the §5 capacity risk | #362 — shipped + measured |
| T16 | **Numeric-text-cast directive** | One `PLAN_DIRECTIVES` bullet: CAST a `TEXT`-declared column used numerically (`'100' < '9'` lexicographic trap). ≈55 tok | targets *Implicit Type Conversion* (C1, [arXiv:2501.09310](https://arxiv.org/pdf/2501.09310)) | [`SK-LLM-035`](../features/llm-router/decisions/SK-LLM-035-numeric-text-cast-directive.md) — shipped (#356); measured combined in T17 |
| T15 | **Group-by-grain directive** | One bullet: GROUP BY on "per/each/by" goals, omit for one total; non-aggregated SELECT columns must appear in GROUP BY. ≈45 tok | targets *Unaligned Aggregation Structure* (E5, arXiv:2501.09310) | [`SK-LLM-034`](../features/llm-router/decisions/SK-LLM-034-group-by-grain-directive.md) — shipped (#354); measured combined in T17 |
| T14 | **Count-grain directive** | One bullet: `COUNT(DISTINCT)` for distinct entities / one-to-many joins; `SELECT DISTINCT` for distinct lists; else keep duplicates. ≈50 tok | targets *Wrong COUNT Object* + *Missing DISTINCT* (arXiv:2501.09310) | [`SK-LLM-032`](../features/llm-router/decisions/SK-LLM-032-count-grain-directive.md) — shipped (#348); measured combined in T17 |
| T13 | **NULL-safe extremum directive** | One bullet: `WHERE <col> IS NOT NULL` before `ORDER BY … LIMIT`. ≈25 tok | SQLite sorts NULL first ⇒ false minimum on BIRD's dirty NULLs ([arXiv:2305.03111](https://arxiv.org/pdf/2305.03111)) | [`SK-LLM-029`](../features/llm-router/decisions/SK-LLM-029-null-safe-extremum.md) — shipped (#345); measured combined in T17 |
| T12 | **BIRD scorer parity (positional value tuples)** | `scoreOne` + Spider transpose read positional tuples (`.values()`), matching canonical BIRD `set(fetchall())` — aliases/casing no longer false-mismatch; multiset + ORDER-BY strictness retained | removes scorer deflation vs the name-keyed 0.318 baseline | [`SK-QUAL-010`](../features/quality-eval/decisions/SK-QUAL-010-bird-positional-tuple-parity.md) — shipped (#340); measured combined in T17 |
| T11 | **Mistral capacity backstop (chain tail)** | `mistral-large-latest` (card-free Experiment tier) appended behind OpenRouter on `plan`/`schema_infer`, prod + eval. Tail-only ⇒ strictly additive | **measured:** answered 5–21 questions per 150-q smoke, inverse to head availability | [`SK-LLM-028`](../features/llm-router/decisions/SK-LLM-028-mistral-capacity-backstop.md) — shipped (#338); measured combined in T17 |
| T10 | **Result-shape directives (projection + REAL-cast)** | Two bullets: select exactly the goal's columns; cast one operand of an integer ratio to REAL. ≈40 tok | extra-column projection (Open-SQL [arXiv:2405.06674](https://arxiv.org/pdf/2405.06674)) + integer-division truncation | [`SK-LLM-027`](../features/llm-router/decisions/SK-LLM-027-result-shape-directives.md) — shipped; measured combined in T17 |
| T9 | **Static few-shot exemplars (DAIL-SQL format half)** | `PLAN_SYSTEM` = directives + 3 static Question→strict-JSON exemplars. ≈250–350 tok/call | few-shot is the biggest prompt-only lever (DAIL-SQL [arXiv:2308.15363](https://arxiv.org/abs/2308.15363)); retrieval half still open (§4 #1) | [`SK-LLM-026`](../features/llm-router/decisions/SK-LLM-026-static-few-shot-plan-exemplars.md) — shipped; measured combined in T17 |
| T7 | **JSON-recovery fallback (reasoning-head preamble leaks)** | `parseJsonResponse` extracts the first brace-balanced `{…}` after strict parse fails | recovers `parse`→`no_sql` losses from `gpt-oss-120b` preamble leaks; strictly additive | [`SK-LLM-025`](../features/llm-router/decisions/SK-LLM-025-json-recovery-fallback.md) — shipped |
| T8 | **Greedy decoding parity (Workers-AI temperature 0)** | `{ messages, temperature: 0 }`, matching every other leg | reproducibility invariant for the `SK-QUAL-006` McNemar baseline | [`SK-LLM-024`](../features/llm-router/decisions/SK-LLM-024-greedy-decoding-parity.md) — shipped |
| T1 | **Cerebras (gpt-oss-120b) leads the planner tier** | `plan`/`schema_infer` chain → `[cerebras, gemini, groq, workers-ai, openrouter, mistral]`, identical eval + prod | frontier-class open reasoning head, card-free; answers most questions when within its ~5 RPM | [`SK-LLM-023`](../features/llm-router/decisions/SK-LLM-023-cerebras-planner-tier.md) — shipped; measured combined in T17 |
| T2–T6 | **Scaffold + measurement enablers** | T2 `withExecRetry` (3 attempts, exec-error-only) · T3 schema-fidelity directives (`SK-LLM-018`) · T4 BIRD `evidence` → goal · T5 hedged planner race (`SK-LLM-014`) · T6 Spider canonical scorer port | T2 est. +4.6 pp (MAC-SQL arXiv:2312.11242); T3 est. +3–5 pp (DIN/C3/DAIL); T4 parity, T5 latency, T6 measurement | shipped |

## 4. What we have NOT tried yet (ranked backlog, all free)

Ranked by expected pp-per-effort on the **free chain**. Each is card-free and
agent-runnable; promote into an `SK-*`/`GLOBAL-*` before implementing
(`CLAUDE.md` §P4).

1. **Similarity-retrieved few-shot exemplars (full DAIL-SQL).** Static
   3-shot shipped (T9); the **retrieval** half — masked-question similarity
   over an exemplar pool — is the larger remaining gain (est. +3–5 pp beyond
   static; arXiv:2308.15363). Needs an exemplar pool + similarity index on
   hot `plan`, so it is gated on per-lever ablation of T9 (`CLAUDE.md` §P5).
2. **Value retrieval + column-level pruning (the M-Schema half T19 left).**
   T19 prunes whole tables; feeding sample cell-values and pruning columns
   targets the mismatch mass directly (est. +3–6 pp). Column-level recall
   risk is per-column — needs an offline recall harness like T19's first.
   Targets *mismatches*, not the 36 Spider `no_sql` — those are
   `http_4xx`/`network` errors on small schemas (§2), not a size problem
   pruning could fix.
3. **Self-consistency majority vote (N=3, free tokens).** Sample 3 plans at
   temperature > 0 on a separate code path, execute, majority-vote the result
   set. Worth a measured ablation (`SK-QUAL-004`) — on the free chain the
   marginal cost is quota, not money, so it trades against §5 capacity.
4. **A second card-free tail backstop beyond Mistral (T11).** The obvious
   candidate `NVIDIA_API_KEY` is a finite ~5,000-credit pool (2026-06), a
   `GLOBAL-013` failure like the rejected Cohere trial. Re-rank only if
   post-T18 runs still show chain-exhaustion `no_sql`.
5. **Corrected-set evaluation (BIRD Mini-Dev 52.8% annotation errors).**
   Score against the UIUC corrected variants, report Spearman vs canonical.
   Measurement honesty, not accuracy; license check first (`SK-QUAL-003`).
6. **Internal `db.create` accepted-answer eval (third dataset).** Blocked on
   a privacy-stripped R2 export; **no user data ever** enters the harness.
7. **Per-stage confidence calibration → hard-plan routing.** Replace the
   placeholder `confidence: 1.0` with harness-calibrated floors so
   `SK-LLM-022`'s hard-plan threshold fires on the right questions.

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

> **Measurement state (2026-06-12).** T18+T19 carry a clean same-seed smoke
> A/B (BIRD raw 37.3% → 51.3%, reproduced 48.7%), and the canonical full
> runs landed in this PR (BIRD 500-q raw **0.522**, Spider 135-q raw
> **0.1704**; sequential per §5, resumed across quota windows per
> `SK-QUAL-013`), re-seeding `baseline-2026-06-15.json` +
> `eval-baseline.ts`. Agents dispatch the workflows directly via the
> workflow-scoped PAT (`GH_TOKEN_WORKFLOW`) — no human click needed.
> **2026-06-17 — Spider re-seeded 0.1704 → 0.1852** after the shared
> `GEMINI_API_KEY` free-tier key was restored (`no_sql` 36 → 9,
> `gemini:http_4xx` cleared; `SK-LLM-039`), resumed across 2 windows
> (one hit the 60-min ceiling → resumed via the `SK-QUAL-013` checkpoint).
> **Next:** per-lever ablations (T9 static few-shot vs none; T19 prune
> on/off) to attribute the combined gain, then §4 #1/#2.
