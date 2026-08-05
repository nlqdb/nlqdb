# Future plan — The expert-knowledge platform ("Become AI")

> **Status:** **vision, unscheduled.** Founder-directed 2026-08-04. The founder
> said, verbatim in substance: *"give it priority."* That directive is recorded
> here faithfully — **and** the weekly focus (the `SK-PIVOT-016` dogfood gate,
> founder-set 2026-07-28) is itself a documented decision, so the sequencing
> between the two is one of the four decisions queued for a founder lock in
> [`blocked-by-human.md`](../blocked-by-human.md) (🔒, per
> [`GLOBAL-033`](../decisions/GLOBAL-033-resolution-defaults.md)). Until locked,
> the conservative default applies: **this vision proceeds in the strategy lane
> (research + codification, this document) while the gate stays the execution
> focus.** Note the two are not rivals: the gate's D-08 pack runner is itself
> the substrate this vision runs on — gate work is empire work.
>
> **Promotion trigger:** **founder locks, and nothing else** — the four
> decisions in [§ Decisions only the founder can lock](#decisions-only-the-founder-can-lock)
> resolve into minted/amended `GLOBAL-*`/`SK-*` records before any build. Per
> `P4 / D5`, **no `SK-*` ID is minted here** — `docs/future/` is pre-decision
> by definition.

**Cross-refs:**
[`docs/research/expert-knowledge-platform.md`](../research/expert-knowledge-platform.md)
(the competitive-landscape pass behind this doc) ·
[`GLOBAL-036`](../decisions/GLOBAL-036-lead-positioning-analytical-agent-memory.md)
(analytical agent memory, the thesis this scales) ·
[`GLOBAL-037`](../decisions/GLOBAL-037-schema-only-llm-egress.md)
(schema-only LLM egress — the trust pillar's existing technical floor) ·
[`SK-PIVOT-018`](../features/agent-memory-pivot/decisions/SK-PIVOT-018-goal-packs.md)
(goal packs — a profession is a pack) ·
[`SK-PIVOT-020`](../features/agent-memory-pivot/decisions/SK-PIVOT-020-memory-ops-business-model.md)
(one monetization axis — the decision a marketplace fee would extend) ·
[`SK-PIVOT-021`](../features/agent-memory-pivot/decisions/SK-PIVOT-021-one-click-goal-pack-journeys.md)
(one-click journeys on one shared runner) ·
[`language-tutor-assistant.md`](./language-tutor-assistant.md)
(the founder's #1 pack — the natural pilot profession).

---

## The vision (founder, 2026-08-04)

Positioning message: **"AI can't replace you if you become AI."**

A system — potentially the empire-scale expression of the agent-memory pivot —
where **any non-technical professional** (teacher, doctor, lawyer, accountant,
baker, language teacher, carpenter, …) can, through a super-simple UX,
incorporate their professional knowledge into a **well-designed database
schema** that any AI can then use as a skill.

The professional doesn't write prompts, upload PDFs, or train a model. They
answer questions about their craft, and their expertise lands as structured,
queryable rows — material tolerances, error taxonomies, dosage rules, pricing
heuristics — that an agent can `GROUP BY`, `JOIN`, and aggregate over, not
just recall.

## Two pillars, deliberately asymmetric marketing (founder-directed)

1. **Trust — said everywhere.** *We are not allowed to use or read this data —
   it is only theirs.* This is the loud pillar; every surface carries it.
2. **Monetization — kept quieter.** The professional can earn money from their
   knowledge: agents and consumers pay to use it, and nlqdb takes only a small
   fee, Stripe-style. Real, but **not part of the trust marketing**.

**Honesty boundary (binding on any copy written from this doc):**

- *Quiet marketing is never hidden terms.* If/when selling ships, the fee is
  plainly disclosed to sellers in the selling flow and its terms — quiet in
  the trust pitch, never concealed from the person paying it.
- *The trust copy must not exceed its technical substance.* The repo's
  capability-claim culture (P6; the honest-claims guard tests) forbids
  marketing "we **can't** read it" while operators technically can. Whether
  the pillar is "not allowed" (contractual) or "not able" (cryptographic) is
  founder decision #1 below; until locked, copy may claim only what
  [`GLOBAL-037`](../decisions/GLOBAL-037-schema-only-llm-egress.md) and the
  isolation rails already make true.

## Why this lands on existing rails

Almost every mechanical piece already has a decided home. The delta is small
and named; nothing here is a parallel system.

| Idea component | Existing rail |
|---|---|
| "Well-designed schema any AI can use" | `agent_memory_v1` + MCP tools (`nlqdb_remember` / `nlqdb_query`), live in prod ([`SK-PIVOT-007`](../features/agent-memory-pivot/decisions/SK-PIVOT-007-memory-schema-versioning.md)) |
| "Per-profession" | [`SK-PIVOT-018`](../features/agent-memory-pivot/decisions/SK-PIVOT-018-goal-packs.md) goal packs — a profession is a pack (recipe + seed entities + golden queries), never new DDL or a new endpoint |
| "Super-simple UX for non-technical" | [`SK-PIVOT-021`](../features/agent-memory-pivot/decisions/SK-PIVOT-021-one-click-goal-pack-journeys.md) one-click journey contract + the shared pack runner ([`D-08`](../features/agent-memory-pivot/worksheets/dogfood/D-08-repo-ops-one-click-import.md) is instance #1) |
| "Only theirs" (isolation) | [`SK-PIVOT-009`](../features/agent-memory-pivot/decisions/SK-PIVOT-009-agent-scope-rls.md) RLS scoping · [`SK-HDC-016`](../features/hosted-db-create/decisions/SK-HDC-016-delete-database.md) delete · FSL self-host ([`SK-PIVOT-005`](../features/agent-memory-pivot/decisions/SK-PIVOT-005-fsl-self-host.md)) |
| "AI can't read what it shouldn't" | [`GLOBAL-037`](../decisions/GLOBAL-037-schema-only-llm-egress.md) schema-only egress — cell-values never reach a third-party LLM |
| Existing profession-shaped seed | Pack candidate #1, **language tutor** (founder-set 2026-07-29, [`pack-candidates.md`](../features/agent-memory-pivot/worksheets/dogfood/pack-candidates.md)) |

## The genuine deltas — where decisions are actually needed

Four things have no existing rail. They are the entire new surface of this
idea, and each is why the founder locks below exist:

- **(a) Extraction-by-interview.** Every shipped pack journey imports
  knowledge that already exists in files (a repo, a log). A professional's
  knowledge is in their head: the authoring journey is an **interview** — the
  system asks profession-shaped questions and writes structured rows — not an
  import. New journey shape on the same `SK-PIVOT-021` runner; the runner's
  auth/progress/proof/cleanup contract carries over unchanged.
- **(b) Cross-tenant grants.** Selling read access to *other people's* agents
  is new engine surface. Today RLS scopes within a tenant
  (`SK-PIVOT-009`); a marketplace needs a grant primitive — tenant A allows
  tenant B's agents to query (never write) a named knowledge DB, revocably,
  with the same fail-closed posture.
- **(c) Marketplace + fee.** A take-rate on knowledge sales is a **second
  monetization axis**, which
  [`SK-PIVOT-020`](../features/agent-memory-pivot/decisions/SK-PIVOT-020-memory-ops-business-model.md)
  as written ("no second monetization system") does not permit. Per `P1` this
  is never worked around silently — the founder must explicitly extend or
  supersede SK-PIVOT-020 before any selling surface exists.
- **(d) Trust-claim substance.** "Not allowed" (ToS/DPA — cheap, weaker) vs
  "not able" (customer-key encryption / E2E — expensive, absolute). The
  research pass shows every incumbent ships the weak form; the strong form
  would be a category differentiator but constrains the NL→SQL engine itself
  (the server must read rows to answer queries — see the research doc's
  trust-posture table for how competitors square this).

## What the research says (2026-08-05 pass)

Full landscape with receipts:
[`docs/research/expert-knowledge-platform.md`](../research/expert-knowledge-platform.md).
The four findings that shape this vision:

1. **The wedge hypothesis survives contact.** Every "monetize your expertise"
   platform (Delphi — chunk-and-embed into Pinecone, confirmed at the infra
   level — Coachvox, the GPT Store's `file_search`) and every
   KB-as-a-service stores **prose to recall**. None stores **structure to
   compute on**. The intersection of non-technical authoring × computable
   schema × agent-queryable interface × expert monetization is unoccupied;
   the nearest players each hold one corner (Pinecone Nexus: structure, no
   monetization; Skill Refinery: positioning, no schema; Paydog: MCP
   pay-per-answer, prose inside).
2. **The creator-economy motion is validated — by others.** Delphi (Sequoia
   $16M Series A, one creator at 7-figure clone revenue) proves
   professionals pay to package expertise and consumers pay to use it; the
   GPT Store proves the anti-pattern — a builder-revenue program promised in
   Jan 2024 and still unshipped burns creator trust; Poe proves shipped,
   boring per-message payouts work. Lesson: the fee must be real, disclosed,
   and boring (Stripe-style), never dangled.
3. **Trust is marketed everywhere and substantiated nowhere.** Incumbent
   postures are contractual ("we don't train on your data") with full
   platform read access — and the biggest brand's legal terms are *weaker*
   than its marketing. The technical ceiling in the whole landscape is
   enterprise-gated customer-managed keys; nobody says "we cannot read it."
   A truthfully-stronger claim is an open lane — which is exactly founder
   decision #1.
4. **The counter-current is the risk to respect.** The market has repeatedly
   traded structure away for prose+LLM (Blue J abandoned its factor models
   for RAG) because structured authoring cost experts too much — while 2026
   evidence (Pinecone Nexus: setup-time curation ~90% vs ~65% RAG) says
   structure wins on quality when authoring is cheap. nlqdb's bet is that
   the NL interface + interview extraction is what makes structure cheap.

## Decisions only the founder can lock

Queued as one bundled 🔒 decision-to-lock bullet in
[`blocked-by-human.md`](../blocked-by-human.md) (respecting the GLOBAL-033
3-bullet cap), with options pre-drafted there. In brief:

1. **Trust-claim substance** — lock "not allowed" (contract/DPA now, honest
   and cheap) or "not able" (customer-key encryption/E2E, expensive, absolute,
   and in tension with server-side NL→SQL). Conservative default until locked:
   copy claims only what is technically true today (GLOBAL-037 + RLS +
   delete + self-host).
2. **Monetization** — explicitly extend or supersede `SK-PIVOT-020` to admit
   a marketplace fee, or reject the fee. Conservative default: no selling
   surface, no fee copy, nothing built.
3. **First profession** — recommend inheriting the founder's existing #1
   (language tutor) as the pilot "become AI" pack, since it is already
   founder-locked; confirm or name another.
4. **Sequencing** — (a) research + codification proceed in the strategy lane
   while the `SK-PIVOT-016` gate stays the execution focus (conservative
   default, applied now), or (b) this displaces the weekly focus explicitly.

## Non-blocking clause (read this before acting on anything above)

This vision **gates nothing**. Specifically, and enforceably:

- It adds **no criterion** to the `SK-PIVOT-016` dogfood launch gate and
  makes **no weekly-focus claim** — the founder's "give it priority" is
  recorded above, and its effect on sequencing is decision #4, a founder
  lock, not something an agent infers.
- It creates **no `D-*` slice**, appears in no worksheet sequence, and adds
  **no scorecard row**.
- It mints **no `SK-*` ID** and supersedes **no** existing decision — in
  particular `SK-PIVOT-020` and `GLOBAL-037` stand unmodified until the
  founder locks otherwise.
- **Nothing is built from this doc.** The handoff that produced it authorizes
  research + codification only. An agent that builds an interview journey, a
  grant primitive, or any selling surface off this doc alone has violated `P1`.
- The **only** queue entries this vision may have are (i) the 🔒 bullet above
  and (ii) pack candidates competing under normal founder ranking.

If you arrived here from a link and are deciding what to work on: **this is
not it.** Read [`docs/scorecard.md`](../scorecard.md) for what is.

## Deliberately open (do not fake-decide these)

Per `D1` / `D2`, open on purpose until the founder locks or until the stage
that needs them runs its own `P2` research pass:

- **Fee percentage, pricing, payout mechanics** — reserved to the founder by
  `SK-PIVOT-020`; no number appears anywhere until locked.
- **Trust-claim substance** — decision #1 above.
- **Grant-primitive design** (discovery, revocation, per-query metering vs
  subscription, buyer identity) — engine research at promotion time, not now.
- **Interview-extraction design** (how profession-shaped questions are
  generated; how answers become rows without the professional seeing SQL) —
  the hardest UX problem here; gets its own research pass when promoted.
- **Regulated professions** (doctor, lawyer, accountant) — liability and
  advice-regulation questions are a legal bet; not researched here, must be
  before any regulated-profession pack ships publicly.

## Why it's strategically real

Three reasons this is more than a slogan. First, it is `GLOBAL-036` at
empire scale: the pivot's bet is that structured, queryable memory beats
prose recall — this vision applies the same bet to every profession, and
each profession is just a pack on rails that already exist. Second, the
research pass found the position unoccupied: incumbents monetize prose
clones; nobody sells computable expertise. Third, the marketing message
writes itself from a true mechanism — a carpenter's tolerances in rows an
agent can aggregate genuinely *is* the carpenter becoming part of the AI's
capability, which is what "AI can't replace you if you become AI" claims.
