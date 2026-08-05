# SK-PIVOT-023 — Business model, second cut: two axes — hosted memory operations + the expert-knowledge marketplace fee

- **Decision (founder, 2026-08-05 — supersedes
  [`SK-PIVOT-020`](./SK-PIVOT-020-memory-ops-business-model.md)):** nlqdb
  monetizes on **two** axes.
  - **Axis 1 — hosted memory operations** (unchanged from SK-PIVOT-020's
    paid line): per-agent / per-end-user isolation ops, TTL/retention
    sweeps, the hosted premium model lane — sold through the existing
    [`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)
    premium chain. No memory-specific meters or SKUs.
  - **Axis 2 — the expert-knowledge marketplace fee**: a small, Stripe-style
    transaction fee on knowledge sales, plainly disclosed to sellers —
    mechanics in
    [`SK-EKP-002`](../../expert-knowledge-platform/FEATURE.md).
  - **Free is unchanged:** FSL self-host (`GLOBAL-019`/`SK-PIVOT-005`), the
    hosted free tier, BYO LLM key at 0% markup (`GLOBAL-026`).
  - **Pricing numbers remain founder-only** on both axes; none is decided
    here.
- **Core value:** Free, Open source, Simple, Goal-first
- **Why:** SK-PIVOT-020's "no second monetization system" was the right
  first cut when memory ops were the only paid line. The founder's "Become
  AI" platform (2026-08-04/05) makes knowledge sales a real second axis with
  its own launch and income, and the founder chose **supersession over a
  bolt-on exception** because the marketplace may grow into a primary
  business — a named exception would understate it and invite re-litigating
  the structure at every marketplace PR.
- **Consequence in code:** Axis 1 inherits SK-PIVOT-020's consequences
  verbatim: no memory-specific usage meters, no `memory_*` Stripe SKU, no
  gating `nlqdb_remember`/`nlqdb_query`/`agent_memory_v1`/self-host behind
  payment; paid memory capabilities are entitlements on the `premium-tier`
  chain behind the `phase-plan.md §6` meter gate. Axis 2's fee logic lives
  only in the marketplace product surface (private repo per `SK-EKP-003`),
  never in nlqdb's public core. A reviewer rejects any **third** axis and
  any pricing number not explicitly founder-set.
- **Alternatives rejected:** **Extend SK-PIVOT-020 with a named exception**
  — offered; founder chose supersession (the marketplace is an axis, not a
  footnote). · **Reject selling (trust pillar only)** — rejects the
  founder's 08-04 directive; the fee is real. · **Usage-based memory
  metering** — still rejected, unchanged from SK-PIVOT-020 (the metering
  machinery doesn't exist and axis 1 doesn't need it).
