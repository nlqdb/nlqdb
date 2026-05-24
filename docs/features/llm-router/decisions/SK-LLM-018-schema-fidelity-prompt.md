# SK-LLM-018 — Schema-fidelity planner prompt + diagnostic retry framing

- **Decision:** `PLAN_SYSTEM` in `packages/llm/src/prompts.ts` gains
  three directives beyond "use the provided schema; don't invent":
  (a) **identifiers literal + casing verbatim** — "Use only tables and
  columns that appear literally in the provided schema; preserve
  identifier casing exactly"; (b) **`Evidence:` is authoritative** —
  when the goal carries the BIRD/Spider annotator-evidence block the
  runner already concatenates in (`tools/eval/src/runner.ts` line
  216–218), the LLM applies its formulas and column hints rather than
  treating it as a hint; (c) **dialect-strict output** — no
  cross-dialect features (no `TOP` for sqlite, no `LIMIT` for tsql).
  `buildPlanUser`'s `previousAttempt` block is reframed from "produce
  a different SQL shape" to a **diagnose-first, surgical-fix**
  prompt: same Goal, schema-only identifiers, change only what the
  error names — keeping the SQL ≤ 500-char cap unchanged.
- **Core value:** Bullet-proof, Free
- **Why:** Free-chain BIRD-dev EX sits at **0.318** vs the
  [`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md) Phase 2 floor
  **0.65** (see
  [`apps/api/src/gate/eval-baseline.ts`](../../../../apps/api/src/gate/eval-baseline.ts) +
  [`SK-QUAL-005`](../../quality-eval/FEATURE.md#sk-qual-005)), and the
  acquisition tracker's 2026-05-24 founder directive names BIRD-gap
  closure as priority #1 (`automated-icp-validation-plan.md`
  preamble). Schema-link prompts add **+3–5 pp** on small free
  models per the canonical NL→SQL literature: **DIN-SQL**
  ([arXiv:2304.11015](https://arxiv.org/abs/2304.11015)) — schema-link
  decomposition is one of four pillars; **C3-SQL**
  ([arXiv:2307.07306](https://arxiv.org/abs/2307.07306)) §3.2 schema
  clear "use only columns from the schema" directive; **DAIL-SQL**
  ([arXiv:2308.15363](https://arxiv.org/abs/2308.15363)) Table 3
  schema-linking ablation. The retry reframe targets the
  [`SK-QUAL-009`](../../quality-eval/FEATURE.md#sk-qual-009)
  exec-retry loop — the prior "different shape" phrasing invited
  whole-approach rewrites when the root cause was a typo or missing
  column. **MAGIC** ([arXiv:2406.12692](https://arxiv.org/pdf/2406.12692))
  §3 explicitly recommends "small surgical change, not rewrite" as the
  self-correction posture; **MAC-SQL** Refiner
  ([arXiv:2312.11242](https://arxiv.org/html/2312.11242v2)) §6.2 ablates
  +4.63 pp BIRD-dev EX precisely because the corrected SQL stays close
  to the rejected one.
- **Consequence in code:** `packages/llm/src/prompts.ts` —
  `PLAN_SYSTEM` extended (4 bullets → 6); `buildPlanUser`'s retry
  block renders three directive bullets in place of the single
  "different shape" line. `packages/llm/test/prompts.test.ts` —
  two new `describe` blocks pin the contract (PLAN_SYSTEM
  bullet-by-bullet + `buildPlanUser` first/retry paths + 500-char
  cap). All four production paths consume the change automatically:
  free chain (Groq / Gemini / Workers-AI / OpenRouter) via the shared
  `_chat-provider.ts` builder, `apps/api/src/ask/orchestrate.ts` (the
  `withStageRetry("plan")` validator-reject loop), `tools/eval/src/exec-retry.ts`
  (the `withExecRetry` exec-error loop), and the
  `agentic-frontier` eval lane — same `PlanRequest.previousAttempt`
  contract, one prompt template, no per-call-site plumbing.
  `SK-LLM-009`'s prompt-cache invalidation note still holds: this
  change rotates the cache once; downstream provider caches refill
  on next miss.
- **Alternatives rejected:** **(1) Add few-shot exemplars to
  `PLAN_SYSTEM`.** Token cost on small models is non-trivial
  (BIRD-Mini schemas already push 2–4 k tokens of DDL via
  `introspectSchema`); the schema-link directive is the cheaper first
  cut. Few-shot stays open for a follow-up if BIRD doesn't reach
  ≥ 0.50 on the next weekly cron. **(2) Hard-fail when the LLM
  returns an identifier that doesn't appear in the schema.** The
  validator (`apps/api/src/ask/sql-validate.ts`) already does column-
  level checks downstream; pushing that signal earlier into the prompt
  is the same information at lower cost. **(3) Inline `sqlglot` parse
  pre-check before exec.** Deliberately rejected for the eval layer in
  [`quality-eval/FEATURE.md` Open questions](../../quality-eval/FEATURE.md#open-questions-known-unknowns)
  ("bun:sqlite exec raises on syntax errors directly, so a separate
  parse step is dead code at the eval layer") — the same logic applies
  here. **(4) Send "Attempt N of 3" in the retry block.** No
  published evidence the counter improves correctness; would add
  cardinality to the cache key without a measured win. **(5) Drop
  the 500-char SQL cap.** The cap is load-bearing for the free-chain
  token budget on Groq's 8 k context Llama-3.1-8b — lifting it would
  truncate the schema instead.
