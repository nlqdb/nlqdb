# Reach track — search-moment interception + coding-agent injection

Third pivot track, companion to messaging (`WS-*`) and engine (`E-*`).
Governed by GLOBAL-036; decision record
[SK-PIVOT-015](../../decisions/SK-PIVOT-015-reach-track.md). Driven by its
own recurring loop, [`/reach`](../../../../../.claude/commands/reach.md),
fired every few hours offset from `/daily`.

## The thesis (why this track exists)

The agent-SaaS builder decides how to do memory at **stage 0/1** — "my
agent forgets things between sessions", "I need per-user memory" — not at
stage 2 ("analytical queries over memory"), where the WS-* wedge content
lives. At that moment they do one of two things:

1. **Search** (Google / Bing / ChatGPT / Claude / Perplexity) and land on a
   DIY guide (Postgres + pgvector + LangGraph) or Mem0's pip install.
2. **Ask the coding agent they build with** — Claude Code, Cursor, Codex.
   That agent then searches the web itself, reads MCP registries,
   `llms.txt` files, npm READMEs, and whatever rules/skills files already
   sit in the repo.

Neither moment is addressed by the existing tracks. The reach track's
single goal: **at either moment, the first actionable answer is nlqdb, and
acting on it is one free command** (the per-host strings in
`apps/web/src/lib/mcp-install.ts`, e.g.
`claude mcp add --transport http nlqdb https://mcp.nlqdb.com/mcp`).

**Two brains to hook, one artifact set each:**

| Brain | Where it looks | What must exist |
|---|---|---|
| The developer | Google/Bing, answer engines, HN/Reddit, blog guides | Stage-0 solve pages + honest build-vs-buy surface (R-02, R-03) |
| Their coding agent (Claude Code / Cursor / Codex) | Web search from inside the session; MCP registries + host directories; `llms.txt`; package READMEs; in-repo rules/skills | Machine-followable setup guide (R-04), registry listings (R-05), droppable in-repo artifacts the developer installs once and the agent obeys forever (R-07) |

## Hard rules

- **Only promise what is live in prod.** Before publishing any page,
  listing, or snippet, verify each promised step against production
  (`MEMORY_PRESET` is dark; `POST /v1/memory/remember` rejects anon —
  SK-PIVOT-010). A gated capability is omitted or explicitly marked
  "coming"; never listed as available (the WS-03 phantom-tool lesson).
- **FSL-1.1, never "Apache-2.0 today"** (GLOBAL-019, SK-PIVOT-005).
- **Human-norm venues stay human.** Registry PRs and directory forms an
  agent can submit are fair game; Reddit/HN/Discord posts get a fact sheet
  in `distribution-queue.md` for the founder, never final copy
  (`docs/history/reddit-ai-voice-rejection.md`).
- **Submissions needing a human account** (sign-in wall, OAuth, payment) →
  exact payload + link as a bullet in `docs/blocked-by-human.md`.
- **Every new CTA emits a GLOBAL-024 demand signal.**
- **Every externally published URL carries its channel's `utm_source`
  key** from the canonical ledger
  [`docs/research/acquisition-channels.md`](../../../../research/acquisition-channels.md)
  (`SK-GTM-007`) — yield reads from `/app/admin` sources, never estimates.
- **Additive.** No renames; reach slices land on existing machinery
  (`solve.ts`, `/blog`, `llms.txt`, docs site, `mcp-install.ts`).

## Sequence

| R | Slice | Risk | Runs | Prereqs |
|----|-------|------|------|---------|
| R-01 | Intent map + P2a/P2b persona split | low | 1 | — |
| R-02 | Build-vs-buy honesty surface (competitor rows + solve page) | low | ~2 | R-01 |
| R-03 | Stage-0 solve pages, one per run | low | ~5 | R-01 |
| R-04 | Canonical machine-followable setup guide | med | ~2 | — |
| R-05 | MCP registry + directory sweep, one venue per run | med | ~8 | R-04 |
| R-06 | Coding-agent walker + baseline (measurement backbone) | med | ~2 | — |
| R-07 | Droppable in-repo artifacts (skill / rules / AGENTS.md / Codex) | med | ~3 | R-04 |
| R-08 | Answer-engine citation baseline + cadence | low | 1 | R-01 |
| R-09 | Host plugin/skill venues, one venue per run | low | ~4 | R-07 |
| R-10 | Authority / referring domains | med | ~3 | — |

