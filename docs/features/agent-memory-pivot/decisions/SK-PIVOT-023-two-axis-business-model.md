# SK-PIVOT-023 — Business model, second cut: two axes — hosted memory operations + the expert-knowledge marketplace fee

- **Decision (founder, 2026-08-05):** nlqdb monetizes on **two** axes.
  - **Axis 1 — hosted memory operations**: the operational conveniences a
    self-hoster would otherwise build and run themselves — per-agent /
    per-end-user isolation ops (`E-03` (archived),
    [`SK-PIVOT-009`](./SK-PIVOT-009-agent-scope-rls.md)), TTL sweeps and
    retention (`E-04` (archived),
    [`SK-PIVOT-011`](./SK-PIVOT-011-ttl-sweep.md)), and the hosted premium
    model lane — sold **through the existing
    [`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)
    premium chain**, not as a second monetization system. No memory-specific
    meters or SKUs.
  - **Axis 2 — the expert-knowledge marketplace fee**: a small, Stripe-style
    transaction fee on knowledge sales, plainly disclosed to sellers —
    mechanics in [`SK-EKP-002`](../../expert-knowledge-platform/FEATURE.md).
    Its fee logic lives only in the marketplace product surface (private repo
    per [`SK-EKP-003`](../../expert-knowledge-platform/FEATURE.md)), never in
    nlqdb's public core.
  - **Free is unchanged:** self-host under FSL-1.1
    ([`GLOBAL-019`](../../../decisions/GLOBAL-019-apache2-open-source-core.md),
    [`SK-PIVOT-005`](./SK-PIVOT-005-fsl-self-host.md)) **and** the hosted free
    tier, with BYO LLM key at 0% markup (`GLOBAL-026`). A self-hoster is never
    feature-gated out of the wedge.
  - **Pricing numbers remain founder-only** on both axes; none is decided
    here, and none may be invented downstream.
- **Core value:** Free, Open source, Simple, Goal-first
- **Why:** A one-axis model (hosted memory ops only) was the right first cut
  when memory ops were the only paid line: the engine track ships memory
  *operations* (isolation, expiry) that are exactly the parts a self-hoster
  runs manually — the natural, honest paid line, and the only one that doesn't
  contradict `GLOBAL-019` (nothing in the critical path becomes Cloud-only; the
  paid thing is *us operating it*). The founder's "Become AI" platform
  (2026-08-04/05) makes knowledge sales a real second axis with its own launch
  and income, so the model gains axis 2. The founder chose **supersession over
  a bolt-on exception** because the marketplace may grow into a primary
  business — a named exception would understate it and invite re-litigating the
  structure at every marketplace PR.
- **Consequence in code:** No new endpoint, meter, or second billing concept
  for memory. A paid memory capability is an entitlement on the
  [`premium-tier`](../../premium-tier/FEATURE.md) chain (scorecard row #20
  machinery), behind the [`phase-plan.md §6`](../../../phase-plan.md) meter gate
  like every other paid path. Reject: memory-specific usage meters, a
  `memory_*` Stripe SKU, gating `nlqdb_remember`/`nlqdb_query`/`agent_memory_v1`
  or self-host behind payment. Axis 2's fee logic stays in the marketplace
  surface only. Any pricing *number* on any surface is a founder decision (P1),
  not an inference from this file — and a reviewer rejects any **third** axis.
- **Alternatives rejected:** **Extend the one-axis model with a named
  exception** — offered; founder chose supersession (the marketplace is an
  axis, not a footnote). · **Reject selling entirely (trust pillar only)** —
  rejects the founder's 08-04 directive; the fee is real. · **Usage-based
  per-memory-DB metering** (rows stored, memories written) — reads as the
  obvious fit for axis 1, but the metering machinery does not exist
  (`SK-PREMIUM-002`'s Lago path is itself parked), so it would mean building a
  billing system to price a product with no paying customers. · **A separate
  memory-only plan beside Hobby/Pro** — a third SKU pre-PMF, already rejected
  at the `GLOBAL-026` level.
