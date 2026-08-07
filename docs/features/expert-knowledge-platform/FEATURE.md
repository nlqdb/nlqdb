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
**Status:** planned — the five governing decisions below were
**founder-locked 2026-08-05 (in-session)**; implementation is authorized and
proceeds **in parallel** with the `SK-PIVOT-016` dogfood gate (SK-EKP-005).
Execution plan: [`worksheets/INDEX.md`](worksheets/INDEX.md) (`EK-01..08`,
picked by `/daily` as its own lane). The private `experts` repo exists
(founder, 2026-08-05, all-rights-reserved); its slices are parked until
agent sessions get workspace access to it. No code exists yet.
**Owners (code):** none yet. The public rails it builds on are
agent-memory-pivot surfaces (`agent_memory_v1`, goal packs, the shared
one-click runner). Product-surface code will live partly in a **private
repo** per SK-EKP-003.
**Cross-refs:** vision + roadmap narrative:
[`docs/future/expert-knowledge-platform.md`](../../future/expert-knowledge-platform.md) ·
competitive receipts (incl. the kill-test):
[`docs/research/expert-knowledge-platform.md`](../../research/expert-knowledge-platform.md) ·
business model: [`SK-PIVOT-023`](../agent-memory-pivot/decisions/SK-PIVOT-023-two-axis-business-model.md)
(the two-axis model) · rails: `SK-PIVOT-007`/`018`/`021`,
`GLOBAL-036`/`GLOBAL-037`.

## Touchpoints — read this feature doc before editing

- `docs/features/expert-knowledge-platform/**` (no code paths yet; this list
  grows when implementation starts)

## Decisions

### SK-EKP-001 — Trust claim: "not allowed", never "not able"; roadmap is 1-click sovereign hosting

- **Decision (founder, 2026-08-05):** The platform's loud trust pillar is
  **"we are not allowed to use or read this data — it is only theirs"** —
  a contractual prohibition (ToS/DPA) stated on top of the true technical
  floor (`GLOBAL-037` schema-only LLM egress, RLS isolation, `SK-HDC-016`
  delete, FSL self-host). Copy never claims "we **can't** read it" while
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
  private repo. Creating the private repository is a founder/operator action
  (agent sessions here are scoped to `nlqdb/nlqdb`); until it exists,
  marketplace product code has no home and must not land anywhere. Detailed
  product design (interview mechanics, marketplace design) is authored in
  the private repo once it exists, not in public docs.
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
  extraction recipe, seed entities, and golden queries; no new schema
  (`SK-PIVOT-007`/`SK-PIVOT-018` stand).
- **Core value:** Goal-first, Simple
- **Why:** Already founder-locked as pack #1; it is the most human-legible
  analytical-memory demo (error taxonomies, mistake counts, progress trends
  — all `GROUP BY`-shaped), and the founder is user #1, closing the feedback
  loop before any stranger's livelihood is on the platform.
- **Consequence in code:** The first interview-authoring journey and the
  first marketplace listing target the language-tutor pack. A reviewer
  rejects a pilot built on an unranked profession or one requiring new DDL.
- **Alternatives rejected:** **A regulated profession first (doctor /
  lawyer / accountant)** — legal exposure before the liability research
  exists (see Open questions). · **A new unranked profession** — ignores the
  founder's existing pack ranking.

### SK-EKP-005 — The marketplace runs in parallel with the dogfood gate; neither blocks the other

- **Decision (founder, 2026-08-05):** The expert-knowledge marketplace is
  its own track with **its own launch motion and its own income** — it is
  **not** gated on the `SK-PIVOT-016` dogfood gate, and it adds **no
  criterion** to that gate. The gate remains exactly what it was: the
  condition for the Show HN launch, and the weekly focus per the founder's
  07-28 setting. Marketplace implementation may begin immediately alongside
  it; the shared substrate (the D-08 one-click runner) serves both tracks.
- **Core value:** Goal-first, Simple
- **Why:** Founder-directed 2026-08-05: "since the marketplace can also be a
  good income to the company with another type of launch — it's ok to have
  them done in parallel; it doesn't have to be blocked." The kill-test's
  timing read (white-space window = quarters, not years) supports not
  serializing the two. The overlap is real but is leverage, not coupling:
  runner and reliability work advances both.
- **Consequence in code:** A reviewer rejects edits that couple the tracks —
  adding marketplace criteria to `SK-PIVOT-016`, or blocking marketplace
  slices on gate progress (and vice versa). The marketplace's own launch
  motion and acceptance criteria are defined at execution planning, in this
  feature — not inherited from the gate.
