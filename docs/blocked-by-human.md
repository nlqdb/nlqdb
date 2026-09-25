# Blocked by human

Temporary founder steps only. No **Answer** field. Delete a bullet when the
steps are done. Reports and `/daily` list **titles** only — never paste a
bullet. Ranked by user-yield per founder-minute; work top-down. 🔒
decision-to-lock bullets follow
[`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md) (cap 3).
Operator actions also get one metadata line in
[`history/founder-actions-log.md`](./history/founder-actions-log.md) — never
a secret value.

## Show HN launch sequence

~30 min · blocked since 2026-06-13. Gated on `GLOBAL-041` Phase A (live KPI 1
≥ 95 %; the live walk reads 85 % (17/20, run 222) and the formal 200-insert
sample is 0/200 — agents drive it). Kit:
[`research/launch-kit.md`](./research/launch-kit.md).

1. Pick the angle (§2). Write the Show HN post + first comment in your own
   voice from the §3.1 fact sheet — never agent copy (the r/SQL lesson).
2. Soft-launch lobste.rs / r/SideProject, then Show HN Tue–Thu morning.
3. Product Hunt ≥ 1 week later (account-walled).
4. Delete this bullet once the Show HN post is live.

## Deploy the email-router Worker

~5 min · blocked since 2026-09-18. The fix is **merged** (#1134, 2026-09-21)
but not live: `apps/email-router` is dashboard-managed with no deploy
workflow, so `main` still runs the old script. Until it ships, the DMARC
retry storm and two inbound-mail-loss paths stay open.

1. Deploy `apps/email-router`.
2. Per its `README.md`, send a test to `hello@` and confirm
   `"action":"forwarded"` in `wrangler tail` **and** arrival in the inbox.
3. Make the **GLOBAL-014** call: accept Cloudflare Workers Logs as the span
   requirement, or require the OTel span (needs a `GRAFANA_OTLP_*` secret
   bound to the Worker — also owner-only).
4. Delete this bullet.

## Anthropic Claude connector directory

~20 min · blocked since 2026-07-21. Needs a **Team/Enterprise** Claude.ai org
with Owner or Directory-management access. If reaching it means paying, it
waits per [`cost-ladder.md`](./cost-ladder.md). Ledger row #9.

1. Open <https://claude.ai/admin-settings/directory/submissions/new>, remote-MCP
   path.
2. Enter: server `https://mcp.nlqdb.com/mcp` (streamable HTTP, same URL for
   every user); name `nlqdb — your autonomous DBA`; tagline
   `Your autonomous DBA — no data modeling. One command.`; docs
   `https://nlqdb.com/agents/?utm_source=claude-dir`; privacy
   `https://nlqdb.com/privacy`; slug `nlqdb` (permanent); OAuth 2.0 with
   dynamic client registration; categories Developer Tools + Data & Analytics;
   first-party API, no health data, no sponsored content.
3. Give reviewer credentials for a demo account seeded so `nlqdb_query`
   returns rows — all five tools then work end-to-end.
4. Flip ledger row #9 to **in-flight**, note the listing URL, delete this
   bullet.

## PulseMCP + mcp.directory

~10 min · blocked since 2026-09-01. Both were expected to pick nlqdb up by
crawl from the official registry; re-checked live, both still show 0 results.
Lowest-yield directories — do these only when the queue head is parked.

1. <https://pulsemcp.com/submit> (account-walled) — server
   `https://mcp.nlqdb.com/mcp`, name `nlqdb`, homepage
   `https://nlqdb.com/agents/?utm_source=pulsemcp`. Flip ledger row #5 to
   **in-flight**.
2. <https://mcp.directory/submit> (SPA form, not agent-POST-able) — repo
   `https://github.com/nlqdb/nlqdb`, homepage
   `https://nlqdb.com/agents/?utm_source=mcpdir`, same description; then
   email to claim the listing. Flip ledger row #23 to **in-flight**.
3. Delete this bullet after both submits.

Description for both: `nlqdb — your autonomous DBA: a real Postgres your agent
connects to over MCP and queries in plain English; the schema is inferred from
what it writes. One command.`

## `nlqdb-memory` → cc-marketplace

~10 min · blocked since 2026-09-04. Ledger row #27. Exact payload is parked in
[`acquisition-channels-mechanisms.md` §Row #27](./research/acquisition-channels-mechanisms.md#row-27)
— copy it verbatim. Either path works.

1. Cross-repo PR to <https://github.com/ananddtyagi/cc-marketplace> per its
   `PLUGIN_SCHEMA.md`, **or** the account-walled
   <https://claudecodecommands.directory/submit> form.
2. Flip ledger row #27 to **in-flight**, note the listing URL, delete this
   bullet.

<!--
Standing notes, not asks:
- skillsclaude.org was dropped 2026-08-05 (VPN security flag, no reputation
  footprint) — never re-queue.
- The auto-merge-tier proposal was rejected 2026-07-22 — don't re-propose.
- D-02 memory-sync stays dark until the D-04 agent run provisions the prod
  memory DB; that is agent work, not a queue bullet.
-->
