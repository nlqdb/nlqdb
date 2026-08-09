# EK-07 — Sovereign hosting, 1-click (SK-EKP-001 roadmap)

**Status:** in-flight — deliberately after the marketplace has a first expert
to serve; must not delay EK-04–06 · **Repo:** nlqdb · **Risk:** high ·
**Runs:** multi · **Prereqs:** EK-03 shipped (the roadmap claim exists
publicly); own `P2` research pass before any build · **Box 1 shipped
2026-08-09:** the `P2` research/design pass →
[`SK-EKP-009`](../decisions/SK-EKP-009-sovereign-hosting-design.md) (v1 =
own-machine via `WS-11`; cloud-account targets v2; a sovereign DB leaves the
`SK-EKP-008` broker). The build (boxes 2–3) stays deferred behind its hard
prereq — the `WS-11` self-host image must ship and run first.

## Goal

Make the trust roadmap real: a non-technical expert moves their knowledge
DB to **their own machine or cloud account** in one click with opinionated
defaults — upgrading their trust posture from "not allowed" to possession
("it lives on your machine").

Scope stakes (the research pass refines, the decision record then locks):

- Builds on the existing FSL self-host rail (`SK-PIVOT-005`, WS-11
  container work) — this is productization of that rail for non-technical
  users, not a new deployment system.
- "1-click" means the `SK-PIVOT-021` journey contract: entry → one primary
  action → unavoidable provider consent (their cloud account) → honest
  progress → durable proof (their DB answering their golden queries from
  their machine) → reversible (move back / tear down).
- The `P2` pass must settle: target providers for v1 (the "even cloud"
  option), how the marketplace keeps selling access to a sovereign DB
  (grants terminate where? engine runs where the data lives), and what
  support burden opinionated defaults actually create.

## Done when

- [x] Research pass done; design record minted as a new SK-EKP decision.
      (2026-08-09 — `SK-EKP-009`: v1 own-machine via `WS-11`, cloud targets
      v2, `pg_dump` move, sovereign-DB-out-of-broker boundary; build gated on
      `WS-11`.)
- [ ] v1 journey ships the contract above for at least one provider +
      on-prem.
- [ ] Trust copy upgraded **only after** a real expert completes the walk
      (P6: manual production-shaped use before the claim changes).
