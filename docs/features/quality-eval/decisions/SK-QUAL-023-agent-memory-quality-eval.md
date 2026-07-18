# SK-QUAL-023 — Agent-memory-quality eval: four axes + an analytical-memory-vs-vector head-to-head

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Siblings:
[`SK-QUAL-003`](./SK-QUAL-003-three-dataset-canon.md) (the NL→SQL canon this
sits alongside) · [`SK-QUAL-018`](./SK-QUAL-018-persona-bench.md) (the
`agent_memory` schema this seeds from). Governing:
[`GLOBAL-036`](../../../decisions/GLOBAL-036-lead-positioning-analytical-agent-memory.md)
(the wedge this measures) · `GLOBAL-026` (the free-vs-frontier bet).
Research: [`docs/research/agent-memory-quality-landscape.md`](../../../research/agent-memory-quality-landscape.md).

**Status (2026-07-14):** offline four-axis dataset, dispatchable workflow,
**and first canonical EX** shipped — `tools/eval/src/datasets/memory-quality.ts`
(15 gold-verified questions, 3 per axis + analytical) + runner wiring
(`--dataset memory-quality`) + gold-executability / tie-free /
axis-semantics tests + `.github/workflows/quality-eval-memory.yml`
(`workflow_dispatch`, free chain + optional frontier lane, per-axis EX
breakdown in the run summary; mirrors the persona-bench dispatch — no
fixture download, no baseline, no emit). **First EX (run 68, 2026-07-14,
main `a5e72e6`, GHA 29305503755): free-chain 86.67% (13/15)**, p50 949 ms /
p95 1999 ms, `no_sql` 0 — a real measurement (`transport_failed:null`).
Per-axis: retrieval / forgetting / analytical 3/3; **temporal + consolidation
2/3** (the weakest axes, next-run lever — the run summary now lists every
non-match free-lane row with its generated SQL, so the lever is diagnosable
from the reachable step summary without the egress-gated artifact JSON).
Confirms the free chain *is*
reachable in CI (only the daily-agent container is egress-gated). **Deferred:**
the analytical-vs-vector head-to-head (needs an embedding baseline —
pending E-05's free-chain embedding provider, LLM-router work, not infra).

- **Decision:** Add an agent-memory-quality benchmark to `tools/eval` alongside
  the NL→SQL canon (`SK-QUAL-003`). It scores four axes — (a) **retrieval
  precision/recall** against relevance labels *we define* (the field has no
  recall@k/MRR standard for agent memory), (b) **temporal reasoning**, (c)
  **forgetting + contradiction resolution**, (d) **consolidation/dedup** — and
  adds the task no existing benchmark runs: **analytical queries over episodic
  memory (`GROUP BY` / `JOIN` / `HAVING` / temporal filters) head-to-head
  against a vector-recall baseline on identical data**, reported honestly
  *including* the fuzzy-recall questions where a pure-SQL store loses to
  embeddings. Numbers are reproducible on the shared harness, never self-graded;
  a memory-quality row joins the scorecard Engine lane as a daily-loop lever.

- **Core value:** Bullet-proof, Honest latency, Goal-first

- **Why:** `GLOBAL-036` leads with "analytical memory for AI agents," but
  nothing measured whether the memory is *good* — the loop optimised
  BIRD/Spider (generic text-to-SQL) while the wedge went unmeasured. Research
  (2026-07-09) found the field grades end-to-end QA on mostly
  vendor-self-reported, contested numbers (Mem0's 26% over OpenAI, Zep's 94.8%
  DMR; an independent audit found ~6.4% of the LoCoMo answer key wrong), with
  **no** component-level retrieval-metric standard and **no** benchmark
  isolating analytical SQL against vector/graph memory — a gap nlqdb can own.
  Measuring the wedge is the `GLOBAL-026` bet applied to memory: scaffolding
  only compounds if it is measured. The head-to-head is what converts the
  positioning from an assertion into a number.

- **Consequence in code:** A new dataset module under
  `tools/eval/src/datasets/` (persona-bench's `agent_memory` schema,
  `SK-QUAL-018`, is the seed) with a labeled memory corpus + relevance labels;
  per-axis scorers reusing `src/score.ts` where the answer is a result set; a
  vector-baseline lane that runs the same questions through embedding recall so
  the head-to-head delta is one number. Emits `feature.eval.*` (`GLOBAL-024`),
  runs manual-on-demand (`SK-QUAL-002`), resumable (`SK-QUAL-013`). The
  scorecard gains an Engine-lane memory-quality row; a Phase-2 gate criterion
  tracks it. Sequenced in daily-loop-sized slices, retrieval + temporal first
  (where structure demonstrably wins and the field is blindest).

- **Alternatives rejected:**
  - **Reuse LoCoMo/LongMemEval as-is** — end-to-end QA on soft, contested
    answer keys; measures the judge, not our retrieval, and can't isolate
    analysis over memory.
  - **Trust vendor leaderboards** — self-reported and disputed; violates the
    reproducibility discipline the `SK-QUAL-*` canon already imposes.
  - **Fold it into BIRD/Spider** — those measure schema-inference NL→SQL, a
    different capability; a memory corpus with temporal/decay/dedup structure is
    a distinct dataset.
  - **Skip the vector baseline** — then the analytical-memory claim stays an
    assertion; the head-to-head on identical data is the whole point.
