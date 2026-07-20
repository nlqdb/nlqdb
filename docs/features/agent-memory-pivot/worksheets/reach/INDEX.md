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
Owned: #2 [`solve/best-way-to-store-agent-memory`](../../../../../apps/web/src/data/solve.ts) ✅, #5 build-vs-buy ✅ (R-02), #10 [`solve/expire-old-agent-memory`](../../../../../apps/web/src/data/solve.ts) ✅, #13 [`solve/agent-memory-mcp-server`](../../../../../apps/web/src/data/solve.ts) ✅ (#13 also R-05 registries).

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
walk (agent given only the URL) completes setup, logged in the PR.

### R-05 — Registry + directory sweep (one venue per run)

**Goal:** Be listed wherever coding agents and their hosts discover MCP
servers.
**Venues (priority order):** official MCP registry
(registry.modelcontextprotocol.io) · Smithery · PulseMCP · Glama · mcp.so ·
Cursor's MCP directory · Anthropic's Claude connector/extension directory ·
`awesome-mcp-servers` (PR). Listing copy leads with memory (SK-PIVOT-003
framing) + the one command. Account-walled venues → payload to
`blocked-by-human.md` (hard rule 4). Re-verify each venue's current
submission mechanism by web search first (P2).
**Done when:** per venue: listed (URL) or payload parked — tick per venue.
- ✅ #1 official MCP registry (`registry.modelcontextprotocol.io`) — **account-walled**
  (`mcp-publisher` needs interactive GitHub OAuth or a domain-verify secret), exact
  ready-to-run payload parked in [`blocked-by-human.md`](../../../../blocked-by-human.md)
  (remote `server.json` + `mcp-publisher login/publish` flow; mechanism web-verified
  2026-07-20). Ledger row #3 → `blocked-by-human`.
- ⬜ #2 Smithery · ⬜ #3 PulseMCP · ⬜ #4 Glama · ⬜ #5 mcp.so · ⬜ #6 Cursor MCP dir ·
  ⬜ #7 Anthropic connector dir · ⬜ #8 `awesome-mcp-servers` (PR).

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
**Done when:** ⬜ walker merged · ⬜ baseline recorded (expected ≈ 0 —
that's the point of the track) · ⬜ re-run wired into `/reach` step 1.

### R-07 — Droppable in-repo artifacts (the direct injection)

**Goal:** One file the developer drops into their SaaS repo, after which
*their* coding agent wires and uses nlqdb memory correctly forever.
**Do:** Publish, per host, from ONE source of truth so command strings
never drift from `mcp-install.ts`: a Claude Code **skill/plugin**
(`nlqdb-memory`: setup + remember/query usage + analytical patterns), a
**Cursor rules** file (`.cursor/rules/nlqdb-memory.mdc`), a host-neutral
**AGENTS.md snippet**, and the Codex `config.toml` block. Distribute via
the R-04 guide + npm + registries. Add a drift test (artifact strings ==
`mcp-install.ts`).
**Done when:** 🟡 artifacts published — 3 of 4 host artifacts live in
[`apps/web/public/agent-artifacts/`](../../../../../apps/web/public/agent-artifacts/)
(host-neutral [`AGENTS.snippet.md`](../../../../../apps/web/public/agent-artifacts/AGENTS.snippet.md),
Cursor [`nlqdb-memory.mdc`](../../../../../apps/web/public/agent-artifacts/nlqdb-memory.mdc),
Codex [`codex-config.toml`](../../../../../apps/web/public/agent-artifacts/codex-config.toml),
+ a README index); the packaged Claude Code **skill/plugin** + npm/registry
distribution are the next R-07 run · ✅ install path on the R-04 page
([`agent-memory.mdx`](../../../../../apps/docs/src/content/docs/agent-memory.mdx)
"Drop it into your repo") · ✅ drift test green
([`agent-artifacts.test.ts`](../../../../../apps/web/src/lib/agent-artifacts.test.ts) —
every connect string == `mcp-install.ts`, all served-file URLs pinned to the
`/mcp` route, all `nlqdb.com` links carry `utm_source=agent-artifacts`).

### R-08 — Answer-engine citation baseline

**Goal:** Know whether ChatGPT/Claude/Perplexity cite nlqdb on R-01 queries.
**Do:** A low-cost spot-check: for the top-10 R-01 queries, query the
answer engines that expose an API (skip ToS-hostile scraping; manual pass
where closed), record cited/not-cited per query in § Current numbers.
**Done when:** ⬜ first baseline recorded · ⬜ monthly cadence noted in
`/reach` step 1.

## Current numbers (maintained by /reach step 1 — overwrite, no changelog)

- Coding-agent walker pass rate: not yet measured (R-06 unbuilt)
- Canonical machine-followable setup guide: **live** (R-04, 2 of 3 boxes) —
  `docs.nlqdb.com/agent-memory/` ("Give your agent memory — one command":
  numbered steps, per-host command blocks matching `mcp-install.ts`, expected
  tool list after connect, a verification query, a failure playbook; honest
  that `nlqdb_remember` + the typed `agent_memory_v1` preset are gated so the
  live path is `nlqdb_query`). Linked from README, `/agents` connect card, and
  a new llms.txt `## For coding agents` section. Remaining box: the manual
  cold-agent walk — **it clears Step 2's browser OAuth, a human action an
  autonomous `/reach` run can't perform**; it needs a human walk (or the R-06
  headless walker, which hits the same OAuth wall).
