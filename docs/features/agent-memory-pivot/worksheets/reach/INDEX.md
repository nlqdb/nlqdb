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
**Mechanism re-verified 2026-07-20/21 (P2):** the canonical 2026 path is **publish once to
the official MCP registry → the crawling directories ingest it automatically**. Full per-venue
mechanism + exact payloads live canonically in the ledger
[`acquisition-channels.md`](../../../../research/acquisition-channels.md) and
[`blocked-by-human.md`](../../../../blocked-by-human.md); summary only here.
- ✅ #1 official MCP registry (`registry.modelcontextprotocol.io`) — **published 2026-07-22**
  (`com.nlqdb/nlqdb` v0.1.1, agent-side via the `com.nlqdb` DNS domain-verify path; `websiteUrl`
  carries `?utm_source=mcp-registry`). Cascades to the crawl-fed ✅ #2 Smithery / ✅ #3 PulseMCP /
  ✅ #4 Glama (they crawl the registry — no separate submission; claim listings once ingested).
  Ledger rows #3–#6 → in-flight. **Cascade confirmed 2026-07-23:** Glama ingested the publish
  within ~1 day (`glama.ai/mcp/connectors/com.nlqdb/nlqdb`, listing live); Smithery/PulseMCP not
  yet surfacing.
- ✅ #5 mcp.so · ✅ #6 Cursor (`cursor.directory`) · ✅ #7 Anthropic connector dir — each account-walled
  and **not** a registry crawler (so #1 doesn't cascade), exact per-venue payloads parked; ledger rows
  #7/#8/#9. #7 is additionally **plan-gated** (Team/Enterprise Claude org), though nlqdb already clears
  its reviewer gates — OAuth 2.0 (`apps/mcp`) + tool annotations (`packages/mcp/src/server.ts`).
- ✅ #8 `awesome-mcp-servers` (`punkpeye/awesome-mcp-servers`) — exact PR payload + mechanism
  (verified 2026-07-21, `CONTRIBUTING.md`; entry → `## 🧠 Knowledge & Memory` per SK-PIVOT-003)
  parked in [`blocked-by-human.md`](../../../../blocked-by-human.md) (ledger row #10). Plain
  GitHub PR, out of this session's `nlqdb/nlqdb` scope; links the repo, no utm-taggable URL.

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
(`bash scripts/reach-agent-walk.sh`; the step-1 measure list already re-runs it once merged).

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
**Done when:** ✅ artifacts published — 4 of 4 host artifacts live in
[`apps/web/public/agent-artifacts/`](../../../../../apps/web/public/agent-artifacts/)
(host-neutral [`AGENTS.snippet.md`](../../../../../apps/web/public/agent-artifacts/AGENTS.snippet.md),
Claude Code skill [`nlqdb-memory/SKILL.md`](../../../../../apps/web/public/agent-artifacts/nlqdb-memory/SKILL.md),
Cursor [`nlqdb-memory.mdc`](../../../../../apps/web/public/agent-artifacts/nlqdb-memory.mdc),
Codex [`codex-config.toml`](../../../../../apps/web/public/agent-artifacts/codex-config.toml),
+ a README index); Channel #12 surfaced on both agent-fetched surfaces
(R-04 docs guide + `llms.txt` `## For coding agents`) **and now one-command
installable** — `npx skills add https://github.com/nlqdb/nlqdb/tree/main/apps/web/public/agent-artifacts/nlqdb-memory`
(vercel-labs/skills CLI, P2 2026-07-22: installs from the **public** repo into
`.claude/skills/` + a Cursor rule + `AGENTS.md`, no account) → **in-flight**;
**remaining R-07 work is external distribution** — `skills.sh` has **no submission
flow** (P2 2026-07-23: the leaderboard populates from anonymous `npx skills` install
telemetry, no account/review — nothing to submit), so it is organic install yield +
the account-walled npm installer package (→ founder) plus the yield gate (a real
`agent-artifacts` visit in `/app/admin`) · ✅ install path on the R-04 page
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
**Autonomous method (what `/reach` re-runs):** an answer engine can only
cite what its retrieval surfaces, so the reproducible baseline is *retrieval
presence* — `WebSearch` each top-10 query, record whether `nlqdb.com` is in
the grounding set (0 sets ⇒ 0 possible citations). The generative-UI pass
(answer-engine accounts, "manual pass where closed") is optional founder
enrichment — it gates nothing, so it is **not** queued in `blocked-by-human.md`.
**Done when:** ✅ first baseline recorded (2026-07-22: **0/10**; see § Current
numbers) · ✅ monthly cadence noted in `/reach` step 1 (next due 2026-08-22).

## Current numbers (maintained by /reach step 1 — overwrite, no changelog)

- **Null-run finding (2026-07-24, 2nd consecutive):** the reach R-slice ledger is
  **agent-exhausted** — every intent-map surface + R-05 venue is built or payload-parked,
  and the two open slices are gated only on human/external actions (R-04's setup-*completion*
  walk on Step-2 browser OAuth, SK-PIVOT-010; R-07's channel-#12 tick on a real `/app/admin`
  `agent-artifacts` visit + the account-walled founder npm package). No agent-pullable box, so
  this ships the numbers refresh only. Binding constraint is now the founder draining
  `blocked-by-human` #2–#5 (parked since 07-21) + external crawl→ranking latency — not agent
  work. Padding the ranked human queue with lower-fit integration-marketplace payloads
  (channel #20) would be the busywork the loop forbids, so skipped.
- Coding-agent walker pass rate (R-06): **0/1 surfaced** (baseline 2026-07-20) —
  cold session recommended `pgvector`, never nlqdb. Boxes (b)/(c) blocked on
  SK-PIVOT-010 OAuth. Walker (`bash scripts/reach-agent-walk.sh`) not re-run (no
  `ANTHROPIC_API_KEY` here). **Retrieval spot-check 2026-07-24** (box-(a) via the
  R-08 method, two top intent queries): "best way to store agent memory … MCP …
  postgres" and "agent memory MCP server install claude" both surface
  mem0 / Neo4j / Stash / Hindsight / cognee / Cockroach-Memori — **nlqdb absent from
  both grounding sets**; the crowded P2b/P2a field is unmoved. The 07-22 registry
  publish still has **not** moved the web-search moment; registry presence ≠ search
  ranking, so 0/1 holds.
- Canonical setup guide (R-04): **live**, 2 of 3 boxes — `docs.nlqdb.com/agent-memory/`,
  linked from README, `/agents`, llms.txt. **Cold-agent walk re-run 2026-07-24**, this
  time verifying every Step-4 claim against prod *source* (not just string parity): the
  response fields the guide tells an agent to key on all exist and match — `db_created`,
  `requires_confirm`, `confirm: true`, `db_not_found` (`packages/mcp/src/tools.ts`); the
  "materialises on first reference → `db_created`" flow is genuinely live via the
  `/v1/ask` handler's `routeAsk` + create path (SK-ASK-009), not `orchestrateAsk` (which
  still returns `schema_unavailable` for an empty schema); Step 3's five-tool list ==
  exactly the five `registerTool` calls in `server.ts`; all nine intent-map "owned"
  solve slugs exist in `solve.ts`. **No new machine-followability gap** — the guide is
  honest and followable end to end. Final box (setup *completed* to a first memory
  read/write) still needs a human to clear the Step-2 browser OAuth (SK-PIVOT-010) →
  box stays ⬜.
- Droppable in-repo artifacts (R-07): **4 of 4 live**, `agent-artifacts` **in-flight**
  — on both agent-fetched surfaces + one-command installable (`npx skills add`).
  Yield 0; **live** only when `/app/admin` shows an `agent-artifacts` visit. `skills.sh`
  has no submission flow (leaderboard = anonymous install telemetry), so remaining
  growth = organic install yield + the account-walled founder npm package.
- Registry/directory listings: **1 published + 1 crawl-fed live**. #1 official registry
  **published 07-22** (`com.nlqdb/nlqdb` v0.1.1, active 07-23); **Glama** listing
  re-confirmed live 07-23 (`glama.ai/mcp/connectors/com.nlqdb/nlqdb`, memory-first
  framing intact) but links the repo not the utm-tagged `websiteUrl` → in-flight
  until founder-claimed; Smithery / PulseMCP still not surfacing (branded search
  returns zero). #5–#8 (mcp.so, Cursor, Anthropic dir, `awesome-mcp-servers`) each
  need a founder submit (`blocked-by-human.md`). Channels live w/ attributable
  yield: **4** (organic, dev.to, github, npm); #12 in-flight.
- Stage-0 solve pages live: 4 of top-5 unowned filled (R-03 complete) + R-02's two
  `competitors.md` §4 entries (DIY-on-Postgres + Agentic DB/Constructive). **Re-verified
  2026-07-24:** all nine intent-map "owned" solve slugs present in `solve.ts`. Live path
  `nlqdb_query`; remember/preset gated (SK-PIVOT-010); auto-in llms.txt + sitemap.
- GSC intent-query clicks (28d, live re-pull 2026-07-24, window 06-24→07-22): **0**,
  **byte-identical** to the prior read (6 total / 475 impr / pos 17.4, all from non-intent
  pages) — no intent query clears 1 click. `/agents` at pos 6.8 (4 impr); intent impressions
  stuck deep ("agent memory benchmark" pos 53, "deep memory retrieval benchmark" pos 52,
  "locomo benchmark ai memory" pos 83). 2nd consecutive flat read confirms the 07-22 registry
  publish + 07-23 Glama ingest have **not** yet moved the search-retrieval moment (registry
  presence ≠ ranking; crawl→rank latency). R-01 baseline, unmoved.
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10** — no top-10
  R-01 query surfaces `nlqdb.com` in the grounding set (owned by mem0/Zep/Letta +
  pgvector). Third confirming zero alongside R-06 (0/1) + GSC. **Monthly; next due
  2026-08-22** (not due this run).

## Tracker

Tick on merge.

- [x] R-01 — intent map + P2a/P2b persona split
- [x] R-02 — build-vs-buy honesty surface (competitor rows + solve page)
- [x] R-03 — stage-0 solve pages (all top-5 unowned filled: #2 best-way-to-store + #5 build-vs-buy + #10 TTL/expiry + #13 agent-memory-MCP)
- [ ] R-04 — canonical machine-followable setup guide
- [x] R-05 — registry sweep (8/8 venues resolved: #1 official registry **published 2026-07-22** → crawl cascade confirmed 07-23 (#4 Glama listing live; #2 Smithery / #3 PulseMCP pending ingest); #5 mcp.so + #6 Cursor + #7 Anthropic connector-dir + #8 awesome-mcp-servers PR payloads parked in blocked-by-human for the founder)
- [x] R-06 — coding-agent walker + baseline (walker + grader + fixture merged; baseline 0/1 surfaced — cold agent recommended pgvector, never nlqdb; re-run via `bash scripts/reach-agent-walk.sh` in `/reach` step 1)
- [ ] R-07 — droppable in-repo artifacts (4/4 host artifacts live + drift-tested: AGENTS.md snippet + Claude Code skill + Cursor rules + Codex block; Channel #12 now surfaced on both agent-fetched surfaces — R-04 docs guide + `llms.txt` — so → in-flight; external npm/registry distribution with attributable yield remains before it ticks)
- [x] R-08 — answer-engine citation baseline (retrieval-layer spot-check: 0/10 top-R-01 queries surface nlqdb; monthly cadence, next 2026-08-22; generative-UI confirmation is optional founder enrichment, gates nothing)
