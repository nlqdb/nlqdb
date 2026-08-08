# Free-stack kit — kill-test research (2026-08-08)

`P2` pass behind [`docs/future/free-stack-kit.md`](../future/free-stack-kit.md)
(founder-directed 2026-08-08). Question: does packaging nlqdb's $0-stack +
agent-operating playbook as a kit have an open lane, and is it worth
occupying?

## Verdict: PARTIAL OVERLAPS ONLY (~75%) — lane open, **not worth occupying as a product**

No single project ships the combination (full $0 third-party stack +
free-LLM fallback router + agent-operating layer). But every pillar exists
as open source with tiny traction, and the closest analogs met a hostile
audience. Nearest three:

1. **free-llm-gateway** (167★) — OpenAI-compatible gateway over 24+ free
   LLM providers with automatic fallback, rate-limit tracking, dashboard.
   The free-LLM-router pillar, already shipped, with **more providers than
   nlqdb's chain** ([github](https://github.com/MrFadiAi/free-llm-gateway)).
2. **free-tier-agent-fleet** (20★) — "AI agents run my one-person company
   on Gemini's free tier, $0/mo" as an adoptable kit. The exact
   agent-OS shape ([github](https://github.com/ppcvote/free-tier-agent-fleet) ·
   [HN thread](https://news.ycombinator.com/item?id=47296664)).
3. **cloudflare-workers-react-boilerplate** (10★) — CF free-tier full-stack
   template "optimised for Claude Code" ([github](https://github.com/henkisdabro/cloudflare-workers-react-boilerplate)).

## Findings (receipts)

- **CF free-tier starters are a saturated commodity** — dozens exist
  (kriasoft/cloudflare-starter-kit, [flarekit](https://github.com/mockkey/flarekit),
  Hono+CF+Neon tutorials) plus aggregator sites cataloging them; none
  dominates, most under a few hundred stars.
- **The free-LLM fallback router is not an open lane** —
  free-llm-gateway (167★), [ypollak2/llm-router](https://github.com/ypollak2/llm-router)
  (63★), OpenRouter's own ["13 free LLM APIs compared"](https://openrouter.ai/blog/tutorials/free-llm-apis-compared/).
  nlqdb's router is a private reimplementation of a commodity.
- **Agent-operated-company kits exist, none broke out** — idea-factory,
  [rsmdt/the-startup](https://github.com/rsmdt/the-startup), AY Automate's
  starter, 176+ plugins in
  [awesome-claude-code-toolkit](https://github.com/rohitg00/awesome-claude-code-toolkit).
- **HN punishes the exact concept right now**: "14 AI agents run a startup"
  → 4 points; the $0-agent-fleet post → 16 points and a thread dominated
  by "dead internet" hostility (author caught batch-posting AI replies).
- **What DID work in the adjacent space**: ["The bootstrapper's EU stack
  for under €10/month"](https://eualternative.eu/guides/bootstrapper-free-tier-eu-stack/)
  — **226 points / 84 comments**. Editorial story with values, not a kit.
- **Boilerplate money is audience-first**: ShipFast (~$250k/5mo) sold to an
  audience Marc Lou built beforehand; **no documented case of a paid kit
  converting a free-tier-seeking audience** — that audience self-selects
  for not paying ([starterstory](https://www.starterstory.com/marc-lou-shipfast)).

## What nlqdb uniquely has (skeptical cut)

Not the stack recipe, the router, or loop templates — all commodity. The
genuinely absent-from-every-competitor assets:

1. **Production failure lore with receipts** — the Gemini free-key billing
   suspension, Neon branch-cap self-healing, R2's hidden card requirement,
   Docker's killed free org (`docs/history/infrastructure-setup.md`,
   `founder-actions-log.md`).
2. **The human/agent boundary, operationalized** — the pre-staged-payload
   pattern: exactly which ~2-minute clicks only a human can do, in
   dependency order. Every agent-company kit pretends full autonomy;
   nlqdb documented the seam.
3. **A live business as the reference implementation** — competitors ship
   demos.

## Recommendation

**Distribution asset only — neither kit shape as a product.** A scaffold
enters a saturated zero-moat market against free incumbents; the agent-OS
kit targets a shape HN currently punishes with a 20-star adoption ceiling.
Extract the unique assets as **editorial content** — the failure-receipt
playbook and the human/agent replay pattern, each post the 226-point
"EU stack" shape, every page funneling to nlqdb. If the agent-OS shape
ever ships, ship it as a **free Claude Code skill pack that dogfoods nlqdb
memory** — marketing for the product, never a second product. This is the
founder's option 1 doing all the work option 2 hoped to do, at a fraction
of the cost.
