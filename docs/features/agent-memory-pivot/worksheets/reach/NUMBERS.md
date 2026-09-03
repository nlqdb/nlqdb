# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-09-03 — DR holds 0.1 (second consecutive read); one new R-09
  venue added from the P2 sweep.** `bun scripts/ahrefs-dr.ts` (free Ahrefs
  public endpoint): **nlqdb.com 0.1 · docs.nlqdb.com 0.1 · mem0.ai 74.0**. Both
  nlqdb domains read 0.1 last cycle (09-02) and again today — the first time
  since the 08-31 first-nonzero read that two consecutive cycles agree, so the
  0.0↔0.1 flicker has settled onto 0.1, but this is still the floor, **not** a
  durable climb: the ≈74-point gap to mem0.ai is unchanged. R-10 stays complete;
  **authority has not durably left zero**, so the binding constraint on the wedge
  (authority, not content or indexing) still holds, and the largest
  referring-domain events remain founder-shaped (launch / community posts,
  `blocked-by-human.md` #1). Referring-domain **count** is still not free-tier
  readable (`backlinks-stats` is paid Site-Explorer), so DR stays the only free
  authority read for `nlqdb.com`.
- **GSC** (live 2026-09-03, 28d 08-04→09-01): **9 clicks / 866 impr / pos
  26.7**; **query-level 0 intent-query clicks** (unchanged). Wedge pages keep
  earning impressions just off the fold: `solve/expire-old-agent-memory` 26 impr
  pos 11.3, `solve/build-vs-buy-agent-memory` 22 impr pos 11.4, `/agents/` 25
  impr pos 16.0 — impressions without clicks, the signature of DR-0 ranking just
  off page 1. Biggest winnable pages stay the SQL-recipe long tail (`solve/`
  index 91 impr pos 35.1; `solve/countif-sumif-conditional-aggregate-in-sql` 74
  impr pos 21.6; `solve/running-total-cumulative-sum-in-sql` 64 impr pos 42.6);
  `security/hall-of-fame` earns 3 of the site's 9 clicks (pos 33.2), still the
  best off-wedge converter. Sitemap: 126 submitted.
- **Per-URL index truth (URL Inspection API, live 2026-09-03): 6 of 6 wedge
  pages indexed** — `/agents/` (crawled 08-31),
  `solve/best-way-to-store-agent-memory` (08-12),
  `solve/build-vs-buy-agent-memory` (re-crawled 09-01),
  `solve/expire-old-agent-memory` (re-crawled 09-01),
  `solve/agent-memory-mcp-server` (08-13), and
  `docs.nlqdb.com/agent-memory/` (08-28). Internal-link + indexing levers remain
  exhausted and fully paid off; the residual is authority (DR at the floor).
- **New venue this cycle (R-09 #6 — P2 sweep, 2026-09-03):** **cc-marketplace /
  `claudecodecommands.directory`** ([`ananddtyagi/cc-marketplace`](https://github.com/ananddtyagi/cc-marketplace),
  688★, 68 commits, actively maintained; built by @ananddtyagi) — a community
  Claude Code plugin/command directory (`/plugin marketplace add
  ananddtyagi/cc-marketplace`). Passes the trust bar `skillsclaude.org` failed
  (real independent footprint, named maintainer, appears in multiple 2026 MCP/
  plugin-directory guides). Submission is a **cross-repo GitHub PR** to their
  repo per [`PLUGIN_SCHEMA.md`](https://github.com/ananddtyagi/cc-marketplace/blob/main/PLUGIN_SCHEMA.md)
  (validation via GitHub Actions), plus a web form at
  `claudecodecommands.directory/submit` — out of this session's `nlqdb/nlqdb`
  repo scope, so the exact payload is parked (ledger row #27 +
  [mechanism notes](../../../../research/acquisition-channels-mechanisms.md#row-27)).
  Listings link the repo / internal command pages, not a homepage we control →
  `github`-ref yield like #24 Cline. R-09 venue #6 ticked (payload parked).
- **Registry / directory listings — carried forward from the 2026-09-02 live
  re-check (state unchanged):** Official MCP registry `com.nlqdb/nlqdb` v0.1.1
  active; Glama live A-grade `author:official`; Smithery live 90/100; mcp.so
  (403) + Cursor directory (429) still bot-walled, in-flight; PulseMCP (#5) +
  mcp.directory (#23) parked for the founder (cascade miss confirmed ~40 days
  post-publish); Anthropic connector dir (money-gated), `awesome-mcp-servers`
  #10984, Cline #2197, LobeHub #25, ExplainX #26 carried forward. Plugin/skill
  venues (R-09): own marketplace ✅, claudemarketplaces.com ✅ (crawl-fed),
  SkillsMP ✅, `claude-community` submitted 08-05 (pending), `skillsclaude.org`
  dropped 08-05, **cc-marketplace #6 payload parked 09-03**.
- **Channels live with attributable yield: 4** (organic, dev.to, github, npm;
  unchanged — `/app/admin` not reachable from here). #3/#4/#5/#6/#7/#8/#9/#12/
  #22/#23/#24/#25/#26/#27 in-flight, untried, or founder-gated, yield 0.
- **Answer-engine retrieval presence (R-08): 0/10**, carried forward from the
  08-31 monthly check. Next monthly check due **2026-09-30** (not due this
  cycle). Grounding stays dominated by mem0/zep/letta/hindsight + hyperscaler
  docs; 0 grounding sets contain `nlqdb.com`, consistent with DR at the floor.
- **Coding-agent walker (R-06): 0/1 surfaced**, carried forward from the 08-31
  re-run (`first_rw=blocked_oauth`; cold agent recommended
  mem0/zep/letta/langmem/pgvector/supabase/pinecone/chroma/weaviate/redis, never
  named nlqdb). Not re-run this cycle — walker code unchanged since 08-31 and the
  result is authority-bound; DR still at the floor is the leading indicator that
  it stays 0/1. Result JSON is gitignored (a read-only measurement).
- **Domain Rating (R-10): nlqdb.com 0.1 · docs.nlqdb.com 0.1 · mem0.ai 74.0**
  (see cycle note above). R-10 stays complete; authority has not durably left
  zero.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29).
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight,
  yield 0. Install-yield gate (a real `agent-artifacts` visit in `/app/admin`)
  unmeasurable from here — stays owed.
- Host plugin/skill venues (R-09): **6/6 venues resolved** (cc-marketplace #6
  added this cycle); install-yield gate (one real `claude-plugin` visit in
  `/app/admin`) unmeasurable from here — stays owed.

**This cycle's finding:** the R-09 slice moved — the P2 venue sweep surfaced a
new, vetted (688★, real footprint), on-thesis Claude Code plugin directory
(cc-marketplace / `claudecodecommands.directory`), added as ledger row #27 and
R-09 venue #6 with the exact submission payload parked (cross-repo PR + web form,
out of this session's repo scope → founder / repo-unscoped agent work). Both
still-owed R-07 / R-09 ⬜ boxes are `/app/admin`-gated yield gates, unmeasurable
from the loop; the only measured state change is DR settling onto 0.1 for a
second consecutive read — still the floor, so authority remains the binding
constraint and the largest remaining levers stay founder-shaped (launch /
community posts).
