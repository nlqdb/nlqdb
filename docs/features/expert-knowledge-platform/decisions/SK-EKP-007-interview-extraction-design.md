# SK-EKP-007 — Interview-extraction design record: ACTA question engine, Graphiti-pattern mapping on `agent_memory_v1`, show-don't-ask verification, recurring case-debrief sessions — and the interview/query `GLOBAL-037` boundary as a tested invariant

- **Decision (agent, 2026-08-06, resolving [`EK-01`](../worksheets/EK-01-interview-extraction-design.md)'s
  five design stakes and five open questions from its 2026-08-05 `P2`
  research pass; value-decidable per [`GLOBAL-033`](../../../decisions/GLOBAL-033-resolution-defaults.md),
  so none escalates):** This is the **rail-level** design of how a
  non-technical expert's tacit knowledge becomes `agent_memory_v1`
  ([`SK-PIVOT-007`](../../agent-memory-pivot/decisions/SK-PIVOT-007-memory-schema-versioning.md),
  no new DDL) rows through an interview. Product-surface detail (the
  question-engine UI, the marketplace-facing session shell) lands in
  `experts` per [`SK-EKP-003`](../FEATURE.md); this record fixes the seam
  EK-04 (public rails) and EK-05 (private product) both build to.

## The five stakes — confirmed as the design

