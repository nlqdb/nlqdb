# EK track — the expert-knowledge marketplace ("Become AI")

Execution track for
[`docs/features/expert-knowledge-platform/FEATURE.md`](../FEATURE.md).
Runs **in parallel** with the dogfood gate per `SK-EKP-005` — neither blocks
the other; a slice here never waits on gate progress and never adds to it.
Driven by its own recurring loop,
[`/ek`](../../../../.claude/commands/ek.md) (founder-approved 2026-08-06),
mirroring `/reach` — because `/daily`'s worst-number lever selection has no
EK number to pick and would otherwise starve the track (measured: 3 daily
runs post-lock, 0 EK slices).
Sized and sequenced like the engine/dogfood tracks: one slice per run where
possible, concrete `Done when` boxes, prereqs stated.

Governing decisions (bodies in [`../FEATURE.md`](../FEATURE.md) and
[`SK-PIVOT-023`](../../agent-memory-pivot/decisions/SK-PIVOT-023-two-axis-business-model.md)
— never restated here): `SK-EKP-001` (trust claim + sovereign-hosting
roadmap) · `SK-EKP-002` (fee shape) · `SK-EKP-003` (hybrid repo split) ·
`SK-EKP-004` (pilot = language tutor) · `SK-EKP-005` (parallel tracks) ·
`SK-PIVOT-023` (two-axis business model).

## The repo boundary (SK-EKP-003, applied to slices)

**Public in nlqdb (this repo):** the shared pack runner and its journey
contract (`SK-PIVOT-021`, built as D-08), pack recipes + golden queries,
`agent_memory_v1` and every engine capability (incl. the EK-06 grant
primitive), marketing/trust surfaces, ToS/DPA text.

**Private in `experts`:** the interview question-engine, marketplace UX
(listings, buy flow), fee/payout wiring. It consumes nlqdb only through the
public SDK/API. **How the private surface reuses the public runner**
(published package vs hosted journey embed) is an explicit EK-01/EK-05
design output — do not fake-decide it here.

Until agent sessions can reach `experts` (founder created it 2026-08-05;
workspace access is a founder/admin action), private-half slices are
**parked**, not blocked-silently: their public-rail halves proceed.

## Sequence

| EK | Slice | Repo | Risk | Runs | Prereqs |
|----|-------|------|------|------|---------|
| [EK-01](EK-01-interview-extraction-design.md) | Interview-extraction research → design record (question generation, answer→row mapping, verification UX, session shape) | nlqdb (design detail → `experts`) | med | 1–2 | — |
| [EK-02](EK-02-grant-primitive-design.md) | Cross-tenant read-grant primitive: research → design record + minted decision | nlqdb | med | 1–2 | — |
| [EK-03](EK-03-trust-surface.md) | Trust surface: public landing + "not allowed" copy on the true floor + ToS/DPA delta (founder reviews legal text) | nlqdb | low | 1–2 | — |
| [EK-04](EK-04-pilot-authoring-rails.md) | Pilot authoring rails: language-tutor expert pack (recipe + golden queries) as runner instance #2's public half | nlqdb | high | multi | EK-01 · D-08 runner exists |
| [EK-05](EK-05-marketplace-surface.md) | Marketplace surface v0: interview product + listings + buy flow + fee wiring (% left symbolic until founder sets it) | **`experts`** | high | multi | EK-01, EK-02, EK-04 · agent access to `experts` |
| [EK-06](EK-06-grant-primitive-impl.md) | Grant primitive implementation: revocable, fail-closed, metered cross-tenant read | nlqdb | high | multi | EK-02 |
| [EK-07](EK-07-sovereign-hosting.md) | Sovereign hosting, 1-click (SK-EKP-001 roadmap): research + design, then build | nlqdb | high | multi | after EK-03; must not delay EK-04–06 |
| [EK-08](EK-08-launch-motion.md) | The marketplace's own launch motion + acceptance criteria (SK-EKP-005: distinct from Show HN) | both | med | 1–2 | EK-04, EK-05 scoped; founder input on motion |

**Why this order.** EK-01/EK-02 are the two research passes the FEATURE.md's
open questions mandate (`P2`) — everything downstream inherits their design
records, and both are pullable today. EK-03 is independent and cheap: the
trust pillar is "said everywhere," and its copy is already fully constrained
by `SK-EKP-001`, so it needs no upstream design — only founder review of the
legal text. EK-04 before EK-05 because the public rails (pack recipe, write
path, verification) are testable without the private surface, and D-08's
N+1 test says a second pack must reuse the runner without rebuilding
auth/progress/proof/cleanup — the expert pack is that N+1. EK-06 can start
any time after EK-02 but only **earns revenue** once EK-05 exists to sell
grants. EK-07 is a locked roadmap item, deliberately after the marketplace
has a first expert to serve. EK-08 last-scoped but not last-shipped: launch
criteria are written once EK-04/05 shapes are real, and the launch itself is
condition-gated (the repo's idiom — never date-gated).

## Hard rules

- **No marketplace product code in nlqdb** (`SK-EKP-003`). A reviewer
  rejects fee logic, listing UX, or interview-product code landing here;
  the public SDK/API is the only interface `experts` may consume.
- **No fee percentage anywhere** until the founder sets it (`SK-EKP-002`).
  Build with a symbolic/config value; no number in code, docs, or copy.
- **Trust copy never exceeds substance** (`SK-EKP-001`): "not allowed"
  posture; no "can't read" claim; sovereign hosting is a roadmap statement
  until shipped.
- **No regulated professions** (doctor/lawyer/accountant) in any public
  pack until the liability research pass exists (FEATURE.md open question).
- **No new schema, endpoint, or tool per pack** (`SK-PIVOT-007`/`018`) —
  the expert pack is content + recipe on `agent_memory_v1`; the grant
  primitive (EK-06) is generic engine surface added once, not per-pack.
- **The dogfood gate is untouchable from here** (`SK-EKP-005`): no EK slice
  adds a gate criterion, waits on one, or edits `SK-PIVOT-016`.
- **`GLOBAL-037` stands**: no expert cell-values to third-party LLMs —
  including inside interview flows, where the *expert's answers* become
  cell values the moment they're written. The interview LLM sees the
  conversation (it must); the **query** path stays schema-only. EK-01 must
  design this boundary explicitly.
- **Secrets rule** (`SK-PIVOT-018`): packs store credential metadata, never
  values; interviews must reject secret-shaped answers.

## Tracker

Tick on merge. Durable status (scorecard rows are regenerated; this is not).

- [ ] EK-01 — interview-extraction design record
- [ ] EK-02 — grant-primitive design record + decision
- [ ] EK-03 — trust surface (landing + copy + ToS/DPA delta)
- [ ] EK-04 — pilot authoring rails (language-tutor expert pack, public half)
- [ ] EK-05 — marketplace surface v0 (`experts`) — parked until agent access
- [ ] EK-06 — grant primitive implementation
- [ ] EK-07 — sovereign hosting 1-click (roadmap)
- [ ] EK-08 — launch motion + acceptance criteria
