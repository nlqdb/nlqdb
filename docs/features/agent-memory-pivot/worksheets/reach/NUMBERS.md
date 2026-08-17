# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-17 — the wedge index closed to 6/6 + one durable ledger
  advance (ExplainX.ai added, row #26); no Done-when box agent-flippable.** The
  three still-owed boxes all gate on measurement outcomes I cannot force from
  here: R-07's `agent-artifacts` `/app/admin` visit, R-09's `claude-plugin`
  visit, R-10's first nonzero DR. **Headline measured movement:** all **6 of 6
  wedge pages are now indexed** (was 4/6 on 08-12) — `solve/build-vs-buy-agent-memory`
  advanced *Crawled — not indexed* → **indexed** and `solve/expire-old-agent-memory`
  advanced *never crawled* → **indexed** this cycle. **This sharpens the
  diagnosis:** both link-discovery levers (`/agents` hub + Footer) and the
  indexing lever are now **fully applied and fully paid off** — every wedge page
  Google knows about is indexed. What remains is *ranking*, and ranking is
  authority-bound (DR 0). Index is no longer any part of the constraint; **DR is
  now the sole binding constraint** for the reach surface. Diversifying off the
  exhausted lane per anti-rut, the P2-mandated venue web-search surfaced
  **ExplainX.ai** (~2 k-server MCP directory, "best integrated discovery" per its
  own copy) — absent from the ledger — added as row #26 with its P2-verified
  mechanism + parked founder payload.
- **New venue this cycle — ExplainX.ai MCP directory (ledger row #26, P2
  2026-08-17):** ~2 000 servers, `/submit` flow is **account-required** (founder
  work, not agent-shippable). Guidelines say listings "may be created or updated
  through internal tooling, data partners, or public sources in addition to (or
  instead of) a self-serve submission flow" — i.e. it *may* ingest public
  sources — but measured live this cycle **nlqdb is absent** (`/mcp-servers/nlqdb`
  → 404; not in site search), ~26 days after the official-registry publish. So
  the narrow-cascade finding holds again: registry publish does not propagate
  here, and a manual account-walled submit is required to appear *and* to carry
  the `explainx` key. Exact payload parked in-row + mechanism shard (row #26).
- **Domain Rating (R-10, `bun scripts/ahrefs-dr.ts` — free Ahrefs public
  endpoint, live 2026-08-17): nlqdb.com 0.0 · docs.nlqdb.com 0.0 · mem0.ai 74.0.**
  Flat across every read since 08-04 — the binding constraint, and now (with the
  index closed to 6/6) the *only* remaining explanation for every off-page-1
  impression row here. R-10's last box (first nonzero DR) stays owed; the largest
  referring-domain events are founder-shaped (launch / community posts,
  `blocked-by-human.md` #1). Referring-domains itself is not free-tier readable
  (`backlinks-stats` is Site-Explorer/paid), so DR stays the only free authority
  read for `nlqdb.com`.
- **GSC** (live 2026-08-17, 28d): **12 clicks / 632 impr / pos 21.9**;
  **query-level 0 intent-query clicks**. The one real ICP intent query holds page
  1: "i need a relational database for ai agent world use cases like planning,
  retrieval, and action execution. what tools fit best in 2026?" — pos 8.0, 3
  impr. The R-10(b) benchmark asset **`/agent-memory-benchmarks/` is now indexed
  and earning impressions — 13 impr / pos 14.6** (first time on the page-level
  board), but its target queries still surface off page 1 ("locomo benchmark ai
  memory" pos 83) — consistent with DR 0. Biggest winnable page stays
  `solve/running-total-cumulative-sum-in-sql` (117 impr / pos 36.7);
  `security/hall-of-fame` earns 5 page-level clicks (pos 23.3) — the site's best
  converter, off-wedge.
- **Per-URL index truth (URL Inspection API, live 2026-08-17): 6 of 6 wedge
  pages indexed** — `/agents/` (crawled 08-16),
  `solve/best-way-to-store-agent-memory` (08-12),
  **`solve/build-vs-buy-agent-memory` (indexed this cycle, crawled 08-12)**,
  **`solve/expire-old-agent-memory` (indexed this cycle, crawled 08-12)**,
  `solve/agent-memory-mcp-server` (08-13), and
  `docs.nlqdb.com/agent-memory/` (08-11). **First time all six are indexed** —
  the internal-link + indexing levers are exhausted; the residual is authority.
- Registry/directory listings (carried forward, not re-verified this cycle):
  official registry ✅ · Smithery parked · Glama badge + connector claim awaiting
  external review · mcp.so approval queue · Cursor submitted · `mcp.directory`
  re-check 08-22 · `awesome-mcp-servers` #10984 PR open · Anthropic connector dir
  founder/money-gated · PulseMCP re-check 08-22 · Cline #2197 submitted 08-05 ·
  LobeHub row #25 founder-gated · **ExplainX.ai row #26 founder-gated (new this
  cycle)**. Plugin/skill venues (R-09): own marketplace ✅,
  claudemarketplaces.com ✅ (crawl-fed), SkillsMP ✅, `claude-community`
  submitted 08-05 (pending review), `skillsclaude.org` dropped 08-05. **Channels
  live with attributable yield: 4** (organic, dev.to, github, npm; unchanged —
  `/app/admin` not reachable from here); #12 + #22 + #23 + #24 + #25 + #26
  in-flight/founder-gated, yield 0.
- Coding-agent walker (R-06): **0/1 surfaced** (baseline 2026-07-20). Not
  re-run: the walker spawns a nested `claude -p` cold session (needs the `claude`
  CLI with working credentials), unavailable in this session.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29).
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight,
  yield 0. Install-yield gate (a real `agent-artifacts` visit in `/app/admin`)
  unmeasurable from here.
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10**.
  Monthly; next 2026-08-22, so not re-run this cycle. The AI-crawler robots
  block was lifted by the founder 2026-08-04, so the 08-22 re-check is the first
  read after the fix — and the first with `/agent-memory-benchmarks` live +
  indexed as a citable target.
