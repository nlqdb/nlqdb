# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-20 — NULL RUN (no slice diff), but the R-06 coding-agent
  walker RE-RAN for the first time since the 2026-07-20 baseline.** The `claude`
  CLI was on PATH this session (prior cycles could not spawn the nested cold
  session and carried the baseline forward untouched). Outcome unchanged:
  **0/1 surfaced** — the cold agent web-searched, recommended
  mem0/zep/langmem/langgraph/pgvector, and **never named nlqdb**; no
  `mcp.nlqdb.com` / `claude mcp add … nlqdb` setup command reached (59.6s,
  `first_rw=blocked_oauth`). This is the falsifiable claim the whole track
  makes, **still false 31 days on despite 6/6 wedge pages indexed** — the
  cleanest corroboration yet that the binding constraint is **authority
  (DR 0.0), not content coverage or indexing**: everything an agent can build
  is built and crawled, and a cold agent still can't find it. Every remaining
  Done-when box (R-07 `agent-artifacts` visit, R-09 `claude-plugin` visit, R-10
  first nonzero DR) is a measurement outcome an agent cannot force with a code
  diff → null run per step 2.
- **Domain Rating (R-10, `bun scripts/ahrefs-dr.ts` — free Ahrefs public
  endpoint, live 2026-08-20): nlqdb.com 0.0 · docs.nlqdb.com 0.0 · mem0.ai
  74.0.** Flat across every read since 08-04 — the **sole binding constraint**.
  R-10's last box (first nonzero DR) stays owed; the largest referring-domain
  events are founder-shaped (launch / community posts, `blocked-by-human.md` #1).
  Referring-domains itself is not free-tier readable (`backlinks-stats` is
  Site-Explorer/paid), so DR stays the only free authority read for `nlqdb.com`.
- **GSC** (live 2026-08-20, 28d 07-21→08-18): **8 clicks / 642 impr / pos
  22.6**; **query-level 0 intent-query clicks**. The one real ICP intent query
  holds page 1: "i need a relational database for ai agent world use cases like
  planning, retrieval, and action execution. what tools fit best in 2026?" —
  pos 8.0, 3 impr. A **new conversational ICP query surfaced at pos 6.0** —
  "seeking natural language bi that can connect to postgres without moving
  data—options?" (1 impr) — evidence the answer-engine-style long queries are
  starting to match the site, but on `/vs`-style pages, not the wedge. The
  R-10(b) benchmark asset **`/agent-memory-benchmarks/` is indexed and earning
  impressions — 13 impr / pos 14.6**, but its target queries still surface off
  page 1 ("locomo benchmark ai memory") — consistent with DR 0. Biggest
  winnable page stays `solve/running-total-cumulative-sum-in-sql` (112 impr /
  pos 36.5); `security/hall-of-fame` earns 3 page-level clicks (pos 22.0) — the
  site's best converter, off-wedge.
- **Per-URL index truth (URL Inspection API, live 2026-08-20): 6 of 6 wedge
  pages indexed** — `/agents/` (crawled 08-16),
  `solve/best-way-to-store-agent-memory` (08-12),
  `solve/build-vs-buy-agent-memory` (08-17),
  `solve/expire-old-agent-memory` (08-12),
  `solve/agent-memory-mcp-server` (08-13), and
  `docs.nlqdb.com/agent-memory/` (08-11). Internal-link + indexing levers
  remain exhausted and fully paid off; the residual is authority (DR 0).
  Sitemap: 124 submitted.
- Registry/directory listings (carried forward, not re-verified this cycle):
  official registry ✅ · Smithery parked · Glama badge + connector claim awaiting
  external review · mcp.so approval queue · Cursor submitted · `mcp.directory`
  re-check 08-22 · `awesome-mcp-servers` #10984 PR open · Anthropic connector dir
  founder/money-gated · PulseMCP re-check 08-22 · Cline #2197 submitted 08-05 ·
  LobeHub row #25 founder-gated · ExplainX.ai row #26 founder-gated. Plugin/skill
  venues (R-09): own marketplace ✅, claudemarketplaces.com ✅ (crawl-fed),
  SkillsMP ✅, `claude-community` submitted 08-05 (pending review),
  `skillsclaude.org` dropped 08-05. **Channels live with attributable yield: 4**
  (organic, dev.to, github, npm; unchanged — `/app/admin` not reachable from
  here); #12 + #22 + #23 + #24 + #25 + #26 in-flight/founder-gated, yield 0.
- Coding-agent walker (R-06): **0/1 surfaced — RE-RUN 2026-08-20** (first
  successful re-run since the 2026-07-20 baseline; unblocked because the
  `claude` CLI was available this session). Recommended
  mem0/zep/langmem/langgraph/pgvector; no nlqdb, no setup command. Result JSON
  is gitignored (`tools/stranger-test/results/*.json`), so it is a read-only
  measurement, not a repo mutation.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29).
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight,
  yield 0. Install-yield gate (a real `agent-artifacts` visit in `/app/admin`)
  unmeasurable from here.
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10**.
  Monthly; **next 2026-08-22** — respected, not burned 2 days early to keep the
  clean monthly comparison. That read is the first after both the 08-04
  AI-crawler robots unblock and the 08-18 Dataset markup on the one citable
  target; R-05's PulseMCP + mcp.directory re-checks and R-10's crawl-lever
  verification also fall due 08-22, so the next cycle on/after that date carries
  the real signal.
