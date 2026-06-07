# Engine quality — verification log

> Append-only, dated, evidence-referenced log of every shipped engine-quality
> lever. Split out of
> [`quality-score-source-of-truth.md`](./quality-score-source-of-truth.md)
> (`CLAUDE.md` §D4) so the progress-bar tracker stays under the 20 KB cap.
> The tracker's §3 table is the current-state view; this file is the history.
> On any conflict the tracker and the canonical `SK-*`/`GLOBAL-*` homes win.

| Date | Event | Evidence |
|---|---|---|
| 2026-05-18 | Free-chain BIRD baseline = 0.318 (159/500) | `baseline-2026-06-15.json` |
| 2026-06-04 | All 5 ICP flows verified reaching gate-403 (engine bottleneck) | `automated-icp-validation-plan.md` §0.5 table |
| 2026-06-04 | **T1 shipped** — Cerebras planner lane (`SK-LLM-023`); awaiting first cron to measure delta vs 0.318 | #317 |
| 2026-06-05 | **Correction (evidence-based):** all 51 baseline `no_sql` re-verified as chain-exhaustion (`all providers in chain failed`; 33 + 17 + 1 by breaker reason), **not** instruction-following losses — §2 + §4 + §5 updated; capacity-backstop framed as an open decision against `SK-LLM-023`'s "rarely fully fails" rationale | `baseline-2026-06-15.json` `results[]` (script-counted) |
| 2026-06-05 | **Planner robustness shipped:** greedy-decoding parity on the Workers AI leg (T8 / `SK-LLM-024`) + reasoning-preamble JSON-recovery fallback (T7 / `SK-LLM-025`); both fold into the first post-T1 cron, neither measured yet | `packages/llm` tests green; SK-LLM-024/025 bodies |
| 2026-06-05 | **Static few-shot exemplars shipped:** 3-shot `PLAN_FEW_SHOT` block (T9 / `SK-LLM-026`); prompt-only, dataset-agnostic, zero-dep; folds into the next cron | `packages/llm` tests green (125); `SK-LLM-026` body |
| 2026-06-06 | **Result-shape directives shipped:** `PLAN_DIRECTIVES` gains exact-projection + REAL-cast-ratio bullets (T10 / `SK-LLM-027`); `SK-LLM-026` exemplar 2 refit. Extra columns change the result tuple ⇒ projection lifts BIRD; Spider tolerates extra pred cols ⇒ no regression. ≈40 tokens/call | `packages/llm` tests green (126); `SK-LLM-027` body |
| 2026-06-06 | **Mistral tail capacity backstop shipped (T11 / `SK-LLM-028`):** `mistral-large-latest` (card-free renewable Experiment tier) appended behind OpenRouter on `plan` / `schema_infer` in production + eval, targeting the 10.2% chain-exhaustion `no_sql` with an independent free-tier RPM pool. Tail-only ⇒ strictly additive. Updates `SK-LLM-023`'s "rarely fully fails" premise; `NVIDIA_API_KEY` left out (finite pool fails `GLOBAL-013`). `MISTRAL_API_KEY` in CI env + `mirror-secrets-gha.sh` | `packages/llm` tests green (132, incl. Mistral) + eval lanes green; `SK-LLM-028` body |
| 2026-06-06 | **BIRD scorer parity shipped (T12 / `SK-QUAL-010`):** `scoreOne` + Spider `rowsToColumnMajor` read positional tuples (`.values()`) not name-keyed objects (`.all()`), so aliases/casing no longer false-mismatch correct values — matching canonical BIRD `set(fetchall())`. 0.318 is now a known lower bound; the first post-fix cron's McNemar diff is a one-time scorer migration that re-seeds the baseline (`SK-QUAL-005`) | `tools/eval` tests green (168, incl. alias-parity + column-swap + transpose); `evaluation.py` verified 2026-06 |
| 2026-06-07 | **NULL-safe extremum directive shipped (T13 / `SK-LLM-029`):** `PLAN_DIRECTIVES` filters the ranked column (`WHERE <col> IS NOT NULL`) before an `ORDER BY … LIMIT` extremum; `SK-LLM-026` exemplar 3 refit to demonstrate it. SQLite sorts NULL first (verified 2026-06) — a false-minimum loss on BIRD's dirty-data NULLs; dialect-portable, prompt-only, ≈25 tokens; folds into the next cron | `packages/llm` tests green (133); `SK-LLM-029` body |
