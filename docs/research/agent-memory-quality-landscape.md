# Agent-memory quality: systems, benchmarks, and how to measure it

**Purpose.** Source of truth for the agent-memory-quality initiative — the
research that (a) designs the memory-quality eval harness in `tools/eval/`
and (b) feeds the `/blog` findings series. Compiled 2026-07-09 from a
fan-out/verify research pass (24/25 verified claims; one refuted, noted
below). Cross-refs: [`deepseek-moat-framing.md`](deepseek-moat-framing.md)
(the thesis) · [`agent-memory-pivot/FEATURE.md`](../features/agent-memory-pivot/FEATURE.md)
(the pivot) · [`quality-eval/FEATURE.md`](../features/quality-eval/FEATURE.md)
(the harness this extends).

**One-paragraph landscape.** Modern agent-memory systems converge on the
same loop — an LLM extracts salient facts from conversation, reconciles them
against existing memory (add / update / delete), and stores the result in one
of three backend shapes: **vector embeddings** (Mem0 base), a **temporal
knowledge graph** (Zep/Graphiti, Mem0's graph variant), or **OS-style tiered
context** (MemGPT/Letta). Quality is scored almost entirely **end-to-end**
with QA benchmarks (LoCoMo, LongMemEval, DMR, LoCoMo-Plus), not with
component-level retrieval metrics. Nearly every headline accuracy number is
**vendor-self-reported and contested**, not independently reproduced.

---

## 1. Leading systems (2023–2026)

| System | Core technique | Storage backend | Headline claim (source) |
|---|---|---|---|
| **Mem0** (arXiv:2504.19413, Apr 2025, ECAI 2025) | Two-phase LLM pipeline: **extract** salient facts from a message pair + summary/recent context, then **update** — reconcile each fact vs. semantically-similar existing memories via `ADD`/`UPDATE`/`DELETE`/`NOOP` | Base: dense embeddings in a vector DB. Graph variant `Mem0^g`: directed labeled graph `G=(V,E,L)` on Neo4j, per-entity embeddings | **26% relative** over OpenAI memory on LoCoMo (LLM-as-judge); **91% lower p95 latency**, **>90% token savings** vs. full-context. *Vendor self-reported.* |
| **Zep / Graphiti** (arXiv:2501.13956, Jan 2025) | **Temporally-aware knowledge graph** that fuses unstructured chat + structured business data with **bitemporal** edges (event time + ingestion time); hybrid retrieval incl. embeddings | Temporal KG (not vector-free) | **94.8% vs 93.4%** on DMR (vs MemGPT); **up to 18.5%** on LongMemEval, **~90% latency cut**. *Vendor self-reported; authors call for independent reproduction.* |
| **Letta / MemGPT** (arXiv:2310.08560, Oct 2023) | **Virtual context management** — OS-inspired paging of data between "main context" (RAM-analog) and "external context" (disk-analog); the agent self-edits memory via self-generated function calls | Tiered store (in-context window + external storage) | Foundational tiered/hierarchical memory; DMR is the MemGPT team's own metric |
| **LangMem** (LangChain) | Memory within the LangChain ecosystem, SDK-first | Ecosystem-dependent | Only appears via LoCoMo leaderboard numbers; **thin primary-source coverage** |
| **cognee** | Named in the pivot; **not covered by verified sources** in this pass | — | Coverage gap — needs a follow-up pass |
| **MemoriesDB** (arXiv:2511.06179, Nov 2025, single-author preprint) | Unified memory on **PostgreSQL + pgvector**: time-series + vector + graph in one append-only schema; argues vector DBs "represent meaning but not time or structure" | Postgres + pgvector | Closest academic instance of "relational DB as memory" — **but still leans on pgvector for similarity**, so it's a hybrid, not an analytical-SQL system |

Note: post-paper, Mem0's OSS graph layer expanded beyond Neo4j to several
graph DBs; blog sources report a later v3 that swapped the graph layer for
spaCy entity-linking into a parallel vector collection (lower-confidence,
blog-sourced).

---

## 2. Benchmarks — how memory quality is scored

| Benchmark | Construction | Task / question types | What it measures | Known limits |
|---|---|---|---|---|
| **LoCoMo** (arXiv:2402.17753, Snap Research, ACL 2024) | Machine-human pipeline: LLM-agent dialogues grounded on personas + temporal event graphs, human-verified. ~300 turns / ~9K tokens, up to 35 sessions | QA (5 types: single-hop, multi-hop, **temporal**, commonsense, adversarial) + event summarization + multi-modal dialogue gen | End-to-end QA (string-match **F1**); vendors use the **QA subset only** | Small public eval set (~10 convos); an **audit found ~6.4% of the answer key wrong** (99/1540); some "multi-hop" answerable in one session; eval-prompt inconsistency (Zep re-scored 84%→58.44%) |
| **LongMemEval** (arXiv:2410.10813, ICLR 2025) | 500 curated questions embedded in freely-scalable chat histories | **5 abilities, separately scored**: information extraction, multi-session reasoning, **temporal reasoning**, **knowledge updates**, abstention | End-to-end QA accuracy per ability | Commercial assistants show a **~30% (30–60%) accuracy drop** over sustained interaction; "chat assistant" framing |
| **DMR (Deep Memory Retrieval)** | The MemGPT team's own metric | Retrieval-focused QA | End-to-end accuracy | Small; both Zep and MemGPT self-report on it |
| **LoCoMo-Plus** (arXiv:2602.10715, Feb 2026) | Extends LoCoMo into "Level-2" **cognitive** memory | 4 latent-constraint components: causal, state, goal, value | Beyond-factual memory | SOTA drops **~15–17 pts** from LoCoMo (Mem0 57.24→41.44 on GPT-4o); single-source, authored by its own creators, not reproduced |

**Refuted claim (0–3 vote):** LoCoMo-Plus's framing that prior benchmarks
"only" test factual memory is **false** — LoCoMo already includes temporal,
multi-hop, commonsense, and adversarial types.

---

## 3. The four quality axes — exact metrics & methodology

**(a) Retrieval precision / recall — the gap.** IR metrics (recall@k,
precision@k, MRR, nDCG) are the standard *outside* agent memory (Pinecone /
Weaviate eval guides, DCG). But the leading agent-memory benchmarks **do not
use them** — they score end-to-end QA (accuracy, F1, LLM-as-judge). No
standardized ground-truth-relevance labeling for agent memory exists in the
verified sources. **Implication:** to measure this axis, nlqdb must **define
its own relevance labels** — do not assume an off-the-shelf standard.

**(b) Temporal reasoning — first-class, and the weakest area.** A dedicated
category in both LongMemEval ("temporal reasoning") and LoCoMo ("temporal"
QA). LoCoMo finds temporal/causal reasoning the single hardest area for LLMs.
**Structuring memory helps most here:** transforming dialogue into a
"database of assertions" lifted LoCoMo temporal F1 **21.3 → 41.9** at top-5,
and Mem0's graph variant leads the temporal category (58.13). This is the
axis where the analytical-SQL thesis has the most evidence.

**(c) Forgetting + contradiction resolution — first-class.** LongMemEval's
"knowledge updates" ability directly tests a changed value superseding an old
one (update-vs-append). Operationally: Mem0's update phase issues
`UPDATE`/`DELETE`; Zep records bitemporal validity intervals and invalidates
edges. TTL/decay is a system feature, not a benchmarked axis.

**(d) Consolidation / dedup — operational, not separately benchmarked.**
Handled by the extract-then-reconcile loop (Mem0 `ADD`/`UPDATE`/`DELETE`/
`NOOP`; entity-level in the graph variant). No standalone benchmark isolates
it; it shows up indirectly as QA accuracy over long horizons.

---

## 4. The SQL-vs-vector angle (honest)

**Where a real database wins:** exact temporal filters, event ordering, and
structured aggregation over episodes — the `GROUP BY`/`JOIN`/`HAVING` a
vector store structurally can't do. Supporting evidence: LoCoMo's "database
of assertions" result and the temporal-category leads of graph/temporal
variants. A vector store retrieves "Alice has a $50k deal"; it cannot answer
"top 5 deals by value, grouped by stage, enterprise only."

**Where it does NOT win — say this plainly:** fuzzy semantic recall over
unstructured text. **Every serious system still uses embeddings** for
similarity search — including MemoriesDB, the most on-thesis Postgres system,
which falls back to pgvector nearest-neighbor. **Pure analytical SQL cannot
replace vector similarity for unstructured recall.** For nlqdb this is not a
caveat to hide — it's exactly what E-05 (pgvector hybrid recall,
infra-gated) exists to add. The honest wedge is "**analytical** memory," not
"memory without embeddings."

