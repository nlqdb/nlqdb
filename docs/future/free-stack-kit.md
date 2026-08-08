# Future plan — the free-stack kit ("create products on fully-free 3rd parties")

> **Status:** **kill-test done 2026-08-08 — verdict: lane open, not worth
> occupying as a product.** The founder (2026-08-08, verbatim in substance:
> *"I'm more excited about the kit to create products with fully free 3rd
> parties"*) chose option **2 + 1**; the research pass
> ([`docs/research/free-stack-kit.md`](../research/free-stack-kit.md)) found
> **no exact clone (~75%)** — the founder's kill-test criterion passes —
> but every pillar is a low-traction commodity (a 167★ free-LLM gateway
> with more providers than ours; saturated CF starters; agent-OS kits at a
> 20★ ceiling), HN currently punishes the agent-run-company kit shape, and
> boilerplate money is audience-first with zero documented free-tier-buyer
> conversions. **Standing shape: distribution asset, not product** — the
> unique assets (production failure lore with receipts; the human/agent
> pre-staged-payload replay pattern; a live business as reference) ship as
> editorial content funneling to nlqdb (the 226-point "EU stack" shape),
> plus the already-recorded Show HN C-story lead. A future agent-OS
> **free skill pack that dogfoods nlqdb memory** stays admissible as
> marketing, never a second product.
>
> **Promotion trigger (kit-as-product, founder-overridable):** the demand
> test — the story content + launch traction — produces concrete kit-asks
> (people requesting the scaffold, not just upvoting the story) **and** the
> founder re-confirms against the research. Until then: no `SK-*` minted,
> no slices, no scorecard row; the `/daily`, `/reach`, `/ek` loops are
> untouched.

## The idea (founder, 2026-08-08)

Package what nlqdb actually is under the hood — a real product running on
**entirely free third-party tiers**, operated by recurring agent loops —
as a kit others use to create their own products:

- **The $0 infrastructure half:** Cloudflare Workers (free) + Neon Postgres
  (free) + the multi-provider **free-LLM router chain** with fallback
  (GLOBAL-026's strict-$0 chain) + free observability/email/auth — the
  `GLOBAL-013` constraint turned into a starting point. Raw material
  already public: `docs/history/infrastructure-setup.md` +
  `founder-actions-log.md` Era 0 (written as a replay checklist),
  `packages/llm`, the runbook.
- **The agent-operating half:** the loops (`/daily`, `/reach`, `/ek`),
  scorecard, decision records, blocked-by-human queue, stranger-test
  walkers — the conventions that let agents run the company.

Two candidate shapes (the kill-test + demand test pick): **(a)** a scaffold
template/CLI ("create-$0-stack-app"); **(b)** the agent-operating-system
kit (loops + conventions as an installable plugin/template).

## Honest strategic frame (recorded so nobody re-litigates it blind)

- **As a business: weak.** Starter kits are crowded and the free-tier
  audience self-selects against paying. Nothing here changes
  `SK-PIVOT-023`'s two axes — the kit is **not** a third monetization axis
  unless the founder later locks one.
- **As distribution + brand: exceptional.** The most HN-native story the
  company has; every kit adopter is a P2 builder one command from nlqdb
  memory, on the same rails "Become AI" runs on.
- **Founder energy is the scarce input.** The launch post needs an author
  who cares; this is the story the founder wants to tell — that fact is
  itself load-bearing (r/SQL lesson: authentic voice is the channel).

## The 2+1 execution (state, not plan)

1. **Kill-test research pass** — running (dispatched 2026-08-08, Fable):
   existing $0-stack kits/boilerplates, agent-operated-company kits, demand
   evidence, kit-monetization reality. Lands in
   `docs/research/free-stack-kit.md`; verdict updates this doc's status.
2. **Demand test (cheap, first):** the "how we run on $0, operated by
   agents" public story — content from existing docs on existing machinery
   (blog rails), plus the re-weighted Show HN lead. Traction (referrers,
   comments, kit-asks) = the demand read this doc's promotion trigger
   needs.

## Non-blocking clause

This vision gates nothing, adds no criterion to `SK-PIVOT-016`, spends no
🔒 bullet (the founder directed it in-session), and builds nothing until
the promotion trigger fires. If you arrived here deciding what to work on:
read [`docs/scorecard.md`](../scorecard.md) instead.
