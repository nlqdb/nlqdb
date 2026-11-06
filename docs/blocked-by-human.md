# Blocked by human

Temporary founder steps only. No **Answer** field. Delete a bullet when the
steps are done. Reports and `/daily` list **titles** only — never paste a
bullet. Ranked by user-yield per founder-minute; work top-down. 🔒
decision-to-lock bullets follow
[`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md) (cap 3).
Operator actions also get one metadata line in
[`history/founder-actions-log.md`](./history/founder-actions-log.md) — never
a secret value.

## Claim the `nlqdb` npm name for the `npx nlqdb attach` door

⏱ ~5 min · blocked since 2026-10-31. [`END_GOAL.md`](./END_GOAL.md) row 1
and [`GLOBAL-043`](./decisions/GLOBAL-043-attach-first-autonomous-dba.md)
item 6 promise `npx nlqdb attach <connection-string>`, but the npm name
`nlqdb` is unclaimed (anyone can take it) and the shim ships as `@nlqdb/cli`.
Until then the CLI door is `nlq attach` (curl or Homebrew install).

1. From the npm account that owns the `@nlqdb` org, publish a placeholder
   `nlqdb` package, then add the trusted publisher `nlqdb/nlqdb` →
   `release-npm.yml` on <https://www.npmjs.com/package/nlqdb/access>; agents
   then ship it as the shim's alias. Or instead amend `END_GOAL.md` row 1
   and `GLOBAL-043` item 6 to `npx @nlqdb/cli attach`.
2. Log a line in `history/founder-actions-log.md` and delete this bullet.

## Delete the `rateme12` Worker and its `rateme12.nlqdb.com` domain

⏱ ~2 min · blocked since 2026-10-27. The clone's code and deploy workflow
are gone from the repo, but the deployed Worker still serves a dead page.

1. Cloudflare dashboard → Workers & Pages → `rateme12` → Settings → Delete
   (this also removes the `rateme12.nlqdb.com` custom domain).
2. Log a line in `history/founder-actions-log.md` and delete this bullet.

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

## 🔒 Lock whether an `sk_mcp_` key may attach a database

⏱ ~5 min · blocked since 2026-10-31. `END_GOAL.md` row 8 has the coding
agent attach with one MCP call, but the hosted MCP's `sk_mcp_` key gets
`connect_requires_account` (`SK-APIKEYS-015` keeps attach its one
`sk_live_`-only capability); it can already list, apply and reject. Checked
`GLOBAL-043` items 5–6, `GLOBAL-033`'s security row, `SK-DBCONN-001`: none
weighs a stored credential against the agent door. Default until locked:
attach over MCP needs an `sk_live_` key.

1. Pick one: (a) `sk_mcp_` attaches (amend `SK-APIKEYS-015`); (b) keep
   `sk_live_`-only and amend `END_GOAL.md` row 8 to say so; (c) `sk_mcp_`
   attaches only once per-database scoping ships.
2. Record it in `SK-APIKEYS-015`, then delete this bullet.

## Shared rules: what the server is missing for nlqdb

⏱ ~10 min · blocked since 2026-11-06 · **Type:** decision. The move onto
https://mcp.hochly.com/mcp (`rules://transition`) kept every nlqdb rule that
differs from a served one. Each line: rule · where it is kept · recommendation.

1. Decision record (`GLOBAL-NNN`, `SK-*` in `FEATURE.md`) · `CLAUDE.md` P1/P3, `docs/feature-conventions.md` · keep as an nlqdb firm call; served "no decisions file" stays as is.
2. Abandoned bets move to `docs/archive/` · `docs/feature-conventions.md` §2 · adopt served: delete them, git holds them (the archive itself was deleted in this move).
3. No doc over 20 KB; split first · `CLAUDE.md` P4 D4 · move to `rules/structure.md`.
4. Resolve open questions before documenting; never document ambiguity · `CLAUDE.md` P4 D1–D3 · move to `rules/workflow.md` § Keeping rules.
5. Journey design + "done = real E2E walk and owner used it" · `docs/guidelines.md` §5, `CLAUDE.md` P6 · move to `rules/guidelines.md`.
6. Append-only founder-actions log · `docs/history/founder-actions-log.md` · adopt served: delete it, git log of this file holds it.
7. Mailbox in `docs/`, no **Answer** field, ⏱ rank format · this file · adopt served: root `blocked-by-human.md` with its template.
8. Scheduled run as `/daily` · `/review` · `/weekly`, no 5-bullet report · `.claude/commands/` · keep `/daily` as this repo's own steps; add `docs/AGENTS.md` with the served cron prompt.
9. Roadmap is `GLOBAL-043`'s list, no `docs/ROADMAP.md` · `docs/decisions/GLOBAL-043-*.md` · move the list to `docs/ROADMAP.md`.
10. Founder is never pinged · `.claude/commands/daily.md` · adopt served: notify only when blocked on your action (`rules://general` rule 17).
11. Renovate, not Dependabot · `renovate.json5` · adopt served `.github/dependabot.yml` (bun + github-actions), delete Renovate.
12. PR template line `Roadmap item / KPI` · `.github/pull_request_template.md` · keep (the KPI is nlqdb's §8 item 7).
13. `CLAUDE.md` ~200 lines (path map) · `CLAUDE.md` §4–§5 · keep; the path map has no narrower home.
14. Merge tools missing from the allow list · `.claude/settings.json` · adopt served: add `mcp__github__merge_pull_request`, `mcp__github__update_pull_request`, `mcp__github__pull_request_review_write` — open <https://github.com/nlqdb/nlqdb/edit/main/.claude/settings.json>, add the three lines to `permissions.allow`, **Commit changes**.

Reply `ok` to take every recommendation, or name the lines to change.

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
