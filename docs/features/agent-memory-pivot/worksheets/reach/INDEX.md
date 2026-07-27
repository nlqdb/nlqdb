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

**Why this order:** R-01 makes every later slice targeted and is the
denominator for all yield rows. R-02/03 win the human's search first
(cheapest; existing machinery). R-04/05 win the coding agent's search.
R-06 proves or falsifies the whole loop with a number. R-07 is the deepest
hook and needs the guide to point at. R-08 is ongoing yield.

## Slices

### R-01 — Intent map + persona split

**Goal:** Know exactly which queries — human-phrased AND coding-agent-phrased —
we must win, and who issues them.
**Do:** (a) Create `intent-map.md` in this folder: the stage-0/1 query
list. Seed set: "AI agent forgets between sessions", "add long term memory
to AI agent", "agent memory postgres", "best way to store agent memory",
"mem0 alternative", "per-user memory for AI agent", "agent memory MCP
server" — plus whatever `bun scripts/gsc-pull.ts` shows we already surface
for. For each query: rank (volume proxy × fit), who owns the answer today,
which nlqdb surface should own it, and the **coding-agent phrasing**
variant (agents search in imperatives: "MCP server for agent memory",
"persist agent state postgres"). (b) Split `docs/research/personas.md` P2
into **P2a** (hobbyist tool-agent builder — today's Jordan) and **P2b**
(**agent-SaaS builder**: multi-tenant product, memory per end-user, builds
with Claude Code/Cursor/Codex, already runs Postgres/Supabase — their
default alternative is a DIY `memories` table, not a memory vendor).
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
**Done when:** ✅ page live ([`docs/agent-memory`](../../../../../apps/docs/src/content/docs/agent-memory.mdx) → `docs.nlqdb.com/agent-memory/`; sidebar-registered, linked from README + `/agents` connect card + llms.txt) · ✅ llms.txt `## For coding agents` section ([`llms.txt.ts`](../../../../../apps/web/src/pages/llms.txt.ts)) · ⬜ one manual cold-agent
walk (agent given only the URL) completes setup — **walked 2026-07-25, blocked at Step 2's browser
consent; cannot tick until a headless credential ships**
([`mcp-server/FEATURE.md`](../../../mcp-server/FEATURE.md)).

### R-05 — Registry + directory sweep (one venue per run)

**Goal:** Be listed wherever coding agents and their hosts discover MCP
servers.
**Venues (priority order):** numbered #1–#8 in the bullets below. Listing copy
leads with memory (SK-PIVOT-003 framing) + the one command.
**Done when:** per venue: listed (URL) or payload parked — tick per venue.
**Mechanism (P2, corrected 2026-07-25 by #822):** publishing once to the official MCP registry
cascades only to venues that document ingestion — Glama (confirmed) and PulseMCP (partly). Every
other venue needs its own account-walled submit. Per-venue mechanism and exact payloads live in
[`acquisition-channels.md`](../../../../research/acquisition-channels.md) +
[`blocked-by-human.md`](../../../../blocked-by-human.md) — status only here.
- ✅ #1 official MCP registry — **published 2026-07-22** (`com.nlqdb/nlqdb` v0.1.1, DNS
  domain-verify; `websiteUrl` carries `?utm_source=mcp-registry`). Cascade reached ✅ #4 Glama
  (07-23) and no one else: ✅ #3 PulseMCP still **absent** 07-25, re-check 08-22; ✅ #2 **Smithery
  is not a registry crawler** — needs its own `smithery mcp publish`, payload parked.
- ✅ #5 mcp.so · ✅ #6 Cursor · ✅ #7 Anthropic connector dir — account-walled, **not** registry
  crawlers (so #1 doesn't cascade), payloads parked. #7 is also plan-gated (Team/Enterprise), though
  nlqdb clears its reviewer gates — OAuth 2.0 + tool annotations.
- ✅ #8 `awesome-mcp-servers` — PR payload parked (verified 2026-07-21). Plain GitHub PR, outside
  this session's repo scope; links the repo, no utm-taggable URL.

### R-06 — Coding-agent walker (measurement backbone)

**Goal:** Measure the claim the whole track makes: a cold coding agent
tasked with adding memory finds nlqdb and completes setup.
**Do:** A stranger-test-style walker (follow `tools/stranger-test`
conventions; read `docs/features/stranger-test/FEATURE.md` first): scripted
cold Claude Code session in a scratch agent-app fixture, prompt "add
persistent per-user memory to this agent; use web search to pick the best
option", recording (a) does it surface nlqdb, (b) does it complete MCP
setup, (c) does it reach a first successful memory read/write. Headless;
result feeds § Current numbers.
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
**Done when:** ✅ artifacts published — 4 of 4 host artifacts live in
[`agent-artifacts/`](../../../../../apps/web/public/agent-artifacts/) (host-neutral
`AGENTS.snippet.md`, Claude Code skill `nlqdb-memory/SKILL.md`, Cursor `nlqdb-memory.mdc`, Codex
`codex-config.toml`, + a README index); Channel #12 surfaced on both agent-fetched surfaces (R-04
docs guide + llms.txt `## For coding agents`) **and one-command installable** —
`npx skills add https://github.com/nlqdb/nlqdb/tree/main/apps/web/public/agent-artifacts/nlqdb-memory`
(vercel-labs/skills; **run against the live CLI 2026-07-25**: writes `.agents/skills/nlqdb-memory/`
— read directly by Cursor and Codex — plus a `.claude/skills/` symlink for Claude Code, no account,
and **no** Cursor rule or `AGENTS.md` entry) → **in-flight**. **Remaining R-07 work is external
distribution**:
`skills.sh` has no submission flow (P2 2026-07-23 — the leaderboard populates from anonymous
`npx skills` install telemetry), so growth is organic install yield + the account-walled npm
installer package (→ founder), plus the yield gate (a real `agent-artifacts` visit in `/app/admin`)
· ✅ install path on the R-04 page · ✅ drift test green
([`agent-artifacts.test.ts`](../../../../../apps/web/src/lib/agent-artifacts.test.ts) — every
connect string == `mcp-install.ts`, served-file URLs pinned to `/mcp`, all `nlqdb.com` links carry
`utm_source=agent-artifacts`).

### R-08 — Answer-engine citation baseline

**Goal:** Know whether ChatGPT/Claude/Perplexity cite nlqdb on R-01 queries.
**Do / autonomous method (what `/reach` re-runs):** an answer engine can only
cite what its retrieval surfaces, so the reproducible baseline is *retrieval
presence* — `WebSearch` each top-10 R-01 query, record whether `nlqdb.com` is
in the grounding set (0 sets ⇒ 0 possible citations). The generative-UI pass
(answer-engine accounts) is optional founder enrichment — it gates nothing, so
it is **not** queued in `blocked-by-human.md`.
**Done when:** ✅ first baseline recorded (2026-07-22: **0/10**; see § Current
numbers) · ✅ monthly cadence noted in `/reach` step 1 (next due 2026-08-22).

## Current numbers (maintained by /reach step 1 — overwrite, no changelog)

- **The R-04 guide was `Disallow: /` to ClaudeBot + GPTBot and Google had never crawled it — found
  and fixed this run.** `docs.nlqdb.com` shipped with no `robots.txt` of its own, so it served only
  Cloudflare's *managed* block: the guide plus `/llms.txt` + `/llms-full.txt` were closed to the
  exact crawlers behind Claude Code and Codex while `/agents` and every solve page stayed open. Edge
  enforcement ruled out first — all four crawler UAs get 200, so robots.txt was the only gate. Fixed
  by mirroring the apex policy; mechanism and the parity guard are canonical in
  [`SK-DOCS-005`](../../../docs-site/FEATURE.md).
- **Per-URL index truth is now measured, not inferred** — `gsc-pull.ts` gained `## Index status`
  (URL Inspection API; needs the service account promoted to Owner, and soft-fails saying so).
  Wedge pages: **2 of 6
  indexed.** `solve/best-way-to-store-agent-memory` (crawled 07-20) and `solve/agent-memory-mcp-server`
  (07-21) are indexed and **still earn 0 impressions** — for those two the gap really is ranking.
  `solve/build-vs-buy-agent-memory` + `solve/expire-old-agent-memory`: **never crawled**.
  `docs/agent-memory`: **unknown to Google** (the robots block above). `/agents/` reports canonical
  drift (Google indexes non-slash `/agents`), but prod is correct — 301 → slash, self-canonical
  matches the sitemap — so that is GSC naming the redirect source; nothing to fix.
- **Correction:** the prior run's "the gap is authority, not crawlability" was half wrong.
  Crawlability *was* a real cause — two stage-0 pages are not in the index and the guide was
  robots-blocked — invisible while the loop read the sitemaps endpoint's `indexed` field, which is
  deprecated and returns 0 for every site
  ([seroundtable 27712](https://www.seroundtable.com/google-search-console-api-sitemaps-indexed-counts-27712.html)).
  `gsc-pull.ts` now says so inline so run N+1 cannot re-derive it.
- GSC (28d, live 2026-07-26, window 06-26→07-24): **8 clicks / 520 impr / pos 17.5**; intent-query
  clicks **0** — **7th consecutive flat read**. All four stage-0 pages earn zero impressions, but
  **nine other agent-memory URLs earn them, five on page 1** (`solve/isolate-ai-agent-memory-per-tenant`
  pos 3.0, `solve/analytical-queries-over-agent-memory` 6.7, `/agents` 6.8, `vs/supermemory` 8.8,
  `solve/analyze-agent-tool-call-logs` 9.5). The host ranks agent-memory content fine; it is the
  stage-0 set specifically that earns nothing. R-01 baseline, unmoved.
- **R-04 setup blocker is delivery, not discovery** (walked 2026-07-25): an agent clears every
  discovery hop against live prod — RFC 9728 + 8414 metadata, RFC 7591 registration, `/authorize`
  302 with PKCE — then stops at a browser consent screen needing a signed-in human, because
  `apps/mcp` routes `/mcp` through `OAuthProvider` with no bearer-key path. Parked in
  [`mcp-server/FEATURE.md`](../../../mcp-server/FEATURE.md); the `SK-MCP-001` stdio hatch is
  publish-ready (#822) and un-gates on one founder npm paste (blocked-by-human #2).
- Registry/directory listings: **1 published + 1 crawl-fed** (#1 official registry live; Glama
  in-flight — links the repo, not the utm-tagged `websiteUrl`, until founder-claimed). Smithery +
  PulseMCP absent 2026-07-25 (#822); R-05 #5–#8 each need a founder submit. Channels live with
  attributable yield: **4** (organic, dev.to, github, npm); #12 in-flight.
- Coding-agent walker (R-06): **0/1 surfaced** (baseline 2026-07-20 — cold session recommended
  `pgvector`, never nlqdb). Not re-run: no `ANTHROPIC_API_KEY` in this session.
- Canonical setup guide (R-04): **live, 2 of 3** — its crawl path opened this run; the walk box stays
  ⬜ because the blocker is the credential, not discovery.
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight, yield 0; the
  one-command install path is verified by running it, not just linted (#825).
- Stage-0 solve pages: R-03 complete + R-02's two `competitors.md` §4 entries. Live path
  `nlqdb_query`; remember/preset gated (SK-PIVOT-010).
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10**. Monthly; next 2026-08-22.
  Not re-run (not due). Note for that run: no Claude/ChatGPT retrieval path could have cited the
  docs-hosted guide before this run's robots fix — the apex was always open, so the 0/10 stands.

## Tracker

Tick on merge; full state per slice is in § Slices above, only what is still
*owed* repeats here.

- [x] R-01 — intent map + P2a/P2b persona split
- [x] R-02 — build-vs-buy honesty surface
- [x] R-03 — stage-0 solve pages
- [ ] R-04 — canonical setup guide — **owed:** the unattended cold-agent walk, blocked on a headless credential (parked in `mcp-server/FEATURE.md`)
- [x] R-05 — registry sweep (8/8 venues resolved)
- [x] R-06 — coding-agent walker + baseline
- [ ] R-07 — droppable in-repo artifacts — **owed:** external distribution with attributable yield (a real `agent-artifacts` visit in `/app/admin`)
- [x] R-08 — answer-engine citation baseline
