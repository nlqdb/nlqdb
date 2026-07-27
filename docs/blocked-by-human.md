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

The whole queue, same order as the bullets below — where the exact URLs, form
values and criteria live. Read those only when you sit down to do the thing.

| # | ⏱ | Do this | Blocked since |
|---|---|---|---|
| 1 | ~2 min | Delete 2 orphaned Neon branches — the project sits at its 10-branch cap, so **CI goes red whenever PRs overlap** | 2026-07-27 |
| 2 | ~5 min | **Decide:** flip `MEMORY_PRESET` in prod before E-03 ships, or hold? Holding also holds #3's dogfood gate; PR #835 drafted | 2026-07-27 |
| 3 | ~30 min | Fire the Show HN launch sequence — condition-gated on the SK-PIVOT-016 dogfood gate; when its 5 criteria are green, only your sitting remains | 2026-06-13 |
| 4 | ~5 min | **Decide:** is `sk_live_*` the headless MCP credential? It defeats global-signout revocation and mis-attributes MCP as `cli` | 2026-07-27 |
| 5 | ~20 min | Submit nlqdb to the Anthropic Claude connector directory — needs a Team/Enterprise org, so it's a money call | 2026-07-21 |

Only #3 can move real strangers (scorecard row #2); #5 is the only one that
costs money and waits per `docs/cost-ladder.md` unless a Team org already
exists. #2 and #4 are decisions an agent may not take alone — both would
supersede or amend a recorded decision.

## Human actions (clicks, secrets, legal) — ranked, work top-down

1. **⏱ ~2 min · since 2026-07-27 — Delete two orphaned Neon branches; the
   project sits at its cap and CI goes red whenever PRs overlap.** Measured
   live 2026-07-27: the project holds **10 branches, the Free-plan cap**, so
   `POST /branches` returns `422 {"code":"BRANCHES_LIMIT_EXCEEDED"}` and
   `ci.yml`'s `test-api-smoke-neon` (plus any preview needing a branch)
   fails regardless of the PR's diff. Intermittent, not constant: on #832 it
   failed 01:41Z and passed 02:08Z once a `ci-smoke-*` branch aged out of the
   >1 h sweep. Two of the ten slots are held for good, so only eight rotate —
   the cap binds as soon as more than that want a branch at once. Those two
   belong to branches whose PRs are long gone: **`pr-571`** (closed
   2026-07-02) and **`pr-648`** (merged 2026-07-10). Deleting a Neon branch
   destroys its data, so an agent won't do it unattended — but these two have
   no owner left. Paste-ready (needs `NEON_API_KEY` + `NEON_PROJECT_ID`):
   ```bash
   # confirm they are still the two oldest pr-* branches before deleting
   curl -fsSL "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches" \
     -H "Authorization: Bearer $NEON_API_KEY" \
     | jq -r '.branches[] | select(.name|startswith("pr-")) | "\(.name)\t\(.id)\t\(.created_at)"' | sort -k3
   # then, for each of pr-571 and pr-648's ids:
   curl -fsS -X DELETE "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches/<id>" \
     -H "Authorization: Bearer $NEON_API_KEY"
   ```
   **Only the deletion is yours.** Two slots buys headroom, not a fix, but the
   durable fix is agent work and is already queued: Neon's create-branch API
   takes an `expires_at` (RFC 3339, ≤30 days out,
   [generally available on all plans](https://neon.com/docs/guides/branch-expiration))
   and reaps the branch itself, so `preview-app.yml` and `ci.yml` can bound
   every `pr-N` / `ci-smoke-*` branch at creation. No decision needed from
   you — if that ever falls through, it comes back here as its own row.

2. **⏱ ~5 min · since 2026-07-27 — Decide: flip `MEMORY_PRESET` in prod
   before E-03 ships, or hold?** PR #835 flips it; I left it drafted because
   the flip crosses a recorded security gate:
   [`E-06`](./features/agent-memory-pivot/worksheets/engine/E-06-agents-createform-preset.md)
   says do it *"only after E-03 (per-agent isolation) ships"*, and
   [`E-03`](./features/agent-memory-pivot/worksheets/engine/E-03-memory-scoping.md)
   is **⬜ not started** — unbuilt in code, not just on paper: rows are tagged
   with the *tenant* id, and `end_user_id`/`thread_id` are written but never
   read, so the columns look like isolation and provide none. Cross-*account*
   isolation holds; the exposure is end-user-to-end-user inside one builder's
   app. **Holding also holds the launch:**
   [`SK-PIVOT-016`](./features/agent-memory-pivot/decisions/SK-PIVOT-016-dogfood-launch-gate.md)
   names `MEMORY_PRESET=1` a prerequisite of the dogfood gate #3 waits on.
   - **Hold** (safe default): no action — #835 stays drafted, E-03 proceeds.
   - **Ship**: I record a decision superseding the E-06 gate, add a backfill
     line to E-03 (its "no prod memory DBs exist, so no backfill migration"
     premise stops holding the moment you flip), and correct the five
     `solve.ts` sites that tell the public the preset is gated.

3. **⏱ ~30 min spread over a week · Show HN draft idle since 2026-06-13, kit
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

4. **⏱ ~5 min · since 2026-07-27 — Decide: is `sk_live_*` the headless MCP
   credential?** #834 standardised every doc on it, because `sk_mcp_*` is
   OAuth-minted server-side and never displayed
   ([`SK-APIKEYS-009`](./features/api-keys/decisions/SK-APIKEYS-009-sk-mcp-server-side-mint.md)),
   so the docs telling users to paste one were unexecutable. Correct, but it
   drags in two properties nobody chose: *"sign out everywhere"* no longer
   revokes a compromised headless MCP host
   ([`SK-APIKEYS-006`](./features/api-keys/decisions/SK-APIKEYS-006-global-signout-scope.md)
   deliberately spares `sk_live_*`), and `surfaceFromPrincipal` labels that
   traffic `cli`, so headless-MCP adoption is unmeasurable in the events
   pipeline. Full write-up: `mcp-server/FEATURE.md` → Open questions.
   - **Accept** (default): I record both as intended and strip `sk_mcp_*`
     from the five sites still naming a key no one can hold
     (`packages/mcp/src/tools.ts` ×4, `cli/internal/cmd/remember.go`).
   - **Widen `/app/keys` to mint `sk_mcp_*`**: amends SK-APIKEYS-009; I ship
     it, and those five sites become true as written.

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
