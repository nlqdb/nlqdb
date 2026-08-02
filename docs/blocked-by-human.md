# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done — an
**operator action** first gets one line in
[`history/founder-actions-log.md`](./history/founder-actions-log.md)
(metadata only, never secret values), the only record that survives deletion.

**This is a ranked queue, not a parking lot** (founder-directed 2026-07-22):
bullets are ordered by expected user-yield per founder-minute — work top-down.
Every bullet opens with `⏱ estimate · blocked since date`; new bullets slot in
by rank, never append. Every `/daily` scorecard names the current top bullet
and its age next to "worst number today" — restating it each run is
measurement, not nagging: with 0 real strangers, the age of this queue's head
is the company's real cycle time.

## At a glance

The whole queue, same order as the bullets below — where the exact URLs, form
values and criteria live. Read those only when you sit down to do the thing.

| # | ⏱ | Do this | Blocked since |
|---|---|---|---|
| 1 | ~30 min | Fire the Show HN launch sequence — condition-gated on the SK-PIVOT-016 dogfood gate; when its 5 criteria are green, only your sitting remains | 2026-06-13 |
| 2 | ~2 min | Set the `NLQDB_API_KEY` GitHub repo secret (an `sk_mcp_` key from `/app/keys`) so D-02's memory-sync workflow runs instead of skipping — feeds gate criterion 1 | 2026-08-01 |
| 3 | ~5 min | Glama: push the score badge to `awesome-mcp-servers` PR #10984 (listing is claimed + released, tier B); claim the *connector* (its `/.well-known/glama.json` ships with the repo) + hand test creds for health | 2026-07-29 |
| 4 | ~5 min | Submit the `nlqdb-memory` plugin to Anthropic's community plugin directory (`clau.de/plugin-directory-submission`) — free signed-in form, no plan gate | 2026-07-29 |
| 5 | ~20 min | Submit nlqdb to the Anthropic Claude connector directory — needs a Team/Enterprise org, so it's a money call | 2026-07-21 |
| 6 | ~1 min | Paste `github.com/nlqdb/nlqdb` into skillsclaude.org's no-account submit form (optional; agent-blocked here) | 2026-07-30 |

