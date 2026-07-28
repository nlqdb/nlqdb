# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Null run 2026-07-28 — nothing was agent-pullable, so this is a measurement-only cycle.** Both
  open slices' remaining work is blocked on factors an agent can't move this session: **R-04**'s
  cold-agent walk needs an `sk_live_` key in the walker env (already queued `blocked-by-human.md` #3)
  and there is no `ANTHROPIC_API_KEY` here to re-run the R-06 walker either; **R-07**'s external
  distribution is organic-install-yield-bound with the npm `0.1.1` mouth gated on release PR #826,
  and its yield gate (a real `agent-artifacts` visit) reads from `/app/admin`, not from here. R-08's
  answer-engine cadence is next due 2026-08-22. No new venue is publishable (R-05 is 8/8 resolved).
- GSC (28d, live 2026-07-28, window 06-28→07-26): **8 clicks / 487 impr / pos 17.7**; intent-query
  clicks **0** — **9th consecutive flat read**. The four stage-0 pages still earn zero impressions,
  while other agent-memory URLs keep earning them (`solve/running-total-cumulative-sum-in-sql` 75
  impr, `vs/wrenai` pos 6.8, `blog/bird-gold-noise-distinct` pos 11.4 with a click). The host ranks
  agent-memory content fine; it is the stage-0 set specifically that earns nothing. R-01 baseline,
  unmoved.
- **Per-URL index truth (URL Inspection API): 2 of 6 wedge pages indexed — unchanged.**
  `solve/best-way-to-store-agent-memory` (crawled 07-20) and `solve/agent-memory-mcp-server` (07-21)
  are indexed and **still earn 0 impressions** — for those two the gap is ranking, not indexing.
  `solve/build-vs-buy-agent-memory` + `solve/expire-old-agent-memory`: **still never crawled**
  (discovered via the submitted apex sitemap, not yet crawled — a crawl-priority wait, not a
  discoverability bug). `docs/agent-memory`: **still "unknown to Google"** — the 07-26 robots fix is
  only 2 days old and the docs host was verified reachable this run (robots `Allow: /` for `*`,
  Googlebot ungated, the page is in `sitemap-0.xml`, and robots advertises `sitemap-index.xml`), so
  discovery of the separate host is a latency wait per the mechanism `SK-DOCS-005` chose; **re-check
  next run** before treating it as failed. `/agents/` still reports canonical drift (Google indexes
  non-slash `/agents`) but prod is correct (301→slash, self-canonical) — GSC naming the redirect
  source, nothing to fix.
- Registry/directory listings (re-read live 2026-07-28): **official registry #1 ✅ active**
  (`com.nlqdb/nlqdb` v0.1.0) · **Smithery #2 ✅** (308→canonical listing, homepage link + 5 tools,
  confirmed 07-27) · **Glama #4** crawl-fed (index 200; links the repo, not the utm-tagged
  `websiteUrl`, until founder-claimed) · **mcp.so #5 still 404** day+2 after the 07-26 submit
  (`mcp.so/server/nlqdb` → 404) — re-check · **Cursor #6** unreadable (`cursor.directory/mcp` → 429
  to a non-browser client, same as 07-27; silence ≠ absence) · #8 `awesome-mcp-servers` PR open · #7
  Anthropic dir founder-gated (`blocked-by-human.md` #6) · PulseMCP #3 re-checks 08-22. Channels
  live with attributable yield: **4** (organic, dev.to, github, npm); #12 in-flight.
- Coding-agent walker (R-06): **0/1 surfaced** (baseline 2026-07-20 — cold session recommended
  `pgvector`, never nlqdb). Not re-run: no `ANTHROPIC_API_KEY` in this session.
- Canonical setup guide (R-04): **live, 2 of 3**. Walk box ⬜ — blocker is "the walker has no key",
  not the product. **One founder action closes it** (`blocked-by-human.md` #3): mint an `sk_live_`
  key at `/app/keys` and set it as `NLQDB_API_KEY` in the walker env. The browser-free MCP route the
  walk needs shipped end-to-end (#836/#837) and is verified by running the published binary.
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight, yield 0. Every dropped
  file carries the `npx -y @nlqdb/mcp` + `sk_live_` headless route beside the hosted one (2026-07-28,
  `GLOBAL-003`), pinned by `agent-artifacts.test.ts`. Published install surfaces = 4 (docs guide,
  `llms.txt`, artifacts index, and `@nlqdb/mcp`'s npm README — the last serves from `0.1.1`, gated on
  release PR #826). `skills.sh` has no submission flow (P2 07-23), so growth is organic install
  yield; the yield gate (a real `agent-artifacts` visit in `/app/admin`) is unmeasurable from here.
- Stage-0 solve pages: R-03 complete + R-02's two `competitors.md` §4 entries. Live path
  `nlqdb_query`; remember/preset gated (SK-PIVOT-010).
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10**. Monthly; next 2026-08-22,
  so not re-run this cycle.
