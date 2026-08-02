# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-02 — slice: `/solve ↔ /solve` contextual internal linking
  for the agent-memory wedge cluster** (crawl-priority lever on the stuck
  Index-status number, not a null run). The two indexed wedge pages
  (`best-way-to-store-agent-memory`, `agent-memory-mcp-server`) now carry
  contextual `related` anchors to the **two never-crawled** pages
  (`build-vs-buy-agent-memory`, `expire-old-agent-memory`) — each target gets
  ≥ 1 inbound link from an *indexed, topically-relevant* sibling. Before this,
  those two pages' only inbound links were the flat `/solve/` index (itself off
  page 1) + the sitemap — the textbook cause of "Discovered - currently not
  indexed" (P2, web-searched 2026-08-02: Onely / IndexMachine / MasterSEOTool
  agree the remedy is 2–5 contextual links from indexed pages; sitemap-only
  discovery ⇒ low crawl priority). New `related?: string[]` field on
  `SolveEntry` + a rendered "Related guides" section + `relatedSolveEntries`
  resolver, pinned by two `solve.test.ts` guards (every related slug resolves /
  no self-ref / no dupes; both wedge targets keep ≥ 1 inbound link). **Effect is
  a crawl-priority signal, not an instant index** — verify at the R-08 check
  (08-22): if `build-vs-buy` / `expire-old` are still never-crawled then, the
  lever failed and the next move is inbound links from `/agents/` (indexed,
  10 impr) too.
- The rest is measurement-only: no `ANTHROPIC_API_KEY` here to re-run the R-06
  walker; R-07/R-09 install-yield gates read from `/app/admin`, not here; R-08's
  answer-engine cadence is next due 2026-08-22.
- GSC (28d, live 2026-08-02, window 07-03→07-31): **8 clicks / 577 impr / pos
  19.0**; intent-query clicks **0** — **14th consecutive flat read**. The four
  stage-0 pages still earn zero impressions, while other agent-memory URLs keep
  earning them (`solve/running-total-cumulative-sum-in-sql` 114 impr,
  `solve/count-rows-per-day-including-missing-dates` 82 impr / pos 8 / a click,
  `security/hall-of-fame` 4 of the 8 total clicks). Three agent-memory *queries*
  surfaced but off-page-1, all earned by the benchmark blog, not the stage-0
  solve set: "agent memory benchmark" (pos 53, 2 impr), "deep memory retrieval
  benchmark" (pos 52), "locomo benchmark ai memory" (pos 83). The host ranks
  agent-memory content fine; it is the stage-0 set specifically that earns
  nothing — which is exactly the crawl gap this cycle's slice targets. R-01
  baseline, unmoved.
- **Per-URL index truth (URL Inspection API): 3 of 6 wedge pages indexed — up
  from 2.** `/agents/` was **crawled + indexed today (2026-08-02)** — the
  canonical drift GSC flagged on 07-30 (Google indexing the non-slash `/agents`)
  has resolved: prod's 301→slash self-canonical won, `/agents/` is now the
  indexed URL (pos 3.3, 10 impr — the strongest indexed wedge page).
  `solve/best-way-to-store-agent-memory` (07-20) and
  `solve/agent-memory-mcp-server` (07-21) remain indexed and **still earn 0
  impressions** — for those the gap is ranking, not indexing.
  `solve/build-vs-buy-agent-memory` ("discovered, not indexed") +
  `solve/expire-old-agent-memory` ("unknown to Google") are **still never
  crawled** — the crawl-priority gap this cycle's internal-linking slice
  addresses. `docs/agent-memory`: **still "unknown to Google", never crawled** —
  the 07-26 robots fix is now 7 days old, still a discovery-latency wait per
  `SK-DOCS-005`; per the standing rule, if still uncrawled at the R-08 check
  (08-22) treat as failed, not latency.
- Registry/directory listings (last read live 2026-07-30, not re-read this
  cycle): official registry #3 ✅ active (`com.nlqdb/nlqdb` v0.1.1,
  `?utm_source=mcp-registry`) · Smithery #4 ✅ · Glama #6 crawl-fed · mcp.so #7
  absent (approval queue) · Cursor #8 submitted · `mcp.directory` #23 absent
  (re-check 08-22) · `awesome-mcp-servers` #10 PR open (merge-gated on Glama
  score badge, founder queue #3) · Anthropic connector dir #9 founder-gated ·
  PulseMCP #5 re-checks 08-22. Plugin/skill venues (R-09): own marketplace ✅,
  claudemarketplaces.com ✅ (crawl-fed), SkillsMP ✅, `claude-community` #4
  payload parked (`blocked-by-human.md` #4), `skillsclaude.org` #5 payload
  parked (`blocked-by-human.md` #6). **Channels live with attributable yield: 4**
  (organic, dev.to, github, npm); #12 + #22 + #23 in-flight, yield 0.
- Coding-agent walker (R-06): **0/1 surfaced** (baseline 2026-07-20 — cold
  session recommended `pgvector`, never nlqdb). Not re-run: no
  `ANTHROPIC_API_KEY` in this session.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29) — cold-agent
  walk green with a founder-minted `sk_mcp_` key (evidence in
  [`INDEX.md`](INDEX.md) §R-04).
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight,
  yield 0. Every dropped file carries the `npx -y @nlqdb/mcp` + `sk_mcp_`
  headless route beside the hosted one (2026-07-28, `GLOBAL-003`, MCP-scoped key
  per `SK-APIKEYS-015`), pinned by `agent-artifacts.test.ts`. `skills.sh` has no
  submission flow (P2 07-23), so growth is organic install yield; the yield gate
  (a real `agent-artifacts` visit in `/app/admin`) is unmeasurable from here.
- Stage-0 solve pages: R-03 complete + R-02's two `competitors.md` §4 entries;
  this cycle added the `/solve ↔ /solve` internal-link mesh over the cluster
  (above). Live path `nlqdb_query`; remember/preset gated (SK-PIVOT-010).
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10**.
  Monthly; next 2026-08-22, so not re-run this cycle.