Only #1 can move real strangers (scorecard row #2); #2 is the cheapest and
feeds the gate that gates #1 (criterion 1's `/v1/ask` counter starts only when
the sync workflow can authenticate); #5 is the only one that costs money and
waits per `docs/cost-ladder.md` unless a Team org already exists; #3 unblocks
a waiting external merge (`awesome-mcp-servers` #10984); #4 is a free,
no-plan-gate form that lists nlqdb in the in-product `/plugin` Discover tab.
#6 is lowest-yield and optional — a 1-min no-account paste that only lands
here because this env can't drive the form.

(**Resolved 2026-07-29 — advisor session, queue 6 → 2:** the founder took the
`MEMORY_PRESET=1` go decision live — #835 merged, the preset + `nlqdb_remember`
are prod-enabled for signed-in accounts — and merged the Version-Packages
release PR #826 (`@nlqdb/mcp@0.1.1` + `@nlqdb/sdk@0.2.2` via
Trusted-Publisher OIDC; scorecard row #19 is now 0). The **LogSnag** bullet
resolved the same sitting: the
founder put `LOGSNAG_TOKEN`/`LOGSNAG_PROJECT` in the session env, the
`window.__nlqdb_logsnag` hook is wired in `Base.astro` (build-time
`PUBLIC_LOGSNAG_*`, both deploy workflows), and one live ingest event verified
the token end-to-end. The **Dependabot #29** bullet resolved too: the founder
pasted the alert (sharp < 0.35.0 in `apps/docs`, libvips CVEs) and the bump to
0.35.3 shipped with a verified build. The **`sk_mcp_` walker-key** bullet
resolved last: the founder minted the key and set it in the walker env, and
R-04's cold-agent walk ran green the same session — published binary, published
guide, real prod write + read-back (evidence: reach `INDEX.md` §R-04). All
operator actions logged in `history/founder-actions-log.md` Era 4. One npm
laggard remains but needs no human — `@nlqdb/cli@0.1.0` still serves an untagged
homepage; its `?utm_source=npm` republish changeset is queued on the same
automated OIDC lane, tracked by scorecard row #22.)

## Human actions (clicks, secrets, legal) — ranked, work top-down

1. **⏱ ~30 min spread over a week · Show HN draft idle since 2026-06-13, kit
   ready since 07-19 — Fire the launch sequence** — **now condition-gated on
   the dogfood gate** ([`SK-PIVOT-016`](./features/agent-memory-pivot/decisions/SK-PIVOT-016-dogfood-launch-gate.md),
   founder-directed 2026-07-26: criteria, never calendar dates — agents
   drive all five). When the gate is green, only this founder-only half
   remains, and the launch demo is the gate's own artifact (the live
   `/agents` memory dashboard + "we ran our company's ops on our own memory
   through the public MCP endpoint — here's what broke"): per
   [`docs/research/launch-kit.md`](./research/launch-kit.md), pick the angle
   (§2; GLOBAL-036 says lead with analytical agent memory), write the Show
   HN post + first comment in your own voice from the §3.1 fact sheet
   (never agent copy — the r/SQL lesson), soft-launch lobste.rs/r/SideProject
   first, then Show HN Tue–Thu morning, Product Hunt ≥ 1 week later
   (account-walled). Attribution (#745) is merged and the prod D1
   migrations (`0022`–`0025`) are applied (verified live 2026-07-22), so
   every visit is attributable end-to-end. nlqdb has never launched anywhere;
   this is the only action in the queue that can move real strangers
   (scorecard row #2) from 0.
   **Reaffirmed 2026-07-28 (advisor session): no launch before the pivot has
   real proof of value — the condition gate stands unchanged, criteria not
   loosened.** The gate's `MEMORY_PRESET=1` prerequisite **shipped 2026-07-29**
   (#835), so all five criteria are now agent-drivable — D-04's prod prereq is
   clear. Execution track:
   [`dogfood/INDEX.md`](./features/agent-memory-pivot/worksheets/dogfood/INDEX.md)
   (`D-01..D-07`, one slice per criterion), the founder-set weekly focus
   number as of 07-28. Gate progress: **0/5**.

2. **⏱ ~2 min · since 2026-08-01 — Set the `NLQDB_API_KEY` repo secret** so
   the [D-02](./features/agent-memory-pivot/worksheets/dogfood/D-02-resync-hook.md)
   docs→memory sync workflow authenticates instead of skipping. Mint an
   `sk_mcp_` MCP key at `app.nlqdb.com/app/keys` (least privilege for a
   headless runner, `SK-APIKEYS-015`; the walker key from 07-29 works too if
   you'd rather reuse), then GitHub → `nlqdb/nlqdb` → Settings → Secrets and
   variables → Actions → new repo secret `NLQDB_API_KEY`. D-02 ships
   skip-green without it; with it, every `docs/**` merge re-syncs the corpus
   and `SK-PIVOT-016` criterion 1's call counter starts accumulating. Doing
   this *before* D-02 lands costs nothing and saves a round-trip.

3. **⏱ ~5 min · since 2026-07-29 — Glama badge onto `awesome-mcp-servers`
   #10984; claim + heal the connector.** The scored-listing prerequisite is
   **done** — server listing submitted, claimed and released 2026-07-29
   ([`glama.ai/mcp/servers/nlqdb/nlqdb`](https://glama.ai/mcp/servers/nlqdb/nlqdb),
   `author:official`, release `0.1.0`, tier **B**; the license "F" side-grade
   is inherent to `GLOBAL-019` — GitHub's detector doesn't ship FSL,
   `getsentry/sentry` itself reads `NOASSERTION` — and sits outside the
   quality tier, ignore it). Remaining:
   - **Badge:** append to the entry line on your fork branch `add-nlqdb` —
     the maintainer's stated merge gate on
     [#10984](https://github.com/punkpeye/awesome-mcp-servers/pull/10984):
     `[![nlqdb MCP server](https://glama.ai/mcp/servers/nlqdb/nlqdb/badges/score.svg)](https://glama.ai/mcp/servers/nlqdb/nlqdb)`
   - **Connector** (`glama.ai/mcp/connectors/com.nlqdb/nlqdb`, crawl-fed,
     health *Unhealthy* 07-29): once this repo's `apps/mcp` deploy ships
     `/.well-known/glama.json`, Glama auto-detects it within minutes and the
     claim binds to the email in the file — `omer@nlqdb.com`; if your
     Glama account uses another email, edit `apps/mcp/src/index.ts` first.
     Once claimed, set the website to
     `https://nlqdb.com/agents/?utm_source=glama` (flips ledger row #6 to
     attributable) and email support@glama.ai about health: the hosted
     transport is OAuth-only by design (`SK-MCP-001`) so their checker stops
     at the 401 wall, and nlqdb has no passwords (`SK-AUTH-002`) — explain
     signup is free (magic link / GitHub / Google), offer to seed a demo
     workspace for an email they name, and ask how they mark OAuth-only
     connectors. Then click **Sync Server** on the admin page.
   Ledger rows #6 + #10 in
   [`acquisition-channels.md`](./research/acquisition-channels.md) track both.

4. **⏱ ~5 min · since 2026-07-29 — Submit the `nlqdb-memory` plugin to
   Anthropic's community plugin directory** (reach R-09 venue #4, ledger row
   #22). Free, signed-in web form — **no plan gate, no money** (unlike #5). P2
   verified 2026-07-29 (`github.com/anthropics/claude-plugins-community`): that
   repo is a read-only mirror; submissions go through
   `clau.de/plugin-directory-submission`, pass automated security scanning, then
   land in the in-product `/plugin` **Discover** tab and the community
   marketplace (distinct from `claude-plugins-official`, which is curated with
   **no** application process — nothing to submit there, ever). The plugin is
   already live and installable directly today (`/plugin marketplace add
   nlqdb/nlqdb` → `/plugin install nlqdb-memory@nlqdb`); this form only adds
   directory discovery. Open the form and enter:
   - **Marketplace / plugin repo:** `https://github.com/nlqdb/nlqdb` (the
     `.claude-plugin/marketplace.json` at the repo root; plugin name
     `nlqdb-memory`)
   - **Display name:** `nlqdb — analytical agent memory`
   - **Tagline (≤55):** `Analytical memory for AI agents. One command.`
   - **Description:** `Persistent, queryable memory for your agent: a real Postgres it asks in plain English over MCP, so it can GROUP BY / JOIN / aggregate over what it remembered instead of recalling the nearest few rows. Bundles the hosted MCP server plus two skills that teach the agent when to use it.`
   - **Homepage / docs URL:** `https://docs.nlqdb.com/agent-memory/?utm_source=claude-plugin` (carries the ledger key — matches `plugin.json`'s `homepage`)
   - **License:** `FSL-1.1-ALv2` · **Category:** Developer Tools / Data
   On submit, tick reach R-09 #4 to *listed* with the directory URL and note it
   on ledger row #22; nothing else changes (the channel stays in-flight until
   `/app/admin` shows a `claude-plugin` visit).

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
   - **Test & launch:** give reviewer credentials for a *populated* demo account. `MEMORY_PRESET=1`
     shipped 2026-07-29 (#835), so a signed-in reviewer can now exercise **all five tools**
     end-to-end, `nlqdb_remember` included — seed the demo DB so `nlqdb_query` returns rows.
   On submit, flip ledger row #9 to **in-flight** and note the `claude.ai/.../submissions` listing URL.

6. **⏱ ~1 min · since 2026-07-30 — Paste one URL into skillsclaude.org's submit
   form** (reach R-09 venue #5, ledger yield rolls into `github` row #16).
   **Optional, lowest-yield** — a marginal skill directory (~7,200 skills) whose
   listing links the repo, so it adds no separate attribution. It sits in this
   queue only because it is **no-account** yet needs a browser paste the
   automation env blocks (P2 2026-07-30: `skillsclaude.org/submit` is a Next.js
   SPA whose `<form>` has no `action`, and the classifier blocks a headless
   submit). The site is not an arbitrary-repo crawler — both nlqdb skills have
   been public since 07-22 yet `?q=nlqdb` returned 0 eight days later — so it
   must be submitted. Open `https://skillsclaude.org/submit` (no sign-in) and
   paste `https://github.com/nlqdb/nlqdb` (it contains
   `apps/web/public/agent-artifacts/nlqdb-memory/SKILL.md` +
   `nlqdb-docs-memory/SKILL.md`). On submit, tick reach R-09 #5 to *listed* with
   the directory URL; nothing else changes (no utm key — `github`-ref yield).

## Suggestions needing approval (to amend the guidelines)

(The auto-merge-tier proposal was **rejected by the founder 2026-07-22**:
review latency is handled by a separate merger agent, not by `/daily`
self-merging; recorded in `daily.md` §4. Don't re-propose.)
