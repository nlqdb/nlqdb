# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-31 — R-10 COMPLETE: first nonzero Domain Rating read.**
  `bun scripts/ahrefs-dr.ts` (free Ahrefs public endpoint, read twice this
  session, stable): **nlqdb.com 0.1 · docs.nlqdb.com 0.1 · mem0.ai 74.0**.
  Both nlqdb domains have read a flat **0.0** on every prior cycle since the
  first DR read (08-04); this is the **first time either clears 0.0**, so
  R-10's last Done-when box — *DR / referring domains ≥ first nonzero read* —
  is satisfied, and R-10 flips complete. Honest scale note: 0.1 on Ahrefs'
  0–100 DR is a directional first-derivative signal, **not** a ranking move —
  the ≈74-point gap to mem0.ai is unchanged, and the binding constraint on
  the wedge (authority, not content or indexing) still holds. What moved is
  the *sign*, not the magnitude: authority has begun, barely, to come off the
  floor. The largest referring-domain events remain founder-shaped (launch /
  community posts, `blocked-by-human.md` #1); referring-domain **count** is
  still not free-tier readable (`backlinks-stats` is paid Site-Explorer), so
  DR stays the only free authority read for `nlqdb.com`.
- **GSC** (live 2026-08-31, 28d 08-01→08-29): **9 clicks / 828 impr / pos
  24.8**; **query-level 0 intent-query clicks** (unchanged). The one real ICP
  intent query holds page 1: "i need a relational database for ai agent world
  use cases like planning, retrieval, and action execution. what tools fit
  best in 2026?" — pos 8.0, 3 impr. Wedge pages keep earning impressions on
  page 1/2: `solve/expire-old-agent-memory` 26 impr pos 11.3,
  `solve/build-vs-buy-agent-memory` 22 impr pos 11.4, `/agents/` 21 impr pos
  12.8 — impressions without clicks, the signature of DR-0 ranking just off
  the fold. Biggest winnable page stays the SQL-recipe long tail
  (`solve/running-total-cumulative-sum-in-sql` 72 impr / pos 40.4;
  `solve/countif-sumif-conditional-aggregate-in-sql` 74 impr / pos 21.6);
  `security/hall-of-fame` earns 3 of the site's 9 clicks (pos 35.9), still the
  best off-wedge converter. Sitemap: 126 submitted.
- **Per-URL index truth (URL Inspection API, live 2026-08-31): 6 of 6 wedge
  pages indexed** — `/agents/` (crawled 08-16),
  `solve/best-way-to-store-agent-memory` (08-12),
  `solve/build-vs-buy-agent-memory` (08-17),
  `solve/expire-old-agent-memory` (re-crawled 08-22),
  `solve/agent-memory-mcp-server` (08-13), and
  `docs.nlqdb.com/agent-memory/` (re-crawled 08-28). Internal-link + indexing
  levers remain exhausted and fully paid off; the residual is authority (now
  DR 0.1, first move off 0).
- **Answer-engine retrieval presence (R-08 monthly check, RE-RUN 2026-08-31,
  the first since the 07-22 baseline — due 08-22, run at first cycle on/after):
  0/10.** `WebSearch` on the top-10 R-01 queries (per-user memory / best way to
  store / multi-tenant isolation / forgets between sessions / add long-term
  memory / agent-memory MCP server / mem0 alternative / build-vs-buy / postgres
  agent state / scope by end_user_id) surfaced **zero** grounding sets
  containing `nlqdb.com` — 0 possible citations, unchanged from baseline and
  consistent with DR 0.1. Grounding is dominated by mem0/zep/letta/hindsight +
  the hyperscaler docs (Databricks/AWS/Azure/Oracle/Cloudflare). Next monthly
  check due **2026-09-30**.
- Coding-agent walker (R-06): **0/1 surfaced — RE-RUN 2026-08-31**
  (`bash scripts/reach-agent-walk.sh`, 86.2s, `first_rw=blocked_oauth`). Cold
  agent web-searched and recommended
  mem0/zep/letta/langmem/langgraph/pgvector/supabase/pinecone/chroma/weaviate/redis;
  **never named nlqdb**, no `mcp.nlqdb.com` / `claude mcp add … nlqdb` command
  reached. Result JSON is gitignored (`tools/stranger-test/results/*.json`) — a
  read-only measurement, not a repo mutation. The falsifiable track claim stays
  false; DR ticking off 0 is the first thing that could, over time, change it.
- **Domain Rating (R-10): nlqdb.com 0.1 · docs.nlqdb.com 0.1 · mem0.ai 74.0**
  (see cycle note above). R-10 now **complete** — all Done-when boxes ✅.
- Registry/directory listings (carried forward, not re-verified this cycle):
  official registry ✅ · Smithery parked · Glama badge + connector claim awaiting
  external review · mcp.so approval queue · Cursor submitted · `mcp.directory`
  re-check due · `awesome-mcp-servers` #10984 PR open · Anthropic connector dir
  founder/money-gated · PulseMCP re-check due · Cline #2197 submitted 08-05 ·
  LobeHub row #25 founder-gated · ExplainX.ai row #26 founder-gated. Plugin/skill
  venues (R-09): own marketplace ✅, claudemarketplaces.com ✅ (crawl-fed),
  SkillsMP ✅, `claude-community` submitted 08-05 (pending review),
  `skillsclaude.org` dropped 08-05. **Channels live with attributable yield: 4**
  (organic, dev.to, github, npm; unchanged — `/app/admin` not reachable from
  here); #12 + #22 + #23 + #24 + #25 + #26 in-flight/founder-gated, yield 0.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29).
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight,
  yield 0. Install-yield gate (a real `agent-artifacts` visit in `/app/admin`)
  unmeasurable from here — stays owed.
- Host plugin/skill venues (R-09): 5/5 venues resolved; install-yield gate (one
  real `claude-plugin` visit in `/app/admin`) unmeasurable from here — stays owed.
