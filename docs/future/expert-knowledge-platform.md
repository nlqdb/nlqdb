# Future plan — The expert-knowledge platform ("Become AI")

> **Status:** **promoted — decisions locked.** Founder-directed 2026-08-04
> (*"give it priority"*), and all five governing decisions were
> **founder-locked in-session on 2026-08-05**. The canonical home is now
> [`docs/features/expert-knowledge-platform/FEATURE.md`](../features/expert-knowledge-platform/FEATURE.md)
> (`SK-EKP-001..005`, plus
> [`SK-PIVOT-023`](../features/agent-memory-pivot/decisions/SK-PIVOT-023-two-axis-business-model.md),
> the two-axis business model). This file remains the narrative — the vision,
> the marketing asymmetry, the rails mapping, and the research pointers;
> for any conflict, the FEATURE.md wins. Implementation proceeds **in
> parallel** with the `SK-PIVOT-016` dogfood gate (`SK-EKP-005`: neither
> blocks the other); execution planning is the feature's next step.

**Cross-refs:**
[`docs/research/expert-knowledge-platform.md`](../research/expert-knowledge-platform.md)
(the competitive-landscape pass behind this doc) ·
[`GLOBAL-036`](../decisions/GLOBAL-036-lead-positioning-analytical-agent-memory.md)
(analytical agent memory, the thesis this scales) ·
[`GLOBAL-037`](../decisions/GLOBAL-037-schema-only-llm-egress.md)
(the enumerated LLM-egress lanes, amended 2026-08-07 — the trust pillar's
technical floor) ·
[`SK-PIVOT-018`](../features/agent-memory-pivot/decisions/SK-PIVOT-018-goal-packs.md)
(goal packs — a profession is a pack) ·
[`SK-PIVOT-023`](../features/agent-memory-pivot/decisions/SK-PIVOT-023-two-axis-business-model.md)
(the two-axis business model) ·
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

- *Quiet marketing is never hidden terms.* The fee is plainly disclosed to
  sellers in the selling flow and its terms — quiet in the trust pitch,
  never concealed from the person paying it (`SK-EKP-002`).
- *The trust copy must not exceed its technical substance.* Locked as
  **"not allowed"** — contractual prohibition on the true technical floor
  ([`GLOBAL-037`](../decisions/GLOBAL-037-schema-only-llm-egress.md), RLS,
  delete, FSL self-host); never "we can't read it" while operators
  technically can. The roadmap that hardens the claim is **1-click
  sovereign hosting** — the expert's knowledge DB on their own on-prem
  machine or cloud account, provisioned with opinionated defaults for
  non-technical users (`SK-EKP-001`).

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
idea; (c) and (d) are resolved by the 2026-08-05 locks, (a) and (b) are
design work owned by the feature:

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
  monetization axis** — resolved 2026-08-05 by
  [`SK-PIVOT-023`](../features/agent-memory-pivot/decisions/SK-PIVOT-023-two-axis-business-model.md)
  (axis 2 of the two-axis model): a small, Stripe-style, plainly-disclosed fee is
  axis 2 of the business model (`SK-EKP-002`); the % stays founder-only.
- **(d) Trust-claim substance.** Resolved 2026-08-05 by `SK-EKP-001`:
  "not allowed" (contractual, on the true technical floor), never "not
  able" — with **1-click sovereign hosting** as the roadmap that hardens
  the claim without the E2E-vs-NL→SQL conflict every incumbent would face
  (see the research doc's trust-posture table).

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

**Kill-test (founder-requested 2026-08-05).** The founder's admission
criterion, verbatim in substance: *"if there are exactly similar then maybe
we shouldn't invent."* A dedicated refutation sweep (research doc §5b)
**found no exact clone — ~85% confidence**. Every candidate holds 2–3 of the
four corners; none combines non-technical authoring with a computable
schema. The two half-markets — expert monetization over prose (Skill
Refinery, Paydog, Kopai) and paid structured queries for agents over
bring-your-own databases (OnDB, the likeliest convergence threat) — are
converging monthly. Read: **the idea passes the kill-test today, and the
white-space window is quarters, not years.**

## The five locked decisions (founder, 2026-08-05 — canonical in the FEATURE.md)

All five were resolved by the founder in-session; the canonical five-field
records live in
[`docs/features/expert-knowledge-platform/FEATURE.md`](../features/expert-knowledge-platform/FEATURE.md)
and
[`SK-PIVOT-023`](../features/agent-memory-pivot/decisions/SK-PIVOT-023-two-axis-business-model.md).
One line each:

1. **Trust claim** (`SK-EKP-001`): "not allowed" — contractual on the true
   technical floor; roadmap = 1-click sovereign hosting (expert's own
   on-prem/cloud machine, opinionated defaults); never claim "can't read"
   until a shipped mechanism makes it true.
2. **Monetization** (`SK-PIVOT-023` + `SK-EKP-002`): two axes — hosted
   memory ops (unchanged) + a small, Stripe-style, plainly-disclosed
   marketplace fee; % founder-set at ship time.
3. **Pilot profession** (`SK-EKP-004`): language tutor, inheriting the
   founder's #1 pack.
4. **Sequencing** (`SK-EKP-005`): parallel tracks — the marketplace has its
   own launch and income and is **not** gated on the `SK-PIVOT-016` dogfood
   gate; neither blocks the other; the gate keeps its Show HN role and its
   weekly-focus setting.
5. **Repo & IP** (`SK-EKP-003`): hybrid — rails/packs/journeys public in
   nlqdb under FSL; the marketplace product surface in a new private repo
   with its own CI; no closed code in nlqdb's critical path.

**Still deliberately open** (per `D1`/`D2`, tracked in the FEATURE.md's Open
questions): fee % and payout mechanics (founder-only) · cross-tenant
grant-primitive design · interview-extraction design · regulated-professions
liability research · the marketplace's own launch motion and acceptance
criteria (execution planning).

If you arrived here from a link and are deciding what to work on: read
[`docs/scorecard.md`](../scorecard.md) and the
[FEATURE.md](../features/expert-knowledge-platform/FEATURE.md) status line —
this file is narrative, not the queue.

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
