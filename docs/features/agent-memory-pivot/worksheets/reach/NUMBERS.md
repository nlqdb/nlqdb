# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-09-01 — DR reverted to the floor; the 08-31 "first nonzero"
  was measurement noise.** `bun scripts/ahrefs-dr.ts` (free Ahrefs public
  endpoint): **nlqdb.com 0.0 · docs.nlqdb.com 0.0 · mem0.ai 74.0**. Last cycle
  (08-31) both nlqdb domains read a stable 0.1; today both read 0.0 again. The
  honest read: Ahrefs' free DR is **oscillating between 0.0 and 0.1 at the
  floor** — the 0.1 was a first-derivative flicker, not a durable move, and the
  ≈74-point gap to mem0.ai is unchanged. R-10's last Done-when box (*DR ≥ first
  nonzero read*) was legitimately satisfied at the 08-31 reading and R-10 stays
  complete, but **authority has not durably left zero**; the binding constraint
  on the wedge (authority, not content or indexing) still holds, and the
  largest referring-domain events remain founder-shaped (launch / community
  posts, `blocked-by-human.md` #1). Referring-domain **count** is still not
  free-tier readable (`backlinks-stats` is paid Site-Explorer), so DR stays the
  only free authority read for `nlqdb.com`.
- **GSC** (live 2026-09-01, 28d 08-02→08-30): **9 clicks / 840 impr / pos
  25.8**; **query-level 0 intent-query clicks** (unchanged). The one real ICP
  intent query holds page 1: "i need a relational database for ai agent world
  use cases like planning, retrieval, and action execution. what tools fit best
  in 2026?" — pos 8.0, 3 impr. Wedge pages keep earning impressions just off
  the fold: `solve/expire-old-agent-memory` 26 impr pos 11.3,
  `solve/build-vs-buy-agent-memory` 22 impr pos 11.4, `/agents/` 23 impr pos
  14.5 — impressions without clicks, the signature of DR-0 ranking just off page
  1. Biggest winnable pages stay the SQL-recipe long tail (`solve/` index 86
  impr pos 34.0; `solve/countif-sumif-conditional-aggregate-in-sql` 74 impr pos
  21.6; `solve/running-total-cumulative-sum-in-sql` 71 impr pos 40.8);
  `security/hall-of-fame` earns 3 of the site's 9 clicks (pos 37.6), still the
  best off-wedge converter. Sitemap: 126 submitted.
- **Per-URL index truth (URL Inspection API, live 2026-09-01): 6 of 6 wedge
  pages indexed** — `/agents/` (crawled 08-31),
  `solve/best-way-to-store-agent-memory` (08-12),
  `solve/build-vs-buy-agent-memory` (08-17),
  `solve/expire-old-agent-memory` (08-22),
  `solve/agent-memory-mcp-server` (08-13), and
  `docs.nlqdb.com/agent-memory/` (08-28). Internal-link + indexing levers remain
  exhausted and fully paid off; the residual is authority (back to DR 0.0).
- **Registry / directory listings — live re-verified this cycle (2026-09-01;
  P2 monthly re-check, the past-due 08-22 triggers fired):**
  - **Official MCP registry** — `com.nlqdb/nlqdb` **v0.1.1 active** (published
    07-22), `websiteUrl` carries `?utm_source=mcp-registry`. ✅ unchanged.
  - **Glama** — **live, `author:official`, upgraded to A-grade** maintenance +
    A-grade quality (was tier B / 4.3–4.6 per-tool on 07-29); listing now
    surfaces `/plugin marketplace add nlqdb/nlqdb`. Ledger #6 quality state
    flipped B → A this cycle. Yield gate still `/app/admin` `glama`.
  - **Smithery** — **live**, 90/100, all tools listed (unchanged since 07-26).
  - **PulseMCP** — **still 0 results** for `nlqdb` in the public directory,
    ~41 days post registry-publish. The row-#5 08-22 trigger fires: the crawl +
    curation cascade has not reached it, so the account-walled
    `pulsemcp.com/submit` payload is now parked for the founder
    (`blocked-by-human.md`); ledger #5 next-step flipped.
  - **mcp.directory** — **still 0 results** (~26+ days post-publish). The
    row-#23 08-22 trigger fires the same way: not ingested from the official
    registry, so the no-account (but SPA-form, non-agent-POST-able) submit is
    parked for the founder alongside PulseMCP; ledger #23 next-step flipped.
  - **mcp.so** — search now returns HTTP 403 to anonymous/bot fetch, so live
    presence is not verifiable from here this cycle (was in the approval queue
    07-27); carried forward as in-flight, re-check when the search un-walls.
  - Cursor dir, Anthropic connector dir (money-gated), `awesome-mcp-servers`
    #10984, Cline #2197, LobeHub #25, ExplainX #26 — carried forward, state
    unchanged. Plugin/skill venues (R-09): own marketplace ✅,
    claudemarketplaces.com ✅ (crawl-fed), SkillsMP ✅, `claude-community`
    submitted 08-05 (pending), `skillsclaude.org` dropped 08-05.
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
  result is authority-bound; DR reverting to 0.0 is the leading indicator that
  it stays 0/1. Result JSON is gitignored (a read-only measurement).
- **Domain Rating (R-10): nlqdb.com 0.0 · docs.nlqdb.com 0.0 · mem0.ai 74.0**
  (see cycle note above). R-10 stays complete (all Done-when boxes were met);
  authority has not durably left zero.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29).
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight,
  yield 0. Install-yield gate (a real `agent-artifacts` visit in `/app/admin`)
  unmeasurable from here — stays owed.
- Host plugin/skill venues (R-09): 5/5 venues resolved; install-yield gate (one
  real `claude-plugin` visit in `/app/admin`) unmeasurable from here — stays owed.

**This cycle's finding:** the two remaining ⬜ reach boxes (R-07 / R-09 yield
gates) are `/app/admin`-gated and unmeasurable from the loop; the agent-doable
ceiling is reached. The one concrete state change this cycle is the P2 monthly
venue re-verification: PulseMCP and mcp.directory both remain absent ~40 days
after the registry publish, confirming the **narrow-cascade** finding (the
official registry reaches only Glama + partial crawlers), so their manual submit
payloads are now parked for the founder and their ledger rows flipped. Glama
quality rose B → A. DR reverted 0.1 → 0.0 — authority, the binding constraint,
is still at the floor.
