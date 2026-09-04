---
name: expert-knowledge-platform
description: The "Become AI" expert-knowledge marketplace — non-technical professionals author structured, queryable knowledge that AI agents pay to use; trust-loud, fee-quiet.
when-to-load:
  globs:
    - docs/features/expert-knowledge-platform/**
  topics: [expert knowledge, marketplace, become ai, interview authoring, cross-tenant grants, knowledge fee, sovereign hosting]
---

# Feature: Expert-Knowledge Platform ("Become AI")

**One-liner:** Any non-technical professional turns their professional
knowledge into a well-designed, queryable database schema any AI agent can
use as a skill — and earns when agents/consumers pay to query it, with nlqdb
taking a small, plainly-disclosed fee.
**Status:** planned — first app built **on** the autonomous DBA (dogfood,
founder decision 2026-09-04). Decisions locked 2026-08-05; **build gated on
Phase A widen-on-write (`GLOBAL-041`)**; the `/ek` loop is paused until then.
Shipped rails: EK-06 grant control plane (`/v1/grants` mint/list/revoke,
SDK `mintGrant`/`listGrants`/`revokeGrant`, CLI `nlq grants list/revoke`,
session-only); the private `experts` repo (pilot interview CLI + methodology
spec, boundary guard) per SK-EKP-003. No MCP/elements grant surface by
design: a control-plane action never rides a bearer.

**Relationship to `GLOBAL-041`.** EK is the first real application built on
the autonomous DBA. Its data layer — packs, interview transcripts, grants —
is built on **inferred schema**: the expert's answers are inserts, the DBA
infers and evolves the shape, and the marketplace buyer reads it through
`/v1/ask`. `agent_memory_v1` is an optional **seed** an operator may start a
pack from, not the model; there is no versioned preset contract and no
per-pack DDL. This is why the build waits for Phase A: EK is the dogfood
workload that proves KPI 1 (first-insert inference rate).

**Owners (code):** `apps/api/src/grants.ts`, `apps/api/src/ask/grant-scope.ts`,
`apps/api/src/grant-status.ts` (public rails); product surface partly in the
private repo per SK-EKP-003.
**Cross-refs:** business model [`SK-PIVOT-023`](../agent-memory-pivot/decisions/SK-PIVOT-023-two-axis-business-model.md);
`GLOBAL-037` (egress lanes); narrative + research folded into
[§ Narrative and research](#narrative-and-research) below.


## Touchpoints — read this feature doc before editing

- `docs/features/expert-knowledge-platform/**`
- `apps/api/src/grants.ts`, `apps/api/migrations/0026_grants.sql`, `/v1/grants` routes — EK-06 grant control plane (`SK-EKP-008`)
- `apps/api/src/ask/grant-scope.ts` (scope guard, deny-by-default), `apps/api/src/grant-status.ts` (≤30 s revocation bound, fail-closed)

## Decisions

### SK-EKP-001 — Trust claim: "not allowed", never "not able"; roadmap is 1-click sovereign hosting

- **Decision (founder, 2026-08-05):** The platform's loud trust pillar is
  **"we are not allowed to use or read this data — it is only theirs"** —
  a contractual prohibition (ToS/DPA) stated on top of the true technical
  floor (`GLOBAL-037`'s enumerated LLM-egress lanes — planning is
  schema-only, buyer queries schema-only end-to-end once `EK-09` ships —
  RLS isolation, `SK-HDC-016` delete, FSL self-host). Copy never claims "we **can't** read it" while
  operators technically can. The roadmap item that hardens the claim is
  **1-click sovereign hosting**: the expert's knowledge DB hosted on their
  own on-prem machine or their own cloud account, provisioned by a one-click
  journey with opinionated defaults (the expert is non-technical); once an
  expert runs sovereign, their copy upgrades to possession ("it lives on
  your machine").
- **Core value:** Honest latency, Bullet-proof, Open source
- **Why:** The 2026-08-05 research pass (research doc §6) shows the whole
  market's ceiling is contractual pledges — often with legal terms weaker
  than the marketing — and nobody offers a technical seal. A truthful
  "not allowed" claim plus a real sovereignty path out-positions every
  incumbent without building customer-key E2E, which structurally conflicts
  with server-side NL→SQL (the engine must read rows to answer questions).
  Sovereign hosting sidesteps that conflict: the engine runs where the data
  lives, extending the existing `SK-PIVOT-005` self-host rail to
  non-technical users.
- **Consequence in code:** A reviewer rejects any marketing copy claiming
  inability ("we can't read/see your data") unless a shipped technical
  mechanism makes it literally true for that deployment mode. Trust copy
  enumerates the floor it stands on. The sovereign-hosting journey is a
  roadmap commitment, not a current claim, until it ships; when built, it is
  a `SK-PIVOT-021`-contract journey (one click, opinionated defaults, honest
  progress, durable proof, reversible teardown).
- **Alternatives rejected:** **Customer-key encryption / E2E now** —
  expensive, and incompatible with server-side NL→SQL answering. · **Marketing
  "can't read" without substance** — violates the honesty culture (P6) and
  invites the Delphi failure mode (legal terms weaker than the pitch). ·
  **Saying nothing about trust** — forfeits the one open lane the research
  found unoccupied.

### SK-EKP-002 — The marketplace fee is small, Stripe-style, and plainly disclosed to sellers; the % is founder-set at ship time

- **Decision (founder, 2026-08-04/05):** Experts earn money when agents and
  consumers pay to use their knowledge. nlqdb takes a **small, Stripe-style
  transaction fee** on knowledge sales — plainly disclosed to sellers in the
  selling flow and its terms. The exact percentage is **founder-set when the
  selling surface ships** and appears nowhere before then. Marketing
  asymmetry is deliberate: the trust pillar is loud, the fee is quiet — but
  quiet marketing is never hidden terms.
- **Core value:** Honest latency, Free, Simple, Goal-first
- **Why:** Founder-directed on 2026-08-04 ("nlqdb takes only a small fee,
  Stripe-style — real, but not part of the trust marketing"). The research
  backs the shape: the GPT Store's dangled-and-unshipped revenue program
  burned creator trust, Poe's boring shipped payouts work, and content-platform
  splits like Skill Refinery's 50/50 contradict a "small fee" positioning.
- **Consequence in code:** Fee billing is axis 2 of
  [`SK-PIVOT-023`](../agent-memory-pivot/decisions/SK-PIVOT-023-two-axis-business-model.md)
  and lives only in the marketplace surface (private repo per SK-EKP-003) —
  no fee logic in nlqdb's public core, no memory meters (SK-PIVOT-023 axis-1
  rejections stand). A reviewer rejects: fee copy inside
  trust marketing; any seller-facing flow that does not state the fee before
  the seller commits; any fee percentage anywhere before the founder sets it.
- **Alternatives rejected:** **Content-platform splits (30–50%)** —
  contradicts the founder's "small fee, Stripe-style" directive and the
  positioning against Skill Refinery's 50/50. · **No monetization** — rejects
  the founder's directive; the marketplace is also company income with its
  own launch (SK-EKP-005). · **Usage meters on memory** — already rejected at
  the SK-PIVOT-023 axis-1 level; unchanged.

### SK-EKP-003 — Hybrid repo split: rails public in nlqdb, marketplace product surface in a private repo with its own CI

- **Decision (founder, 2026-08-05):** The platform's **rails stay public**
  in nlqdb under FSL — `agent_memory_v1`, goal packs, the shared one-click
  runner, and every engine capability they need. The **marketplace product
  surface** (fee/selling flows, the interview-authoring product, marketplace
  UX) is developed in a **new private, proprietary repository** with its own
  CI. Each repo's CI runs in that repo. No closed code enters nlqdb's
  critical path (`GLOBAL-019` upheld); the private repo consumes nlqdb
  through its public SDK/API surface only.
- **Core value:** Open source, Simple, Bullet-proof
- **Why:** Proprietary where it counts (the marketplace mechanics are the
  idea's competitive surface) without breaking the trust story or
  `GLOBAL-019`: self-hostability remains real because everything an expert's
  data touches stays open. Private-repo CI cost is a non-issue (2,000 free
  GHA min/month, ~$0.006/min after, free self-hosted runners), so the split
  is pure IP strategy, not infrastructure.
- **Consequence in code:** A reviewer rejects marketplace product code
  landing in nlqdb, and any nlqdb PR whose critical path depends on the
  private repo. Detailed product design (interview mechanics, marketplace
  design) is authored in the private repo, not in public docs.
- **Alternatives rejected:** **All in nlqdb (FSL)** — simplest, but makes
  the product surface source-visible to the converging competitors named in
  the research (OnDB, Skill Refinery). · **All private** — weakens the
  self-host trust substance (`SK-PIVOT-005`) and risks GLOBAL-019 drift. ·
  **Testing private artifacts on nlqdb's public-repo Actions** — rejected:
  each repo's CI runs in that repo.

### SK-EKP-004 — The pilot profession is the language tutor

- **Decision (founder, 2026-08-05, inheriting the 2026-07-29 pack lock):**
  The pilot "become AI" profession is the **language tutor** — the
  founder-set #1 goal pack. The pilot journey builds on that pack's
  extraction recipe, seed entities, and golden queries; no pack-authored
  DDL (SK-EKP-005) — the shape is inferred from the expert's rows.
- **Core value:** Goal-first, Simple
- **Why:** Already founder-locked as pack #1; it is the most human-legible
  analytical-memory demo (error taxonomies, mistake counts, progress trends
  — all `GROUP BY`-shaped), and the founder is user #1, closing the feedback
  loop before any stranger's livelihood is on the platform.
- **Consequence in code:** The first interview-authoring journey and the
  first marketplace listing target the language-tutor pack. A reviewer
  rejects a pilot built on an unranked profession or one requiring new DDL.
  (Alternatives — a regulated profession first, or a new unranked one —
  fall out of the decision + the regulated-professions open question.)

### SK-EKP-005 — EK builds on the autonomous DBA and is gated on Phase A; it adds no criterion to Phase A

- **Decision (founder, 2026-09-04):** EK is the first application built on
  the inferred-schema engine. Its build starts when Phase A widen-on-write
  (`GLOBAL-041`) ships and its KPI-1 floor is measurable; until then EK
  ships decisions only, no code. EK adds **no criterion** to Phase A's exit
  gate, and Phase A does not wait on EK. EK keeps its own launch motion and
  income line (marketplace fee, SK-EKP-002).
- **Core value:** Goal-first, Simple
- **Why:** Building EK on the `agent_memory_v1` preset would re-introduce the
  exact modeling step the bet removes and would make EK the second app that
  never exercises the engine. Built on inferred schema, EK is the dogfood
  workload that proves the engine to a stranger with a livelihood on it.
- **Consequence in code:** A reviewer rejects EK slices that ship pack DDL, a
  versioned preset contract, or a bespoke endpoint per pack; the expert's
  rows land through the same widen-on-write path as any app's.
- **Alternatives rejected:** **Build EK now on the preset** — a modeled
  schema under a "no modeling" product. · **Archive EK** — it is the only
  planned workload with a paying counterparty.

### SK-EKP-006 — One catalog: goal packs are the marketplace's free listings; niche-agent packs are marketplace instances

- **Decision (founder-proposed, 2026-08-05):** The marketplace catalog and
  the goal-pack catalog are **one surface with two listing types**:
  (a) **packs** — free, first-party recipes (the locked
  pack-candidates order, archived with the prior bet) that an operator installs onto their **own** data via the shared
  runner — no grant, no fee; (b) **knowledge DBs** — paid, cross-tenant
  listings of an expert's rows (EK-06 grant + SK-EKP-002 fee). The
  niche-agent packs are therefore marketplace instances from day one,
  seeding the supply side. Pack **authoring** opens to third-party experts
  later; a third-party-sold recipe becomes a paid listing type when that
  ships, riding the same fee mechanics.
- **Core value:** Simple, Goal-first, Free
- **Why:** Both product types run on identical rails (`agent_memory_v1`,
  `SK-PIVOT-018` recipes, the `SK-PIVOT-021` runner, golden queries); two
  catalogs would duplicate discovery and split one audience. The locked
  pack build order doubles as the marketplace's initial catalog roadmap —
  the marketplace never launches empty (the cold-start answer the
  research's GPT-Store lesson demands).
- **Consequence in code:** EK-05's catalog renders both listing types from
  one model. Installing a pack = the runner journey on the installer's own
  tenant — **never** a grant, **never** a fee (`SK-PIVOT-023`'s axes and
  free line unchanged). Querying a knowledge DB = grant + fee. A reviewer
  rejects a second, separate pack-discovery surface, and any fee attached
  to a first-party pack install.
- **Alternatives rejected:** **Separate pack directory beside the
  marketplace** — duplicated discovery, split audience. · **Making packs
  paid** — kills the free wedge and contradicts SK-PIVOT-023's free line. ·
  **Marketplace without packs** — launches empty; cold-start is the
  documented creator-platform killer.

### SK-EKP-007 — Interview-extraction design record (ACTA engine · Graphiti-pattern mapping · show-don't-ask verification · recurring debriefs · tested interview/query boundary)

**Body:** [`decisions/SK-EKP-007-interview-extraction-design.md`](decisions/SK-EKP-007-interview-extraction-design.md). The rail-level design fixing EK-01's five stakes and resolving its five open questions (exploratory-led interview with a mechanical probe floor; validity-window contradictions, never overwrite; text-first, voice parked; the database stays fully invisible; the cold-start earnings bridge parked-with-trigger, not escalated). States `INV-EKP-037`: the knowledge-DB **query** path is schema-only to third-party LLMs (reusing the `GLOBAL-037` builder), while the **interview** path is the only path expert cell values reach an LLM — on the expert's own tenant. Product-surface detail lands in `experts` (`SK-EKP-003`). *(Anchored: the founder approved the GLOBAL-037 amendment 2026-08-07 — the interview path is lane 3 of the amended GLOBAL's enumerated egress lanes.)*

### SK-EKP-008 — Cross-tenant read-grant primitive (platform-brokered · non-owner SELECT-only role · billed on successful execution · fail-closed ≤30 s)

**Body:** [`decisions/SK-EKP-008-grant-primitive-design.md`](decisions/SK-EKP-008-grant-primitive-design.md). Confirms EK-02's baseline and settles its five questions: billable unit = the successfully-executed authorized query (row-count-independent, required idempotency key, broker-synthesized when absent); schema free for introspection, rows are the paid product; in-place execution with per-grant rate limits (read-replica escape hatch parked with trigger); merchant-of-record routed to the founder's SK-EKP-002 ship-time call; buyer identity v1 = tenant API key. Scope enforced at validation (join/subquery reach rejected before execution) plus non-owner role plus per-table FORCE RLS; revocation fail-closed ≤30 s incl. in-flight statement timeout; v1 grants on platform-provisioned hosted DBs only.

### SK-EKP-009 — Sovereign hosting, 1-click: v1 = own-machine via the WS-11 container; cloud-account targets are v2; a sovereign DB leaves the marketplace broker

**Body:** [`decisions/SK-EKP-009-sovereign-hosting-design.md`](decisions/SK-EKP-009-sovereign-hosting-design.md). The EK-07 `P2` research/design pass, resolved from the values per `GLOBAL-033`: v1 sovereign target is own-machine (on-prem) via the `WS-11` self-host image — fewest support surfaces, strongest "possession" claim — with cloud-account (Launch-Stack style) targets deferred to v2, one provider at a time, only after a first expert completes the on-prem walk. DB move = `pg_dump`/restore (small knowledge DBs; logical replication parked-with-trigger). Load-bearing boundary: a sovereign DB leaves `SK-EKP-008`'s platform-provisioned scope, so it is **not brokerable** — in v1 an expert either sells brokered access to a hosted DB *or* takes possession; selling into a sovereign DB is a future decision, deny-by-default. Build (EK-07 boxes 2–3) is hard-gated on `WS-11` shipping; changes no trust copy (that is EK-07 box 3, gated on a real expert walk).

## Narrative and research

**Vision (founder, 2026-08-04):** *"AI can't replace you if you become AI."*
Any professional — teacher, doctor, carpenter, language tutor — answers
questions about their craft and the expertise lands as structured, queryable
rows (material tolerances, error taxonomies, dosage rules) an agent can
`GROUP BY` and `JOIN`, not just recall. Two pillars, marketed asymmetrically:
**trust loud** ("not allowed", never "not able" — SK-EKP-001), **fee quiet**
(SK-EKP-002).

**Research (2026-08-05 pass, sources in git history):** (1) every expertise
platform and KB service stores prose for similarity recall — deliberately
authored, structured, agent-queryable expertise has no incumbent; (2) trust is
marketed everywhere and substantiated nowhere (best-in-class is a contractual
no-train pledge; enterprise-gated CMEK is the technical ceiling) — schema-only
LLM egress (`GLOBAL-037`) + self-host is a materially stronger, truthful
claim; (3) creator demand is proven (Delphi, Poe payouts) while dangled
revenue programs (GPT Store) burn trust — the fee must be real, disclosed,
boring; (4) the market moved from structure to prose+LLM because structured
authoring cost experts too much — cheap authoring via interview-style
extraction is the bet that reverses it. Pinecone Nexus (setup-time curated
"manifests", vendor-claimed ~90 % vs ~65 % RAG) is the nearest miss and is
tracked in `docs/competitors.md`.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per
GLOBAL; index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-019** — Free + Open Source core.
  - *In this feature:* the hybrid split (SK-EKP-003) exists to uphold it —
    rails public, no closed code in nlqdb's critical path.
- **GLOBAL-025** — North-star KPIs.
  - *In this feature:* advances engine quality (structured-vs-prose wedge)
    and onboarding (non-technical authoring); its slices name KPIs per PR.
- **GLOBAL-041** — Autonomous DBA.
  - *In this feature:* EK is the first app built on inferred schema; build gated on Phase A (SK-EKP-005).
- **GLOBAL-026** — LLM strategy.
  - *In this feature:* unchanged; axis 1 of SK-PIVOT-023 still rides it.
- **GLOBAL-037** — LLM egress lanes (planning schema-only; amended 2026-08-07).
  - *In this feature:* the technical floor under the SK-EKP-001 trust claim — lane 3 (interview authoring, own tenant) is `INV-EKP-037`; EK-09 makes buyer-query paths schema-only end-to-end (lane 2 narration skip).

## Open questions / known unknowns

- **Fee % and payout mechanics** — founder-set at ship time (SK-EKP-002);
  no number anywhere before that.
- **Listing demo depth** (EK-05 build decision) — golden-query samples are
  a listing's "honest demo": do they show **real result rows free** (a leak
  of the paid product) or query text/shapes only? Interacts with
  SK-EKP-008 Q2 (schema free for introspection, rows paid).
- **Regulated professions** (doctor, lawyer, accountant) — liability/
  advice-regulation research required before any regulated pack ships
  publicly.
- **Marketplace launch motion + acceptance criteria** — owned by
  [`EK-08`](worksheets/EK-08-launch-motion.md) (its own launch, distinct
  from Show HN; SK-EKP-005).
