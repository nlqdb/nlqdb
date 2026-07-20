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
| 2 | dev.to syndication (1/day drip, `SK-BLOG-003`) | `devto` | **live**, yield untagged until canonical links carry the key | `/daily` step 3 | add `?utm_source=devto` to canonical-URL links in variants |
| 3 | Official MCP registry (registry.modelcontextprotocol.io) | `mcp-registry` | blocked-by-human — payload parked 2026-07-20 (R-05 #1) | `/reach` → founder | founder runs the parked `mcp-publisher` flow ([`blocked-by-human.md`](../blocked-by-human.md)); then → in-flight |
| 4 | Smithery | `smithery` | untried (R-05 #2) | `/reach` | same |
| 5 | PulseMCP | `pulsemcp` | untried (R-05 #3) | `/reach` | same |
| 6 | Glama | `glama` | untried (R-05 #4) | `/reach` | same |
| 7 | mcp.so | `mcpso` | untried (R-05 #5) | `/reach` | same |
| 8 | Cursor MCP directory | `cursor-dir` | untried (R-05 #6) | `/reach` | same |
| 9 | Anthropic Claude connector directory | `claude-dir` | untried (R-05 #7) | `/reach` | same |
| 10 | `awesome-mcp-servers` (GitHub PR) | `awesome-mcp` | untried (R-05 #8) | `/reach` | open the listing PR |
| 11 | Answer engines (ChatGPT / Claude / Perplexity citations) | ref `chatgpt.com` / `perplexity.ai` | untried — R-08 baseline unbuilt | `/reach` | build the R-08 citation spot-check |
| 12 | Coding-agent in-repo artifacts (Claude Code skill, Cursor rules, AGENTS.md, Codex) | `agent-artifacts` | untried (R-07) | `/reach` | R-04 guide first, then publish artifacts |
| 13 | Hacker News (Show HN + answer comments) | ref `news.ycombinator.com` | untried — human-norm | founder (fact sheet by agents) | draft Show HN fact sheet into distribution-queue |
| 14 | Reddit (r/LocalLLaMA, r/AI_Agents, r/ClaudeAI) | ref `reddit.com` | untried — human-norm | founder (fact sheet by agents) | draft per-sub fact sheets |
| 15 | Product Hunt launch | `producthunt` | untried — account-walled | founder | assemble launch payload → `blocked-by-human.md` when R-04/R-05 give it legs |
| 16 | GitHub discovery (repo topics, README badges, starter-template repos) | `github` | partial — repo public, topics/templates unworked | `/reach` | set topics; utm-tag README links; publish a starter template |
| 17 | npm discovery (`@nlqdb/*` package READMEs, keywords) | `npm` | partial — packages live, links untagged | `/daily` | utm-tag README links; audit keywords |
| 18 | Stack Overflow / GitHub Discussions answers | `stackoverflow` | untried — human-norm | founder (fact sheet by agents) | collect the R-01 intent questions that already exist on SO |
| 19 | Dev newsletters (TLDR AI, Ben's Bites, AI Agents Weekly) | `newsletter-<name>` | untried — editorial/paid | founder | pitch only after a channel-1 page ranks (social proof) |
| 20 | Integration marketplaces (Supabase integrations, Vercel templates, Neon partners, Astro integrations) | venue slug (`supabase`, `vercel`, …) | untried | `/reach` | verify each venue's submission mechanism (P2), one per run |
| 21 | Demo video (60-second one-command memory setup; site-embedded + shareable) | `youtube` | untried | founder-assisted | script + record once R-04 guide is live |

**Live: 2 · partial: 2 · in-flight: 0 · blocked-by-human: 1 · untried: 16.** The number that
matters weekly: **channels live with attributable yield** (`/reach` step 1
records it; target per the 2026-07-19 focus: +3 via R-05).

## Why this order

Registries (rows 3–10) come first: they are agent-submittable (no
human-norm constraint), they intercept the coding-agent search moment the
reach thesis bets on, and one listing is permanent — unlike a Reddit post
its yield compounds. Human-norm venues (13, 14, 18) are cheap for agents
to *prepare* but blocked on founder posting; they stay queued until the
founder drains them. Paid/editorial (19) waits for proof from the free
channels.