**Why this order:** R-01 makes every later slice targeted and is the
denominator for all yield rows. R-02/03 win the human's search first
(cheapest; existing machinery). R-04/05 win the coding agent's search.
R-06 proves or falsifies the whole loop with a number. R-07 is the deepest
hook and needs the guide to point at. R-08 is ongoing yield.

## Slices

### R-01 — Intent map + persona split

**Goal:** Know exactly which queries — human-phrased AND coding-agent-phrased —
we must win, and who issues them.
**Do:** (a) Create `intent-map.md` in this folder: the stage-0/1 query list —
per query: rank (volume proxy × fit), who owns the answer today, which nlqdb
surface should own it, and the **coding-agent phrasing** variant (agents
search in imperatives). (b) Split `docs/research/personas.md` P2 into **P2a**
(hobbyist tool-agent builder) and **P2b** (**agent-SaaS builder**: multi-tenant
product, memory per end-user, builds with Claude Code/Cursor/Codex, already
runs Postgres/Supabase — their default alternative is a DIY `memories` table,
not a memory vendor).
**Done when:** ✅ intent-map.md with ≥ 15 ranked queries incl. agent
phrasings ([`intent-map.md`](intent-map.md), 18 queries) · ✅ personas.md
P2a/P2b split merged.

### R-02 — Build-vs-buy honesty surface

**Goal:** Own the "should I build my own agent memory" decision moment.
**Do:** `docs/competitors.md` §4 gains two entries: **DIY on your existing
Postgres/Supabase** (the #1 real alternative; honest counter = isolation
correctness at multi-tenant scale, zero schema design, TTL, NL analytics)
and **Agentic DB** (Constructive, Apr 2026 — open-source "Postgres memory
layer for AI agents", direct entrant). Then a solve page
(`build-vs-buy-agent-memory` or extend an existing one): honest DIY steps
first — the reader keeps trust — then where DIY bites (cross-user leakage,
embedding plumbing, TTL, analytics), then the one-command alternative.
**Done when:** ✅ two competitor entries ([`competitors.md`](../../../../competitors.md) §4: DIY-on-your-Postgres + Agentic DB/Constructive) · ✅ solve page live + in llms.txt ([`solve/build-vs-buy-agent-memory`](../../../../../apps/web/src/data/solve.ts); llms.txt auto-includes the slug).

### R-03 — Stage-0 solve pages (one per run)

**Goal:** Win the felt-need searches from the R-01 map.
**Do:** One solve page per run on the `solve.ts` machinery, titled in the
searcher's words ("My AI agent forgets everything between sessions",
"Give each user their own agent memory"). Page shape: the one-command
answer first (copy block per host, values sourced from `mcp-install.ts` —
never hand-typed), the proven-best-practice schema story
(`agent_memory_v1`: facts/episodes/entities + per-agent RLS + TTL) as the
credibility layer, honest DIY section last. Cross-link R-02.
**Done when:** ✅ one page per top-5 unowned R-01 query (all filled).
Owned, all in [`solve.ts`](../../../../../apps/web/src/data/solve.ts): #2
`best-way-to-store-agent-memory`, #5 `build-vs-buy-agent-memory` (R-02), #10
`expire-old-agent-memory`, #13 `agent-memory-mcp-server` (also R-05 registries).

### R-04 — Canonical machine-followable setup guide

**Goal:** A coding agent landing anywhere on nlqdb surfaces can complete
memory setup without a human.
**Do:** One canonical page (docs site; linked from README, `llms.txt` top
section, `/agents`): "Give your agent memory — one command." Structured
for machine execution: numbered steps, one fenced command block per host
(strings imported/generated from `mcp-install.ts`), the expected tool list
after connect, a verification query, what to do on failure. Add a
`## For coding agents` section to `llms.txt` with the same content.
**Verify every step against prod before publishing** (hard rule 1).
**Done when:** ✅ page live ([`docs/agent-memory`](../../../../../apps/docs/src/content/docs/agent-memory.mdx) → `docs.nlqdb.com/agent-memory/`; sidebar-registered, linked from README + `/agents` connect card + llms.txt) · ✅ llms.txt `## For coding agents` section ([`llms.txt.ts`](../../../../../apps/web/src/pages/llms.txt.ts)) — both now publish the **headless** route
(`npx -y @nlqdb/mcp` + an `sk_mcp_` MCP key, swept 2026-07-28 per `SK-APIKEYS-015`), strings owned by
[`mcp-install.ts`](../../../../../apps/web/src/lib/mcp-install.ts) and pinned to `packages/mcp` by
[`mcp-install-stdio.test.ts`](../../../../../apps/web/src/lib/mcp-install-stdio.test.ts) ·
✅ cold-agent walk green 2026-07-29: given only the published URL, an agent ran the headless
route verbatim end-to-end (initialize, all-5 `tools/list`, gated prod write + fact read-back).

