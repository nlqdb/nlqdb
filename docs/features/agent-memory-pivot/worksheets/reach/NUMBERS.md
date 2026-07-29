# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-07-29 — R-04 was the one box pulled (walk green, below); the rest is
  measurement-only.** **R-04**'s cold-agent walk ran green with a founder-minted `sk_mcp_` key set
  as `NLQDB_API_KEY` in the walker env (see the R-04 line below), closing the slice; there is no
  `ANTHROPIC_API_KEY` here to re-run the R-06 walker; **R-07**'s external distribution is
  organic-install-yield-bound
  and its yield gate (a real `agent-artifacts` visit) reads from `/app/admin`, not from here. R-08's
  answer-engine cadence is next due 2026-08-22. No new venue is publishable (R-05 is 8/8 resolved).
- GSC (28d, live 2026-07-29, window 06-29→07-27): **7 clicks / 464 impr / pos 17.3**; intent-query
  clicks **0** — **10th consecutive flat read**. The four stage-0 pages still earn zero impressions,
  while other agent-memory URLs keep earning them (`solve/running-total-cumulative-sum-in-sql` 75
  impr, `vs/wrenai` pos 6.8, `blog/bird-gold-noise-distinct` pos 10.6 with a click,
  `blog/agent-memory-benchmarks-measure-recall-not-analysis` 8 impr). Two agent-memory *queries*
  surfaced but off-page-1: "agent memory benchmark" (pos 53, 2 impr), "deep memory retrieval
  benchmark" (pos 52), "locomo benchmark ai memory" (pos 83) — the benchmark blog earns these, not
  the stage-0 solve set. The host ranks agent-memory content fine; it is the stage-0 set
  specifically that earns nothing. R-01 baseline, unmoved.
- **Per-URL index truth (URL Inspection API): 2 of 6 wedge pages indexed — unchanged.**
  `solve/best-way-to-store-agent-memory` (crawled 07-20) and `solve/agent-memory-mcp-server` (07-21)
  are indexed and **still earn 0 impressions** — for those two the gap is ranking, not indexing.
  `solve/build-vs-buy-agent-memory` + `solve/expire-old-agent-memory`: **still never crawled**
  (discovered via the submitted apex sitemap, a crawl-priority wait, not a discoverability bug).
  `docs/agent-memory`: **still "unknown to Google", never crawled** — the 07-26 robots fix is now
  3 days old and discovery of the separate docs host is a latency wait per `SK-DOCS-005`; **re-check
  next run** before treating it as failed, but the elapsed window is worth flagging. `/agents/`
  still reports canonical drift (Google indexes non-slash `/agents`) but prod is correct
  (301→slash, self-canonical) — GSC naming the redirect source, nothing to fix.
- Registry/directory listings (re-read live 2026-07-29): **official registry #1 ✅ active — now
  `com.nlqdb/nlqdb` v0.1.1 latest** (was v0.1.0 last read; `websiteUrl` carries
  `?utm_source=mcp-registry`) · **Smithery #2 ✅** (confirmed 07-27) · **Glama #4** crawl-fed · **mcp.so
  #5 still unconfirmed** — `mcp.so/server/nlqdb` returns 403 to a non-browser client (bot-block;
  silence ≠ absence, same class as Cursor), unresolved since the 07-26 submit — **re-check** · **Cursor
  #6** unreadable (`cursor.directory/mcp` → 429 to non-browser) · #8 `awesome-mcp-servers` PR open · #7
  Anthropic dir founder-gated (`blocked-by-human.md` #5) · PulseMCP #3 re-checks 08-22. Channels
  live with attributable yield: **4** (organic, dev.to, github, npm); #12 in-flight.
- Coding-agent walker (R-06): **0/1 surfaced** (baseline 2026-07-20 — cold session recommended
  `pgvector`, never nlqdb). Not re-run: no `ANTHROPIC_API_KEY` in this session.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29). The cold-agent walk ran green
  with a founder-minted `sk_mcp_` key — published binary, published guide, real prod write +
  read-back; evidence in [`INDEX.md`](INDEX.md) §R-04. The queue item is deleted.
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight, yield 0. Every dropped
  file carries the `npx -y @nlqdb/mcp` + `sk_mcp_` headless route beside the hosted one (2026-07-28,
  `GLOBAL-003`, swept to the MCP-scoped key per `SK-APIKEYS-015`), pinned by `agent-artifacts.test.ts`.
  Published install surfaces = 4 (docs guide, `llms.txt`, artifacts index, and `@nlqdb/mcp`'s npm
  README — the last serves from `0.1.1`, gated on release PR #826). `skills.sh` has no submission
  flow (P2 07-23), so growth is organic install yield; the yield gate (a real `agent-artifacts`
  visit in `/app/admin`) is unmeasurable from here.
- Stage-0 solve pages: R-03 complete + R-02's two `competitors.md` §4 entries. Live path
  `nlqdb_query`; remember/preset gated (SK-PIVOT-010).
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10**. Monthly; next 2026-08-22,
  so not re-run this cycle.
