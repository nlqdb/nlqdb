# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-06 — R-10 (b) linkable asset shipped.** The binding
  constraint below is still authority (DR 0), and the one agent-memory surface
  earning any search impressions is benchmark content — so this cycle pulled
  R-10's remaining agent-doable box: promote the survey blog post into a
  citable standalone asset. Shipped
  [`/agent-memory-benchmarks`](../../../../../apps/web/src/pages/agent-memory-benchmarks.astro)
  — a benchmark-**landscape** reference of the field's suites
  (LoCoMo/LongMemEval/DMR) and the numbers vendors report (Mem0/Zep), every
  figure linked to its primary source (arXiv 2402.17753 / 2410.10813 /
  2310.08560 / 2504.19413 / 2501.13956) and flagged self-reported or disputed,
  plus the independent LoCoMo audit (Penfield Labs: 6.4% of the answer key
  wrong, judge accepts up to 63% of wrong answers, honest ceiling ≈93–94%). It
  carries **no nlqdb score** — the own-results harness (SK-PIVOT-019 / D-07) is
  still corpus-blocked, hard rule 1 — only the field survey + the
  analysis-over-memory gap (every benchmark ✗) and the honest "where a database
  loses" concession. Data + honesty invariants in
  [`memoryBenchmarks.ts`](../../../../../apps/web/src/data/memoryBenchmarks.ts) /
  [`.test.ts`](../../../../../apps/web/src/data/memoryBenchmarks.test.ts) (8
  tests, all green: no self-score, ≥1 dispute, the concession, live source
  URLs). In sitemap + `llms.txt` `## Pages` + a Footer link so it isn't the
  orphan the never-crawled `/solve` wedge pages are. R-10's last box stays
  owed: (c) a first nonzero DR / referring-domain read.
- **Domain Rating (R-10, `bun scripts/ahrefs-dr.ts` — free Ahrefs endpoint,
  live 2026-08-06): nlqdb.com 0.0 · docs.nlqdb.com 0.0 · mem0.ai 74.0**
  (github.com, where the two repo-linked listings point, is 97.0). Unchanged
  from the 08-04/08-05 reads — the binding constraint, and the measured
  explanation for every flat row here. Attacked by R-10 (b/c); (c) still owed.
- **GSC** (live 2026-08-06): **page-level 793 impr across 95 pages**;
  **intent-query clicks 0** (13 intent-filtered queries, 35 impr, all 0 clicks).
  The benchmark queries the new asset targets are exactly what surfaces —
  "agent memory benchmark" (pos 53, 2 impr), "deep memory retrieval benchmark"
  (pos 52), "locomo benchmark ai memory" (pos 83) — all off page 1, consistent
  with DR 0; the R-10(b) asset exists to give those queries a stronger, more
  linkable target than a blog post. One real ICP intent query now lands on
  **page 1**: "i need a relational database for ai agent world use cases like
  planning, retrieval, and action execution. what tools fit best in 2026?" —
  pos 8.0, 3 impr. Biggest winnable page stays
  `solve/running-total-cumulative-sum-in-sql` (126 impr / pos 36.1);
  `security/hall-of-fame` earns 4 of the ~7 page-level clicks.
- **Per-URL index truth (URL Inspection API, live 2026-08-06): 3 of 6 wedge
  pages indexed** — `/agents/` (crawled 08-02),
  `solve/best-way-to-store-agent-memory` (07-20),
  `solve/agent-memory-mcp-server` (07-21). `solve/build-vs-buy-agent-memory` +
  `solve/expire-old-agent-memory` are **still never crawled**, and
  `docs/agent-memory` remains unknown to Google — the crawl-priority levers for
  exactly this (#888 internal links, #892 docs-site sitemap) verify at the R-08
  check 08-22; the new `/agent-memory-benchmarks` page ships with a Footer +
  sitemap + llms.txt inbound path precisely to avoid joining that
  never-crawled set.
- Registry/directory listings (carried forward, not re-verified this cycle —
  the lever was R-10(b)): official registry #3 ✅ · Smithery #4 ✅ · Glama #6
  badge + connector claim awaiting external review · mcp.so #7 approval queue ·
  Cursor #8 submitted · `mcp.directory` #23 re-check 08-22 · `awesome-mcp-servers`
  #10 PR open, awaiting maintainer review · Anthropic connector dir #9
  founder/money-gated · PulseMCP #5 re-checks 08-22 · Cline #24 submitted 08-05
  (issue #2197, awaiting review). Plugin/skill venues (R-09): own marketplace ✅,
  claudemarketplaces.com ✅ (crawl-fed), SkillsMP ✅, `claude-community`
  submitted 08-05 (pending review), `skillsclaude.org` dropped 08-05.
  **Channels live with attributable yield: 4** (organic, dev.to, github, npm);
  #12 + #22 + #23 + #24 in-flight, yield 0.
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
