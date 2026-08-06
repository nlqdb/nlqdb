# EK-01 — Interview-extraction: research → design record

**Status:** design record minted 2026-08-06 as
[`SK-EKP-007`](../decisions/SK-EKP-007-interview-extraction-design.md)
(boxes 1 + 3 below); **remaining: box 2** — EK-04's interview-source adapter
contract updated to name the record. **Detailed product design lands in
`experts`** once agent access exists (`SK-EKP-003`) · **Repo:** nlqdb
(rail-level design), `experts` (product detail) · **Risk:** med · **Runs:**
1–2 · **Prereqs:** none

## Goal

Design how a non-technical professional's tacit knowledge becomes
`agent_memory_v1` rows through an interview — question generation,
answer→row mapping, verification UX, session structure — feeding EK-04
(public rails) and EK-05 (question-engine product).

## Research findings (2026-08-05)

- **The knowledge-acquisition bottleneck is this product's founding
  problem** — named by Feigenbaum in the expert-systems era; manual
  knowledge engineering never solved it
  ([overview](https://www.sciencedirect.com/topics/biochemistry-genetics-and-molecular-biology/expert-system)).
  An LLM interviewer is a direct attack on it; the elicitation literature
  is the tested playbook.
- **Experts cannot introspect their expertise** — verbal self-reports are
  partly confabulated (Nisbett & Wilson 1977,
  [ref](https://philpapers.org/rec/NISTMT)); "how do you do X?" yields
  "I just know" or espoused theory that diverges from practice.
- **What works anchors on concrete incidents**: the Critical Decision
  Method ([Klein et al.](https://ieeexplore.ieee.org/document/31053/)) and
  Critical Incident Technique
  ([NN/g](https://www.nngroup.com/articles/critical-incident-technique/)) —
  "tell me about your last difficult student," never "what are the rules
  of tutoring."
- **ACTA is a promptable question-generation spec**: task diagram → eight
  fixed knowledge-audit probe categories → simulation interview
  ([Militello & Hutton](https://www.tandfonline.com/doi/abs/10.1080/001401398186108),
  [DTIC PDF](https://apps.dtic.mil/sti/tr/pdf/ADA335225.pdf)) — built
  because CDM was too hard for non-specialists, the same constraint our
  interviewer faces.
- **Contrived techniques elicit relational structure**: repertory-grid
  triads ("which two of these student types are most alike, and why?") and
  laddering mechanically surface discriminating constructs → **edge rows**
  ([technique refs](https://edutechwiki.unige.ch/en/Repertory_grid_technique)).
- **LLM-led interviews are validated with a known failure profile**: data
  quality comparable to humans, but **88% of guideline violations are
  under-probing** — moving on from surprising answers
  ([arXiv:2410.01824](https://arxiv.org/abs/2410.01824)). The live product
  axis is exploratory (Listen Labs) vs guide-bound (Outset) interviewing
  ([comparison](https://cleverx.com/blog/outset-ai-vs-listen-labs-ai-interview-platforms-compared/));
  the enterprise "capture retiring experts" segment stops at internal KM —
  **nobody combines interview capture with a queryable SQL marketplace**.
- **The answer→row pattern has canonical prior art — Zep/Graphiti**:
  interview turn = episode; entities/facts/edges extracted with
  `source_episode` provenance; contradictions **invalidate the old fact's
  validity window instead of overwriting**
  ([arXiv:2501.13956](https://arxiv.org/pdf/2501.13956)). Directly
  reusable on `agent_memory_v1`. Schema naming/descriptions are themselves
  an extraction lever — up to 64.7% accuracy gains from LLM-optimized
  schema presentation (PARSE,
  [arXiv:2510.08623](https://arxiv.org/html/2510.08623v1)).
- **Read-back "correct?" verification is bias-prone** (acquiescence bias;
  sycophantic entrenchment over multi-turn,
  [arXiv:2504.09343](https://arxiv.org/pdf/2504.09343)) — confirmation
  must be *edit/rank/forced-choice*, never yes/no.
- **Episodic capture beats one-shot retrospection**: recall bias runs
  20–50%; momentary/diary methods win on accuracy but attrit
  ([Myin-Germeys 2018](https://onlinelibrary.wiley.com/doi/full/10.1002/wps.20513))
  — short recurring case-debriefs, not a 2-hour brain-dump.

## Design stakes (the design record confirms or refutes)

1. **Question engine = ACTA instantiated per profession**: task diagram
   first, then the eight audit probes per step, every probe anchored to a
   recent real case; laddering until an answer carries a
   *cue + condition + action* triple; **minimum-2-follow-ups enforced
   mechanically**, not by prompt vibes (the measured LLM failure).
2. **Mapping = Graphiti pattern on `agent_memory_v1`**: every exchange an
   episode row (kept even when nothing extracts — schema-tunnel-vision
   guard); structured-output extraction per exchange with episode
   provenance; contradiction = search-before-insert, invalidate + one
   clarifying question citing both statements.
3. **Verification = show, don't ask**: extracted rows rendered as
   plain-language cards the expert edits or ranks; forced-choice
   refinement ("always / usually / only adults?"). How far verification
   can hide inside conversation is an open question below.
4. **Sessions = 10–15-minute recurring case-debriefs**, each opening with
   2–3 replayed facts from last time (P6 durable proof) and a row-count
   fill-meter per table (honest progress in user-meaningful units).
5. **`GLOBAL-037` boundary (track INDEX rule)**: the interview LLM
   necessarily sees the conversation; extraction happens there. The
   **query** path over the resulting DB stays schema-only. The design
   record states this boundary as an invariant with its enforcement point.

## Open design questions (product stances — settle in the design record, with a founder check-in where marked)

1. Exploration vs schema-fill time ratio (Listen vs Outset stance).
2. Contested-facts at **paid** query time: newest wins, both with validity
   windows, or confidence-weighted? (A paid product may need a stronger
   guarantee than Graphiti's "keep both.")
3. Voice vs text for non-technical experts — voice fits the persona,
   complicates card-edit verification; no study covers the combination.
4. How invisible can the database stay ("never sees SQL" vs "edits row
   cards")?
5. Cold-start incentive: experts monetize only after enough rows exist —
   the earnings-gap bridge is a **founder/money call** (GLOBAL-033).

## Done when

- [x] Design record covering the five stakes + five questions, minted as a
      new `SK-EKP` decision (rail-level here; product detail in `experts`).
      → [`SK-EKP-007`](../decisions/SK-EKP-007-interview-extraction-design.md).
- [ ] EK-04's interview-source adapter contract updated to match.
- [x] The `GLOBAL-037` interview/query boundary stated as a testable
      invariant. → `INV-EKP-037` in `SK-EKP-007`.