1. **Question engine = ACTA instantiated per profession.** Task diagram
   first, then the eight fixed knowledge-audit probe categories per step,
   every probe anchored to a *recent real case* (Critical Decision Method /
   Critical Incident Technique — "your last difficult student," never "the
   rules of tutoring"). Laddering continues until an answer carries a
   *cue + condition + action* triple. **A minimum of two follow-ups per
   surprising answer is enforced mechanically** (a counter in the session
   state machine), not by prompt wording — this is the direct guard against
   the measured LLM interview failure (88% of guideline violations are
   under-probing, [arXiv:2410.01824](https://arxiv.org/abs/2410.01824)).
   Repertory-grid triads and laddering are the contrived probes that
   surface **edge rows** (relations between entities).

2. **Mapping = the Graphiti/Zep pattern on `agent_memory_v1`.** Every
   interview exchange is an **episode row**, kept even when nothing
   structured extracts from it (the schema-tunnel-vision guard). Per
   exchange, a structured-output extraction produces entity/fact/edge rows
   carrying `source_episode` provenance. A contradiction is resolved by
   **search-before-insert**: the new fact invalidates the old fact's
   *validity window* rather than overwriting it, and triggers exactly one
   clarifying question citing both statements. No fact is ever silently
   destroyed.

3. **Verification = show, don't ask.** Extracted rows are rendered as
   plain-language cards the expert **edits, ranks, or forced-chooses over**
   ("always / usually / only adults?"). Read-back "is this correct?" yes/no
   confirmation is **prohibited** — it is acquiescence-/sycophancy-biased
   ([arXiv:2504.09343](https://arxiv.org/pdf/2504.09343)). Confirmation is
   always an edit/rank/forced-choice act, never a binary assent.

4. **Sessions = 10–15-minute recurring case-debriefs.** Each session opens
   with 2–3 replayed facts captured last time (P6 durable proof) and shows
   a **per-table row-count fill-meter** (honest progress in user-meaningful
   units, P6 — never a spinner or invented %). Short recurring debriefs
   beat one 2-hour brain-dump (recall bias 20–50%,
   [Myin-Germeys 2018](https://onlinelibrary.wiley.com/doi/full/10.1002/wps.20513)).

5. **The `GLOBAL-037` boundary** — stated as a tested invariant below.

## The five open questions — resolved

Each resolution cites `GLOBAL-033` plus the source value; none is a founder
bet (see Q5).

1. **Exploration vs schema-fill ratio (Listen- vs Outset-style).**
   **Exploratory-led with a mechanical probe floor.** The interview is
   driven by the ACTA probes and the min-2-follow-up counter (stake 1), not
   by a schema-completion progress bar racing to fill cells — because the
   measured failure mode is *under*-probing, and Goal-first (`§0`) says the
   expert's knowledge, not our table shape, sets the agenda. Schema-fill is
   the *ceiling* (which tables exist, when a session can end), never the
   *driver*. Source: guidelines habits + Goal-first (`§0`).

2. **Contested facts at paid query time.** **Validity-window model, never
   overwrite.** A contradiction invalidates the prior fact's window and
   inserts the new one; a query returns the currently-valid fact with its
   provenance retained. This is the bullet-proof-by-design default (make bad
   states unreachable: a destroyed fact is an unrecoverable bad state) and
   the honest-latency value (the buyer can always see *why* a fact holds and
   what it superseded). "Newest silently wins" and "confidence-weighted
   blend" are both rejected: the first loses history a paid buyer may need to
   audit, the second invents a number we cannot yet calibrate. Source:
   guidelines §7 (layered, fail-safe) + bullet-proof.

3. **Voice vs text.** **Text-first; voice parked until a pilot expert asks.**
   Card-edit verification (stake 3) is clean in text and complicates under
   voice, and no study covers the voice+card-edit combination — so building
   voice now is speculative scope. Parked until a pilot expert (`SK-EKP-004`,
   language tutor) requests voice. Source: `GLOBAL-033` speculative-scope
   rung + Effortless-UX (`§0`).

4. **How invisible the database stays.** **Fully invisible: the expert never
   sees SQL or a schema.** Authoring is conversation; verification is
   plain-language row cards; the word "table/column/query" never appears in
   the expert surface. Simple + Effortless-UX (`§0`) + P6. This is the
   hardest UX bar and the one that most differentiates the product from
   "capture retiring experts" internal-KM tools, which stop at a document.
   Source: Effortless-UX (`§0`) + P6.

5. **Cold-start incentive / earnings-gap bridge** (an expert authors rows
   before enough exist to earn). **Parked until a pilot expert reaches the
   gap — no subsidy or earnings guarantee is built speculatively.** The
   authored pack is independently useful to the expert as *their own* agent
   memory the day it exists (`SK-EKP-006`: a pack install is the runner
   journey on the author's own tenant — free, no grant, no fee), so there is
   no gap to bridge at authoring time. Any subsidy/guarantee is money out
   the door and is deferred until a real expert hits the threshold with
   unpaid authored rows and asks — at which point it becomes a founder bet to
   lock, not before. Source: `GLOBAL-033` speculative-scope rung ("defer
   until a paying or design-partner customer asks; never build
   speculatively; park with a named trigger"). **Not escalated** — the
   ladder decides it, so no 🔒 bullet is spent.

## The `GLOBAL-037` interview/query boundary — a tested invariant

The interview LLM **necessarily sees the conversation** — the expert's
answers are its input, and structured extraction happens on that turn. Those
answers **become cell values the moment they are written** to
`agent_memory_v1`. The invariant is therefore not "no expert data reaches an
LLM" (impossible for the interviewer) but a **boundary between two paths**:

> **INV-EKP-037:** The **query** path over any expert's knowledge DB is
> schema-only to third-party LLMs — a knowledge-DB query request sends table
> and column *names and descriptions*, never expert cell values, to the
> NL→SQL model, exactly as `GLOBAL-037` already governs every hosted DB. The
> **interview/extraction** path is the only path where expert cell values
> reach an LLM, and that LLM is the interview model operating on the expert's
> own tenant during authoring — never a cross-tenant buyer's query.

- **Enforcement point:** the interview path uses the extraction/interview
  model; the marketplace query path reuses the unmodified `/v1/ask`
  schema-only prompt builder (`GLOBAL-037`'s existing egress guard). No new
  egress path is introduced — the boundary holds because the query path is
  *literally the same code* that already never sends cell values.
- **Test:** an assertion in the EK-04 interview-source-adapter test suite
  that (a) the query/ask path for a knowledge DB sends zero expert row
  values to the model (schema tokens only — the existing `GLOBAL-037` egress
  test extended to the knowledge-DB listing type), and (b) the interview
  path is the *only* code path that reads expert cell values into an LLM
  request. A reviewer rejects any marketplace query surface that widens
  egress beyond schema.

## Core value

Goal-first, Simple, Honest latency, Bullet-proof

## Why

EK-01's research is settled (`P2`, receipts in the worksheet); what was
missing was a *record fixing the choices* so EK-04 and EK-05 build to one
seam instead of each re-deriving it. Each of the five questions is a fork a
later agent would otherwise re-litigate — documenting the resolution is
exactly the D5 "non-obvious and expensive to reverse" bar (the interview
shape is the product's competitive surface and its hardest UX problem). The
boundary invariant is load-bearing and cheaply testable now, so it is stated
now (bullet-proof: make the bad state unreachable, not caught later).

## Consequence in code

- EK-04's interview-source adapter feeds the runner **episode + extracted
  rows with `source_episode` provenance**, produced by the ACTA/min-2-probe
  interview; the runner's draft → phases → counters → proof → delete contract
  is unchanged (D-08 N+1). The adapter contract in
  [`EK-04`](../worksheets/EK-04-pilot-authoring-rails.md) is to be updated to
  name this record (EK-01's remaining box 2).
- The verification surface renders **row cards with edit/rank/forced-choice**
  affordances; a reviewer rejects a yes/no "correct?" confirmation step.
- The query path over a knowledge DB **must not** introduce a new egress
  path; it reuses the `GLOBAL-037` schema-only builder, guarded by the
  INV-EKP-037 test.
- No new schema, endpoint, or tool per pack (`SK-PIVOT-007`/`018`).

## Alternatives rejected

- **Schema-fill-driven interview** (race to populate cells) — reproduces the
  measured under-probing failure; rejected for exploratory-led + probe floor.
- **Overwrite-on-contradiction** — loses history a paid buyer may audit;
  rejected for validity windows.
- **Yes/no read-back verification** — acquiescence/sycophancy-biased;
  rejected for edit/rank/forced-choice.
- **Voice-first authoring now** — speculative; parked until a pilot expert
  asks.
- **Building a cold-start earnings subsidy now** — speculative money out the
  door; parked with a trigger, not escalated.
</content>
</invoke>
