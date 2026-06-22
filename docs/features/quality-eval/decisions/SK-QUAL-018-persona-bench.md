# SK-QUAL-018 — persona-bench: nlqdb's own ICP-shaped NL→SQL benchmark, gold-executable fixture first

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). The third,
user-relevant quality number [`GLOBAL-027`](../../../decisions/GLOBAL-027-pre-alpha-gate.md)
§Lifecycle kept as agent work alongside BIRD/Spider, per
[`fable-recommendation.md §2`](../../../research/fable-recommendation.md):
"~50–100 NL questions from `personas.md` over nlqdb-created 5–20-table
schemas (the actual ICP shape)." Sibling of the offline
instruments [`SK-QUAL-014`](./SK-QUAL-014-mismatch-error-class-classifier.md)
and [`SK-QUAL-015`](./SK-QUAL-015-column-coverage-harness.md).

- **Decision:** `tools/eval/src/datasets/persona-bench.ts` ships persona-bench
  as nlqdb's **own** benchmark: ICP-shaped SQLite schemas authored as inline
  DDL + seed (v0: `saas_app` for `personas.md` §P1 Solo Builder, `agent_memory`
  for §P2 Agent Builder — the GLOBAL-036 analytical-memory wedge) and NL→gold-SQL
  pairs lifted from each persona's "Representative queries". Gold SQL uses
  **literal date bounds, never `date('now')`**, so a "signups this month"
  phrasing compiles to a time-stable gold. v0 ships the **fixture + the
  gold-executability invariant** (`checkGoldExecutability` + a `bun persona-bench`
  CLI + unit test: every gold runs against its seeded schema and returns ≥ 1
  hand-checked row) — the **data half**. The **runner-wiring half** then makes
  `persona-bench` a dispatchable `EvalDataset`: `loadPersonaBench` materialises
  each in-memory schema to a real `.sqlite` on first `resolveDbPath` (the runner
  opens fixtures by path, readonly), wired into `loadDatasetByName` /
  `KNOWN_DATASETS` with a `--persona P1|P2` filter, so `bun src/runner.ts
  --dataset persona-bench` scores the free chain's EX. The wiring adds only a new
  dataset branch (BIRD/Spider paths byte-unchanged) and PR CI never fires real
  keys (`SK-QUAL-002`), so **no baseline moves**; the free-chain EX number is the
  next canonical dispatch (a dedicated `workflow_dispatch` is the remaining half).

- **Core value:** Legible

- **Why:**
  - **BIRD/Spider don't look like what a user creates.** Both are messy,
    many-table public academic schemas; nlqdb's ICP builds small, clean
    side-project / agent-memory schemas. An accuracy number on BIRD is
    comparable-to-research but not predictive of *the queries a real nlqdb user
    types* — exactly the gap GLOBAL-027 §Lifecycle named. persona-bench measures
    the production shape, scored by the same EX comparator (`SK-QUAL-010`).
  - **Gold-executable-first is the cheap, honest unit of progress.** A benchmark
    whose gold SQL doesn't run, or returns nothing, silently inflates
    `gold_error`/empty-set noise (the `gold_error` denominator-exclusion lesson
    in `types.ts`). Proving 12/12 golds execute and return a hand-checked
    non-empty set offline — no LLM, no network, no quota — locks the fixture as
    ground truth before a single dispatch is spent measuring the chain against
    it. v0's number is "the benchmark is sound," not "the engine is good"; the
    EX number is the next canonical dispatch.
  - **Offline-half-first mirrors the proven pattern.** `SK-LLM-041` (retrieval)
    and `SK-QUAL-017` (self-consistency) both shipped a pure, unit-tested core
    staged ahead of the dispatch-gated wiring. Same split here keeps the slice
    one-run-sized, additive, and baseline-safe (`SK-QUAL-002`: PR CI never fires
    real keys; BIRD 06-19 + Spider 06-17 untouched).
  - **The buckets carry forward.** Each question is tagged with its `SK-QUAL-014`
    structural bucket (group-by-count, HAVING, top-N, TTL date-range, NULL
    filter, REAL-cast ratio), so a future persona-bench mismatch run attributes
    losses the same way BIRD's are — and the agent-memory questions (GROUP BY /
    top-N / TTL over `facts`) are the analytics-over-memory wedge a vector store
    structurally can't answer, making the pivot claim *measurable*.

- **Consequence in code:** `tools/eval/src/datasets/persona-bench.ts`
  (`PERSONA_BENCH_SCHEMAS`, `PERSONA_BENCH_QUESTIONS`, `toEvalQuestions`,
  `checkGoldExecutability`, `import.meta.main` CLI, **+ `loadPersonaBench`** —
  the materialising loader), the `"persona-bench"` member on `EvalDataset`
  (`types.ts`), the `loadDatasetByName` branch + `KNOWN_DATASETS` member +
  `--persona` flag (`runner.ts`), and `test/datasets/persona-bench.test.ts`
  (fixture integrity + gold-executability + persona/limit filters + the
  loader's path-materialisation + readonly-gold-exec end-to-end). The
  data-half module imports only the `EvalQuestion` type; `loadPersonaBench`
  keeps `bun:sqlite` a **dynamic** import (the bun-only driver) so the module
  is still importable from a plain type context, materialising under
  `--data-dir` or an OS temp dir. The wiring is additive (new dataset branch
  only); the EX number it unlocks is the lever that moves the KPI, on the next
  dispatch.

- **Alternatives rejected:**
  - **Dispatch the free chain against it the moment the fixture existed.** That
    spends a quota-gated eval window before the fixture is proven sound; v0
    proved 12/12 golds executable offline first, then this half wired the
    dispatchable `EvalDataset` — both additive and baseline-safe. Spending the
    *dispatch* is the next step, gated by `SK-QUAL-002` (no back-to-back canonical
    run while BIRD 06-19 / Spider 06-17 are < 7 days old), not by the wiring.
  - **Reuse BIRD/Spider rows as "the persona set".** Defeats the point — the
    whole value is schemas shaped like what nlqdb users build, not relabelled
    academic ones.
  - **Generate the schemas/questions with an LLM.** Non-deterministic, and a
    fixture that defines ground truth must be hand-authored and hand-checked;
    determinism is the contract (`SK-LLM-024` discipline applied to the gold).
  - **Author all 50–100 questions now.** v0 deliberately ships 12 across 2
    schemas to lock the format + invariant in one run; growth toward the
    5–20-table, 50–100-question target is the documented follow-on, one batch
    per run. **Batch 2 (run 47): 12 → 20 questions** — adds the anti-join /
    negation (`NOT IN`) and challenging multi-join shapes v0 lacked (the
    `SK-QUAL-014` loss mass `SK-LLM-041`'s pool now targets), 20/20 golds still
    execute non-empty.
