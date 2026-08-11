# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-11 — NULL run for box-flips + one durable ledger advance
  (row #20 sweep completed: Supabase mechanism P2-verified).** No Done-when
  box is agent-flippable — the three still owed all gate on measurement
  outcomes I cannot force from here: R-07's `agent-artifacts` `/app/admin`
  visit, R-09's `claude-plugin` visit, R-10's first nonzero DR. **But the
  measured surface moved in the right direction this cycle:** the docs-page
  crawl lever landed — `docs.nlqdb.com/agent-memory/` went from *unknown to
  Google* (08-10) to **Submitted and indexed, crawled 2026-08-11** (today),
  taking wedge-page index from **3/6 → 4/6**, and `solve/build-vs-buy-agent-memory`
  advanced *unknown → Discovered - currently not indexed* (Google now knows it).
  This is the earliest of the levers that were queued to verify at the R-08
  check (2026-08-22) — it arrived ahead of cadence. Authority (DR 0) is still
  the binding constraint on ranking, unchanged. Diversifying off the crawl-link
  lane per anti-rut, this cycle finished the ledger row-#20 integration-marketplace
  sweep with its last untried venue (Supabase) — recorded below. No box flips;
  honest measurement + one durable ledger advance, not a content pull.
- **Integration marketplaces (ledger row #20) — sweep now COMPLETE, all four
  founder/build-gated, none agent-shippable as a one-run diff:**
  - **Supabase Partner Catalog (P2 2026-08-11):** apply via a ~30-second form
    at <https://supabase.com/partners>; listing gates on **business viability**
    (official business registration + bank account, meaningful revenue, or VC
    backing) + own T&C/Privacy/AUP + a "Supabase"-free name — account+business-
    walled → **founder/blocked-by-human-shaped**, and the viability bar may not
    clear at $0 revenue yet. Fit is BYO-only (a Supabase user connects their
    Postgres as a BYO source; nlqdb itself runs on Neon, not Supabase). Sources:
    <https://supabase.com/docs/guides/platform/marketplace>,
    <https://supabase.com/partners>.
  - Prior venues (carried, verified earlier): **Astro (08-09)** — npm-publish
    with the `astro-integration` keyword → withastro/astro issue; blocked,
    `@nlqdb/astro` is `private`. **Neon (08-10)** — formal OAuth/API business
    partnership via support/partner channels → founder; authentic fit (nlqdb
    runs on Neon). **Vercel Templates (08-10)** — account-walled form or a
    `vercel/examples` GitHub PR needing MIT `LICENSE` + template shape + a
    Vercel-hosted demo URL; agent-buildable, not a one-run diff.
  - Row #20 is exhausted: every integration-marketplace venue is founder- or
    build-gated, so no further per-run sweep work remains here. Next lever off
    this lane returns to authority (R-10) or a re-check at the R-08 monthly.
- **Domain Rating (R-10, `bun scripts/ahrefs-dr.ts` — free Ahrefs public
  endpoint, live 2026-08-11): nlqdb.com 0.0 · docs.nlqdb.com 0.0 · mem0.ai 74.0.**
  Flat across every read since 08-04 — the binding constraint, and the measured
  explanation for every off-page-1 impression row here. R-10's last box (first
  nonzero DR) stays owed; the largest referring-domain events are founder-shaped
  (launch / community posts, `blocked-by-human.md` #1). Referring-domains itself
  is not free-tier readable (`backlinks-stats` is Site-Explorer/paid), so DR
  stays the only free authority read for `nlqdb.com`.
- **GSC** (live 2026-08-11, 28d): **query-level 0 intent-query clicks**;
  page-level **838 impr across 105 pages**. The benchmark queries the R-10(b)
  asset targets still surface off page 1 — "agent memory benchmark" (pos 53),
  "deep memory retrieval benchmark" (pos 52), "locomo benchmark ai memory"
  (pos 83) — consistent with DR 0. One real ICP intent query holds page 1:
  "i need a relational database for ai agent world use cases like planning,
  retrieval, and action execution. what tools fit best in 2026?" — pos 8.0,
  3 impr. Biggest winnable page stays `solve/running-total-cumulative-sum-in-sql`
  (117 impr / pos 35.7); `security/hall-of-fame` earns 4 page-level clicks
  (pos 13.6) — the site's best converter, off-wedge.
- **Per-URL index truth (URL Inspection API, live 2026-08-11): 4 of 6 wedge
  pages indexed** (up from 3/6 on 08-10) — `/agents/` (crawled 08-08),
  `solve/best-way-to-store-agent-memory` (07-20),
  `solve/agent-memory-mcp-server` (07-21), and now
  **`docs.nlqdb.com/agent-memory/` (crawled + indexed 08-11)**.
  `solve/build-vs-buy-agent-memory` moved *unknown → Discovered - currently
  not indexed*; `solve/expire-old-agent-memory` is **still unknown to Google
  (NEVER CRAWLED)** — the one acute symptom still pinning the constraint to
  authority, not link discovery. Both internal-link levers ( `/agents` hub +
  Footer) re-confirm at the R-08 check 08-22.
- Registry/directory listings (carried forward, not re-verified this cycle —
  the lever was ledger row #20): official registry ✅ · Smithery parked · Glama
  badge + connector claim awaiting external review · mcp.so approval queue ·
  Cursor submitted · `mcp.directory` re-check 08-22 · `awesome-mcp-servers`
  #10984 PR open · Anthropic connector dir founder/money-gated · PulseMCP
  re-check 08-22 · Cline #2197 submitted 08-05. Plugin/skill venues (R-09):
  own marketplace ✅, claudemarketplaces.com ✅ (crawl-fed), SkillsMP ✅,
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