**The strategic opening:** *no verified benchmark isolates analytical SQL
(GROUP BY / JOIN / HAVING / exact temporal filters over episodes) against
vector/graph memory on identical data.* The field measures recall of facts,
not analysis of them. That gap is a benchmark nlqdb could **create and own**
— the single most defensible move surfaced by this research.

---

## 5. Implications for the eval harness

1. **Score all four axes, but weight (b) temporal and (a) retrieval first** —
   (b) is where structure demonstrably wins and (a) is the field's blind spot.
2. **Define our own relevance labels** for the retrieval axis (no standard
   exists) — recall@k / MRR over a labeled memory corpus.
3. **Build the analytical-memory task no one else has** — questions that
   require aggregation/ordering over episodic memory, run head-to-head vs. a
   vector-recall baseline on identical data. This substantiates the
   positioning instead of asserting it.
4. **Measure honestly, including our loss cases** — include fuzzy-recall
   questions where a pure-SQL store loses to embeddings; report the delta.
   This is the E-05 justification, quantified.
5. **Don't trust the leaderboards** — vendor numbers are self-reported and
   contested; our comparisons must be reproducible on a shared harness, the
   same discipline `SK-QUAL-*` already imposes on BIRD/Spider.

---

## 6. Caveats

- **Vendor vs independent:** Mem0's 26% and Zep's 94.8% DMR / 18.5%
  LongMemEval are **self-reported**; none cleanly reproduced; the two vendors
  publicly dispute each other's LoCoMo methodology. Treat as directional.