- Droppable in-repo artifacts (R-07): **3 of 4 host artifacts live** in
  `apps/web/public/agent-artifacts/` (served at `nlqdb.com/agent-artifacts/`) —
  host-neutral `AGENTS.snippet.md`, Cursor `.cursor/rules/nlqdb-memory.mdc`,
  Codex `config.toml` block, + README. All connect strings are generated from
  `mcp-install.ts` and pinned by `agent-artifacts.test.ts` (drift test green:
  commands == builders, endpoints on `/mcp`, `nlqdb.com` links carry
  `utm_source=agent-artifacts`). Honest to the R-04 line: memory via
  `nlqdb_query`; `nlqdb_remember`/`agent_memory_v1` marked gated. Linked from
  the R-04 guide. **Channel #12 (`agent-artifacts`) stays untried** in the
  ledger — files exist in-repo but aren't yet externally distributed (npm/
  registries) with attributable yield; the packaged Claude Code skill/plugin +
  distribution are the next R-07 run.
- Registry/directory listings live: 0 of 8 (1/8 prepared — #1 official MCP registry
  payload parked in `blocked-by-human.md`; account-walled on founder `mcp-publisher`
  login, so not live until submitted). Acquisition channels live w/ attributable
  yield: **2** (unchanged; registry row #3 is `blocked-by-human`, not yet live).
  R-05 not advanced this run: the next venue (#2 Smithery) is account-walled
  (publish via `smithery.ai/new` needs a Smithery account + a browser OAuth so
  Smithery can scan our auth-required server — verified 2026-07-20), which
  would park a payload and flip `docs/research/acquisition-channels.md` — a file
  an open `/daily` PR (#753) is already editing, so per the collision rule R-05
  waits for that PR to merge.
- Stage-0 solve pages live: 4 of top-5 unowned filled (R-03 complete):
  #2 best-way-to-store ✅, #5 build-vs-buy ✅, #10 TTL/expiry ✅, #13 agent-memory-MCP ✅.
  R-03 latest page: `solve/agent-memory-mcp-server` (owns query #13 "agent memory
  MCP server"; the MCP-noun search — answers it with the one-command hosted-server
  install and the honest contrast against blob/vector "memory MCP servers" that
  can't aggregate; live path is `nlqdb_query` provisioning + querying, honest that
  the dedicated `nlqdb_remember` verb + `agent_memory_v1` preset are MEMORY_PRESET-
  gated per SK-PIVOT-010; auto-in llms.txt + sitemap). Earlier R-03 pages:
  `solve/expire-old-agent-memory` (query #10 TTL/expiry; `expires_at`-on-typed-rows
  makes expiry a `WHERE`-predicate query, honest about the not-yet-live automatic
  sweep — SK-PIVOT-011 core ships, scheduler landing). Foundational pages:
  `solve/best-way-to-store-agent-memory` (query #2, storage-shape decision) +
  R-02's two `competitors.md` §4 entries (DIY-on-Postgres + Agentic DB/Constructive)
  and `solve/build-vs-buy-agent-memory` (query #5).
- GSC intent-query clicks (28d to 2026-07-17, pulled 2026-07-19 via
  `bun scripts/gsc-pull.ts`): **0** — no intent query clears 1 click.
  `/agents` at pos 7.3 with 3 impressions; intent impressions surfacing but
  not clicking: "agent memory benchmark" (2 impr, pos 53), "deep memory
  retrieval benchmark" (1 impr, pos 52), `/blog/agent-memory-benchmarks…`
  (7 impr, pos 30). Site total 1 click / 468 impr, pos 16.3. This zero is the
  R-01 baseline.
- Answer-engine citations (top-10): not yet measured (R-08 unbuilt)

## Tracker

Tick on merge.

- [x] R-01 — intent map + P2a/P2b persona split
- [x] R-02 — build-vs-buy honesty surface (competitor rows + solve page)
- [x] R-03 — stage-0 solve pages (all top-5 unowned filled: #2 best-way-to-store + #5 build-vs-buy + #10 TTL/expiry + #13 agent-memory-MCP)
- [ ] R-04 — canonical machine-followable setup guide
- [ ] R-05 — registry sweep (1/8 venues: #1 official MCP registry payload parked, account-walled)
- [ ] R-06 — coding-agent walker + baseline
- [ ] R-07 — droppable in-repo artifacts (3/4 host artifacts live + drift-tested: AGENTS.md snippet + Cursor rules + Codex block; Claude Code skill/plugin + npm/registry distribution remain)
- [ ] R-08 — answer-engine citation baseline
