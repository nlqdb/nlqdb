# Reach track — current numbers

The reach loop's scorecard-equivalent: **overwrite in place, no changelog**
(`/reach` step 1). Slices, hard rules and the owed-work tracker live in
[`INDEX.md`](INDEX.md); this file holds only the latest measured state, so it
can be rewritten every cycle without pushing that file past CLAUDE.md `D4`.

- **The R-04 guide was `Disallow: /` to ClaudeBot + GPTBot and Google had never crawled it — found
  and fixed 2026-07-26.** `docs.nlqdb.com` shipped with no `robots.txt` of its own, so it served
  only Cloudflare's *managed* block: the guide plus `/llms.txt` + `/llms-full.txt` were closed to
  the exact crawlers behind Claude Code and Codex while `/agents` and every solve page stayed open.
  Edge enforcement was ruled out first — all four crawler UAs get 200, so robots.txt was the only
  gate. Fixed by mirroring the apex policy; mechanism and parity guard canonical in
  [`SK-DOCS-005`](../../../docs-site/FEATURE.md).
- **Per-URL index truth is now measured, not inferred** — `gsc-pull.ts` gained `## Index status`
  (URL Inspection API, same readonly service account). Wedge pages: **2 of 6
  indexed.** `solve/best-way-to-store-agent-memory` (crawled 07-20) and `solve/agent-memory-mcp-server`
  (07-21) are indexed and **still earn 0 impressions** — for those two the gap really is ranking.
  `solve/build-vs-buy-agent-memory` + `solve/expire-old-agent-memory`: **never crawled**.
  `docs/agent-memory`: **unknown to Google** (the robots block above). `/agents/` reports canonical
  drift (Google indexes non-slash `/agents`), but prod is correct — 301 → slash, self-canonical
  matches the sitemap — so that is GSC naming the redirect source; nothing to fix.
- GSC (28d, live 2026-07-27, window 06-27→07-25): **8 clicks / 488 impr / pos 16.7**; intent-query
  clicks **0** — **8th consecutive flat read**. All four stage-0 pages earn zero impressions, but
  **nine other agent-memory URLs earn them, five on page 1** (07-26 read: `solve/isolate-ai-agent-memory-per-tenant`
  pos 3.0, `solve/analytical-queries-over-agent-memory` 6.7, `/agents` 6.8, `vs/supermemory` 8.8,
  `solve/analyze-agent-tool-call-logs` 9.5). The host ranks agent-memory content fine; it is the
  stage-0 set specifically that earns nothing. R-01 baseline, unmoved.
- **R-04's blocker was delivery, not discovery — delivery closed this run.** Walked 2026-07-25: an
  agent clears every discovery hop against live prod (RFC 9728 + 8414, RFC 7591, `/authorize` 302 +
  PKCE) then stops at browser consent — `apps/mcp` routes `/mcp` through `OAuthProvider`, no bearer
  path.
  `SK-MCP-001`'s stdio hatch shipped 2026-07-26, but both agent-fetched surfaces kept asserting
  *"no headless credential either, so hand that one step to the developer"*. Both now carry the
  route, per-host blocks (incl. Claude Desktop, whose only hosted path is a dialog) and its failure
  modes. **Verified by running the published binary** (clean `npm i`, empty dir): `initialize` +
  `tools/list` (5 tools) + `tools/call` reaching prod — a prefix-valid bogus key returns the API's
  own 401, no browser. **`0.1.0`'s own no-key stderr still steers readers to `sk_mcp_`** — fixed in
  `stdio.ts` after publish, so it needs a republish; `sk_live_` is the only pasteable prefix
  (`SK-APIKEYS-009`) and its revocation consequence is a founder call open in
  [`mcp-server/FEATURE.md`](../../../mcp-server/FEATURE.md).
- Registry/directory listings: **2 published + 1 crawl-fed + 3 queued** (#1 official registry and
  #2 Smithery live; Glama crawl-fed — links the repo, not the utm-tagged `websiteUrl`, until
  founder-claimed; #5 mcp.so + #6 Cursor submitted 2026-07-26, #8 `awesome-mcp-servers` PR open;
  only #7 still needs a founder submit; PulseMCP re-checks 08-22). Channels live with attributable
  yield: **4** (organic, dev.to, github, npm); #12 in-flight. **State changes read live 2026-07-27:**
  Smithery's homepage field **did save** — its listing now serves
  `https://nlqdb.com/agents/?utm_source=smithery` and names all five tools, closing publish day's
  "no outbound link, key not carried" caveat; **mcp.so still absent day + 1** (its search payload
  returns `total: 0`, plausible `mcp.so/server/…` slugs 404); Glama and `cursor.directory` **could
  not be read at all** (504 and 429 to a non-browser client), so their silence is not evidence of
  absence.
- Coding-agent walker (R-06): **0/1 surfaced** (baseline 2026-07-20 — cold session recommended
  `pgvector`, never nlqdb). Not re-run: no `ANTHROPIC_API_KEY` in this session.
- Canonical setup guide (R-04): **live, 2 of 3**. Walk box ⬜ — blocker is now "the walker has no
  key", not the product. **One founder action closes it:** mint an `sk_live_` key at `/app/keys`
  and set it as `NLQDB_API_KEY` in the walker env (queue in `blocked-by-human.md` next run).
- Droppable artifacts (R-07): **4 of 4 live**, `agent-artifacts` in-flight, yield 0; the
  one-command install path is verified by running it, not just linted (#825). **Headless route now
  in every artifact (2026-07-28):** all four dropped files (AGENTS snippet, Claude Code SKILL,
  Cursor `.mdc`, Codex TOML) carried only the hosted browser-OAuth route — a dead-end for the
  *unattended* agent they exist for — so each gained the `npx -y @nlqdb/mcp` + `sk_live_` alternative
  from `mcp-install.ts`'s `buildStdio*` builders (`GLOBAL-003`), pinned by `agent-artifacts.test.ts`
  (23 pass). **Published install surfaces 3 → 4 (2026-07-27):** the `npx skills add …` one-liner now
  also ships on **`@nlqdb/mcp`'s npm README — the page npmjs.com renders** — beside the docs guide,
  `llms.txt` and the artifacts index, pinned by `packages/mcp/test/readme.test.ts`. Re-run live in a
  clean directory it writes
  `.agents/skills/nlqdb-memory/SKILL.md`, a `.claude/skills/` symlink and `skills-lock.json` (no
  Cursor rule, no `AGENTS.md` edit); npm serves the new page from **0.1.1** (latest published still
  0.1.0, release PR #826). **The yield gate was unmeasurable until 07-26** — all five artifacts led
  with an untagged `docs.nlqdb.com/agent-memory/`, so every channel converted as `direct`. The key
  now rides the URL across the hop (mechanism canonical in
  [`docs-site`](../../../docs-site/FEATURE.md)), taking keyed links on an attributing host **4 of
  10 → 10 of 10**. Two holes stay open: a `claude mcp add` conversion never loads an apex page
  (`untracked`), and only the *landing* URL carries the key.
- Stage-0 solve pages: R-03 complete + R-02's two `competitors.md` §4 entries. Live path
  `nlqdb_query`; remember/preset gated (SK-PIVOT-010).
- Answer-engine retrieval presence (R-08 baseline, 2026-07-22): **0/10**. Monthly; next 2026-08-22,
  so not re-run. Note for that run: no Claude/ChatGPT retrieval path could have cited the
  docs-hosted guide before the 07-26 robots fix — the apex was always open, so the 0/10 stands.
