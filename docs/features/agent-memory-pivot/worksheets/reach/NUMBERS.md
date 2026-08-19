# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-18 — state flat vs 08-17; slice shipped: made the one
  citable reach asset (`/agent-memory-benchmarks/`) machine-citable.** No
  Done-when box was agent-flippable (all three owed boxes gate on measurement
  outcomes I cannot force from here — R-07's `agent-artifacts` `/app/admin`
  visit, R-09's `claude-plugin` visit, R-10's first nonzero DR). Diversifying
  off the exhausted index/link lane per anti-rut, and targeting the diagnosed
  binding constraint (authority + answer-engine retrieval), this cycle added a
  **schema.org/Dataset JSON-LD node** to `/agent-memory-benchmarks/` — the R-10
  (b) linkable asset. It is what Google Dataset Search and AI answer engines
  index to cite a survey/catalog like this (P2 verified 08-18:
  [Google Dataset docs](https://developers.google.com/search/docs/appearance/structured-data/dataset),
  [schema.org/Dataset](https://schema.org/Dataset),
  [2026 AI-search structured-data guidance](https://www.stackmatix.com/blog/structured-data-ai-search)).
  Derived entirely from `memoryBenchmarks.ts` (can't drift from the rendered
  view); `citation`/`isBasedOn` expose every primary source (arXiv + the LoCoMo
  audit) for a crawler to follow; carries **no nlqdb score** (hard rule 1).
  Lands one week before the R-08 answer-engine retrieval re-check (08-22) — the
  first read after the AI-crawler robots block was lifted (08-04), now with the
  asset both indexed and machine-annotated.
- **Domain Rating (R-10, `bun scripts/ahrefs-dr.ts` — free Ahrefs public
  endpoint, live 2026-08-18): nlqdb.com 0.0 · docs.nlqdb.com 0.0 · mem0.ai
  74.0.** Flat across every read since 08-04 — the **sole binding constraint**
  now the wedge index is closed at 6/6. R-10's last box (first nonzero DR) stays
  owed; the largest referring-domain events are founder-shaped (launch /
  community posts, `blocked-by-human.md` #1). Referring-domains itself is not
  free-tier readable (`backlinks-stats` is Site-Explorer/paid), so DR stays the
  only free authority read for `nlqdb.com`.
- **GSC** (live 2026-08-18, 28d 07-19→08-16): **12 clicks / 625 impr / pos
  21.7**; **query-level 0 intent-query clicks**. The one real ICP intent query
  holds page 1: "i need a relational database for ai agent world use cases like
  planning, retrieval, and action execution. what tools fit best in 2026?" —
  pos 8.0, 3 impr. The R-10(b) benchmark asset **`/agent-memory-benchmarks/` is
  indexed and earning impressions — 13 impr / pos 14.6**, but its target queries
  still surface off page 1 ("locomo benchmark ai memory") — consistent with DR
  0. Biggest winnable page stays `solve/running-total-cumulative-sum-in-sql`
  (114 impr / pos 36.7); `security/hall-of-fame` earns 5 page-level clicks
  (pos 23.3) — the site's best converter, off-wedge.
- **Per-URL index truth (URL Inspection API, live 2026-08-18): 6 of 6 wedge
  pages indexed** — `/agents/` (crawled 08-16),
  `solve/best-way-to-store-agent-memory` (08-12),
  `solve/build-vs-buy-agent-memory` (08-12),
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
- Coding-agent walker (R-06): **0/1 surfaced** (baseline 2026-07-20). Not
  re-run: the walker spawns a nested `claude -p` cold session (needs the `claude`
  CLI with working credentials), unavailable in this session.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29).
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight,
  yield 0. Install-yield gate (a real `agent-artifacts` visit in `/app/admin`)
  unmeasurable from here.
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10**.
  Monthly; next 2026-08-22, so not re-run this cycle — and now the first read
  after both the 08-04 AI-crawler robots unblock and this cycle's Dataset
  markup on the one citable target.
