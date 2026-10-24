# Blocked by human

Temporary founder steps only. No **Answer** field. Delete a bullet when the
steps are done. Reports and `/daily` list **titles** only — never paste a
bullet. Ranked by user-yield per founder-minute; work top-down. 🔒
decision-to-lock bullets follow
[`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md) (cap 3).
Operator actions also get one metadata line in
[`history/founder-actions-log.md`](./history/founder-actions-log.md) — never
a secret value.

## Pick the spike database and hand its connection string to CI

⏱ ~10 min · blocked since 2026-10-22. `/daily` step 2's item 1b is the
2-week Postgres spike, run once item 1a's Postgres slices land ([`GLOBAL-043`](./decisions/GLOBAL-043-attach-first-autonomous-dba.md));
it needs a real-traffic database only you can pick and grant.

1. Choose a real-traffic Postgres you own (Supabase / Neon / RDS — not the
   rateme12 clone).
2. Create a role with `pg_read_all_stats`, granted membership in the role
   that owns the app's tables (only a table's owner can add its indexes).
3. Make sure `pg_stat_statements` is enabled (and HypoPG, if the host
   offers it).
4. Set the connection string as the repo secret `SPIKE_PG_URL`
   (`gh secret set SPIKE_PG_URL -R nlqdb/nlqdb`).
5. Log a line in `history/founder-actions-log.md` (no secret) and delete
   this bullet.

## Hand CI a Cloudflare API token for rateme12's D1

⏱ ~5 min · blocked since 2026-10-22. The dogfood attaches nlqdb to the real
rateme12's D1 ([`002-rateme12-attach.md`](./history/dogfood-iterations/002-rateme12-attach.md));
only the account owner can mint the token.

1. In the Cloudflare dashboard, create an API token limited to rateme12's
   account: D1 Edit, Account Analytics Read (D1 Edit is account-wide, so it
   reaches every D1 database in that account; exact scopes are verified on
   first attach).
2. Set it as the repo secret `RATEME12_D1_TOKEN`, plus the account id and
   database id (`gh secret set RATEME12_D1_TOKEN -R nlqdb/nlqdb`;
   `RATEME12_D1_ACCOUNT_ID`, `RATEME12_D1_DATABASE_ID` the same way).
3. Log a line in `history/founder-actions-log.md` (no secret) and delete
   this bullet.

## 🔒 Lock which `/v1/ask` pieces the deletion series removes

⏱ ~10 min · blocked since 2026-10-22. [`GLOBAL-043`](./decisions/GLOBAL-043-attach-first-autonomous-dba.md)
deletes "the NL-specific `/v1/ask` machinery" yet keeps the shipped premium
tier (it meters `/v1/ask`) and an async LLM for proposal text (item 3).
Checked `GLOBAL-043`, `GLOBAL-026`, `GLOBAL-004`: none says whether
ask-pipeline, plan-cache, llm-router or frontier-keys go. Default until
locked: all four stay unretired; nothing is deleted before the spike passes.

1. Pick one: (a) delete `/v1/ask` whole (ask-pipeline, plan-cache,
   frontier-keys, the premium meter — amends "premium tier stays"); keep
   llm-router only for async proposal text; (b) keep `/v1/ask` as the read
   interface over attached databases, delete only its create / widen
   branches; (c) decide after the spike.
2. Amend `GLOBAL-043`'s deletion list to name the pieces, then delete this
   bullet.

## 🔒 Lock when public copy switches to attach-first

⏱ ~10 min · blocked since 2026-10-22. Public copy still sells the hosted,
infer-from-inserts product: the README body below its intro, launch-kit
angles A–B + the fact sheet, `apps/docs` `agent-memory.mdx`, the
`architecture.md` §3.1 headline, and the registry copy in
`research/acquisition-channels-mechanisms.md` (the directory bullets below
are already gated on it). `GLOBAL-043` sets no messaging date. Default until
locked: copy stays — it is still true of what is live, and acquisition is
paused.

1. Pick one: (a) switch all copy now, the hosted product framed as "live
   today"; (b) switch when the spike passes; (c) switch with the deletion PR
   that removes `insert()`.
2. Record the choice as a line in `GLOBAL-043`'s consequences, then delete
   this bullet.

## Recruit 10 builders once rateme12's attach shows a measured delta

⏱ ~5 h · blocked since 2026-10-14. Gated — opens when KPI B > 0 on
rateme12's D1 (one applied change with a measured gain,
[`GLOBAL-043`](./decisions/GLOBAL-043-attach-first-autonomous-dba.md)).

1. DM ~10 P1 builders who already run a Postgres or D1 app (no content, no
   SEO); each attaches it. Agents track week-2 returns on the scorecard.
2. Delete this bullet once 10 have attached.

## Show HN launch sequence

⏱ ~30 min · blocked since 2026-06-13. Gated on the
[`GLOBAL-043`](./decisions/GLOBAL-043-attach-first-autonomous-dba.md) love
gate: ≥ 3 of the first ~10 founder-recruited builders return unprompted in
their second week. Kit: [`research/launch-kit.md`](./research/launch-kit.md).

1. Pick the angle (§2). Write the Show HN post + first comment in your own
   voice from the §3.1 fact sheet — never agent copy (the r/SQL lesson).
2. Soft-launch lobste.rs / r/SideProject, then Show HN Tue–Thu morning.
3. Product Hunt ≥ 1 week later (account-walled).
4. Delete this bullet once the Show HN post is live.

## Deploy the email-router Worker

⏱ ~5 min · blocked since 2026-09-18. The fix is **merged** (#1134, 2026-09-21)
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

⏱ ~20 min · blocked since 2026-07-21. Needs a **Team/Enterprise** Claude.ai org
with Owner or Directory-management access. If reaching it means paying, it
waits per [`cost-ladder.md`](./cost-ladder.md). Ledger row #9. Gated: the
copy below pitches the retired hosted product — submit once the attach MCP
tools ship ([`GLOBAL-043`](./decisions/GLOBAL-043-attach-first-autonomous-dba.md)),
with the copy rewritten to match.

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

⏱ ~10 min · blocked since 2026-09-01. Both were expected to pick nlqdb up by
crawl from the official registry; re-checked live, both still show 0 results.
Lowest-yield directories — do these only when the queue head is parked.
Gated like the connector directory above: the description pitches the
retired hosted product.

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

⏱ ~10 min · blocked since 2026-09-04. Ledger row #27. Parked until the
spike's verdict: on a pass agent-memory is deleted
([`GLOBAL-043`](./decisions/GLOBAL-043-attach-first-autonomous-dba.md)), and
so is this bullet. Exact payload is parked in
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