- **Alternatives rejected:** **Marketplace displaces the weekly focus** —
  unnecessary once the tracks are parallel; the gate keeps its focus and its
  own momentum. · **Gate as marketplace pre-flight** (agent-proposed) — the
  founder explicitly declined the coupling; quality bars for expert
  onboarding will be set in this feature's own launch criteria instead. ·
  **Marketplace waits for the gate** — serializes two independent income/
  proof motions for no reason.

### SK-EKP-006 — One catalog: goal packs are the marketplace's free listings; niche-agent packs are marketplace instances

- **Decision (founder-proposed, 2026-08-05):** The marketplace catalog and
  the goal-pack catalog are **one surface with two listing types**:
  (a) **packs** — free, first-party recipes (the locked
  [`pack-candidates.md`](../agent-memory-pivot/worksheets/dogfood/pack-candidates.md)
  order) that an operator installs onto their **own** data via the shared
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

**Body:** [`decisions/SK-EKP-007-interview-extraction-design.md`](decisions/SK-EKP-007-interview-extraction-design.md). The rail-level design fixing EK-01's five stakes and resolving its five open questions (exploratory-led interview with a mechanical probe floor; validity-window contradictions, never overwrite; text-first, voice parked; the database stays fully invisible; the cold-start earnings bridge parked-with-trigger, not escalated). States `INV-EKP-037`: the knowledge-DB **query** path is schema-only to third-party LLMs (reusing the `GLOBAL-037` builder), while the **interview** path is the only path expert cell values reach an LLM — on the expert's own tenant. Product-surface detail lands in `experts` (`SK-EKP-003`).

### SK-EKP-008 — Cross-tenant read-grant primitive design (platform-brokered per-query grant · non-owner SELECT-only role · billed on successful execution · fail-closed within 30 s)

**Body:** [`decisions/SK-EKP-008-grant-primitive-design.md`](decisions/SK-EKP-008-grant-primitive-design.md). The EK-02 design record `EK-06` implements. Tenant A sells tenant B's agents **read-only, revocable, fail-closed, per-query-metered** access to a named knowledge DB via a platform-brokered query (not a copy, not a capability token): a `grants` control-plane row brokered above Postgres (Neon has no cross-project share), authorized per-request fail-closed (status cache ≤ 30 s), executed on the owner's DB under a **non-owner SELECT-only role** with `FORCE ROW LEVEL SECURITY`, scope refused at the **validation layer** (join/subquery reach to non-granted tables rejected before execution), and one **usage record** per successful query, idempotent on the `Idempotency-Key` (`GLOBAL-005`). The public engine emits usage records only — fee logic, fee %, and Stripe stay in `experts` (`SK-EKP-003` / `SK-PIVOT-023` axis 2). Confirms the EK-02 baseline (no shift); settles its five open questions from the `GLOBAL-033` values (MoR + payout route to the `SK-EKP-002` ship-time founder gate — no 🔒 bullet spent).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per
GLOBAL; index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-019** — Free + Open Source core.
  - *In this feature:* the hybrid split (SK-EKP-003) exists to uphold it —
    rails public, no closed code in nlqdb's critical path.
- **GLOBAL-025** — North-star KPIs.
  - *In this feature:* advances engine quality (structured-vs-prose wedge)
    and onboarding (non-technical authoring); its slices name KPIs per PR.
- **GLOBAL-026** — LLM strategy.
  - *In this feature:* unchanged; axis 1 of SK-PIVOT-023 still rides it.
- **GLOBAL-036** — Lead positioning: analytical agent memory.
  - *In this feature:* this platform is the empire-scale expression of the
    same bet — structure to compute on, not prose to recall.
- **GLOBAL-037** — Schema-only LLM egress.
  - *In this feature:* the technical floor under the SK-EKP-001 trust claim.

## Open questions / known unknowns

- **Fee % and payout mechanics** — founder-set at ship time (SK-EKP-002);
  no number anywhere before that.
- **Cross-tenant grant primitive** (selling read access to other tenants'
  agents: discovery, revocation, metering, buyer identity) — **designed**
  (`SK-EKP-008`, EK-02); implementation tracked by
  [`EK-06`](worksheets/EK-06-grant-primitive-impl.md). Today RLS scopes
  within a tenant (SK-PIVOT-009); the grant brokers above it.
- **Interview-extraction design** (profession-shaped questions → structured
  rows, no SQL shown) — the hardest UX problem; own research pass when the
  journey is scoped.
- **Regulated professions** (doctor, lawyer, accountant) — liability/
  advice-regulation research required before any regulated pack ships
  publicly.
- **Marketplace launch motion + acceptance criteria** — owned by
  [`EK-08`](worksheets/EK-08-launch-motion.md) (its own launch, distinct
  from Show HN; SK-EKP-005).