### R-05 — Registry + directory sweep (one venue per run)

**Goal:** Be listed wherever coding agents and their hosts discover MCP servers; listing copy leads
with memory (SK-PIVOT-003) + the one command.
**Done when:** per venue: listed (URL) or payload parked — tick per venue.
**Mechanism (P2, 2026-07-25 #822):** the official-registry publish cascades only to venues that
*document* ingestion; every other venue needs its own account-walled submit.
Per-venue mechanism and exact payloads live in
[`acquisition-channels.md`](../../../../research/acquisition-channels.md) +
[`blocked-by-human.md`](../../../../blocked-by-human.md) — status only here.
- ✅ #1 official MCP registry — **published 2026-07-22** (`com.nlqdb/nlqdb` v0.1.1, DNS domain-verify;
  `?utm_source=mcp-registry`). Cascade reached only Glama #4 (badge + connector claim done by the founder
  2026-08-04, awaiting external review); PulseMCP #3 absent 07-25 (re-check 08-22); Smithery #2 needs its own `smithery
  mcp publish`, parked.
- ✅ #5 mcp.so · ✅ #6 Cursor · ✅ #7 Anthropic connector dir — account-walled, **not** registry
  crawlers, payloads parked. #7 is also plan-gated (Team/Enterprise).
- ✅ #8 `awesome-mcp-servers` — PR #10984 open since 07-26; badge pushed 2026-08-04,
  awaiting maintainer review.
- ✅ #9 `mcp.directory` — P2 07-30: registry-ingesting crawler + no-account form fallback, absent
  07-30; payload in [`acquisition-channels.md`](../../../../research/acquisition-channels.md) #23,
  re-check 08-22.
- ✅ #10 **Cline MCP Marketplace** — P2 08-03: GitHub-issue submission, approved listings
  one-click-installable inside Cline; agent-blocked here, payload parked
  ([`blocked-by-human.md`](../../../../blocked-by-human.md) #3) + ledger #24; repo-linked →
  `github`-ref yield.

### R-06 — Coding-agent walker (measurement backbone)

**Goal:** Measure the claim the whole track makes: a cold coding agent
tasked with adding memory finds nlqdb and completes setup.
**Do:** A stranger-test-style walker (follow `tools/stranger-test`
conventions; read `docs/features/stranger-test/FEATURE.md` first): a headless
cold Claude Code session in a scratch agent-app fixture, prompt "add persistent
per-user memory to this agent; use web search to pick the best option",
recording (a) surfaces nlqdb, (b) completes MCP setup, (c) reaches a first
memory read/write. Result feeds [`NUMBERS.md`](NUMBERS.md).
**Done when:** ✅ walker merged
([`reach-agent-walk.ts`](../../../../../tools/stranger-test/src/reach-agent-walk.ts) +
[`scripts/reach-agent-walk.sh`](../../../../../scripts/reach-agent-walk.sh); pure
grader `assessTranscript` pinned by
[`reach-agent-walk.test.ts`](../../../../../tools/stranger-test/test/reach-agent-walk.test.ts);
cold session drops into
[`fixtures/agent-app/`](../../../../../tools/stranger-test/fixtures/agent-app/)) ·
✅ baseline recorded (2026-07-20: **0/1 surfaced** — cold agent web-searched, recommended
`pgvector`, never named nlqdb; the expected ≈ 0) · ✅ re-run wired into `/reach` step 1
(`bash scripts/reach-agent-walk.sh`).

### R-07 — Droppable in-repo artifacts (the direct injection)

**Goal:** One file the developer drops into their SaaS repo, after which
*their* coding agent wires and uses nlqdb memory correctly forever.
**Do:** Publish the four host artifacts enumerated under **Done when**
below, all from ONE source of truth so command strings never drift from
`mcp-install.ts`. Distribute via
the R-04 guide + npm + registries. Add a drift test (artifact strings ==
`mcp-install.ts`).
**Done when:** ✅ artifacts published — 4 of 4 host artifacts live (+ the
`nlqdb-docs-memory` goal-pack skill, `SK-PIVOT-017`) in
[`agent-artifacts/`](../../../../../apps/web/public/agent-artifacts/) (host-neutral
`AGENTS.snippet.md`, Claude Code skill `nlqdb-memory/SKILL.md`, Cursor `nlqdb-memory.mdc`,
Codex `codex-config.toml`, + a README index), on both agent-fetched surfaces (R-04 guide +
llms.txt `## For coding agents`) **and one-command installable** —
`npx skills add https://github.com/nlqdb/nlqdb/tree/main/apps/web/public/agent-artifacts/nlqdb-memory`
(vercel-labs/skills, run against the live CLI 2026-07-25; no account) → **in-flight**, all
artifact links keyed 2026-07-26 ([`NUMBERS.md`](NUMBERS.md)) · ✅ install path on the R-04
page, and on `@nlqdb/mcp`'s npm README from 0.1.1 (2026-07-27; `skills.sh` has no submission
flow — P2 2026-07-23 — so growth is organic install yield) · ✅ drift test green
([`agent-artifacts.test.ts`](../../../../../apps/web/src/lib/agent-artifacts.test.ts) — every
connect string == `mcp-install.ts`, incl. each artifact's headless `npx -y @nlqdb/mcp` +
MCP-scoped `sk_mcp_` route (added 2026-07-28; `GLOBAL-003`,
[`SK-APIKEYS-015`](../../../api-keys/FEATURE.md)); all `nlqdb.com` links carry
`utm_source=agent-artifacts`). **Still owed:** external distribution with attributable yield
(a real `agent-artifacts` visit in `/app/admin`).

