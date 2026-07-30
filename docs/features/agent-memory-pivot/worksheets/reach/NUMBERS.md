# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-07-30 (b) — R-09 #5 (`skillsclaude.org`) was the venue pulled.**
  P2 (web-searched + fetched 2026-07-30): `skillsclaude.org` (~7,200 skills) is a
  **no-account** paste-a-repo submit form ("Paste a GitHub repository that contains
  one or more SKILL.md files. No upload, no account required") — **not** an
  arbitrary-repo crawler: both nlqdb skills have been public since 2026-07-22 yet
  `skillsclaude.org/skills?q=nlqdb` returns **0** eight days later, so it only
  indexes submitted (or curated-collection) repos. The submit page is a Next.js SPA
  with a `<form>` carrying no `action` (client-only), so it is **not cleanly
  agent-POST-able**, and driving it with headless Chromium was **blocked by this
  automation env's classifier** — so the one-field payload (`github.com/nlqdb/nlqdb`)
  is **parked** for a founder browser paste ([`blocked-by-human.md`](../../../../blocked-by-human.md) #5,
  ranked last / optional). The listing links the **repo URL**, not a taggable
  `nlqdb.com` homepage, so its yield rolls into the existing `github` ref (ledger
  row #16) — **no new ledger row, no utm key** (the awesome-mcp #10 / SkillsMP
  pattern). R-09 now 5 venues resolved.
- The rest is measurement-only: no `ANTHROPIC_API_KEY` here to re-run the R-06
  walker; R-07/R-09 install-yield gates read from `/app/admin`, not here; R-08's
  answer-engine cadence is next due 2026-08-22.
- GSC (28d, live 2026-07-30, window 06-30→07-28): **7 clicks / 517 impr / pos
  17.8**; intent-query clicks **0** — **13th consecutive flat read**. The four
  stage-0 pages still earn zero impressions, while other agent-memory URLs keep
  earning them (`solve/running-total-cumulative-sum-in-sql` 91 impr,
  `solve/count-rows-per-day-including-missing-dates` 76 impr / pos 8 / a click,
  `vs/wrenai` pos 6.9, `security/hall-of-fame` 4 of the 7 total clicks). Three
  agent-memory *queries* surfaced but off-page-1, all earned by the benchmark blog,
  not the stage-0 solve set: "agent memory benchmark" (pos 53, 2 impr), "deep memory
  retrieval benchmark" (pos 52), "locomo benchmark ai memory" (pos 83). The host
  ranks agent-memory content fine; it is the stage-0 set specifically that earns
  nothing. R-01 baseline, unmoved.
- **Per-URL index truth (URL Inspection API): 2 of 6 wedge pages indexed —
  unchanged.** `solve/best-way-to-store-agent-memory` (crawled 07-20) and
  `solve/agent-memory-mcp-server` (07-21) are indexed and **still earn 0
  impressions** — for those two the gap is ranking, not indexing.
  `solve/build-vs-buy-agent-memory` ("discovered, not indexed") +
  `solve/expire-old-agent-memory` ("unknown to Google"): **still never crawled** (a
  crawl-priority wait, not a discoverability bug). `docs/agent-memory`: **still
  "unknown to Google", never crawled** — the 07-26 robots fix is now 4 days old,
  still a discovery-latency wait per `SK-DOCS-005`; per the standing rule, if still
  uncrawled at the R-08 check (08-22) treat as failed, not latency. `/agents/`
  still reports canonical drift (Google indexes non-slash `/agents`) but prod is
  correct (301→slash, self-canonical) — GSC naming the redirect source, nothing
  to fix.
- Registry/directory listings (last read live 2026-07-30): official registry #3
  ✅ active (`com.nlqdb/nlqdb` v0.1.1, `?utm_source=mcp-registry`) · Smithery #4
  ✅ (07-27) · Glama #6 crawl-fed · mcp.so #7 absent (approval queue) · Cursor #8
  submitted · `mcp.directory` #23 absent (registry-ingestion pending, re-check
  08-22) · `awesome-mcp-servers` #10 PR open (merge-gated on Glama score badge,
  founder queue #2) · Anthropic connector dir #9 founder-gated
  (`blocked-by-human.md` #4) · PulseMCP #5 re-checks 08-22. Plugin/skill venues
  (R-09): own marketplace ✅, claudemarketplaces.com ✅ (crawl-fed), SkillsMP ✅,
  `claude-community` #4 payload parked (`blocked-by-human.md` #3), `skillsclaude.org`
  **#5 new this cycle — no-account form, payload parked** (`blocked-by-human.md` #5).
  **Channels live with attributable yield: 4** (organic, dev.to, github, npm); #12 +
  #22 + #23 in-flight, yield 0.
- Coding-agent walker (R-06): **0/1 surfaced** (baseline 2026-07-20 — cold
  session recommended `pgvector`, never nlqdb). Not re-run: no
  `ANTHROPIC_API_KEY` in this session.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29) — cold-agent
  walk green with a founder-minted `sk_mcp_` key (evidence in
  [`INDEX.md`](INDEX.md) §R-04).
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight,
  yield 0. Every dropped file carries the `npx -y @nlqdb/mcp` + `sk_mcp_`
  headless route beside the hosted one (2026-07-28, `GLOBAL-003`, MCP-scoped key
  per `SK-APIKEYS-015`), pinned by `agent-artifacts.test.ts`. Published install
  surfaces = 4 (docs guide, `llms.txt`, artifacts index, `@nlqdb/mcp` npm README
  from 0.1.1). `skills.sh` has no submission flow (P2 07-23), so growth is
  organic install yield; the yield gate (a real `agent-artifacts` visit in
  `/app/admin`) is unmeasurable from here.
- Stage-0 solve pages: R-03 complete + R-02's two `competitors.md` §4 entries.
  Live path `nlqdb_query`; remember/preset gated (SK-PIVOT-010).
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10**.
  Monthly; next 2026-08-22, so not re-run this cycle.
