# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-07 — R-10 crawl-priority lever: link the indexed `/agents`
  hub to the orphaned wedge `/solve` pages.** The binding constraint is still
  authority (DR 0), but this cycle's fresh index read shows the concrete
  symptom the whole reach funnel bleeds through: **two agent-memory wedge
  solve pages are *still* NEVER CRAWLED** — `solve/build-vs-buy-agent-memory`
  and `solve/expire-old-agent-memory` — two-plus weeks after #888 added
  solve↔solve internal links to unstick them. The measured lesson: solve↔solve
  wasn't enough; orphans behind weakly-crawled peers stay orphans. The
  strongest agent-doable crawl lever is an inbound link from an
  **already-indexed, higher-authority** page — and `/agents/` (indexed,
  crawled 2026-08-02, GSC pos 4.8) is the natural agent-memory hub that linked
  to **zero** solve pages. This cycle added a "Guides" block on `/agents`
  linking all four agent-memory `/solve` pages (searcher-phrased anchor text =
  each page's `searchTitle`), giving Google a crawl path from the indexed hub
  to the two orphans. Internal nlqdb.com→nlqdb.com links, so no `utm_source`
  (SK-GTM-007 governs *externally* published URLs). No Done-when box flips —
  DR is still 0 and R-10's sweep/asset boxes are already ✅ — but this is the
  measured lever for the #1 crawl symptom below, a continuation of #888's
  R-02/R-03 unsticking work; the crawl outcome verifies at the R-08 index
  re-read (next 2026-08-22).
- **Domain Rating (R-10, `bun scripts/ahrefs-dr.ts` — free Ahrefs endpoint,
  live 2026-08-07): nlqdb.com 0.0 · docs.nlqdb.com 0.0 · mem0.ai 74.0**
  (github.com, where the two repo-linked listings point, is 97.0). Unchanged
  from the 08-04/08-05/08-06 reads — the binding constraint, and the measured
  explanation for every flat row here. R-10's last box (first nonzero DR) stays
  owed; the largest referring-domain events are founder-shaped (launch /
  community posts, `blocked-by-human.md` #1).
- **GSC** (live 2026-08-07): **page-level 800 impr across 94 pages**;
  **intent-query clicks 0** (13 intent-filtered queries, 35 impr, all 0 clicks).
  The benchmark queries the R-10(b) asset targets are exactly what surfaces —
  "agent memory benchmark" (pos 53, 2 impr), "deep memory retrieval benchmark"
  (pos 52), "locomo benchmark ai memory" (pos 83) — all off page 1, consistent
  with DR 0. One real ICP intent query holds **page 1**: "i need a relational
  database for ai agent world use cases like planning, retrieval, and action
  execution. what tools fit best in 2026?" — pos 8.0, 3 impr. Biggest winnable
  page stays `solve/running-total-cumulative-sum-in-sql` (128 impr / pos 36.0);
  `security/hall-of-fame` earns 4 of the ~7 page-level clicks.
- **Per-URL index truth (URL Inspection API, live 2026-08-07): 3 of 6 wedge
  pages indexed** — `/agents/` (crawled 08-02),
  `solve/best-way-to-store-agent-memory` (07-20),
  `solve/agent-memory-mcp-server` (07-21). `solve/build-vs-buy-agent-memory` +
  `solve/expire-old-agent-memory` are **still NEVER CRAWLED** (the target of
  this cycle's `/agents`-hub link lever), and `docs/agent-memory` remains
  **unknown to Google**. The crawl-priority levers for the docs page (#892
  docs-site sitemap) verify at the R-08 check 08-22; whether the new `/agents`
  hub links pull the two orphaned solve pages into the crawl queue is the
  measurable test of this cycle, read at that same 08-22 index re-check.
- Registry/directory listings (carried forward, not re-verified this cycle —
  the lever was R-10 crawl-priority): official registry ✅ · Smithery parked ·
  Glama badge + connector claim awaiting external review · mcp.so approval
  queue · Cursor submitted · `mcp.directory` re-check 08-22 ·
  `awesome-mcp-servers` #10984 PR open, awaiting maintainer review · Anthropic
  connector dir founder/money-gated · PulseMCP re-check 08-22 · Cline #2197
  submitted 08-05 (awaiting review). Plugin/skill venues (R-09): own
  marketplace ✅, claudemarketplaces.com ✅ (crawl-fed), SkillsMP ✅,
  `claude-community` submitted 08-05 (pending review), `skillsclaude.org`
  dropped 08-05. **Channels live with attributable yield: 4** (organic, dev.to,
  github, npm); #12 + #22 + #23 + #24 in-flight, yield 0.
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
