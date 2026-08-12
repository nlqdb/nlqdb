# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-12 — one durable ledger advance (LobeHub added, row #25) +
  a measured crawl advance; no Done-when box agent-flippable.** The three still
  owed all gate on measurement outcomes I cannot force from here: R-07's
  `agent-artifacts` `/app/admin` visit, R-09's `claude-plugin` visit, R-10's
  first nonzero DR. **Measured movement this cycle:**
  `solve/build-vs-buy-agent-memory` advanced *Discovered — not indexed* (08-11)
  → **Crawled — currently not indexed, crawled 2026-08-12** (today) — Google
  crawled it for the first time, one step short of indexing; wedge-page index
  holds at **4/6**. Diversifying off the exhausted integration-marketplace lane
  (row #20, closed last cycle) per anti-rut, the P2-mandated venue web-search
  surfaced the **largest MCP directory (LobeHub, ~56 k servers) absent from the
  ledger** — added as row #25 with its P2-verified mechanism + exact founder
  payload. No box flips; honest measurement + one durable ledger advance, not a
  content pull.
- **New venue this cycle — LobeHub MCP Marketplace (ledger row #25, P2
  2026-08-12):** the largest MCP directory surfaced (~56 k servers vs the
  official registry's ~2 k), previously unlisted here. Submission is via the
  `@lobehub/market-cli` (`lhm plugin submit <repo-url>`) whose flow is **login →
  GitHub ownership-verify → `lhm.plugin.json` manifest → publish**; the login is
  a LobeHub-account/OAuth wall → **founder work, not agent-shippable** (publish
  doc 403s to anonymous fetch, consistent with the gate). Not confirmed to
  auto-ingest the official registry, so a manual submit is required to appear
  *and* to carry the `lobehub` key. Exact payload parked in-row (row #25). Next
  P2 candidate off this lane: ExplainX.ai (discovery aggregator, ~1.2 M monthly
  MCP searches) — mechanism unresearched, queued for a later run.
- **Domain Rating (R-10, `bun scripts/ahrefs-dr.ts` — free Ahrefs public
  endpoint, live 2026-08-12): nlqdb.com 0.0 · docs.nlqdb.com 0.0 · mem0.ai 74.0.**
  Flat across every read since 08-04 — the binding constraint, and the measured
  explanation for every off-page-1 impression row here. R-10's last box (first
  nonzero DR) stays owed; the largest referring-domain events are founder-shaped
  (launch / community posts, `blocked-by-human.md` #1). Referring-domains itself
  is not free-tier readable (`backlinks-stats` is Site-Explorer/paid), so DR
  stays the only free authority read for `nlqdb.com`.
- **GSC** (live 2026-08-12, 28d): **query-level 0 intent-query clicks**;
  page-level **818 impr across 103 pages**. The benchmark queries the R-10(b)
  asset targets still surface off page 1 — "agent memory benchmark" (pos 53),
  "deep memory retrieval benchmark" (pos 52), "locomo benchmark ai memory"
  (pos 83) — consistent with DR 0. One real ICP intent query holds page 1:
  "i need a relational database for ai agent world use cases like planning,
  retrieval, and action execution. what tools fit best in 2026?" — pos 8.0,
  3 impr. Biggest winnable page stays `solve/running-total-cumulative-sum-in-sql`
  (113 impr / pos 35.5); `security/hall-of-fame` earns 4 page-level clicks
  (pos 13.6) — the site's best converter, off-wedge.
- **Per-URL index truth (URL Inspection API, live 2026-08-12): 4 of 6 wedge
  pages indexed** — `/agents/` (crawled 08-08),
  `solve/best-way-to-store-agent-memory` (07-20),
  `solve/agent-memory-mcp-server` (07-21), and
  `docs.nlqdb.com/agent-memory/` (crawled + indexed 08-11).
  **`solve/build-vs-buy-agent-memory` advanced this cycle: *Discovered — not
  indexed* → *Crawled — currently not indexed*, crawled 2026-08-12** (Google
  fetched it for the first time; indexing decision still pending).
  `solve/expire-old-agent-memory` is **still unknown to Google (NEVER CRAWLED)**
  despite inbound internal links from three indexed solve pages + `/agents` —
  the internal-link lever is fully applied, so this residual pins the constraint
  to authority (DR 0), not link discovery. Both internal-link levers (`/agents`
  hub + Footer) re-confirm at the R-08 check 08-22.
- Registry/directory listings (carried forward, not re-verified this cycle):
  official registry ✅ · Smithery parked · Glama badge + connector claim awaiting
  external review · mcp.so approval queue · Cursor submitted · `mcp.directory`
  re-check 08-22 · `awesome-mcp-servers` #10984 PR open · Anthropic connector dir
  founder/money-gated · PulseMCP re-check 08-22 · Cline #2197 submitted 08-05 ·
  **LobeHub row #25 founder-gated (new this cycle)**. Plugin/skill venues (R-09):
  own marketplace ✅, claudemarketplaces.com ✅ (crawl-fed), SkillsMP ✅,
  `claude-community` submitted 08-05 (pending review), `skillsclaude.org`
  dropped 08-05. **Channels live with attributable yield: 4** (organic, dev.to,
  github, npm; unchanged — `/app/admin` not reachable from here); #12 + #22 +
  #23 + #24 + #25 in-flight/founder-gated, yield 0.
- Coding-agent walker (R-06): **0/1 surfaced** (baseline 2026-07-20). Not
  re-run: no `ANTHROPIC_API_KEY` in this session.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29).
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight,
  yield 0. Install-yield gate (a real `agent-artifacts` visit in `/app/admin`)
  unmeasurable from here.
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10**.
  Monthly; next 2026-08-22, so not re-run this cycle. The AI-crawler robots
  block was lifted by the founder 2026-08-04, so the 08-22 re-check is the first
  read after the fix — and the first with `/agent-memory-benchmarks` live as a
  citable target.
