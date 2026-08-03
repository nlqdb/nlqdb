# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **Cycle 2026-08-03 — slice: wire the docs-site sitemap so the R-04 wedge page
  is discoverable** (crawl-priority lever on the stuck Index-status number, not
  a null run; **non-confounding** with last cycle's solve↔solve experiment —
  different host, different mechanism). Root cause found: `docs.nlqdb.com`'s
  `robots.txt` advertises `sitemap-index.xml`, but **Starlight emits no sitemap
  on its own** — it bundles `@astrojs/sitemap` as a dependency yet leaves it
  unapplied (P2, web-searched 2026-08-03: [Astro sitemap guide](https://docs.astro.build/en/guides/integrations-guide/sitemap/),
  [npm](https://www.npmjs.com/package/@astrojs/sitemap) — the integration must
  be added to `integrations[]`; only then does `astro build` emit
  `sitemap-index.xml` + `sitemap-0.xml`). So the advertised sitemap URL 404'd
  and the docs site's primary machine-discovery channel was a dead link — a
  concrete root cause for `docs.nlqdb.com/agent-memory/` being **"unknown to
  Google, never crawled."** Fix: added `sitemap()` to `astro.config.mjs`
  (+ direct `@astrojs/sitemap` dep, version already resolved via Starlight's
  `^3.7.2`, no lockfile churn beyond the direct-dep line), corrected the
  false "Starlight emits an index" premise in `robots.txt` + SK-DOCS-005, and
  pinned it with `apps/docs/src/sitemap-wired.test.ts` (integration applied /
  direct dep / advertised filename == what `@astrojs/sitemap` emits).
  **Verified against the build:** `sitemap-index.xml` → `sitemap-0.xml` with
  **75 URLs incl. `https://docs.nlqdb.com/agent-memory/`**. **Effect is a
  discovery signal, not an instant index** — verify at the R-08 check (08-22):
  if `docs/agent-memory` is still never-crawled then, the dead-sitemap was not
  the only blocker and the next move is the GSC docs-sitemap console submission
  (a founder action — park it in `blocked-by-human.md`).
- The rest is measurement-only: no `ANTHROPIC_API_KEY` here to re-run the R-06
  walker; R-07/R-09 install-yield gates read from `/app/admin`, not here; R-08's
  answer-engine cadence is next due 2026-08-22.
- GSC (28d, live 2026-08-03, window 07-04→08-01): **8 clicks / 562 impr / pos
  19.3**; intent-query clicks **0** — **15th consecutive flat read**. The four
  stage-0 pages still earn zero impressions, while other agent-memory URLs keep
  earning them (`solve/running-total-cumulative-sum-in-sql` 114 impr,
  `solve/count-rows-per-day-including-missing-dates` 82 impr / pos 8.4 / a click,
  `security/hall-of-fame` 4 of the 8 total clicks). Three agent-memory *queries*
  surfaced but off-page-1, all earned by the benchmark blog, not the stage-0
  solve set: "agent memory benchmark" (pos 53, 2 impr), "deep memory retrieval
  benchmark" (pos 52), "locomo benchmark ai memory" (pos 83). The host ranks
  agent-memory content fine; it is the stage-0 set specifically that earns
  nothing. R-01 baseline, unmoved.
- **Per-URL index truth (URL Inspection API): 3 of 6 wedge pages indexed.**
  `/agents/` indexed (pos 3.0, the strongest indexed wedge page),
  `solve/best-way-to-store-agent-memory` (crawled 07-20) and
  `solve/agent-memory-mcp-server` (crawled 07-21) remain indexed and **still
  earn 0 impressions** — for those the gap is ranking, not indexing (pages are
  already thorough + keyword-targeted; on-page tweaks would be speculative
  busywork, so untouched). `solve/build-vs-buy-agent-memory` ("discovered, not
  indexed") + `solve/expire-old-agent-memory` ("unknown to Google") are **still
  never crawled** — the crawl-priority gap last cycle's solve↔solve
  internal-linking slice addresses (verify 08-22; deliberately not touched this
  cycle to keep that experiment's attribution clean). `docs/agent-memory`:
  **still "unknown to Google," never crawled** — this cycle's dead-sitemap fix
  is the concrete remedy; the 07-26 robots fix + this sitemap fix both verify at
  the R-08 check (08-22), treat as failed if still uncrawled then per
  `SK-DOCS-005`.
- Registry/directory listings (last read live 2026-07-30, not re-read this
  cycle): official registry ✅ active (`com.nlqdb/nlqdb` v0.1.1,
  `?utm_source=mcp-registry`) · Smithery ✅ · Glama crawl-fed · mcp.so absent
  (approval queue) · Cursor submitted · `mcp.directory` absent (re-check 08-22) ·
  `awesome-mcp-servers` PR open (merge-gated on Glama score badge, founder queue
  #3) · Anthropic connector dir founder-gated · PulseMCP re-checks 08-22.
  Plugin/skill venues (R-09): own marketplace ✅, claudemarketplaces.com ✅
  (crawl-fed), SkillsMP ✅, `claude-community` payload parked
  (`blocked-by-human.md` #4), `skillsclaude.org` payload parked
  (`blocked-by-human.md` #5). **Channels live with attributable yield: 4**
  (organic, dev.to, github, npm); agent-artifacts + plugin + mcp.directory
  in-flight, yield 0.
- Coding-agent walker (R-06): **0/1 surfaced** (baseline 2026-07-20 — cold
  session recommended `pgvector`, never nlqdb). Not re-run: no
  `ANTHROPIC_API_KEY` in this session.
- Canonical setup guide (R-04): **complete, 3 of 3** (2026-07-29) — cold-agent
  walk green with a founder-minted `sk_mcp_` key (evidence in
  [`INDEX.md`](INDEX.md) §R-04). Its published page `docs.nlqdb.com/agent-memory/`
  was undiscovered by Google until this cycle's sitemap fix.
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight,
  yield 0. Every dropped file carries the `npx -y @nlqdb/mcp` + `sk_mcp_`
  headless route beside the hosted one (2026-07-28, `GLOBAL-003`, MCP-scoped key
  per `SK-APIKEYS-015`), pinned by `agent-artifacts.test.ts`. `skills.sh` has no
  submission flow (P2 07-23), so growth is organic install yield; the yield gate
  (a real `agent-artifacts` visit in `/app/admin`) is unmeasurable from here.
- Stage-0 solve pages: R-03 complete + R-02's two `competitors.md` §4 entries +
  the `/solve ↔ /solve` internal-link mesh (2026-08-02). Live path `nlqdb_query`;
  remember/preset gated (SK-PIVOT-010).
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10**.
  Monthly; next 2026-08-22, so not re-run this cycle.
