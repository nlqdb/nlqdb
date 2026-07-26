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

## At a glance

The whole queue in nine lines, same order as the bullets below — where the
exact URL, form values and paste-ready commands live. Read those only when you
sit down to do the thing.

| # | ⏱ | Do this | Blocked since |
|---|---|---|---|
| 1 | ~30 min | Fire the Show HN launch sequence — nlqdb has never launched anywhere | 2026-06-13 |
| 2 | ~5 min | Bootstrap-publish `@nlqdb/mcp` to npm (one paste), then set its Trusted Publisher | 2026-07-25 |
| 3 | ~3 min | Publish nlqdb to Smithery (`smithery mcp publish`) | 2026-07-25 |
| 4 | ~5 min | Submit nlqdb to mcp.so | 2026-07-21 |
| 5 | ~5 min | Submit nlqdb to cursor.directory | 2026-07-21 |
| 6 | ~10 min | Open the `awesome-mcp-servers` listing PR | 2026-07-21 |
| 7 | ~20 min | Submit nlqdb to the Anthropic Claude connector directory — needs a Team/Enterprise org, so it's a money call | 2026-07-21 |
| 8 | ~2 min | Flip "Always Use HTTPS" on the `nlqdb.com` Cloudflare zone | 2026-07-22 |
| 9 | ~3 min | Make CI a required status check on `main` | 2026-07-25 |

Only #1 can move real strangers (scorecard row #2) this week; #7 is the only
one that costs money. Each of the rest is a sign-in plus a form, a terminal
paste, a PR, or a console toggle.

## Human actions (clicks, secrets, legal) — ranked, work top-down

1. **⏱ ~30 min spread over a week · Show HN draft idle since 2026-06-13, kit
   ready since 07-19 — Fire the launch sequence** — **now condition-gated on
   the dogfood gate** ([`SK-PIVOT-016`](./features/agent-memory-pivot/decisions/SK-PIVOT-016-dogfood-launch-gate.md),
   founder-directed 2026-07-26: criteria, never calendar dates — agents
   drive all five; `/daily` restates gate progress n/5 beside this bullet's
   age). When the gate is green, only this founder-only half remains, and
   the launch demo is the gate's own artifact (the live `/agents` memory
   dashboard + "we ran our company's ops on our own memory through the
   public MCP endpoint — here's what broke"): per
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

2. **⏱ ~20 min + Team/Enterprise plan gate · since 2026-07-21 — Submit nlqdb
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

## Suggestions needing approval (to amend the guidelines)

- **Add a "surface-creating" escape hatch to `/daily` step 2** (proposed
  2026-07-26, advisor session): after N (suggest 4) consecutive null runs,
  the next run may — instead of a 5th null — propose **one** new
  surface-area lever (a new workload, channel experiment, or product
  wedge slice) as a written option for founder review, rather than idling.
  Rationale: runs 131–137 produced six consecutive "no agent-movable
  lever" nulls while the phase gate sat at 1/9 — the nulls were a signal
  the lever taxonomy was exhausted, and nothing was assigned to hear it.
  Approving amends `daily.md` step 2; rejecting records a don't-re-propose
  note here, like the auto-merge tier below.

(The auto-merge-tier proposal was **rejected by the founder 2026-07-22**:
review latency is handled by a separate merger agent, not by `/daily`
self-merging; recorded in `daily.md` §4. Don't re-propose.)
