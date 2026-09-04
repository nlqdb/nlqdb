# EK-08 — The marketplace's own launch motion + acceptance criteria

**Status:** in-flight · **Repo:** both · **Risk:** med · **Runs:** 1–2 ·
**Prereqs:** EK-04 + EK-05 scoped enough that criteria describe something
real; founder input on the motion itself · **Box 1 shipped 2026-08-26:** the
acceptance criteria (the marketplace's own launch gate, `SK-EKP-005`'s "own
launch" made concrete) are written below with an owner per criterion —
agent-tightenable, founder-loosenable, never added to the Phase A gate.
**Box 2 `P2` research shipped 2026-08-29:** the three candidate motions are
drafted below (§ *Motion — options*) with 2026 receipts and the conservative
default applied (Motion 1 — supply-first single-vertical wedge). Remaining:
the founder's motion pick (deferred, **not** queued — the launch is
condition-gated on box 3's six criteria, so the pick is not yet actionable and
the default already unblocks the track; a `🔒` slots in with these options once
EK-04/05's live loop brings the criteria toward green) and box 3 (the launch
bullet, only once the criteria are green).

## Goal

`SK-EKP-005` gives the marketplace **its own launch**, distinct from the
product's Show HN launch. This slice writes that launch
down — condition-gated, never date-gated (the repo's idiom, founder-directed
2026-07-26):

1. **Acceptance criteria** — the marketplace's own gate, defined here, not
   inherited from the engine's Phase A gate: e.g. a real expert (starting with the founder as
   language tutor, user #1) completes interview → listing → a real buyer
   queries → fee splits correctly → revocation works → zero silent
   data-loss incidents on expert knowledge. Exact set is this slice's
   deliverable, agent-tightenable / founder-loosenable.
2. **Motion** — where and how it launches (the "another type of launch"
   the founder named): candidates researched with `P2` (creator-economy
   channels, profession communities, the existing /agents audience), then
   **founder picks** — the motion is a strategy/money call on the
   GLOBAL-033 ladder.
3. **First-expert recruitment** — how experts #2..N after the founder are
   found; interacts with `docs/founder-playbook.md` design-partner
   machinery rather than duplicating it.

## Acceptance criteria — the marketplace's own launch gate

`SK-EKP-005` gives the marketplace its own launch, uncoupled from the
engine's Phase A gate, so these are defined here — condition-gated (never date-gated),
each criterion owned by the slice that proves it. **Agents may tighten a
criterion; only the founder loosens or removes one** — and no criterion here
is ever added to Phase A's gate (`SK-EKP-005`).
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
green — only the founder's ~30-minute sitting remains" — condition-gated,
never date-gated.

## Motion — options (`P2` research, 2026)

The "another type of launch" `SK-EKP-005` names is a **money/strategy call on
the `GLOBAL-033` ladder**, so this pass pre-drafts the options and applies the
conservative default; the founder picks (deferred — see the status line). The
2026 marketplace-launch orthodoxy is one-directional: **most builds fail on the
cold start, not on features** — recruit 10–50 suppliers by hand *before* buyers
see the surface, and **shrink the market to one vertical until liquidity is
reachable** (the Airbnb one-city move); the 2026 success signal is *supply-side
retention* [FORKOFF; pulserevops]. For an agent marketplace the second bottleneck
is **discovery** among thousands of listings, and the best creators are **domain
experts, not AI engineers** [digitalapplied; agentman] — exactly the "Become AI"
thesis. This constrains the choice more than it looks.

1. **Supply-first single-vertical wedge — hand-recruited language tutors.**
   The founder (user #1, a real language tutor per `SK-EKP-004`) is the first
   paying expert; experts #2..N are hand-recruited **one by one** (10–50, white-
   glove) from where independent language tutors already are — the italki/Preply
   tutor community, `r/languagelearning`, and language-teaching Facebook/Skool/
   Discord groups [italki; thehiveindex]. `SK-EKP-006`'s free packs seed the one
   catalog, so it never launches empty (the GPT-Store cold-start lesson). No
   public "marketplace is open" splash until supply is liquid. Aligns with every
   lock (`SK-EKP-004` pilot, `SK-EKP-006` catalog, the six criteria) and needs
   **no fee-% or money commitment to begin** (`SK-EKP-002` discloses the fee in
   the selling flow whenever it ships; a launch-window reduced/zero-commission is
   a *separate* founder call, not a launch prerequisite). Lowest-regret, most
   reversible.
2. **Demand-led /agents + MCP-directory distribution.** Launch to the *buyer*
   side first via the existing `/agents` audience and the MCP hubs / connector
   directories where agent developers already are, seeding the founder's tutor
   knowledge DB as the first paid listing. **Inverts the cold-start orthodoxy**
   (one expert is not liquid supply) and lands into the discovery bottleneck —
   better as a **phase-2 amplifier** once Motion 1 is liquid, not the opening
   move. Reuses `/reach`'s ledgered venues (do not duplicate that ledger).
3. **Creator-economy "Become AI" content splash.** A public positioning launch
   (Product Hunt / creator-economy channels / an X thread) driving experts to
   sign up. Repeats the **GPT-Store failure mode** in the FEATURE research — a
   public splash with dangled revenue and no liquid supply burns creator trust —
   and is premature before the criteria are green. A later amplifier, never the
   opener; kept distinct from the Show HN dev launch (`SK-EKP-005`).

**Conservative default (applied): Motion 1.** Supply-first, single-vertical,
hand-recruited, no public splash until liquid; Motions 2–3 layer on only after
Motion 1 reaches supply-side retention. It is the only option consistent with
the 2026 cold-start evidence *and* every locked decision, and it commits no
money. First-expert recruitment (box 3 of the *Goal*) rides
`docs/founder-playbook.md`'s design-partner machinery against the tutor-community
venues above rather than duplicating it.

**Receipts (`P2`):** [FORKOFF cold-start 2026](https://forkoff.xyz/blog/founder-growth/two-sided-marketplace-cold-start-2026)
· [pulserevops two-sided GTM](https://pulserevops.com/go-to-market-playbooks/gp0500)
· [digitalapplied — agent-marketplace discovery 2026](https://www.digitalapplied.com/blog/ai-agent-marketplaces-2026-discovery-distribution)
· [agentman — agent-skills ecosystem 2026](https://agentman.ai/blog/agent-skills-ecosystem-report-2026)
· [italki — where tutors gather](https://www.italki.com/en/blog/best-websites-for-language-learning-tutors)
· [Hive Index — language-learning communities](https://thehiveindex.com/topics/language-learning/).

## Done when

- [x] Acceptance criteria written into this track (or a minted decision)
      with owners per criterion. (2026-08-26 — the six-criterion first-paying-
      expert gate above, each owned by its proving slice, agent-tightenable /
      founder-loosenable, kept off the Phase A gate.)
- [~] Motion options researched with receipts (2026-08-29 `P2` pass, §
      *Motion — options*: three candidates + receipts + conservative default
      Motion 1 applied); **founder pick deferred** — not queued, since the
      launch is condition-gated on the six criteria and the default already
      unblocks the track (`GLOBAL-033`).
- [ ] The launch bullet exists in `blocked-by-human.md` **only** when its
      criteria are green and just the founder's sitting remains.
