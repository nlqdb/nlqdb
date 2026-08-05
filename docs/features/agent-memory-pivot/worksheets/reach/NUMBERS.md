# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-05 — R-10 (a) homepage-link sweep done.** The one binding
  constraint every flat number below shares is authority (DR 0 / ~zero
  referring domains), so this cycle pulled R-10's lowest agent-doable box: the
  homepage-link sweep — re-verify that every live listing/venue routes its
  homepage/website link (the DR-carrying one) at an `nlqdb.com` URL with its
  utm key, **not** `github.com/nlqdb/nlqdb` (DR-97 github absorbs the equity).
  **Result: clean** — see the sweep block below; box ticked in `INDEX.md`.
  R-10's other two boxes stay owed: (b) the linkable benchmark asset, (c) a
  first nonzero DR/referring-domain read.
- **Homepage-link sweep (R-10 a, live-verified 2026-08-05):** every venue that
  exposes a homepage/website field routes it at `nlqdb.com`, none at the repo:
  - **Live-fetched this cycle (P2):** MCP registry #3 `websiteUrl` =
    `nlqdb.com/agents/?utm_source=mcp-registry` ✓ · npm #17 `@nlqdb/mcp@0.1.1`
    `homepage` = `nlqdb.com/agents/?utm_source=npm` ✓ (0.1.1 live on the
    registry) · Glama server #6 renders the README CTA → `nlqdb.com/?utm_source=github` ✓
    (nlqdb.com destination, not github).
  - **In-repo source-of-truth (feeds the venues):** all three npm `homepage`
    fields → `nlqdb.com/…?utm_source=npm`; the Claude-plugin `plugin.json`
    homepage → `docs.nlqdb.com/agent-memory/?utm_source=claude-plugin`. Every
    `repository`/`owner`/`author` github link is a repo field, not a homepage.
  - **Carried from the ledger:** Smithery #4 `nlqdb.com/agents/?utm_source=smithery`;
    mcp.so #7 / Cursor #8 / `mcp.directory` #23 payloads all
    `nlqdb.com/agents/?utm_source=<key>`; dev.to read-through `?utm_source=devto`;
    README CTA `?utm_source=github`.
  - **Only github-destination listings:** #10 `awesome-mcp-servers` + #24 Cline
    — both repo-linked with **no homepage field by venue design**; their yield
    rolls into `github`/organic refs. Inherent, not fixable.
  - **Out of R-10-(a) scope (noted for the next run, not touched):**
    `.well-known/ai-catalog.json`'s Server-Card `websiteUrl` = `nlqdb.com/agents/`
    carries no utm key — but it is an SK-WEB-028 machine-discovery card, not a
    ledger venue, and its consumers (AI crawlers / answer engines) are
    ref-attributed (ledger #11), so link equity is fine (nlqdb.com) and adding a
    marketing param would fight SK-WEB-028's "describe the canonical server".
- **Domain Rating (R-10, `bun scripts/ahrefs-dr.ts` — free Ahrefs endpoint,
  2026-08-05): nlqdb.com 0.0 · docs.nlqdb.com 0.0 · mem0.ai 74.0** (github.com,
  where the two repo-linked listings point, is 97.0). Unchanged from the
  2026-08-04 first read — the binding constraint, and the measured explanation
  for every flat row here. Attacked by R-10 (b/c), still owed.
- **GSC** (live 2026-08-05): **page-level 773 impr / 2 clicks across 95 pages**;
  **intent-query clicks 0**. The four stage-0 agent-memory solve pages still
  earn zero impressions; the only agent-memory *queries* that surface are
  off-page-1 and benchmark-blog-earned ("agent memory benchmark" pos 53, "deep
  memory retrieval benchmark" pos 52, "locomo benchmark ai memory" pos 83) — the
  same picture as the last read, consistent with DR 0. Biggest winnable page
  stays `solve/running-total-cumulative-sum-in-sql` (121 impr / pos 36.3, still
  off page 1); `security/hall-of-fame` earns 4 of the clicks.
- **Per-URL index truth (URL Inspection API): 3 of 6 wedge pages indexed** —
  `/agents/` (crawled 08-02), `solve/best-way-to-store-agent-memory` (07-20),
  `solve/agent-memory-mcp-server` (07-21); the last two still earn 0 impressions
  (ranking gap, not indexing). `solve/build-vs-buy-agent-memory` +
  `solve/expire-old-agent-memory` are **still never crawled**, and
  `docs/agent-memory` remains uncrawled — the two crawl-priority levers targeting
  exactly this (#888 `/solve↔/solve` internal links, #892 docs-site sitemap) are
  **mid-flight, verified at the R-08 check 08-22**; not re-touched this cycle
  (a third crawl lever would confound their attribution).
- Registry/directory listings (carried forward): official registry #3 ✅ active
  (`websiteUrl` re-verified live 08-05) · Smithery #4 ✅ · Glama #6 badge pushed +
  connector claimed 2026-08-04, awaiting external review (server page re-fetched
  live 08-05) · mcp.so #7 approval queue (absent 08-04) · Cursor #8 submitted
  (absent 08-04) · `mcp.directory` #23 absent (re-check 08-22) ·
  `awesome-mcp-servers` #10 PR open, badge pushed, awaiting maintainer review ·
  Anthropic connector dir #9 founder/money-gated · PulseMCP #5 re-checks 08-22 ·
  Cline #24 payload parked (founder queue #3). Plugin/skill venues (R-09): own
  marketplace ✅, claudemarketplaces.com ✅ (crawl-fed), SkillsMP ✅,
  `claude-community` payload parked, `skillsclaude.org` payload parked.
  **Channels live with attributable yield: 4** (organic, dev.to, github, npm);
  #12 + #22 + #23 + #24 in-flight/parked, yield 0.
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
  Monthly; next 2026-08-22, so not re-run this cycle. Context for the re-check:
  AI crawlers (GPTBot / ClaudeBot / CCBot / Meta-ExternalAgent) were
  robots-blocked by a Cloudflare managed policy until 2026-08-04, when the
  founder disabled it (`founder-actions-log.md` Era 5) — the 0/10 baseline
  predates the fix.