### R-08 — Answer-engine citation baseline

**Goal:** Know whether ChatGPT/Claude/Perplexity cite nlqdb on R-01 queries.
**Do / autonomous method (what `/reach` re-runs):** an answer engine can only
cite what its retrieval surfaces, so the reproducible baseline is *retrieval
presence* — `WebSearch` each top-10 R-01 query, record whether `nlqdb.com` is
in the grounding set (0 sets ⇒ 0 possible citations). The generative-UI pass
(answer-engine accounts) is optional founder enrichment — it gates nothing, so
it is **not** queued in `blocked-by-human.md`.
**Done when:** ✅ first baseline recorded (2026-07-22: **0/10**; see
[`NUMBERS.md`](NUMBERS.md)) · ✅ monthly cadence noted in `/reach` step 1 (next
due 2026-08-22).

### R-09 — Host plugin/skill venues (one venue per run)

**Goal:** Be installable, not just readable, wherever a coding-agent host has an
extension venue. R-05 covers MCP-server registries; this covers the newer
**plugin and skill** venues, where the unit is "one command wires the server
*and* the instructions" rather than a server URL.
**Cadence:** R-05's — one venue per run, same listing copy plus the two `/plugin`
lines; re-verify every listed venue at the R-08 monthly check.
**Mechanism (P2 2026-07-29, cite on every edit):** the ecosystem splits three
ways, only the first is agent-work — **publish** (a git marketplace is a JSON file
in our repo), **crawl** (aggregators index it; nothing to submit), **submit**
(signed-in forms → founder queue). Per-venue payloads live in
[`acquisition-channels.md`](../../../../research/acquisition-channels.md) row #22 +
[`blocked-by-human.md`](../../../../blocked-by-human.md) — status only here.
**Done when:** per venue: listed (URL) or payload parked — tick per venue.
- ✅ #1 **nlqdb's own marketplace** — shipped: repo-root `.claude-plugin/marketplace.json`
  + a manifest that makes [`agent-artifacts/`](../../../../../apps/web/public/agent-artifacts/)
  itself the plugin, so its skills **cannot** be forked copies. `/plugin marketplace add
  nlqdb/nlqdb` → `/plugin install nlqdb-memory@nlqdb`, on all three agent-fetched surfaces
  (README index, R-04 guide, `llms.txt`) and pinned by
  [`agent-artifacts.test.ts`](../../../../../apps/web/src/lib/agent-artifacts.test.ts)
  (schema, endpoint == `mcp-install.ts`, FSL-1.1-ALv2, `utm_source=claude-plugin`).
