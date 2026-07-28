# D-03 — Ops-corpus golden-query set (≥ 10, ≥ 3 temporal)

**Status:** ⬜ not started — **the one slice in this track pullable while
`MEMORY_PRESET` is dark** (offline, frozen-snapshot corpus; no prod flag, no
Neon)
**Sequence:** Dogfood 3 of 7 · **Risk:** med · **Runs:** ~2 · **Prereqs:** D-01 (the extraction shape) · **Gate:** none

## Goal

A golden-query set over the **ops-docs** corpus — ≥ 10 questions, ≥ 3 of them
temporal — added to the existing `SK-QUAL-023` memory-quality eval family, so
"the docs→memory workload answers correctly" is a **number** in the Engine lane
rather than a vibe. These are the queries SK-PIVOT-017 names as already
existing informally: the grep-and-hand-edit work agents do against `docs/`
today.

Question shapes to draw from (all relational, none fuzzy-recall — the wedge's
own claim): *which features have open questions older than 30 days* · *which
decisions reference `GLOBAL-013`* · *what is blocked, and since when* · *which
`SK-*` are superseded, and by what* · *how many decisions landed per month* ·
*which queue bullets outlived their stated estimate*.

## SK-PIVOT-016 criterion / number it moves

**Criterion 4** — "the temporal golden queries pass." Also the scorecard's
memory-quality row (currently free-chain EX 93.33 %, per-axis 3/3 except
**temporal 2/3**).

**Scope, stated precisely so nothing is silently loosened:** the existing `2/3`
is the *synthetic* `memory-quality` corpus, owned by
[`quality-eval`](../../../quality-eval/decisions/SK-QUAL-023-agent-memory-quality-eval.md).
This slice adds the **ops** corpus's temporal queries alongside it. Criterion 4
goes green when temporal passes on **both** — which is a tightening (agents may
tighten; only the founder may loosen — SK-PIVOT-016).

## Read first

- [`SK-QUAL-023`](../../../quality-eval/decisions/SK-QUAL-023-agent-memory-quality-eval.md)
  — the four axes + analytical, the scorers, and its **determinism rule**
  (literal date bounds, never `date('now')`; tie-free ranked gold per
  `SK-QUAL-019`)
- `docs/features/quality-eval/FEATURE.md` — **mandatory** per `AGENTS.md` §5
  for anything under `tools/eval/**`
- `tools/eval/src/datasets/memory-quality.ts` — the module to extend or
  sibling: seed-plus-questions shape, `MemoryAxis`, `EvalQuestion`
- `tools/eval/test/datasets/memory-quality.test.ts` — the gold-executability /
  tie-free / axis-semantics guards a new set must also pass
- `.github/workflows/quality-eval-memory.yml` — the `workflow_dispatch` runner
  (`--dataset memory-quality`) and its per-axis EX breakdown
- [`SK-PIVOT-017`](../../decisions/SK-PIVOT-017-docs-to-memory-skill.md) — "a
  golden-query set (≥ 10, including temporal) gates the workload in the memory
  eval suite"

## Mechanism — why the corpus is a frozen snapshot

Gold result sets must be deterministic, but the real `docs/` corpus changes on
every merge (that is D-02's whole job). So the eval seeds from a **pinned
extract** of `docs/` at a named commit, committed with the dataset — exactly the
determinism discipline `SK-QUAL-023` already imposes with literal date bounds.

Consequence: this slice needs **no** prod memory DB, no `MEMORY_PRESET`, no
Neon. It is offline dataset work, which is why it is sequenced ahead of D-04
even though D-04 owns three criteria.

Re-snapshotting later is a deliberate, reviewed act (new commit pin + re-verified
gold), never an automatic refresh — an auto-refreshing gold set silently grades
itself.

## Steps

1. **Run 1 — corpus snapshot + the retrieval/analytical half.** Pin a `docs/`
   extract at a commit; seed it into a `memory-quality`-shaped module
   (`agent_memory_v1` shape: `facts` / `episodes` / `entities` /
   `entity_facts`). Write ≥ 7 questions with hand-verified gold SQL and
   non-empty, tie-free result sets across the retrieval / consolidation /
   analytical axes. Extend the existing guard tests to cover the new set.
2. **Run 2 — the temporal half + dispatch.** Add ≥ 3 temporal questions
   ("older than 30 days", "blocked since", ordering of decision dates) with
   **literal** date bounds relative to the pinned snapshot date. Dispatch
   `quality-eval-memory.yml`, record the per-axis EX + the run link, and add
   the number to the scorecard's memory-quality row. A temporal miss is the
   lever the next run pulls — the run summary already lists each non-match's
   generated SQL.

## Done when

- [ ] ≥ 10 questions total, **≥ 3 temporal**, each with hand-verified gold over
      the pinned snapshot; all pass the existing gold-executability / tie-free /
      axis-semantics guards.
- [ ] Corpus snapshot is committed and its source commit is named in the module
      header (so a later re-snapshot is a visible, reviewed diff).
- [ ] Every temporal gold uses literal date bounds — **no** `date('now')`
      (`SK-QUAL-023` determinism rule); a test pins this.
- [ ] `quality-eval-memory.yml` dispatched; per-axis EX + run link recorded in
      the scorecard's memory-quality row.
- [ ] Criterion 4's two halves stated in [`INDEX.md`](INDEX.md)'s gate table
      (synthetic + ops), neither dropped.
- [ ] `bun run typecheck && test` green; lint with explicit paths.
- [ ] INDEX tracker + status ticked.

## Artifact

A queue draft with real teeth: *"the queries we actually run against our own
docs — and the ones a vector store can't answer"*. It is the honest, measured
version of the wedge claim, and D-07 reuses the same question set. Queue-gated.

## Rollback

Delete the dataset module + its snapshot; the NL→SQL canon (BIRD / Spider /
persona-bench) is untouched by construction — a new dataset is additive and
runs only on explicit `--dataset`. No baseline is affected
(memory-quality has none).
