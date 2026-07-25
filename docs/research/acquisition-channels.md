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
| 1 | Organic search (Google/Bing) — 104 `/solve`+`/vs`+`/blog` surfaces | ref `google.com` / `bing.com` (+ GSC) | **live** — 28d: 6 clicks / 485 impr / pos 17.4 (07-25 pull); **100 pages earn impressions, 572 in total**, and the biggest winnable one is `/solve/running-total-cumulative-sum-in-sql/` at 57 impr / pos 36.0 | `/daily` + `/reach` R-03 | grow impression breadth; lift the pages `gsc-pull`'s **Strengthen next** section names (highest impressions still off page 1) |
| 2 | dev.to syndication (1/day drip, `SK-BLOG-003`) | `devto` | **live** — each variant's read-through link now carries `?utm_source=devto` (the API `canonical_url` stays clean for SEO), so dev.to→nlqdb.com visits are `utm_source`-attributable, not reliant on the flaky referrer host | `/daily` step 3 | grow tag/topic breadth per variant |
| 3 | Official MCP registry (registry.modelcontextprotocol.io) | `mcp-registry` | **in-flight** — **published 2026-07-22** as [`com.nlqdb/nlqdb`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.nlqdb/nlqdb) v0.1.1, status `active`; `websiteUrl` carries `?utm_source=mcp-registry` (rule 1 ✓). Agent-published via the `com.nlqdb` DNS domain-verify path (TXT record on `nlqdb.com`, kept; the signing keypair is ephemeral — a future version bump regenerates a key + updates the TXT record, agent-doable with the DNS-scoped CF token) | `/reach` | watch `/app/admin` for `mcp-registry` yield → live; registry description caps at 100 chars (learned on publish) |
| 4 | Smithery | `smithery` | blocked-by-human — payload parked 2026-07-25 (R-05 #2). **Not a registry crawler.** Mechanism re-verified (P2 2026-07-25) against Smithery's own docs + CLI: publishing is `smithery mcp publish <url> -n <org>/<name>` after `smithery auth login` (both verbs, and `--resume`, confirmed in `@smithery/cli@4.11.1 --help`; the web path `smithery.ai/servers/new` is **not** dead — it 307s to `/login?redirect=/servers/new`, i.e. login-gated, so the CLI is simply the shorter of two account-walled paths), and official-registry ingestion appears nowhere, so the row-#3 cascade does **not** reach it. Measured live 2026-07-25: `registry.smithery.ai/servers?q=nlqdb` returns **no nlqdb server** (100 fuzzy neighbours, none ours), 3 days after the publish Glama ingested in ~1 day. The earlier "auto-ingests from the registry crawl" reading (2026-07-20) was wrong. A remote server stays self-hosted (Smithery's gateway proxies upstream; streamable HTTP + OAuth both required, both shipped) | `/reach` → founder | founder publishes via the parked payload ([`blocked-by-human.md`](../blocked-by-human.md) #3); then → in-flight |
| 5 | PulseMCP | `pulsemcp` | **in-flight** — row #3 published 2026-07-22. Ingests the official registry as **one source among crawling + manual curation**, and also runs its own `pulsemcp.com/submit` (403 to anonymous fetch ⇒ account-walled) — P2 2026-07-25. Measured live 2026-07-25: **0** hits for `nlqdb` in the public directory, 3 days post-publish (the `v0beta` API is mid-sunset and randomly 410s; `v0.1` needs an `X-API-Key`, so the public directory is the honest check) | `/reach` → founder | **trigger:** if still absent at the R-08 monthly check (2026-08-22), park the `pulsemcp.com/submit` payload for the founder; until then the crawl+curation path costs nobody a minute |
| 6 | Glama | `glama` | **in-flight** — row #3 published 2026-07-22; **crawl-fed listing now live** ([`glama.ai/mcp/connectors/com.nlqdb/nlqdb`](https://glama.ai/mcp/connectors/com.nlqdb/nlqdb), verified 2026-07-23 — name + description ingested from the official registry within ~1 day, confirming the cascade thesis; still in-flight, Glama surfaces the repo/`mcp.nlqdb.com` link, not the utm-tagged `websiteUrl`, so yield rolls into the `github`/organic refs until a claimed listing exposes the key) | `/reach` → founder | claim the listing to expose the `?utm_source=glama` `websiteUrl` (account-walled) |
| 7 | mcp.so | `mcpso` | blocked-by-human — payload parked 2026-07-21 (R-05 #5). Mechanism verified (P2): account-walled `mcp.so/submit` form (GitHub sign-in), Supabase-backed directory `chatmcp/mcpso`, **not** a registry crawler → row-#3 cascade does not reach it | `/reach` → founder | founder submits the parked form payload ([`blocked-by-human.md`](../blocked-by-human.md)); then → in-flight |
| 8 | Cursor MCP directory | `cursor-dir` | blocked-by-human — payload parked 2026-07-21 (R-05 #6). Mechanism verified (P2): official in-product marketplace is curated (no self-serve); the community `cursor.directory` takes submissions only via a GitHub/Google-signed-in web form (`cursor/community-plugins`: "no pull requests needed for data") — not a registry crawler, so row-#3 cascade does not reach it | `/reach` → founder | founder submits the parked form payload ([`blocked-by-human.md`](../blocked-by-human.md)); then → in-flight |
| 9 | Anthropic Claude connector directory | `claude-dir` | blocked-by-human — payload parked 2026-07-21 (R-05 #7). Mechanism verified (P2): remote-MCP submission portal lives in a Claude.ai org's admin settings, **plan-gated** to Team/Enterprise + Owner/Directory-management access; **not** a registry crawler → row-#3 cascade does not reach it. nlqdb already clears the reviewer's OAuth-2.0 + tool-annotation gates | `/reach` → founder | founder submits the parked portal payload ([`blocked-by-human.md`](../blocked-by-human.md)); then → in-flight |
| 10 | `awesome-mcp-servers` (GitHub PR) | `awesome-mcp` | blocked-by-human — PR payload parked 2026-07-21 (R-05 #8). A plain GitHub PR to `punkpeye/awesome-mcp-servers`, but this `/reach` session is scoped to `nlqdb/nlqdb` only so it can't fork/PR an external repo. Listing links to the GitHub repo (list convention), **not** a utm-taggable `nlqdb.com` URL — so yield rolls into the `github`/organic refs, never its own attributable key; this venue can't become "live with attributable yield" on its own | `/reach` → founder | founder (or a scope-unrestricted session) opens the parked PR ([`blocked-by-human.md`](../blocked-by-human.md)); on merge → in-flight |
| 11 | Answer engines (ChatGPT / Claude / Perplexity citations) | ref `chatgpt.com` / `perplexity.ai` | untried (no citation yield) — R-08 baseline built 2026-07-22: **0/10** top-R-01 queries surface nlqdb in the answer-engine retrieval layer, so 0 possible citations | `/reach` | re-run the R-08 retrieval spot-check monthly (next 2026-08-22); presence is earned downstream of the R-05 registry publish + R-03 pages ranking, not published directly |
| 12 | Coding-agent in-repo artifacts (Claude Code skill, Cursor rules, AGENTS.md, Codex) | `agent-artifacts` | in-flight — artifacts served at `nlqdb.com/agent-artifacts/*`, surfaced to the coding-agent read channel (R-04 docs guide + `llms.txt` `## For coding agents`), **and now one-command installable**: `npx skills add https://github.com/nlqdb/nlqdb/tree/main/apps/web/public/agent-artifacts/nlqdb-memory` (vercel-labs/skills CLI — **re-verified by running it 2026-07-25**, three ways: default, `--agent cursor`, `--all` — pulls the skill straight from the public repo into `.agents/skills/nlqdb-memory/SKILL.md`, which Cursor and Codex read directly, plus a `.claude/skills/` symlink for Claude Code and a `skills-lock.json`; no account, no publish. It writes **no** Cursor rule and **no** `AGENTS.md` entry under any selection — the 07-22 record claimed both, so an `AGENTS.md`-only host still needs the by-hand snippet). Every artifact's outbound `nlqdb.com` link carries the key (drift-tested); the `npx` line itself is a github.com URL (not utm-taggable, like row #10), but a developer who installs it lands on the skill's `?utm_source=agent-artifacts` links. Yield 0 pending real agent traffic; **live** only when `/app/admin` shows an `agent-artifacts` visit | `/reach` | grow reach: `skills.sh` has **no submission flow** (P2 2026-07-23: the leaderboard is built from anonymous `npx skills` install telemetry — skills appear automatically from real installs, no account, no review), so the only remaining levers are organic install yield (populates the leaderboard itself) + the npm installer package, whose **exact founder command is now parked** ([`blocked-by-human.md`](../blocked-by-human.md) #2 — `@nlqdb/mcp`, publish-ready in-repo; npm OIDC cannot make a first publish). Once it lands, the artifacts gain a headless `npx -y @nlqdb/mcp` config beside the browser-OAuth one |
| 13 | Hacker News (Show HN + answer comments) | ref `news.ycombinator.com` | untried — human-norm | founder (fact sheet by agents) | draft Show HN fact sheet into distribution-queue |
| 14 | Reddit (r/LocalLLaMA, r/AI_Agents, r/ClaudeAI) | ref `reddit.com` | untried — human-norm | founder (fact sheet by agents) | draft per-sub fact sheets |
| 15 | Product Hunt launch | `producthunt` | untried — account-walled | founder | assemble launch payload → `blocked-by-human.md` when R-04/R-05 give it legs |
| 16 | GitHub discovery (repo topics, README badges, starter-template repos) | `github` | **live** — the root README's product CTA ("describe your database at nlqdb.com") now links `https://nlqdb.com/?utm_source=github`, so github.com click-throughs are `captureFirstTouch`-attributable (docs./elements. subdomain links don't run `Base.astro`; legal-footer links are not a conversion path, left untagged). Topics/templates remain `/reach` amplification (discovery), not the live-gate | `/reach` (amplify) | grow discovery: set repo topics; publish a starter template |
| 17 | npm discovery (`@nlqdb/*` package READMEs, keywords) | `npm` | **live for discovery, broken on arrival** — the two published packages (`@nlqdb/sdk`, `@nlqdb/cli`; all wrappers are `private`) carry `homepage: https://nlqdb.com/?utm_source=npm` **in-repo only**: the registry manifests still serve an untagged `https://nlqdb.com` (`sdk@0.2.1`, `cli@0.1.0` — read live 2026-07-25), so nothing on npmjs is attributable until each republishes; the live count still carries npm on the in-repo tag — re-count it at the next `/daily`. And **`@nlqdb/sdk@0.2.1` cannot be imported at all**: verified 2026-07-25 by installing it clean from the registry — published `main`/`types`/`exports` all point at `./src/index.ts` while `files` ships only `dist/`, so `import "@nlqdb/sdk"` throws `ERR_MODULE_NOT_FOUND` (`publishConfig` main/exports overrides are pnpm-only; npm ignores them — see [`.changeset/README.md`](../../.changeset/README.md)). A visitor this channel converts hits a dead package, so treat the yield as discovery-only until it is fixed + republished | `/daily` | **next: `@nlqdb/mcp`** — publish-ready as of 2026-07-25 (memory-led keywords, `homepage: https://nlqdb.com/agents/?utm_source=npm`, `mcpName` for registry ownership), bootstrap publish parked at [`blocked-by-human.md`](../blocked-by-human.md) #2. It is the only `@nlqdb/*` package a coding agent would search npm for, and the one that carries a headless install path. Then grow keyword breadth; publish a wrapper if a framework channel warrants it |
| 18 | Stack Overflow / GitHub Discussions answers | `stackoverflow` | untried — human-norm | founder (fact sheet by agents) | collect the R-01 intent questions that already exist on SO |
| 19 | Dev newsletters (TLDR AI, Ben's Bites, AI Agents Weekly) | `newsletter-<name>` | untried — editorial/paid | founder | pitch only after a channel-1 page ranks (social proof) |
| 20 | Integration marketplaces (Supabase integrations, Vercel templates, Neon partners, Astro integrations) | venue slug (`supabase`, `vercel`, …) | untried | `/reach` | verify each venue's submission mechanism (P2), one per run |
| 21 | Demo video (60-second one-command memory setup; site-embedded + shareable) | `youtube` | untried | founder-assisted | script + record once R-04 guide is live |

**Live: 4 · in-flight: 4 · blocked-by-human: 5 · untried: 8.** The number that
matters weekly: **channels live with attributable yield** (`/reach` step 1
records it; target per the 2026-07-19 focus: +3 via R-05). npm joined the
live set 2026-07-20 (homepage links tagged); GitHub joined 2026-07-20 (README
CTA tagged `utm_source=github`). No partials remain — every published channel's
yield is attributable. **Row #3 published 2026-07-22** (agent-side, DNS
domain-verify — no founder action was needed after all). **The cascade is
narrower than this ledger claimed:** measured live 2026-07-25, three days on,
only **Glama** ingested it (row #6, live within ~1 day). Smithery has no
documented registry-ingestion path at all — its own docs describe a publish
flow, so row #4 moved in-flight → blocked-by-human with a parked payload — and
PulseMCP treats the registry as one input to crawl + manual curation (row #5
keeps a dated re-check trigger rather than a founder minute). Registry presence
buys one listing automatically, not the directory long tail. So live-count
growth runs through the five parked payloads (Smithery #4, mcp.so #7, Cursor
`cursor.directory` #8, Anthropic connector dir #9, `awesome-mcp-servers` PR #10
— account-walled or, for #10, out of agent-session repo scope) plus the
human-norm venues; each flips to live once a claimed listing exposes the
utm-tagged `websiteUrl` and yield lands on `/app/admin`. Every R-05 venue is
resolved (published, crawl-fed, or payload-parked) — none is waiting on agent work.

## Why this order

Registries (rows 3–10) come first: they intercept the coding-agent search
moment the reach thesis bets on, and one listing is permanent — unlike a
Reddit post its yield compounds. The 2026 mechanism, corrected against live
evidence 2026-07-25: **publish once to the official registry (row #3) → expect
exactly the crawlers that document ingestion to pick it up** — that is Glama,
and PulseMCP partially. Every other venue needs its own submission (Smithery,
mcp.so, Cursor, Anthropic connector dir, `awesome-mcp-servers`), so "it will
appear on its own" is the assumption to test with a live query, not to record.
Human-norm venues (13, 14, 18) are cheap for agents
to *prepare* but blocked on founder posting; they stay queued until the
founder drains them. Paid/editorial (19) waits for proof from the free
channels.
