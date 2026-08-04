# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-03 — slice: R-05 sweep, new venue parked — Cline MCP
  Marketplace** ([`cline/mcp-marketplace`](https://github.com/cline/mcp-marketplace)).
  P2 (web-searched 2026-08-03, sources in the PR): a **GitHub-issue** submission
  registry (the `[Server Submission]` template — repo URL + a 400×400 PNG logo +
  reason + a testing-confirmation that Cline installs the server from the repo
  README/`llms-install.md`) that makes the listed server **one-click installable
  inside Cline**, one of the largest coding-agent hosts — squarely the reach
  thesis (coding-agent discovery + one-command install), yet absent from the
  entire R-05/R-09 sweep. Not agent-submittable *from this env* (GitHub scope is
  `nlqdb/nlqdb` only; also needs a rendered logo + a real Cline-setup pass), so
  the **exact payload is parked** ([`blocked-by-human.md`](../../../../blocked-by-human.md) #5)
  and the venue is recorded as ledger row #24
  ([`acquisition-channels.md`](../../../../research/acquisition-channels.md)) —
  repo-linked like `awesome-mcp`/`skillsclaude`, so its yield rolls into the
  `github` ref (no dedicated utm key). R-05 venue ticked *payload parked*.
- **GSC** (28d, live 2026-08-03, window 07-04→08-01): **8 clicks / 582 impr /
  pos 19.2** — flat vs the last two reads (8/577/19.0, 8/562/19.3), the **16th
  consecutive flat read**; **intent-query clicks 0**. The four stage-0 pages
  still earn zero impressions while the rest of the agent-memory cluster earns
  them (`solve/running-total-cumulative-sum-in-sql` 117 impr,
  `solve/count-rows-per-day-including-missing-dates` 87 impr / pos 8.3 / a click,
  `security/hall-of-fame` 4 of the 8 total clicks). The three agent-memory
  *queries* that surface are all off-page-1 and earned by the benchmark blog, not
  the stage-0 set ("agent memory benchmark" pos 53, "deep memory retrieval
  benchmark" pos 52, "locomo benchmark ai memory" pos 83). R-01 baseline,
  unmoved.
- **Per-URL index truth (URL Inspection API): 3 of 6 wedge pages indexed.**
  `/agents/` (crawled 08-02, pos 2.9, 10 impr — strongest indexed wedge page),
  `solve/best-way-to-store-agent-memory` (07-20) and
  `solve/agent-memory-mcp-server` (07-21) remain indexed; the last two **still
  earn 0 impressions** — for those the gap is ranking, not indexing.
  `solve/build-vs-buy-agent-memory` ("discovered, not indexed") +
  `solve/expire-old-agent-memory` ("unknown to Google") are **still never
  crawled**, and `docs/agent-memory` remains uncrawled — the two crawl-priority
  levers that target exactly this (#888 `/solve↔/solve` internal links, shipped
  08-02; #892 docs-site sitemap, open this cycle) are **mid-flight, verified at
  the R-08 check 08-22**; re-pulling a third crawl lever now would confound their
  attribution, so this cycle did not touch them.
- Registry/directory listings (carried forward, not re-read live this cycle):
  official registry #3 ✅ active · Smithery #4 ✅ · Glama #6 crawl-fed (badge +
  connector-claim founder-gated) · mcp.so #7 approval queue · Cursor #8
  submitted · `mcp.directory` #23 absent (re-check 08-22) · `awesome-mcp-servers`
  #10 PR open (merge-gated on Glama badge, founder queue #3) · Anthropic
  connector dir #9 founder/money-gated · PulseMCP #5 re-checks 08-22 · **Cline
  MCP Marketplace #24 payload parked (new this cycle, founder queue #5).** Plugin/
  skill venues (R-09): own marketplace ✅, claudemarketplaces.com ✅ (crawl-fed),
  SkillsMP ✅, `claude-community` payload parked, `skillsclaude.org` payload
  parked. **Channels live with attributable yield: 4** (organic, dev.to, github,
  npm); #12 + #22 + #23 + #24 in-flight/parked, yield 0.
- Coding-agent walker (R-06): **0/1 surfaced** (baseline 2026-07-20). Not re-run:
  no `ANTHROPIC_API_KEY` in this session.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29) — cold-agent
  walk green with a founder-minted `sk_mcp_` key (evidence in [`INDEX.md`](INDEX.md) §R-04).
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight,
  yield 0; every dropped file carries the `npx -y @nlqdb/mcp` + `sk_mcp_`
  headless route (`GLOBAL-003`, MCP-scoped key per `SK-APIKEYS-015`), pinned by
  `agent-artifacts.test.ts`. Install-yield gate (a real `agent-artifacts` visit
  in `/app/admin`) unmeasurable from here.
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10**.
  Monthly; next 2026-08-22, so not re-run this cycle.
