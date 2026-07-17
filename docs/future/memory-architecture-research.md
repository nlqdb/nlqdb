# Future plan — Research-grounded agent-memory architecture

> **Status:** mandated, not yet started. **Founder mandate (2026-07-17,
> non-negotiable):** the agent-memory architecture must eventually be
> designed from **researched best practices**, with full **visibility into
> why it is implemented the way it is**, **optimized for speed and
> efficiency**, with the north-star recall goal: **per task, the agent gets
> all the context it needs and only the context it needs.** Promote each
> firm outcome into `SK-PIVOT-NNN` / `SK-QUAL-NNN` blocks (or a `GLOBAL-NNN`
> if cross-cutting) per `P4 / D1` — do not promote vague conclusions.
>
> **Promotion trigger:** at latest when E-05 (hybrid recall) is picked up —
> recall design is where these choices become expensive to reverse. Sooner
> if the agent-memory-quality eval (`SK-QUAL-023`) reports a losing
> head-to-head vs a vector-store baseline on any axis.

**Cross-refs:** engine track
[`worksheets/engine/INDEX.md`](../features/agent-memory-pivot/worksheets/engine/INDEX.md)
(E-01..E-07 build the primitives) ·
[`quality-eval/FEATURE.md`](../features/quality-eval/FEATURE.md)
(`SK-QUAL-023` scores the four memory-quality axes) ·
[`SK-PIVOT-009`](../features/agent-memory-pivot/decisions/SK-PIVOT-009-agent-scope-rls.md)
(scoping semantics already ratified) · `docs/performance.md` (speed budget
home) · `docs/research-receipts.md` (every claim below needs a receipt).

## The mandate, unpacked

1. **Researched, not improvised.** Before recall/consolidation design
   hardens, run a P2-grade research pass (web, cited, receipts) over the
   current memory-architecture literature and shipping systems: Mem0's
   extraction/consolidation pipeline, Zep/Graphiti temporal knowledge
   graphs, Letta/MemGPT context paging, summarization-vs-verbatim
   trade-offs, retrieval scoring (recency × relevance × importance),
   contradiction handling, and working-vs-long-term memory splits. Output:
   a comparison with what `agent_memory_v1` does differently and why —
   each divergence is either defended with evidence or fixed.
2. **Visibility on why.** Every architectural choice (schema shape, recall
   ranking, TTL semantics, consolidation policy) gets a decision record in
   its canonical home — the standard `P3`/`P4` machinery, applied without
   gaps, so a reader can always answer "why is it built this way?".
3. **Speed and efficiency.** Recall is on the agent's hot path — set
   explicit latency/token budgets for `nlqdb_recall` in
   `docs/performance.md` and eval them; efficiency includes token cost of
   what recall returns, not just wall-clock.
4. **All the context it needs, only the context it needs.** The recall
   quality bar is two-sided: missing-context failures AND
   irrelevant-context noise are both defects. `SK-QUAL-023`'s retrieval
   axis must score precision as well as recall (a result set that buries
   the answer in noise fails), sized against the task's context budget.

## Why this is not done inside E-03/E-05 directly

E-03 (scoping) and E-04 (TTL) are correctness slices — mechanism already
ratified. The mandate above governs the *quality* layer (what recall
returns and how fast), which peaks at E-05 and beyond; folding a research
program into a daily-loop slice would violate the one-slice-per-run sizing.
This doc exists so the mandate survives until that work is picked up —
whoever takes E-05 must read this first.
