# Acquisition channels — canonical ledger

Founder-resolved 2026-07-19: the operating focus is **user acquisition**
([`GLOBAL-038`](../decisions/GLOBAL-038-gtm-pmf-instrumentation.md)). This
file is the one place that answers *"which channels exist, which have we
actually tried, and what did each yield?"* — the question the scorecard's
surface counts (row #6) never answered.

**Rules**

1. **Every externally published nlqdb URL carries this ledger's
   `utm_source` key** (`SK-GTM-007`). Yield is then read from
   `/app/admin` → Acquisition sources (`signups/DBs by source`), not
   estimated. Referrer-only channels (we don't control the link, e.g.
   answer engines) are read by their `ref` host instead.
2. A channel is **live** only when its artifact is published *and* its
   yield is attributable (key or ref host listed here). Submitted-but-
   pending is **in-flight**. Never tried is **untried**.
3. Human-norm venues (Reddit / HN / Discord / SO) follow the `/reach`
   hard rules: agents draft fact sheets into
   [`distribution-queue.md`](distribution-queue.md); the founder posts.
   Account-walled submissions park their exact payload in
   [`blocked-by-human.md`](../blocked-by-human.md).
4. `/reach` step 1 records the live count; `/weekly` audits this ledger
   for monoculture (one channel absorbing every run) and for untried
   rows going stale. Update the Status column in the same PR that
   changes a channel's state — no changelog, current state only.

## The ledger

| # | Channel | `utm_source` / ref key | Status | Owner | Next concrete step |
|---|---------|------------------------|--------|-------|--------------------|
| 1 | Organic search (Google/Bing) — 105 `/vs`+`/solve`+`/blog` surfaces | ref `google.com` / `bing.com` (+ GSC) | **live** — 28d: 1 click / 452 impr | `/daily` + `/reach` R-03 | grow impression breadth; win the page-1 queries GSC already shows |
| 2 | dev.to syndication (1/day drip, `SK-BLOG-003`) | `devto` | **live** — each variant's read-through link now carries `?utm_source=devto` (the API `canonical_url` stays clean for SEO), so dev.to→nlqdb.com visits are `utm_source`-attributable, not reliant on the flaky referrer host | `/daily` step 3 | grow tag/topic breadth per variant |
| 3 | Official MCP registry (registry.modelcontextprotocol.io) | `mcp-registry` | blocked-by-human — payload parked 2026-07-20 (R-05 #1) | `/reach` → founder | founder runs the parked `mcp-publisher` flow ([`blocked-by-human.md`](../blocked-by-human.md)) — **one publish cascades to the crawl-fed rows 4–6**; then → in-flight |
| 4 | Smithery | `smithery` | crawl-fed — auto-ingests from row #3 once published (Smithery crawls the official registry; verified 2026-07-20, R-05 #2) | `/reach` → founder | claim/clean-up listing after row #3 publishes (no separate submission) |
| 5 | PulseMCP | `pulsemcp` | crawl-fed — indexes the ecosystem + registry, auto-ingests from row #3 (verified 2026-07-20, R-05 #3) | `/reach` → founder | claim listing after row #3 publishes (no separate submission) |
| 6 | Glama | `glama` | crawl-fed — auto-indexes open-source GitHub repos **and** crawls the registry, auto-ingests from row #3 (verified 2026-07-20, R-05 #4) | `/reach` → founder | claim listing after row #3 publishes (no separate submission) |
| 7 | mcp.so | `mcpso` | untried — manual submit form (`mcp.so/submit`, not a registry crawler; R-05 #5) | `/reach` | verify submit mechanism (P2), then park payload / submit |
| 8 | Cursor MCP directory | `cursor-dir` | untried (R-05 #6) | `/reach` | same |
| 9 | Anthropic Claude connector directory | `claude-dir` | untried (R-05 #7) | `/reach` | same |
| 10 | `awesome-mcp-servers` (GitHub PR) | `awesome-mcp` | untried (R-05 #8) | `/reach` | open the listing PR |
| 11 | Answer engines (ChatGPT / Claude / Perplexity citations) | ref `chatgpt.com` / `perplexity.ai` | untried — R-08 baseline unbuilt | `/reach` | build the R-08 citation spot-check |
| 12 | Coding-agent in-repo artifacts (Claude Code skill, Cursor rules, AGENTS.md, Codex) | `agent-artifacts` | untried (R-07) | `/reach` | R-04 guide first, then publish artifacts |
| 13 | Hacker News (Show HN + answer comments) | ref `news.ycombinator.com` | untried — human-norm | founder (fact sheet by agents) | draft Show HN fact sheet into distribution-queue |
| 14 | Reddit (r/LocalLLaMA, r/AI_Agents, r/ClaudeAI) | ref `reddit.com` | untried — human-norm | founder (fact sheet by agents) | draft per-sub fact sheets |
| 15 | Product Hunt launch | `producthunt` | untried — account-walled | founder | assemble launch payload → `blocked-by-human.md` when R-04/R-05 give it legs |
| 16 | GitHub discovery (repo topics, README badges, starter-template repos) | `github` | **live** — the root README's product CTA ("describe your database at nlqdb.com") now links `https://nlqdb.com/?utm_source=github`, so github.com click-throughs are `captureFirstTouch`-attributable (docs./elements. subdomain links don't run `Base.astro`; legal-footer links are not a conversion path, left untagged). Topics/templates remain `/reach` amplification (discovery), not the live-gate | `/reach` (amplify) | grow discovery: set repo topics; publish a starter template |
| 17 | npm discovery (`@nlqdb/*` package READMEs, keywords) | `npm` | **live** — the two published packages (`@nlqdb/sdk`, `@nlqdb/cli`; all wrappers are `private`) now carry `homepage: https://nlqdb.com/?utm_source=npm`, so npmjs "Homepage" click-throughs are attributable | `/daily` | grow keyword breadth; publish a wrapper if a framework channel warrants it |
| 18 | Stack Overflow / GitHub Discussions answers | `stackoverflow` | untried — human-norm | founder (fact sheet by agents) | collect the R-01 intent questions that already exist on SO |
| 19 | Dev newsletters (TLDR AI, Ben's Bites, AI Agents Weekly) | `newsletter-<name>` | untried — editorial/paid | founder | pitch only after a channel-1 page ranks (social proof) |
| 20 | Integration marketplaces (Supabase integrations, Vercel templates, Neon partners, Astro integrations) | venue slug (`supabase`, `vercel`, …) | untried | `/reach` | verify each venue's submission mechanism (P2), one per run |
| 21 | Demo video (60-second one-command memory setup; site-embedded + shareable) | `youtube` | untried | founder-assisted | script + record once R-04 guide is live |

**Live: 4 · crawl-fed (gated on row #3): 3 · in-flight: 0 · blocked-by-human: 1 · untried: 13.** The number that
matters weekly: **channels live with attributable yield** (`/reach` step 1
records it; target per the 2026-07-19 focus: +3 via R-05). npm joined the
live set 2026-07-20 (homepage links tagged); GitHub joined 2026-07-20 (README
CTA tagged `utm_source=github`). No partials remain — every published channel's
yield is attributable. **R-05 mechanism re-verified 2026-07-20 (P2):** rows 4–6
(Smithery / PulseMCP / Glama) crawl the official registry, so the single row-#3
`mcp-publisher` publish (payload already parked) cascades to all three — the +3
registry target collapses to **one founder action**, not four separate submissions.
The remaining path to live-count growth is that one publish plus the non-crawling
venues (mcp.so form, Cursor/Anthropic dirs, `awesome-mcp-servers` PR) and the
human-norm venues.

## Why this order

Registries (rows 3–10) come first: they intercept the coding-agent search
moment the reach thesis bets on, and one listing is permanent — unlike a
Reddit post its yield compounds. The 2026 mechanism (verified 2026-07-20)
is **publish once to the official registry (row #3) → the crawling
directories (Smithery, PulseMCP, Glama) ingest it automatically**; only the
non-crawling venues (mcp.so, Cursor, Anthropic connector dir,
`awesome-mcp-servers`) need their own submission. Human-norm venues (13, 14, 18) are cheap for agents
to *prepare* but blocked on founder posting; they stay queued until the
founder drains them. Paid/editorial (19) waits for proof from the free
channels.
