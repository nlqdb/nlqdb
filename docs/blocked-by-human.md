# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

**This is a ranked queue, not a parking lot** (founder-directed 2026-07-22):
bullets are ordered by expected user-yield per founder-minute — work top-down.
Every bullet opens with `⏱ estimate · blocked since date`; new bullets slot in
by rank, never append. Every `/daily` scorecard names the current top bullet
and its age next to "worst number today" — restating it each run is
measurement, not nagging: with 0 real strangers, the age of this queue's head
is the company's real cycle time.

## Human actions (clicks, secrets, legal) — ranked, work top-down

1. **⏱ ~30 min spread over a week · Show HN draft idle since 2026-06-13, kit
   ready since 07-19 — Fire the launch sequence** — the founder-only half of
   [`docs/research/launch-kit.md`](./research/launch-kit.md): pick the angle
   (§2; GLOBAL-036 says lead with analytical agent memory), write the Show
   HN post + first comment in your own voice from the §3.1 fact sheet
   (never agent copy — the r/SQL lesson), soft-launch lobste.rs/r/SideProject
   first, then Show HN Tue–Thu morning, Product Hunt ≥ 1 week later
   (account-walled). Attribution (#745) is merged and the prod D1
   migrations (`0022`–`0025`) are applied (verified live 2026-07-22), so
   every visit is attributable end-to-end. nlqdb has never launched anywhere;
   this is the only action in the queue that can move real strangers
   (scorecard row #2) from 0 this week.

2. **⏱ ~5 min · since 2026-07-21 — Submit nlqdb to mcp.so** (`mcp.so/submit`;
   reach R-05 venue #5, ledger row #7).
   Account-walled: the form needs a GitHub sign-in (anonymous fetch → 403), and mcp.so
   is **not** an official-registry crawler — it's a Next.js + Supabase directory
   (`chatmcp/mcpso`) whose data comes from this form, so the row-#3 registry publish does
   **not** cascade here (per-server pages auto-open a giscus GitHub Discussion for
   *comments*, which is not the submission path). Verified 2026-07-21. Sign in, open
   `mcp.so/submit`, and enter:
   - **GitHub URL:** `https://github.com/nlqdb/nlqdb` (the form auto-fetches name/README)
   - **Name / title:** `nlqdb — analytical memory for AI agents`
   - **Website:** `https://nlqdb.com/agents/?utm_source=mcpso` (carries the ledger key)
   - **Description:** `Analytical memory for AI agents: a real Postgres your agent connects to over MCP and queries in plain English — GROUP BY, JOIN, aggregate over what it remembered, not just the top-k a vector store recalls. One command to connect.`
   - **Connect / config (if asked):** `claude mcp add --transport http nlqdb https://mcp.nlqdb.com/mcp`
   On submit, flip ledger row #7 to **in-flight** and note the `mcp.so/server/...` URL.

3. **⏱ ~5 min · since 2026-07-21 — Submit nlqdb to cursor.directory**
   (`cursor.directory/plugins/new`; reach R-05 venue #6, ledger row #8).
   Account-walled: Cursor's **official in-product marketplace is curated** with
   no public self-serve path, and the community directory Cursor's own docs point to
   (`cursor.directory`) takes submissions only through a web form that needs a GitHub/Google
   sign-in — the `cursor/community-plugins` repo explicitly says "all content is submitted
   through the website — no pull requests needed for data", so there is **no agent PR path** and
   the row-#3 registry publish does not cascade here. Verified 2026-07-21. Sign in at
   `cursor.directory/login` (GitHub or Google), open `cursor.directory/plugins/new`, and enter:
   - **GitHub repo URL:** `https://github.com/nlqdb/nlqdb` (the form auto-detects Open-Plugins
     components — `.mcp.json`, `rules/*.mdc`, `skills/*/SKILL.md`; nlqdb's repo has no root
     `.mcp.json` yet since the MCP server is hosted-remote, so fill the hosted URL below by hand)
   - **Name / title:** `nlqdb — analytical memory for AI agents`
   - **Website:** `https://nlqdb.com/agents/?utm_source=cursor-dir` (carries the ledger key)
   - **Description:** `Analytical memory for AI agents: a real Postgres your agent connects to over MCP and queries in plain English — GROUP BY, JOIN, aggregate over what it remembered, not just the top-k a vector store recalls. One command to connect.`
   - **MCP server / connect (if asked):** hosted HTTP URL `https://mcp.nlqdb.com/mcp`, or the
     one command `claude mcp add --transport http nlqdb https://mcp.nlqdb.com/mcp`
   On submit, flip ledger row #8 to **in-flight** and note the `cursor.directory/...` URL.

4. **⏱ ~10 min · since 2026-07-21 — Open the `awesome-mcp-servers` listing PR**
   (`punkpeye/awesome-mcp-servers`; reach R-05 venue #8, ledger row #10). A
   plain GitHub PR — but agent sessions are scoped to `nlqdb/nlqdb` only
   and can't fork/PR an external repo (re-verified 2026-07-22: `add_repo`
   rejects cross-owner adds, GitHub-MCP fork denied), so it's parked for the
   founder or a scope-unrestricted session. Mechanism verified
   2026-07-21 (`CONTRIBUTING.md`): follow the README's existing format, keep
   alphabetical order within the category, one server per line; automated-agent PRs
   can prefix the title with `🤖🤖🤖` for the maintainer's fast-track merge.
   1. Fork `github.com/punkpeye/awesome-mcp-servers`, edit `README.md`.
   2. Under the `## 🧠 Knowledge & Memory` heading (memory-first per SK-PIVOT-003;
      not `🗄️ Databases`), insert **in alphabetical position** (by `nlqdb`) this line:
      ```
      - [nlqdb/nlqdb](https://github.com/nlqdb/nlqdb) 📇 ☁️ - Analytical memory for AI agents: a real Postgres your agent connects to over MCP and queries in plain English — GROUP BY, JOIN, aggregate over what it remembered, not just the top-k a vector store recalls. One command to connect.
      ```
      Markers: 📇 TypeScript codebase · ☁️ hosted cloud service (remote MCP at
      `mcp.nlqdb.com/mcp`). No 🎖️ (not an official MCP-protocol-team server). The
      Glama score badge is auto-added by Glama's bot later — omit it.
   3. PR title: `🤖🤖🤖 Add nlqdb (analytical memory for AI agents) to Knowledge & Memory`
      (drop the `🤖🤖🤖` if a human submits by hand).
   Honesty caveat: the entry links to the **GitHub repo** (list convention), not a
   utm-taggable `nlqdb.com` URL, so this venue can't carry the `awesome-mcp` key —
   its yield rolls into the `github`/organic refs (discovery/SEO), and it never
   becomes "live with attributable yield" on its own. Alt list if rejected:
   `wong2/awesome-mcp-servers`. On merge, flip ledger row #10 → in-flight.

5. **⏱ ~20 min + Team/Enterprise plan gate · since 2026-07-21 — Submit nlqdb
   to the Anthropic Claude connector directory**
   (`claude.ai/admin-settings/directory/submissions/new`; reach R-05 venue #7, ledger row #9).
   Account-walled **and plan-gated**: the submission portal lives inside a Claude.ai org's **admin
   settings**, so it needs a **Team or Enterprise** org (not an individual plan) plus Owner or
   Directory-management access — a heavier gate than mcp.so/Cursor (any sign-in). If reaching it
   would require *paying* for a plan, it waits for the first paying customer per
   [`docs/cost-ladder.md`](./cost-ladder.md). Not a registry
   crawler, so the row-#3 official-registry publish does **not** cascade here. Verified 2026-07-21
   (`claude.com/docs/connectors/building/submission`). nlqdb already clears the two hard technical
   gates the reviewer enforces: **OAuth 2.0** (`apps/mcp` runs `@cloudflare/workers-oauth-provider`
   with dynamic client registration + `/.well-known/*`) and **tool annotations** (every tool in
   `packages/mcp/src/server.ts` — `nlqdb_query`, `nlqdb_list_databases`, `nlqdb_describe`,
   `nlqdb_remember`, `nlqdb_connect_database` — carries a `title` + `readOnlyHint`/`destructiveHint`).
   Open the portal (remote-MCP path) and enter:
   - **Server URL / transport:** `https://mcp.nlqdb.com/mcp`, streamable HTTP, same URL for every user
   - **Name (≤100):** `nlqdb — analytical memory for AI agents`
   - **Tagline (≤55):** `Analytical memory for AI agents. One command.`
   - **Description (≤2000):** `Analytical memory for AI agents: a real Postgres your agent connects to over MCP and queries in plain English — GROUP BY, JOIN, aggregate over what it remembered, not just the top-k a vector store recalls. One command to connect.`
   - **Categories (1–5):** Developer Tools + Data & Analytics
   - **Documentation URL:** `https://nlqdb.com/agents/?utm_source=claude-dir` (carries the ledger key)
   - **Privacy policy URL:** `https://nlqdb.com/privacy`
   - **Support contact:** your support email · **Icon:** the nlqdb mark · **Slug (permanent):** `nlqdb`
   - **Authentication:** OAuth 2.0 with dynamic client registration (supported out of the box)
   - **Data handling:** first-party API (nlqdb's own); no health data / no sponsored content
   - **Test & launch:** give reviewer credentials for a *populated* demo account. Honesty caveat
     (SK-PIVOT-010): `nlqdb_remember` + `agent_memory_v1` are `MEMORY_PRESET`-gated in prod, so a
     reviewer can exercise `nlqdb_query`/`nlqdb_list_databases`/`nlqdb_describe`/`nlqdb_connect_database`
     end-to-end but not the gated remember path — seed the demo DB so `nlqdb_query` returns rows.
   On submit, flip ledger row #9 to **in-flight** and note the `claude.ai/.../submissions` listing URL.

6. **⏱ ~15 min (decision only) · since 2026-07-21 — Decide the toolchain path
   to unblock the Astro 6→7 security upgrade**
   (fixes moderate/low XSS `GHSA-f48w-9m4c-m7f5` / `GHSA-4g3v-8h47-v7g6` /
   `GHSA-7pw4-f3q4-r2p2` on the marketing + docs sites). The dep+code migration
   is otherwise done and green, but Astro 7 hard-requires `cookie@2` (renamed
   `parseCookie` API) while better-auth / express / sveltekit / nuxt need
   `cookie@0.7.x` (held above `GHSA-pxg6-pf52-xh8x` by the root global
   override), and bun 1.3.11 supports neither scoped overrides
   ([oven-sh/bun#6608](https://github.com/oven-sh/bun/issues/6608)) nor correct
   isolated-install linking here. Pick one: migrate the cookie consumers off
   `parse`/`serialize`, switch bun linker mode / package manager, or bump bun
   and re-verify. Until then the 3 Astro advisories stay on `main`
   (agent-verified 2026-07-21; re-verified 2026-07-22 — bun overrides are
   still name-keyed only, [#6608](https://github.com/oven-sh/bun/issues/6608)
   open, so "bump bun" is not yet a path).

7. **⏱ ~5 min · since 2026-07-22 — Enable "Always Use HTTPS" + HSTS on the
   `nlqdb.com` Cloudflare zone** (dashboard → SSL/TLS → Edge Certificates, or
   a broader API token). Prod currently serves `http://` with a **200 (no
   HTTP→HTTPS 301) and no HSTS header** — the 07-22 GSC pull found Google
   indexing an `http://` solve URL. The `rel=canonical` tag already points
   Google to https (SEO harm is small); the real gap is SSL-strip/HSTS
   hardening across all 105 surfaces. Agent-blocked: the CF API token is
   Workers/DNS/D1-scoped and gets auth errors on zone settings,
   `security_header`, page rules, and zone/account rulesets alike
   (re-verified 2026-07-22), so this needs a console click or a
   Zone-Settings-scoped token. Lowest rank: internal-integrity yield, no
   user-facing surface.

## Suggestions needing approval (to amend the guidelines)

- **Define an auto-merge tier for daily PRs** so review latency stops
  serializing the loop: on 2026-07-19 seven PRs stacked unmerged and step 0
  pushed runs 95–98 into progressively smaller levers because every real
  lane was "held by an open PR". Proposal: a daily PR auto-merges when the
  §8 gates are green AND the diff is docs/web-only, small (< ~150 lines),
  with no migrations and no API/auth/billing paths; everything else keeps
  waiting for founder review. Would amend `daily.md` §4 — needs your
  approval since it changes what ships without you.