- **Benchmark methodology is soft:** small eval sets, string-match F1, a
  ~6.4%-wrong LoCoMo answer key, prompt-inconsistency swings (84%→58.44%).
- **Retrieval-metric gap:** no standardized recall@k/MRR/nDCG for agent
  memory — we define our own or there is none.
- **Coverage gaps this pass:** cognee, LangMem internals, sleep-time compute,
  and reflection/self-editing beyond MemGPT/Mem0 are unverified here.
- **Time-sensitivity:** fast-moving (MemGPT Oct'23 → Zep Jan'25 → Mem0
  Apr'25 → MemoriesDB Nov'25 → LoCoMo-Plus Feb'26). Re-verify before citing.

## 7. Open questions

- Primary-source technique/backend for cognee, LangMem, sleep-time compute,
  reflection/self-editing — needs a second research pass.
- Any independent reproduction of Mem0's 26% / Zep's DMR on a shared harness?
- Does a component-level retrieval-metric standard exist for agent memory, or
  must we define relevance labels ourselves? (Evidence so far: the latter.)
- Is there any benchmark isolating analytical SQL vs vector/graph memory on
  identical data? (Evidence so far: no — the opening in §4.)

## 8. Sources

Primary (arXiv / official): Mem0 [2504.19413](https://arxiv.org/abs/2504.19413) ·
Zep/Graphiti [2501.13956](https://arxiv.org/abs/2501.13956) ·
MemGPT [2310.08560](https://arxiv.org/abs/2310.08560) ·
LongMemEval [2410.10813](https://arxiv.org/abs/2410.10813) ·
LoCoMo [2402.17753](https://arxiv.org/abs/2402.17753) +
[project page](https://snap-research.github.io/locomo/) ·
LoCoMo-Plus [2602.10715](https://arxiv.org/abs/2602.10715) ·
MemoriesDB [2511.06179](https://arxiv.org/abs/2511.06179).
Metric refs: Pinecone offline-eval, Weaviate retrieval-metrics,
[DCG (Wikipedia)](https://en.wikipedia.org/wiki/Discounted_cumulative_gain).
Contrarian: [LoCoMo answer-key audit (dev.to)](https://dev.to/penfieldlabs/we-audited-locomo-64-of-the-answer-key-is-wrong-and-the-judge-accepts-up-to-63-of-intentionally-33lg) ·
Zep-vs-Mem0 methodology dispute (getzep/zep-papers#5) ·
"Benchmark Theatre" (bloo-mind, May 2026).
