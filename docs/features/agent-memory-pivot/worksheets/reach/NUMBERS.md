# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-07-29 (b) — R-09 #4 was the box pulled.** The `claude-community`
  plugin-directory submission was a signed-in form with **no parked payload** — the ledger said
  "founder-queued" but the founder had nothing to act on. P2 re-verified the mechanism
  (`anthropics/claude-plugins-community` is a read-only mirror; submissions go through the
  `clau.de/plugin-directory-submission` form → automated security scan → in-product `/plugin`
  Discover tab) and the exact payload is now parked in [`blocked-by-human.md`](../../../../blocked-by-human.md)
  #3, ticking R-09 #4 to *parked* (4 of 4 venues resolved). The rest of this run is measurement-only:
  no `ANTHROPIC_API_KEY` here to re-run the R-06 walker; R-07/R-09 install-yield gates read from
  `/app/admin`, not here; R-08's answer-engine cadence is next due 2026-08-22.
- GSC (28d, live 2026-07-29, window 06-29→07-27): **7 clicks / 498 impr / pos 17.6**; intent-query
  clicks **0** — **11th consecutive flat read**. The four stage-0 pages still earn zero impressions,
  while other agent-memory URLs keep earning them (`solve/running-total-cumulative-sum-in-sql` 85
  impr, `vs/wrenai` pos 6.7, `blog/bird-gold-noise-distinct` pos 10.6 with a click,
  `security/hall-of-fame` 4 of the 7 total clicks). Three agent-memory *queries* surfaced but
  off-page-1, all earned by the benchmark blog, not the stage-0 solve set: "agent memory benchmark"
  (pos 53, 2 impr), "deep memory retrieval benchmark" (pos 52), "locomo benchmark ai memory" (pos
  83). The host ranks agent-memory content fine; it is the stage-0 set specifically that earns
  nothing. R-01 baseline, unmoved.
- **Per-URL index truth (URL Inspection API): 2 of 6 wedge pages indexed — unchanged.**
  `solve/best-way-to-store-agent-memory` (crawled 07-20) and `solve/agent-memory-mcp-server` (07-21)
  are indexed and **still earn 0 impressions** — for those two the gap is ranking, not indexing.
  `solve/build-vs-buy-agent-memory` + `solve/expire-old-agent-memory`: **still never crawled**
  (discovered via the submitted apex sitemap, a crawl-priority wait, not a discoverability bug).
  `docs/agent-memory`: **still "unknown to Google", never crawled** — the 07-26 robots fix is now 3
  days old, still a discovery-latency wait per `SK-DOCS-005`, but the window is worth flagging; if
  still uncrawled at the R-08 check (08-22) treat as failed, not latency. `/agents/` still reports
  canonical drift (Google indexes non-slash `/agents`) but prod is correct (301→slash,
  self-canonical) — GSC naming the redirect source, nothing to fix.
- Registry/directory listings (last read live 2026-07-29): official registry #1 ✅ active
  (`com.nlqdb/nlqdb` v0.1.1, `?utm_source=mcp-registry`) · Smithery #2 ✅ (07-27) · Glama #4 crawl-fed
  · mcp.so #5 unconfirmed (403 to non-browser) · Cursor #6 unreadable (429) · #8 `awesome-mcp-servers`
  PR open (merge-gated on Glama score badge, founder queue #2) · #7 Anthropic connector dir
  founder-gated (`blocked-by-human.md` #4) · PulseMCP #3 re-checks 08-22. Plugin venues (R-09): own
  marketplace ✅, claudemarketplaces.com ✅ (crawl-fed), SkillsMP ✅, `claude-community` #4 **payload
  parked this run** (`blocked-by-human.md` #3). Channels live with attributable yield: **4**
  (organic, dev.to, github, npm); #12 + #22 in-flight, yield 0.
- Coding-agent walker (R-06): **0/1 surfaced** (baseline 2026-07-20 — cold session recommended
  `pgvector`, never nlqdb). Not re-run: no `ANTHROPIC_API_KEY` in this session.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29) — cold-agent walk green with a
  founder-minted `sk_mcp_` key (evidence in [`INDEX.md`](INDEX.md) §R-04).
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight, yield 0. Every dropped
  file carries the `npx -y @nlqdb/mcp` + `sk_mcp_` headless route beside the hosted one (2026-07-28,
  `GLOBAL-003`, MCP-scoped key per `SK-APIKEYS-015`), pinned by `agent-artifacts.test.ts`. Published
  install surfaces = 4 (docs guide, `llms.txt`, artifacts index, `@nlqdb/mcp` npm README from 0.1.1).
  `skills.sh` has no submission flow (P2 07-23), so growth is organic install yield; the yield gate
  (a real `agent-artifacts` visit in `/app/admin`) is unmeasurable from here.
- Stage-0 solve pages: R-03 complete + R-02's two `competitors.md` §4 entries. Live path
  `nlqdb_query`; remember/preset gated (SK-PIVOT-010).
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10**. Monthly; next 2026-08-22,
  so not re-run this cycle.
