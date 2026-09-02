# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-09-02 — DR flickered back 0.0 → 0.1; the oscillation-at-the-floor
  read holds.** `bun scripts/ahrefs-dr.ts` (free Ahrefs public endpoint):
  **nlqdb.com 0.1 · docs.nlqdb.com 0.1 · mem0.ai 74.0**. Last cycle (09-01) both
  nlqdb domains read 0.0; today both read 0.1 again — the same 0.0↔0.1
  first-derivative flicker at the floor called out on 09-01, **not** a durable
  move. The ≈74-point gap to mem0.ai is unchanged. R-10 stays complete (all
  Done-when boxes were satisfied at the 08-31 reading); **authority has not
  durably left zero**, so the binding constraint on the wedge (authority, not
  content or indexing) still holds, and the largest referring-domain events
  remain founder-shaped (launch / community posts, `blocked-by-human.md` #1).
  Referring-domain **count** is still not free-tier readable (`backlinks-stats`
  is paid Site-Explorer), so DR stays the only free authority read for
  `nlqdb.com`.
- **GSC** (live 2026-09-02, 28d 08-03→08-31): **9 clicks / 858 impr / pos
  26.6**; **query-level 0 intent-query clicks** (unchanged). The one real ICP
  intent query holds page 1: "i need a relational database for ai agent world
  use cases like planning, retrieval, and action execution. what tools fit best
  in 2026?" — pos 8.0, 3 impr. Wedge pages keep earning impressions just off the
  fold: `solve/expire-old-agent-memory` 26 impr pos 11.3,
  `solve/build-vs-buy-agent-memory` 22 impr pos 11.4, `/agents/` 24 impr pos
  16.6 — impressions without clicks, the signature of DR-0 ranking just off page
  1. Biggest winnable pages stay the SQL-recipe long tail (`solve/` index 90
  impr pos 35.4; `solve/countif-sumif-conditional-aggregate-in-sql` 74 impr pos
  21.6; `solve/running-total-cumulative-sum-in-sql` 69 impr pos 41.8);
  `security/hall-of-fame` earns 3 of the site's 9 clicks (pos 36.3), still the
  best off-wedge converter. Sitemap: 126 submitted.
- **Per-URL index truth (URL Inspection API, live 2026-09-02): 6 of 6 wedge
  pages indexed** — `/agents/` (crawled 08-31),
  `solve/best-way-to-store-agent-memory` (08-12),
  `solve/build-vs-buy-agent-memory` (re-crawled 09-01),
  `solve/expire-old-agent-memory` (08-22),
  `solve/agent-memory-mcp-server` (08-13), and
  `docs.nlqdb.com/agent-memory/` (08-28). Internal-link + indexing levers remain
  exhausted and fully paid off; the residual is authority (DR at the floor).
- **Registry / directory listings — re-checked this cycle (2026-09-02):**
  - **Official MCP registry** — `com.nlqdb/nlqdb` **v0.1.1 active** (published
    07-22), `websiteUrl` carries `?utm_source=mcp-registry`. ✅ unchanged.
  - **Glama** — **live, `author:official`, A-grade** maintenance + quality
    (flipped B → A on 09-01); listing surfaces `/plugin marketplace add
    nlqdb/nlqdb`. Competitive-scale note: Glama's public registry now advertises
    **~81 k servers** (WebSearch 09-02, was ~2 k on the official registry) — the
    directory long tail is crowded; being *listed* is table stakes, ranking is
    authority-bound like the wedge. Yield gate still `/app/admin` `glama`.
  - **Smithery** — **live**, 90/100, all tools listed (unchanged).
  - **mcp.so** (ledger #7) + **Cursor directory** (ledger #8) — re-checked live
    this cycle: **still bot-walled** (mcp.so HTTP 403, cursor.directory HTTP 429
    to anonymous fetch; WebSearch surfaces no independent index of either
    nlqdb listing). Unverifiable from the loop, same wall as 09-01 — both rows
    **carried forward in-flight**, no Status flip warranted.
  - **PulseMCP** (#5) + **mcp.directory** (#23) — parked for the founder on
    09-01 (cascade miss confirmed ~40 days post registry-publish); no re-check
    due this cycle.
  - Anthropic connector dir (money-gated), `awesome-mcp-servers` #10984, Cline
    #2197, LobeHub #25, ExplainX #26 — carried forward, state unchanged.
    Plugin/skill venues (R-09): own marketplace ✅, claudemarketplaces.com ✅
    (crawl-fed), SkillsMP ✅, `claude-community` submitted 08-05 (pending),
    `skillsclaude.org` dropped 08-05.
- **Channels live with attributable yield: 4** (organic, dev.to, github, npm;
  unchanged — `/app/admin` not reachable from here). #3/#4/#5/#6/#7/#8/#12/#22/
  #23/#24 in-flight or founder-gated, yield 0.
- **Answer-engine retrieval presence (R-08): 0/10**, carried forward from the
  08-31 monthly check. Next monthly check due **2026-09-30** (not due this
  cycle). Grounding stays dominated by mem0/zep/letta/hindsight + hyperscaler
  docs; 0 grounding sets contain `nlqdb.com`, consistent with DR at the floor.
- **Coding-agent walker (R-06): 0/1 surfaced**, carried forward from the 08-31
  re-run (`first_rw=blocked_oauth`; cold agent recommended
  mem0/zep/letta/langmem/pgvector/supabase/pinecone/chroma/weaviate/redis, never
  named nlqdb). Not re-run this cycle — walker code unchanged since 08-31 and the
  result is authority-bound; DR still at the floor is the leading indicator that
  it stays 0/1. Result JSON is gitignored (a read-only measurement).
- **Domain Rating (R-10): nlqdb.com 0.1 · docs.nlqdb.com 0.1 · mem0.ai 74.0**
  (see cycle note above). R-10 stays complete; authority has not durably left
  zero.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29).
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight,
  yield 0. Install-yield gate (a real `agent-artifacts` visit in `/app/admin`)
  unmeasurable from here — stays owed.
- Host plugin/skill venues (R-09): 5/5 venues resolved; install-yield gate (one
  real `claude-plugin` visit in `/app/admin`) unmeasurable from here — stays owed.

**This cycle's finding (null run):** no reach Done-when box is pullable — the
two remaining ⬜ boxes (R-07 / R-09 yield gates) are both `/app/admin`-gated and
unmeasurable from the loop, R-08's answer-engine cadence isn't due until 09-30,
and the R-05 in-flight venues (mcp.so, cursor.directory) stay bot-walled on
live re-check, so no Status flips. The only measured state change this cycle is
DR flickering 0.0 → 0.1, which confirms rather than breaks the
oscillation-at-the-floor read: authority, the binding constraint, is still at
the floor and the agent-doable ceiling on this track remains reached (largest
levers are founder-shaped launch / community posts).
