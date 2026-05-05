# Open design questions — research notes

> **Status:** unresolved questions. Each row is a deferred decision the team needs to take a stance on before the indicated phase ships. Per `D1` of `CLAUDE.md §2`, don't promote any of these into a canonical doc / skill until the underlying question is resolved — vague decisions are worse than no decision.

These were deferred during the PR #81 docs consolidation. They lived in the now-deleted `docs/design.md §10` and `docs/plan.md §8`. Some were already addressed by skills (`SK-AUTH-001` decided "Better Auth on Workers"; `architecture.md §10` Phase 2 committed custom embed domains). The seven below are the ones still open.

## 1. `<nlq-data>` security review — external pentest

**Question.** When does the embed element get an external pentest, and what's the scope?

**Why it matters.** `<nlq-data>` is the surface most likely to be embedded on third-party origins. The template registry (`SK-ELEM-006`) and `pk_live_*` origin-pinning (`SK-ELEM-005`, `SK-APIKEYS-003`) are the two safety boundaries. A motivated attacker who finds a template-injection vector or an origin-bypass can pull rows from any DB whose `pk_live_` they discover. We should not announce on `nlqdb.com` with this untested.

**Cut-off.** Before public launch (Phase 1 exit).

**Decision needed.**
- Vendor (Trail of Bits / NCC / Doyensec for spend; Cure53 cheaper; Hacker One bug bounty as continuous alternative)?
- Scope — just the element + `pk_live_*` flow, or include the demo endpoint and the wider `/v1/ask` contract?
- Budget — pentest is the only line in the launch budget that breaks strict-$0; absorb on the $85/yr domain line or wait for credits?

## 2. D1 control-plane scale ceiling

**Question.** At what user count do we shard or migrate off a single D1 instance?

**Original framing.** *"Single D1 fine to ~10k users; revisit sharding at 100k."*

**Why it matters.** D1 currently caps at 5M reads/day, 100k writes/day, 5GB per database. Schema-per-DB tenancy (`SK-HDC-006`, `architecture.md §3.6.6`) means user-DB rows are on Neon, but every auth check, key lookup, plan-cache miss, and Stripe-event row hits D1. At 10k DAU the read-side is tight; at 100k we're past the limit and need a sharding decision.

**Decision needed.**
- Partition strategy (by tenant_id mod N, or geographic, or by surface)?
- Cutover mechanism (read-from-old write-to-both, then flip — same shape as `engine-migration` skill)?
- Trigger (% of daily quota over a rolling window, or absolute DAU count)?

## 3. NL-querying as an embeddable library inside users' own apps

**Question.** Do we expose the natural-language layer as a library users can embed inside their own products (so their end-users can ask English questions of *their* DB)?

**Why it matters.** Tempting positioning ("be the Stripe of NL-Q"), and a plausible Phase 3+ revenue line (per-end-user metering). Risk: dilutes the goal-first message, doubles the surface area for support, and forces us to think about embedded auth & multi-tenant LLM cost attribution before the core product is mature.

**Cut-off.** Decide before Phase 3 starts. Park until then.

## 4. Multi-region from day 1, or single-region with latency warning?

**Question.** Phase 0 / Phase 1 ship from one region (us-east), or multi-region from day 1?

**Original lean.** *"Probably single-region (us-east) + read replicas later."*

**Why it matters.** Cloudflare Workers are global, but Neon Postgres lives in one region. Every query from EU/APAC has the trans-Atlantic round-trip on a cache miss, which makes the p95 promise (`architecture.md §0`: "p95 < 1.5s cache miss") harder. Multi-region from day 1 means provisioning Neon branches per region — operational complexity tax we don't need at <1k DAU.

**Decision needed.**
- Single us-east through Phase 2; revisit at 5k DAU or first paying customer outside North America.
- Or: ship EU read-replica when the first EU paying customer signs up (latency-driven, not capacity-driven).

## 5. User-writable migration triggers

**Question.** Do we let users write their own migration triggers (e.g. *"always keep this DB in Redis"*) as overrides, or is the Workload Analyzer the only decider?

**Original lean.** *"Likely yes, as an override, not as a default surface."*

**Status.** Decided in `engine-migration/FEATURE.md` (per the post-consolidation grep). Move to that skill or close this row out — confirm with the engine-migration owner.

## 6. Notebooks-style multi-query document

**Question.** Do we ship a notebook-style multi-query / multi-cell document early?

**Why it matters.** Tempting UX win for the data-curious-PM persona (P3 in `personas.md`) — a single share-link with several queries and prose interleaved. Risk: scope creep for Phase 1, and once we have a notebook product we have a BI-tool product, which is in the explicit *not building* list (`architecture.md §8`).

**Cut-off.** Decide before Phase 2 ends. Probably no in Phase 1, possibly yes in Phase 2 for the share-link case.

## 7. Team workspaces — Phase 1 or Phase 2?

**Question.** When do team workspaces ship?

**Original lean.** *"Probably late Phase 1 — solo-user product first, teams when first 5 customers ask."*

**Status.** `architecture.md §10` Phase 3 lists *Team workspaces* as a Phase 3 deliverable. The original intention (late Phase 1) was deferred — confirm whether that's based on customer signal (no Phase 1 partners asked) or scope-creep avoidance.

**Decision needed.** Confirm Phase 3 placement. If yes, close this row; if customer signal flips to "team is blocking adoption," it can move forward.

## 8. MCP deep-link install — one-click button

**Question.** Does `nlq mcp install` reach a true one-click install ("click button on `nlqdb.com/mcp` → host config patched in browser") or stay copy-paste?

**Original framing.** *"One-click button is the goal; copy-paste accepted for v1."*

**Why it matters.** First-time MCP install is the moment that converts the agent-builder persona (P2). The copy-paste workflow today is two extra steps — open terminal, run `nlq mcp install`. A browser-launched deep link (`nlqdb://install?key=…&host=cursor`) closes the loop in-browser.

**Cut-off.** Phase 2 ships without it (copy-paste accepted); decide before Phase 3 whether to spend a week building the deep-link handler in the CLI.

---

## Source

Carried forward from:
- Pre-consolidation `docs/design.md §10` "Open design questions" (deleted in PR #81 commit `fb6e8c9`).
- Pre-consolidation `docs/plan.md §8` "Open questions — to resolve before Phase 2 starts" (same commit).

When a question resolves, promote the decision into the canonical home (skill `SK-*` block or `GLOBAL-NNN` in `decisions.md`) and remove the row here. Per `P4 / D1` of `CLAUDE.md §2`, do not document the resolution before the question is actually answered.