- ✅ #2 **claudemarketplaces.com** (~300 k monthly visitors) — crawl-fed, daily, keyed
  on the very file #1 adds; **no submission mechanism exists**, so nothing is owed but
  a dated re-check.
- ✅ #3 **SkillsMP** — crawls every public repo for `SKILL.md`; both skills have been
  public since 2026-07-22, so this venue was already served before the slice existed.
- ✅ #4 **Anthropic `claude-community`** (in-product `/plugin` Discover tab) — signed-in
  form only, so the **payload is parked** ([`blocked-by-human.md`](../../../../blocked-by-human.md)
  #2, 2026-07-29; possibly already submitted 2026-08-04 — founder to confirm). Distinct from the connector directory (R-05 #7 / ledger #9);
  `claude-plugins-official` is curated with **no application process** — nothing to submit.
- ✅ #5 **skillsclaude.org** — P2 2026-07-30: **no-account** paste-a-repo form, not an
  arbitrary-repo crawler (nlqdb absent 8 days despite public); headless submit env-blocked →
  payload **parked** ([`blocked-by-human.md`](../../../../blocked-by-human.md) #7); repo-linked
  → `github`-ref yield (ledger #16), no utm key.
- ⬜ **Install-yield gate:** not done on listings — closes when `/app/admin` shows one
  real `claude-plugin` visit (the same bar R-07 carries; why `plugin.json`'s `homepage`
  keeps its own key, not `agent-artifacts`).

### R-10 — Authority / referring domains

**Goal:** Move DR / referring domains off zero — the measured explanation for
indexed-pages-at-0-impressions and the 0/10 answer-engine retrieval (nlqdb.com
DR 0.0 vs mem0.ai 74.0, first read 2026-08-04); authority is what ranks the
already-shipped R-02/R-03 surface.
**Do:** (a) **Homepage-link sweep** — re-verify every live listing/venue in
[`acquisition-channels.md`](../../../../research/acquisition-channels.md) that
permits a homepage/website field points at an `nlqdb.com` URL (with its utm
key), not `github.com/nlqdb/nlqdb` — DR-97 github.com absorbs the link equity
today. (b) **Linkable-asset play** — the agent-memory benchmark blog content is
the only surface earning agent-memory query impressions; promote it into a
citable standalone asset (public leaderboard / dataset page) — benchmarks earn
links, product pages don't. (c) **Measurement** — a DR line each run via
`bun scripts/ahrefs-dr.ts` (`AHREF_API_KEY`; free public endpoint).
**Honest constraint:** at $0 the largest referring-domain events are launches
and community posts, which are founder-shaped (hard rule 3 /
[`blocked-by-human.md`](../../../../blocked-by-human.md) #1) — this slice
maximizes what's agent-doable; it does not replace the launch.
**Done when:** ⬜ homepage-link sweep done across all live venues · ⬜ linkable
asset live + in llms.txt · ⬜ DR / referring domains ≥ first nonzero read.

## Current numbers

Overwritten every cycle, so it lives in its own file:
[`NUMBERS.md`](NUMBERS.md).

## Tracker

Tick on merge; full state per slice is in § Slices above, only what is still
*owed* repeats here.

- [x] R-01 — intent map + P2a/P2b persona split
- [x] R-02 — build-vs-buy honesty surface
- [x] R-03 — stage-0 solve pages
- [x] R-04 — canonical setup guide (cold-agent walk green 2026-07-29, `sk_mcp_` key)
- [x] R-05 — registry sweep (8/8 venues resolved)
- [x] R-06 — coding-agent walker + baseline
- [ ] R-07 — droppable in-repo artifacts — **owed:** external distribution with attributable yield (a real `agent-artifacts` visit in `/app/admin`)
- [x] R-08 — answer-engine citation baseline
- [ ] R-09 — host plugin/skill venues — **owed:** one real `claude-plugin` visit in `/app/admin` (5 of 5 venues resolved — #4 + #5 payloads parked)
- [ ] R-10 — authority / referring domains
