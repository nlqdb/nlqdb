# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-10 — NULL run + one ledger advance (row #20: Neon + Vercel
  mechanisms P2-verified).** No Done-when box is agent-flippable this cycle,
  identical to 08-09: R-07 and R-09 both gate on a *real* `/app/admin` visit
  (`agent-artifacts` / `claude-plugin` yield) and R-10's last box on a *first
  nonzero DR read* — all three are measurement outcomes I can't force from here,
  and DR is still 0 (below). The two crawl levers (`/agents`-hub block, site-wide
  Footer link) are deployed and verify at the R-08 index re-check (2026-08-22).
  Nothing changed since 08-09 in the measured surface: DR flat at 0, index flat
  at 3/6, and the two target solve pages are **still NEVER CRAWLED** despite
  `/agents/` being re-crawled 08-08 — the constraint is **authority**, not link
  discovery, re-confirmed. Diversifying off the crawl-link lane per anti-rut
  (last cycle did Astro), this cycle continued the ledger row-#20 sweep —
  **P2-verify the next two integration-marketplace venues' submission
  mechanisms** — and recorded them (Neon + Vercel, below). No box flips; honest
  measurement + one durable ledger advance, not a content pull.
- **Integration marketplaces (ledger row #20, P2 2026-08-10):**
  - **Neon partner program** — mechanism verified live: a formal **OAuth/API
    business partnership** applied for through Neon's support/partner channels
    (not a self-serve listing form), granting API-based DB-provisioning
    integration. Account-walled + a business call → **founder/blocked-by-human**,
    like the Neon side of any partner directory. A genuine referring domain
    (neon.com, DR high) and an authentic fit (nlqdb runs on Neon, Phase 0) the
    moment the founder opens the partnership. Sources:
    <https://neon.com/partners>, <https://neon.tech/docs/guides/partner-get-started>.
  - **Vercel Templates** — mechanism verified live: primary path is an
    **account-walled marketplace submission form**; the alternative
    `vercel/examples` **GitHub PR** path requires an **MIT** `LICENSE`, a
    `README.md`/`package.json` in the repo's template shape, **and a deployable
    demo URL Vercel itself hosts** (a real Next.js-on-nlqdb starter). Agent-
    *buildable* but not a one-run diff, and the MIT requirement must not leak
    into any nlqdb-product license claim (FSL-1.1, GLOBAL-019 — an example
    starter that only consumes `@nlqdb/*` can be MIT; nlqdb itself stays FSL).
    Parked as row #20's next concrete step; strong authority (vercel.com DR ~93)
    once a starter + demo exist. Sources:
    <https://github.com/vercel/examples>,
    <https://community.vercel.com/t/submitting-a-template/6016>.
  - Row #20 sweep so far: Astro (blocked on wrapper publish, 08-09), Neon
    (founder/partnership), Vercel (starter + demo build). Remaining untried:
    Supabase integrations — next run.
- **Domain Rating (R-10, `bun scripts/ahrefs-dr.ts` — free Ahrefs public
  endpoint, live 2026-08-10): nlqdb.com 0.0 · docs.nlqdb.com 0.0 · mem0.ai 74.0**
  (github.com, where the two repo-linked listings point, is 97.0). Unchanged
  across every read since 08-04 — the binding constraint, and the measured
  explanation for every flat row here. R-10's last box (first nonzero DR) stays
  owed; the largest referring-domain events are founder-shaped (launch /
  community posts, `blocked-by-human.md` #1). **P2 note (no action needed):**
  the free `domain-rating-free` endpoint went **auth-mandatory 2026-08-10** —
  `ahrefs-dr.ts` already sends `Authorization: Bearer`, so this cycle's read
  confirms it stays functional past the cutover. Referring-domains itself is
  **not** free-tier readable (`backlinks-stats` is Site-Explorer/paid) — so DR
  stays the only free authority read for `nlqdb.com`; do not re-explore a free
  refdomains pull.
- **GSC** (live 2026-08-10, 28d 07-11→08-08): **query-level 9 clicks / 612 impr
  / pos 19.4**; **page-level 807 impr across 94 pages**; **intent-query clicks 0**.
  The benchmark queries the R-10(b) asset targets are what surfaces — "agent
  memory benchmark" (pos 53, 2 impr), "deep memory retrieval benchmark" (pos 52),
  "locomo benchmark ai memory" (pos 83) — all off page 1, consistent with DR 0.
  One real ICP intent query holds **page 1**: "i need a relational database for
  ai agent world use cases like planning, retrieval, and action execution. what
  tools fit best in 2026?" — pos 8.0, 3 impr. Biggest winnable page stays
  `solve/running-total-cumulative-sum-in-sql` (112 impr / pos 35.7);
  `security/hall-of-fame` earns 4 page-level clicks (pos 13.6) — the site's best
  converter, off-wedge.
- **Per-URL index truth (URL Inspection API, live 2026-08-10): 3 of 6 wedge
  pages indexed** — `/agents/` (crawled 08-08),
  `solve/best-way-to-store-agent-memory` (07-20),
  `solve/agent-memory-mcp-server` (07-21). `solve/build-vs-buy-agent-memory` +
  `solve/expire-old-agent-memory` are **still NEVER CRAWLED** despite the hub
  page being re-crawled 08-08 — the acute symptom pinning the constraint to
  authority, not link discovery. `docs/agent-memory` remains **unknown to
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
