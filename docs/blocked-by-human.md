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
| 2 | ~20 min | Submit nlqdb to the Anthropic Claude connector directory — needs a Team/Enterprise org, so it's a money call | 2026-07-21 |
| 3 | ~15 min | Register the Supabase OAuth app + set `SUPABASE_OAUTH_CLIENT_ID`/`_SECRET` prod secrets — unblocks one-click Supabase connect (paste path works meanwhile) | 2026-08-13 |

Only #1 can move real strangers (scorecard row #2); #2 is the only one that
costs money and waits per `docs/cost-ladder.md` unless a Team org already
exists. No founder action remains on the SK-PIVOT-016 gate path itself: with
`NLQDB_API_KEY` set (2026-08-04), D-04 — provisioning the memory DB through
the product's own authed create surface — is **agent work** (the 08-08 weekly
review briefly queued it here; corrected same day, founder-flagged: rule 4 /
GLOBAL-033 — never park an agent-performable action on the founder).
(Resolved 2026-08-05, same sitting — Era 6: the "Become AI" five locks →
`SK-EKP-001..005`/`SK-PIVOT-023`, the goal-pack build order locked
(niche-quality lens → `pack-candidates.md` header), the Anthropic
plugin-directory submission (pending review), and Cline issue #2197
(pending review). **Dropped, not resolved:** the skillsclaude.org paste —
the founder's VPN security filter flagged the site, it has zero independent
reputation footprint, and it was the queue's lowest-yield optional item;
venue marked dropped in reach R-09, never re-queue. Earlier sittings
in `history/founder-actions-log.md` Eras 4–5. One load-bearing note survives:
D-02 memory-sync stays dark until the **D-04 agent run** creates the prod
memory DB and sets the `NLQDB_MEMORY_DB` repo variable — agent work, not a
queue bullet (founder-directed 2026-08-09: provisioning is
product-automated). Live-tested 08-09: one 1-run API change first — preset
create for user-scoped keys, SK-PIVOT-010 as amended.)

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
   number as of 07-28. Gate progress: **1/5** (D-04 run 1, 2026-08-11 —
   provisioned + seeded the prod memory DB and ran the first ops workload
   through the public MCP surface; criterion 2 first-10 success 100 % → green,
   criterion 1 = 12 real MCP asks, criterion 3 surfaced one silent wrong-answer
   incident. This founder-only launch half stays gated until all five are green).

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
   - **Test & launch:** give reviewer credentials for a *populated* demo account. `MEMORY_PRESET=1`
     shipped 2026-07-29 (#835), so a signed-in reviewer can now exercise **all five tools**
     end-to-end, `nlqdb_remember` included — seed the demo DB so `nlqdb_query` returns rows.
   On submit, flip ledger row #9 to **in-flight** and note the `claude.ai/.../submissions` listing URL.

3. **⏱ ~15 min · since 2026-08-13 — Enable one-click Supabase connect in prod**
   (`SK-DBCONN-003`, shipped #985). The `/app/connect` "Connect Supabase" button
   is live, but `/start` returns 503 and gracefully falls back to paste until the
   OAuth app exists. In the Supabase dashboard → org → **OAuth Apps**, register an
   app with redirect URI
   `https://app.nlqdb.com/v1/db/connect/oauth/supabase/callback` (add the
   localhost variant for dev), then set the issued credentials as the
   `SUPABASE_OAUTH_CLIENT_ID` / `SUPABASE_OAUTH_CLIENT_SECRET` Worker secrets
   (`scripts/mirror-secrets-workers.sh` promotes them on deploy; `docs/runbook.md`
   §secrets). Ranked last: no real user has asked to connect a Supabase DB yet,
   and the paste path already works.

(P6 was approved and merged by the founder 2026-08-04, #885 — it is binding
in CLAUDE.md/AGENTS.md.)

(The auto-merge-tier proposal was **rejected by the founder 2026-07-22**:
review latency is handled by a separate merger agent, not by `/daily`
self-merging; recorded in `daily.md` §4. Don't re-propose.)
