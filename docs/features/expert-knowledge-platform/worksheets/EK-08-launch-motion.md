# EK-08 — The marketplace's own launch motion + acceptance criteria

**Status:** in-flight · **Repo:** both · **Risk:** med · **Runs:** 1–2 ·
**Prereqs:** EK-04 + EK-05 scoped enough that criteria describe something
real; founder input on the motion itself · **Box 1 shipped 2026-08-26:** the
acceptance criteria (the marketplace's own launch gate, `SK-EKP-005`'s "own
launch" made concrete) are written below with an owner per criterion —
agent-tightenable, founder-loosenable, never added to `SK-PIVOT-016`.
Remaining: box 2 (motion — founder picks after a `P2` receipts pass) and
box 3 (the launch bullet, only once the criteria are green).

## Goal

`SK-EKP-005` gives the marketplace **its own launch**, distinct from the
Show HN launch the dogfood gate protects. This slice writes that launch
down — condition-gated, never date-gated (the repo's idiom, founder-directed
2026-07-26):

1. **Acceptance criteria** — the marketplace equivalent of the dogfood
   gate's five, defined here instead of inherited (the founder explicitly
   declined coupling): e.g. a real expert (starting with the founder as
   language tutor, user #1) completes interview → listing → a real buyer
   queries → fee splits correctly → revocation works → zero silent
   data-loss incidents on expert knowledge. Exact set is this slice's
   deliverable, agent-tightenable / founder-loosenable like SK-PIVOT-016.
2. **Motion** — where and how it launches (the "another type of launch"
   the founder named): candidates researched with `P2` (creator-economy
   channels, profession communities, the existing /agents audience), then
   **founder picks** — the motion is a strategy/money call on the
   GLOBAL-033 ladder.
3. **First-expert recruitment** — how experts #2..N after the founder are
   found; interacts with `docs/founder-playbook.md` design-partner
   machinery rather than duplicating it.

## Acceptance criteria — the marketplace's own launch gate

`SK-EKP-005` gives the marketplace its own launch, and the founder declined
coupling it to the dogfood gate, so these are defined here — the
marketplace's `SK-PIVOT-016` equivalent, condition-gated (never date-gated),
each criterion owned by the slice that proves it. **Agents may tighten a
criterion; only the founder loosens or removes one** — and no criterion here
is ever added to `SK-PIVOT-016` (`SK-EKP-005`: parallel tracks, not coupled).
The gate is green when a single **first paying expert** completes the whole
money loop with a real buyer:

1. **Author** — a real expert (the founder as language tutor, user #1 per
   `SK-EKP-004`) completes the interview→authoring walk end-to-end on the
   public rails: draft → honest progress counters → verify with
   edit/rank/forced-choice (no yes/no read-back, `SK-EKP-007` stake 3) →
   durable proof (the pack's golden queries answer from the authored rows) →
   delete works. *Owner: EK-04 (public rails) + EK-05 (interview product UX,
   `experts`).*
2. **List** — the authored knowledge DB is a paid listing in the **one**
   catalog (`SK-EKP-006`), showing its honest demo (schema / query-shapes per
   the FEATURE listing-demo-depth open question — not free result rows unless
   that question resolves that way) with the transaction fee disclosed to the
   seller **before** they publish (`SK-EKP-002`). *Owner: EK-05.*
3. **Buy + query** — a real buyer on a **distinct** tenant queries the listing
   and gets correct rows **only** through a live grant: cross-tenant read is
   denied without the grant, SELECT-only, schema-only egress end-to-end (zero
   expert row values reach an LLM — EK-09 narration skip), rows returned
   un-narrated. *Owner: EK-06 (grant execution) + EK-09 (schema-only buyer
   path).*
4. **Fee splits correctly** — the successfully-executed authorized query
   meters exactly one billable unit (`SK-EKP-008`), the fee is computed at the
   founder-set % and the expert's share is credited to their payout with a
   reconcilable record; no fee ever touches a first-party pack install
   (`SK-EKP-006` free line). *Owner: EK-05 (fee/payout wiring, `experts`).*
5. **Revocation works** — the expert revokes the buyer's access and it
   fail-closes within the ≤30 s bound (`SK-EKP-008`) for both new queries and
   any in-flight one; a post-revocation query is denied. *Owner: EK-06.*
6. **Zero silent harm on expert knowledge** — across the whole walk, zero
   silent data-loss and zero wrong-answer-accepted incidents on
   expert-knowledge rows; the "not allowed" trust contract (ToS/DPA delta) is
   live **before** the first listing opens (`SK-EKP-001` sequencing) and every
   trust-surface claim passes the honest-claims guard. *Owner: EK-03 (contract
   + guard) + the EK-04/EK-06 data-safety tests.*

When all six are green, the launch bullet (box 3) becomes "everything is
green — only the founder's ~30-minute sitting remains" — mirroring
`SK-PIVOT-016`'s idiom without inheriting its criteria.

## Done when

- [x] Acceptance criteria written into this track (or a minted decision)
      with owners per criterion. (2026-08-26 — the six-criterion first-paying-
      expert gate above, each owned by its proving slice, agent-tightenable /
      founder-loosenable, kept off `SK-PIVOT-016`.)
- [ ] Motion options researched with receipts; founder has picked one.
- [ ] The launch bullet exists in `blocked-by-human.md` **only** when its
      criteria are green and just the founder's sitting remains.
