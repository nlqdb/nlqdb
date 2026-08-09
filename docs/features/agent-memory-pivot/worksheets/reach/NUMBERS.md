# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-09 — NULL run + one ledger advance (row #20 Astro mechanism
  verified).** No Done-when box is agent-flippable this cycle: R-07 and R-09
  both gate on a *real* `/app/admin` visit (`agent-artifacts` / `claude-plugin`
  yield), and R-10's last box gates on a *first nonzero DR read* — all three are
  measurement outcomes I can't force from here, and DR is still 0 (below). The
  two agent-doable crawl levers (the `/agents`-hub block, then last cycle's
  site-wide Footer link) are deployed and verify at the R-08 index re-check
  (2026-08-22). **The new signal this cycle:** `/agents/` was **re-crawled
  2026-08-08** (was 08-02) — so Googlebot has now *seen* the hub-link lever —
  yet the two target solve pages are **still NEVER CRAWLED**. Read straight:
  internal links from a DR-0 hub don't get low-priority pages crawled; the
  binding constraint is **authority**, re-confirmed (and `/daily`'s own null run
  #955 reaches the same conclusion independently — "the gap is off-page
  authority and the human-gated launch, neither an in-container daily lever").
  Diversifying off the crawl-link lane per anti-rut, this cycle did the ledger's
  prescribed row-#20 action instead — **P2-verify one integration-marketplace
  venue's submission mechanism** — and recorded it (Astro integrations, below).
  No box flips; this is honest measurement + one durable ledger advance, not a
  content pull.
- **Astro integrations directory (ledger row #20, P2 2026-08-09).** Mechanism
  verified live: listing requires (1) the package **published to npm** carrying
  the `astro-integration` keyword, then (2) a GitHub issue on `withastro/astro`
  to be added/customised (name/description/homepage). `@nlqdb/astro` is
  `private: true` @ `0.0.0` — **unpublished**, so the venue is **blocked on a
  publish decision**, which is a framework-wrappers / `/daily` release call
  (touches `packages/astro/**`), not a reach action. Parked as row #20's next
  concrete step; a genuine authority candidate (astro.build is a real referring
  domain) the moment the wrapper ships. Source:
  <https://docs.astro.build/en/guides/integrations/>.
- **Domain Rating (R-10, `bun scripts/ahrefs-dr.ts` — free Ahrefs public
  endpoint, live 2026-08-09): nlqdb.com 0.0 · docs.nlqdb.com 0.0 · mem0.ai 74.0**
  (github.com, where the two repo-linked listings point, is 97.0). Unchanged
  across every read since 08-04 — the binding constraint, and the measured
  explanation for every flat row here. R-10's last box (first nonzero DR) stays
  owed; the largest referring-domain events are founder-shaped (launch /
  community posts, `blocked-by-human.md` #1). **P2 note (no action needed):**
  the free `domain-rating-free` endpoint goes **auth-mandatory 2026-08-10** —
  `ahrefs-dr.ts` already sends `Authorization: Bearer`, so it is future-proofed.
  Referring-domains itself is **not** free-tier readable (`backlinks-stats` is
  Site-Explorer/paid; free test queries only accept `ahrefs.com`/`wordcount.com`
  targets) — so DR stays the only free authority read for `nlqdb.com`; do not
  re-explore a free refdomains pull.
- **GSC** (live 2026-08-09): **page-level 858 impr across 92 pages**;
  **intent-query clicks 0**. The benchmark queries the R-10(b) asset targets are
  what surfaces — "agent memory benchmark" (pos 53, 2 impr), "deep memory
  retrieval benchmark" (pos 52), "locomo benchmark ai memory" (pos 83) — all off
  page 1, consistent with DR 0. One real ICP intent query holds **page 1**: "i
  need a relational database for ai agent world use cases like planning,
  retrieval, and action execution. what tools fit best in 2026?" — pos 8.0, 3
  impr. Biggest winnable page stays `solve/running-total-cumulative-sum-in-sql`
  (137 impr / pos 35.5); `security/hall-of-fame` earns 4 of the ~8 page-level
  clicks (pos 13.6) — the site's best converter, off-wedge.
- **Per-URL index truth (URL Inspection API, live 2026-08-09): 3 of 6 wedge
  pages indexed** — `/agents/` (**re-crawled 08-08**, was 08-02),
  `solve/best-way-to-store-agent-memory` (07-20),
  `solve/agent-memory-mcp-server` (07-21). `solve/build-vs-buy-agent-memory` +
  `solve/expire-old-agent-memory` are **still NEVER CRAWLED** despite the hub
  page above now being re-crawled — the acute symptom that pins the constraint
  to authority, not link discovery. `docs/agent-memory` remains **unknown to
  Google**. The docs-page crawl lever (#892 docs-site sitemap) and both
  internal-link levers verify together at the R-08 check 08-22.
- Registry/directory listings (carried forward, not re-verified this cycle —
  the lever was ledger row #20 venue research): official registry ✅ · Smithery
  parked · Glama badge + connector claim awaiting external review · mcp.so
  approval queue · Cursor submitted · `mcp.directory` re-check 08-22 ·
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
