# SK-PIVOT-020 — The pivot's business model, first cut: free is self-host + hosted free tier + BYO key; paid is hosted memory *operations* on the existing premium chain

> **Status: superseded 2026-08-05 by
> [`SK-PIVOT-023`](./SK-PIVOT-023-two-axis-business-model.md)** (founder,
> in-session): the model gains a second axis — the expert-knowledge
> marketplace fee (`SK-EKP-002`). Axis 1 (everything below about free +
> hosted memory operations) carries forward unchanged inside SK-PIVOT-023;
> only the "no second monetization system" clause is retired.

- **Decision (founder, 2026-07-28 — a deliberate first cut):** The
  agent-memory wedge monetizes on **one** axis — *hosted memory operations*.
  - **Free:** self-host under FSL-1.1 ([`GLOBAL-019`](../../../decisions/GLOBAL-019-apache2-open-source-core.md),
    [`SK-PIVOT-005`](./SK-PIVOT-005-fsl-self-host.md)) **and** the hosted free
    tier, with BYO LLM key at 0% markup
    ([`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md),
    unchanged). A self-hoster is never feature-gated out of the wedge.
  - **Paid:** the operational conveniences a self-hoster would otherwise build
    and run themselves — per-agent / per-end-user isolation ops
    ([`E-03`](../worksheets/engine/E-03-memory-scoping.md),
    [`SK-PIVOT-009`](./SK-PIVOT-009-agent-scope-rls.md)), TTL sweeps and
    retention ([`E-04`](../worksheets/engine/E-04-ttl-decay.md),
    [`SK-PIVOT-011`](./SK-PIVOT-011-ttl-sweep.md)), and the hosted premium
    model lane — sold **through the existing `GLOBAL-026` premium chain**, not
    as a second monetization system.

  Pricing numbers and packaging are **not decided here** and must not be
  invented downstream; no paid memory surface is live, so no pricing-page copy
  changes on the strength of this decision.
- **Core value:** Free, Open source, Simple, Goal-first
- **Why:** The engine track ships memory *operations* (isolation, expiry) that
  are exactly the parts a self-hoster runs manually — that is the natural,
  honest paid line, and it is the only one that doesn't contradict
  `GLOBAL-019` (nothing in the critical path becomes Cloud-only; the paid thing
  is *us operating it*). Riding `GLOBAL-026`'s chain rather than inventing a
  parallel system means the wedge inherits machinery that already exists on
  paper (plans, spend cap, §6 gate) instead of asking for metering that
  doesn't. And it has to be written down *now*: agents building pricing
  surfaces, CTAs, or upgrade copy for the wedge were otherwise guessing across
  an undocumented strategy — a P1 hazard on every such PR.
- **Consequence in code:** No new endpoint, no new meter, no second billing
  concept for memory. A paid memory capability is expressed as an entitlement
  on the `premium-tier` chain
  ([`premium-tier/FEATURE.md`](../../premium-tier/FEATURE.md), scorecard row
  #20 machinery) and stays behind the [`phase-plan.md` §6](../../../phase-plan.md)
  meter gate like every other paid path. Reject: memory-specific usage meters,
  a `memory_*` Stripe SKU, gating `nlqdb_remember`/`nlqdb_recall`,
  `agent_memory_v1`, or self-host behind payment. Any pricing *number* on a
  surface is a founder decision (P1), not an inference from this file.
- **Alternatives rejected:** **Usage-based per-memory-DB metering** (rows
  stored, memories written) — reads as the obvious fit, but the metering
  machinery does not exist (`SK-PREMIUM-002`'s Lago path is itself parked), so
  it would mean building a billing system to price a product with no paying
  customers. · **Defer the whole question until the first strangers arrive** —
  leaves every wedge PR that touches upgrade copy guessing; a documented first
  cut costs one file to supersede, an undocumented strategy costs a
  contradiction in every surface. · **A separate memory-only plan beside
  Hobby/Pro** — a third SKU pre-PMF, already rejected at the `GLOBAL-026`
  level.
