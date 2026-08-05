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

**This is the only place agents may ask for the founder's attention** — and a
founder *bet* enters only as a **🔒 decision-to-lock** bullet
([`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md), amended
2026-08-04): admissible only when no codified decision — the GLOBAL-033
ladder, the `§0` values, any `GLOBAL-*`/`SK-*` — decides the question (the
bullet says what was checked); the conservative default is already applied so
nothing is blocked on the founder; and the ask is to **lock a decision**
(mint/amend the governing `GLOBAL-*`/`SK-*` from pre-drafted options), never
to hand a one-off answer. Hard cap: **3** live 🔒 bullets.

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
| 2 | ~5 min | Submit the `nlqdb-memory` plugin to Anthropic's community plugin directory (`clau.de/plugin-directory-submission`) — possibly already submitted 2026-08-04, check before redoing | 2026-07-29 |
| 3 | ~15 min | Open a `[Server Submission]` issue on `cline/mcp-marketplace` — free, no plan gate; one-click install inside Cline | 2026-08-03 |
| 4 | ~20 min | Submit nlqdb to the Anthropic Claude connector directory — needs a Team/Enterprise org, so it's a money call | 2026-07-21 |
| 5 | ~10 min | 🔒 Lock the goal-pack build order — rank candidates #2–#9 in `pack-candidates.md` (your #1 is set; agents' formula order stands as default until you lock) | 2026-07-29 |
| 6 | ~1 min | Paste `github.com/nlqdb/nlqdb` into skillsclaude.org's no-account submit form (optional; agent-blocked here) | 2026-07-30 |

Only #1 can move real strangers (scorecard row #2); #4 is the only one that
costs money and waits per `docs/cost-ladder.md` unless a Team org already
exists; #2 and #3 are free, no-plan-gate coding-agent-host venues (the
Anthropic `/plugin` Discover tab and Cline's in-product marketplace) — both
list nlqdb where an agent-builder is already installing tools. #5 is the
queue's 🔒 decision-to-lock — nothing is blocked on it (the agents' formula
ordering stands as the conservative default), but your lock sets the build
order for every pack after founder-ops. (The "Become AI" platform's five
locks resolved in-session 2026-08-05 → `SK-EKP-001..005` / `SK-PIVOT-023`;
never re-queued here.) #6 is lowest-yield and optional
— a 1-min no-account paste that only lands here because this env can't drive
the form. (Earlier sittings' resolutions live in
`history/founder-actions-log.md` Eras 4–5. One load-bearing note survives
them: D-02 memory-sync stays dark until D-04 sets `NLQDB_MEMORY_DB`, so
SK-PIVOT-016 criterion 1's counter is **not** running yet.)

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
   (account-walled). Attribution (#745) + the prod D1 migrations
   (`0022`–`0025`) are live (verified 2026-07-22): every visit is
   attributable end-to-end. nlqdb has never launched anywhere.
   **Reaffirmed 07-28 (advisor session): no launch before real proof of
   value — gate unchanged, criteria not loosened.** The gate's `MEMORY_PRESET=1` prerequisite **shipped 2026-07-29**
   (#835), so all five criteria are now agent-drivable — D-04's prod prereq is
   clear. Execution track:
   [`dogfood/INDEX.md`](./features/agent-memory-pivot/worksheets/dogfood/INDEX.md)
   (`D-01..D-07`, one slice per criterion), the founder-set weekly focus
   number as of 07-28. Gate progress: **0/5**.

2. **⏱ ~5 min · since 2026-07-29 — Submit the `nlqdb-memory` plugin to
   Anthropic's community plugin directory** (reach R-09 venue #4, ledger row
   #22). Free, signed-in web form — **no plan gate, no money** (unlike #4).
   **Possibly already submitted 2026-08-04** — check the form page / email
   receipt before redoing; the public mirror doesn't list nlqdb yet, but it
   shows approved listings only, so a pending review is invisible there. P2
   verified 2026-07-29: `anthropics/claude-plugins-community` is a read-only
   mirror; submissions go through `clau.de/plugin-directory-submission`, then
   land in the in-product `/plugin` **Discover** tab (distinct from
   `claude-plugins-official`, curated, **no** application process — nothing
   to submit there, ever). The plugin is
   already live and installable directly today (`/plugin marketplace add
   nlqdb/nlqdb` → `/plugin install nlqdb-memory@nlqdb`); this form only adds
   directory discovery. Open the form and enter:
   - **Marketplace / plugin repo:** `https://github.com/nlqdb/nlqdb` (the
     `.claude-plugin/marketplace.json` at the repo root; plugin name
     `nlqdb-memory`)
   - **Path within repository:** `apps/web/public/agent-artifacts` (where the
     plugin's `.claude-plugin/plugin.json` lives)
   - **Supported platforms:** Claude Code only — Cowork is untested; never
     tick an untested surface (the form says test first)
   - **Privacy policy URL:** `https://nlqdb.com/privacy` (verified live
     2026-08-05) · **Contact email:** the founder's read inbox
   - **Display name:** `nlqdb — analytical agent memory`
   - **Tagline (≤55):** `Analytical memory for AI agents. One command.`
   - **Description:** `Persistent, queryable memory for your agent: a real Postgres it asks in plain English over MCP, so it can GROUP BY / JOIN / aggregate over what it remembered instead of recalling the nearest few rows. Bundles the hosted MCP server plus two skills that teach the agent when to use it.`
   - **Homepage / docs URL:** `https://docs.nlqdb.com/agent-memory/?utm_source=claude-plugin` (carries the ledger key — matches `plugin.json`'s `homepage`)
   - **License:** `FSL-1.1-ALv2` · **Category:** Developer Tools / Data
   On submit, tick reach R-09 #4 to *listed* with the directory URL and note it
   on ledger row #22; nothing else changes (the channel stays in-flight until
   `/app/admin` shows a `claude-plugin` visit).

3. **⏱ ~15 min · since 2026-08-03 — Open a `[Server Submission]` issue on
   `cline/mcp-marketplace`** (reach R-05 venue #10, ledger row #24). Free,
   **no plan gate, no money** — a GitHub issue on
   [`cline/mcp-marketplace`](https://github.com/cline/mcp-marketplace). Approved
   listings become **one-click installable inside Cline**, one of the largest
   coding-agent hosts, so this puts nlqdb where a Cline-building agent already
   installs MCP servers (squarely the reach thesis). Re-verified 2026-08-05
   against the live template (`mcp-server-submission.yml`): fields are a repo
   URL, a 400×400 PNG logo, **two required testing checkboxes**, and an
   optional Additional Information box (there is no separate "reason" field —
   the pitch goes there). Agent-blocked here only because this env's
   GitHub scope is `nlqdb/nlqdb` (can't open an issue on an external repo). Open
   the template and enter:
   - **Title:** `[Server Submission]: nlqdb — analytical memory for AI agents`
   - **GitHub repo URL:** `https://github.com/nlqdb/nlqdb`
   - **Logo (400×400 PNG):** attach `apps/web/public/brand/nlqdb-400.png` —
     the brand mark used on all third-party listings (the GitHub org avatar;
     checked in 2026-08-05. The green `logo.svg` tile is **not** the external
     brand.)
   - **Additional Information:** `Analytical memory for AI agents: a real Postgres your agent connects to over MCP and queries in plain English — GROUP BY / JOIN / aggregate over what it remembered, not just the top-k a vector store recalls. One command to connect (hosted https://mcp.nlqdb.com/mcp — OAuth with dynamic client registration, or headless npx -y @nlqdb/mcp with an sk_mcp_ key from app.nlqdb.com/app/keys); five annotated tools incl. nlqdb_remember / nlqdb_query.`
   - **Testing checkboxes (both required):** **actually run it once first** —
     give Cline only the repo README and watch it set up the server end-to-end
     (headless `npx -y @nlqdb/mcp` + an `sk_mcp_` key from `/app/keys`), then
     tick both truthfully (the server-stability box is already true: hosted
     endpoint + `@nlqdb/mcp` are live in prod). If the README alone proves
     insufficient for Cline's agent-install, **don't tick — stop**; the
     follow-up is a root `llms-install.md` generated from `mcp-install.ts`
     (drift-tested) — flag it back to `/reach` and it becomes a slice.
   No utm key: the listing links the repo, so its yield rolls into the `github`
   ref (like `awesome-mcp` #10). On submit, tick reach R-05 Cline to *listed*
   with the issue/listing URL and flip ledger row #24 to **in-flight**.

4. **⏱ ~20 min + Team/Enterprise plan gate · since 2026-07-21 — Submit nlqdb
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

5. **⏱ ~10 min · since 2026-07-29 — 🔒 Lock the goal-pack build order
   (candidates #2–#9).** [`SK-PIVOT-018`](./features/agent-memory-pivot/decisions/SK-PIVOT-018-goal-packs.md)
   assigns pack ranking to founder taste, so no codified decision can settle
   it (checked: the GLOBAL-033 ladder, `GLOBAL-025`, `SK-PIVOT-018` itself —
   which is what routes it here). Conservative default already applied:
   agents' evidence × fit × reach ordering in
   [`pack-candidates.md`](./features/agent-memory-pivot/worksheets/dogfood/pack-candidates.md)
   stands until you lock, and your #1 (language tutor, 2026-07-29) is pinned.
   Your action: read the 9 one-paragraph candidates, reorder #2–#9 (or write
   "formula order locked"), and the locked order is recorded in that file's
   header — it becomes the build sequence for every pack after founder-ops
   (D-05), each shipping as a `SK-PIVOT-021` one-click journey on the shared
   runner — the lock decides *all* future "which pack next" questions.

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

None live. (P6 was approved and merged by the founder 2026-08-04, #885 —
it is binding in CLAUDE.md/AGENTS.md.)

(The auto-merge-tier proposal was **rejected by the founder 2026-07-22**:
review latency is handled by a separate merger agent, not by `/daily`
self-merging; recorded in `daily.md` §4. Don't re-propose.)
