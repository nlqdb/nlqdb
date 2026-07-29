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
| 1 | ~5 min | **Go/no-go:** flip `MEMORY_PRESET=1` in prod (PR #835) or hold — E-03 per-agent isolation shipped (#851), so the E-06 gate is satisfied; the flip itself is a prod data-write surface only an operator turns on | 2026-07-27 |
| 2 | ~30 min | Fire the Show HN launch sequence — condition-gated on the SK-PIVOT-016 dogfood gate; when its 5 criteria are green, only your sitting remains | 2026-06-13 |
| 3 | ~2 min | Mint an **`sk_mcp_`** key (`/app/keys` → MCP key, SK-APIKEYS-015) and set it as `NLQDB_API_KEY` in the walker env — the last tick on the cold-agent headless walk | 2026-07-27 |
| 4 | ~10 min | Provide a LogSnag ingest token (+ wire the late-bound `window.__nlqdb_logsnag` hook) so client demand signals stop being silent no-ops | 2026-07-27 |
| 5 | ~20 min | Submit nlqdb to the Anthropic Claude connector directory — needs a Team/Enterprise org, so it's a money call | 2026-07-21 |
| 6 | ~5 min | Connect the Claude GitHub App to the org so Dependabot alert #29 (1 high) is viewable — `bun audit` on the lockfile shows nothing high, so its target can't be confirmed from here | 2026-07-27 |

Only #2 can move real strangers (scorecard row #2); #5 is the only one that
costs money and waits per `docs/cost-ladder.md` unless a Team org already
exists. #1 is now a clean operator go/no-go — its E-06 gate blocker shipped in
#851, so no decision crosses a recorded gate; flipping a prod data-write
surface stays a human action. The headless-credential decision was taken
2026-07-28 (advisor session; see below).

(**Resolved 2026-07-28 — headless MCP credential:** founder chose the
security-first *Widen* option; shipped in #850 as
[`SK-APIKEYS-015`](./features/api-keys/FEATURE.md) — `sk_mcp_` is mintable
from `/app/keys`, MCP-scoped, host+device-bound, individually revocable,
attributed as `mcp`. The cross-surface docs sweep is in flight on
`claude/headless-credential-sweep`.)

(The 2026-07-27 "delete two orphaned Neon branches" row is **done** — verified
live: `pr-571` and `pr-648` are gone and the project sits at 5 of 10 slots. Its
durable half shipped the same day: all three creation sites now set Neon's
`expires_at`, so an orphan reaps itself even when no runner survives to clean
up. Nothing to re-queue.)

(**Not queued — rides the release flow, not a founder gate:** the published
`@nlqdb/mcp@0.1.0` no-key stderr still names the unmintable `sk_mcp_`, but
`stdio.ts` is already fixed on `main` and a `patch` changeset is queued, so
merging the changesets "Version Packages" PR (#826) publishes `0.1.1` with the
corrected stderr + npm page via Trusted-Publisher OIDC — no manual `npm login`.
That same PR also carries the `@nlqdb/sdk` import-entrypoint fix. A normal
release step, largely automated.)

## Human actions (clicks, secrets, legal) — ranked, work top-down

1. **⏱ ~5 min · since 2026-07-27 — Go/no-go: flip `MEMORY_PRESET=1` in prod
   (PR #835), or hold.** The decision that blocked this is cleared —
   [`E-03`](./features/agent-memory-pivot/worksheets/engine/E-03-memory-scoping.md)
   (per-agent isolation, the security-critical slice) **shipped** in #851,
   satisfying
   [`E-06`](./features/agent-memory-pivot/worksheets/engine/E-06-agents-createform-preset.md)'s
   *"only after E-03 ships"* gate, so no recorded decision crosses here now.
   What remains is the flip itself: turning on a prod data-write surface is an
   operator action an agent won't self-take. The founder's 2026-07-28 lean was
   *build the blocker, then ship*, and E-03 has now shipped — so this is teed
   up, but the prod flip is yours to execute or hold. It also unblocks the
   dogfood gate ([`SK-PIVOT-016`](./features/agent-memory-pivot/decisions/SK-PIVOT-016-dogfood-launch-gate.md)
   names `MEMORY_PRESET=1` a prerequisite) that #2's launch waits on.
   - **Hold** (safe default): #835 stays unmerged.
   - **Ship**: merge #835; an agent then adds E-03's backfill line (its "no
     prod memory DBs exist" premise ends the moment you flip) and corrects the
     five `solve.ts` sites that still tell the public the preset is gated.

2. **⏱ ~30 min spread over a week · Show HN draft idle since 2026-06-13, kit
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
   loosened.** The gate now has an execution track that `/daily` can pick up:
   [`dogfood/INDEX.md`](./features/agent-memory-pivot/worksheets/dogfood/INDEX.md)
   (`D-01..D-07`, one slice per criterion), and it is the founder-set weekly
   focus number as of 07-28. Gate progress: **0/5**.

3. **⏱ ~2 min · since 2026-07-27 — Mint an `sk_mcp_` key and set it as
   `NLQDB_API_KEY` in the walker env.** The browser-free MCP route is
   proven end-to-end (transport, tool list, prod reachability, the
   published `claude mcp add` line run verbatim); the one thing left to
   tick R-04's cold-agent walk is a real key in the walker's environment —
   an operator secret an agent can't self-mint. Mint the **MCP key** at
   `https://app.nlqdb.com/app/keys` (SK-APIKEYS-015 — MCP-scoped,
   host+device-bound, revocable per key; shipped #850, so no full-account
   `sk_live_` in a CI env), set `NLQDB_API_KEY` in the walker env.
   *Founder asked 2026-07-28 to be reminded rather than re-ranked — the
   advisor session re-arms reminders until this is done.*

4. **⏱ ~10 min · since 2026-07-27 — Provide a LogSnag ingest token so client
   demand signals stop being silent no-ops.** The events `lib/logsnag.ts` emits
   (`agents.connect_clicked` with its new `url`/`stdio` transport dimension,
   `solve.try_query_clicked`, …) only fire if the late-bound
   `window.__nlqdb_logsnag` hook is present, and that hook is defined nowhere
   in the repo — so every client-side demand signal is currently a no-op, and
   any scorecard row that reads a "signal transports moved" number is measuring
   nothing on the client. The wiring is agent-doable; what only you can give is
   the LogSnag project/ingest token (an external account). Hand me the token
   (as a build-time public env) and I'll wire the hook. Recorded at
   `solve-pages/FEATURE.md`.

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

6. **⏱ ~5 min · since 2026-07-27 — Connect the Claude GitHub App to the org so
   Dependabot is viewable.** A push flagged **Dependabot alert #29 (1 high)**
   on the default branch, but the alerts API answers *"GitHub access is not
   enabled for this session — an org admin must connect the Claude GitHub App
   for this organization,"* so the alert's target is unreadable from here.
   `bun audit` against the committed lockfile shows **nothing high** (only the
   already-accepted low `cookie` advisory, `framework-wrappers/FEATURE.md`), so
   the high can't be confirmed or fixed without seeing it. Connect the app (or
   paste alert #29's package + advisory), then an agent can bump and verify the
   build. Bumping blind for an alert we can't see risks breaking the build for
   no confirmed gain, so this waits on visibility.

## Suggestions needing approval (to amend the guidelines)

(The auto-merge-tier proposal was **rejected by the founder 2026-07-22**:
review latency is handled by a separate merger agent, not by `/daily`
self-merging; recorded in `daily.md` §4. Don't re-propose.)
