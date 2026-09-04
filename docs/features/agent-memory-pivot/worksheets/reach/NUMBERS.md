# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-09-04 — DR holds 0.1 (third consecutive read); R-09's parked
  cc-marketplace venue surfaced into the founder queue so it is actionable, not
  research-only.** `bun scripts/ahrefs-dr.ts` (free Ahrefs public endpoint):
  **nlqdb.com 0.1 · docs.nlqdb.com 0.1 · mem0.ai 74.0**. Both nlqdb domains read
  0.1 on 09-02, 09-03 and again today — three consecutive cycles agree, so the
  0.0↔0.1 flicker is firmly settled onto 0.1, but this is still the floor,
  **not** a durable climb: the ≈74-point gap to mem0.ai is unchanged. R-10 stays
  complete; **authority has not durably left zero**, so the binding constraint on
  the wedge (authority, not content or indexing) still holds, and the largest
  referring-domain events remain founder-shaped (launch / community posts,
  `blocked-by-human.md` #1). Referring-domain **count** is still not free-tier
  readable (`backlinks-stats` is paid Site-Explorer), so DR stays the only free
  authority read for `nlqdb.com`.
- **GSC** (live 2026-09-04, 28d 08-05→09-02): **9 clicks / 875 impr / pos
  26.4**; **query-level 0 intent-query clicks** (unchanged). Wedge pages keep
  earning impressions just off the fold: `solve/expire-old-agent-memory` 31 impr
  pos 11.8, `solve/build-vs-buy-agent-memory` 25 impr pos 12.3, `/agents/` 27
  impr pos 15.3 — impressions without clicks, the signature of DR-0 ranking just
  off page 1. Biggest winnable pages stay the SQL-recipe long tail (`solve/`
  index 92 impr pos 34.8; `solve/countif-sumif-conditional-aggregate-in-sql` 75
  impr pos 21.3; `solve/running-total-cumulative-sum-in-sql` 62 impr pos 43.0);
  `security/hall-of-fame` earns 3 of the site's 9 clicks (pos 31.6), still the
  best off-wedge converter. Sitemap: 126 submitted.
- **Per-URL index truth (URL Inspection API, live 2026-09-04): 6 of 6 wedge
  pages indexed** — `/agents/` (crawled 08-31),
  `solve/best-way-to-store-agent-memory` (08-12),
  `solve/build-vs-buy-agent-memory` (re-crawled 09-01),
  `solve/expire-old-agent-memory` (re-crawled 09-01),
  `solve/agent-memory-mcp-server` (08-13), and
  `docs.nlqdb.com/agent-memory/` (08-28). Internal-link + indexing levers remain
  exhausted and fully paid off; the residual is authority (DR at the floor).
- **This cycle's R-09 move (2026-09-04):** the cc-marketplace /
  `claudecodecommands.directory` venue (added last cycle as ledger #27 / R-09
  venue #6) had its exact `nlqdb-memory` payload parked only in the ledger +
  [mechanism notes](../../../../research/acquisition-channels-mechanisms.md#row-27),
  which the founder does not read — so the venue was findable but **not
  submittable**. Surfaced it into [`blocked-by-human.md` #4](../../../../blocked-by-human.md)
  (the single file the founder reads; hard rule: account-walled submissions →
  founder queue), pointing at the parked payload rather than duplicating it, and
  flipped the ledger #27 disposition to founder-queued. Now actionable in ~10 min
  (cross-repo PR or web form); lowest yield in the queue (`github`-ref, no utm
  key), slotted below the two directory submits at #3.
- **Registry / directory listings — carried forward from the 2026-09-02 live
  re-check (state unchanged):** Official MCP registry `com.nlqdb/nlqdb` v0.1.1
  active; Glama live A-grade `author:official`; Smithery live 90/100; mcp.so
  (403) + Cursor directory (429) still bot-walled, in-flight; PulseMCP (#5) +
  mcp.directory (#23) parked for the founder (cascade miss confirmed ~40 days
  post-publish, blocked-by-human #3); Anthropic connector dir (money-gated),
  `awesome-mcp-servers` #10984, Cline #2197, LobeHub #25, ExplainX #26 carried
  forward. Plugin/skill venues (R-09): own marketplace ✅, claudemarketplaces.com
  ✅ (crawl-fed), SkillsMP ✅, `claude-community` submitted 08-05 (pending),
  `skillsclaude.org` dropped 08-05, **cc-marketplace #6 founder-queued 09-04**.
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
  founder-queued this cycle); install-yield gate (one real `claude-plugin` visit
  in `/app/admin`) unmeasurable from here — stays owed.

**This cycle's finding:** the only measured state change is DR settling onto 0.1
for a third consecutive read — still the floor, so authority remains the binding
constraint and the largest remaining levers stay founder-shaped (launch /
community posts). The R-09 slice moved without waiting on that: last cycle's
cc-marketplace venue was parked only in research docs the founder doesn't read,
leaving it findable but un-submittable; this cycle surfaced its exact payload
into the founder queue (`blocked-by-human.md` #4) so the venue is actually
actionable, closing the account-walled-submission honesty gate. Both still-owed
R-07 / R-09 ⬜ boxes remain `/app/admin`-gated yield gates, unmeasurable from the
loop.
