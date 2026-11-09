# Blocked by human

Async mailbox between agents and the human. Agents add an entry when a task
needs a human. Omer never edits this file: he answers in chat (or just does
the thing), and the agent infers his answer from that. The resolving agent
finishes the task and **deletes the entry** in the same commit. Holds open
blockers only — history is in git. Ask format: rules://workflow § Mailbox.

nlqdb additions: entries are ranked by user-yield per founder-minute, work
top-down; `/daily` reports list **titles** only; 🔒 decision-to-lock entries
follow [`GLOBAL-033`](docs/decisions/GLOBAL-033-resolution-defaults.md)
(cap 3). Never a secret value here.

<!-- Entry template — copy below this line.

## <roadmap item, verbatim>
- **Type:** secret | account action | decision · ⏱ <estimate> · since <date>
- **Done so far:** <state of the partial work, PR/commit refs>
- **Ask:** <numbered steps with links + copy-paste blocks, or a decision:
  context · benefits · risks · alternatives, ≤ 5 words each>
-->

## Claim the `nlqdb` npm name for the `npx nlqdb attach` door

- **Type:** account action · ⏱ ~5 min · since 2026-10-31
- **Done so far:** [`END_GOAL.md`](docs/END_GOAL.md) row 1 and
  [`GLOBAL-043`](docs/decisions/GLOBAL-043-attach-first-autonomous-dba.md)
  item 6 promise `npx nlqdb attach <connection-string>`, but the npm name
  `nlqdb` is unclaimed and the shim ships as `@nlqdb/cli`. Until then the CLI
  door is `nlq attach` (curl or Homebrew install).
- **Ask:**
  1. From the npm account that owns the `@nlqdb` org, publish a placeholder
     `nlqdb` package, then add the trusted publisher `nlqdb/nlqdb` →
     `release-npm.yml` on <https://www.npmjs.com/package/nlqdb/access>; agents
     then ship it as the shim's alias. Or instead amend `END_GOAL.md` row 1
     and `GLOBAL-043` item 6 to `npx @nlqdb/cli attach`.

## Delete the `rateme12` Worker and its `rateme12.nlqdb.com` domain

- **Type:** account action · ⏱ ~2 min · since 2026-10-27
- **Done so far:** the clone's code and deploy workflow are gone from the
  repo, but the deployed Worker still serves a dead page.
- **Ask:**
  1. Cloudflare dashboard → Workers & Pages → `rateme12` → Settings → Delete
     (this also removes the `rateme12.nlqdb.com` custom domain).

## 🔒 Lock which `/v1/ask` pieces the deletion series removes

- **Type:** decision · ⏱ ~10 min · since 2026-10-22
- **Done so far:** `GLOBAL-043` deletes "the NL-specific `/v1/ask`
  machinery" yet keeps the shipped premium tier (it meters `/v1/ask`) and an
  async LLM for proposal text (item 3). Checked `GLOBAL-043`, `GLOBAL-026`,
  `GLOBAL-004`: none says whether ask-pipeline, plan-cache, llm-router or
  frontier-keys go. Default until locked: all four stay; nothing is deleted
  before the spike passes.
- **Ask:** pick one —
  (a) delete `/v1/ask` whole (ask-pipeline, plan-cache, frontier-keys, the
  premium meter — amends "premium tier stays"), keep llm-router only for
  async proposal text; (b) keep `/v1/ask` as the read interface over attached
  databases, delete only its create / widen branches; (c) decide after the
  spike. The agent writes it into [`docs/ROADMAP.md`](docs/ROADMAP.md) §2.

## 🔒 Lock when public copy switches to attach-first

- **Type:** decision · ⏱ ~10 min · since 2026-10-22
- **Done so far:** public copy still sells the hosted, infer-from-inserts
  product: the README body below its intro, launch-kit angles A–B + the fact
  sheet, `apps/docs` `agent-memory.mdx`, the `architecture.md` §3.1 headline,
  and the registry copy in `docs/research/acquisition-channels-mechanisms.md`
  (the directory entries below are gated on it). `GLOBAL-043` sets no
  messaging date. Default until locked: copy stays — it is still true of what
  is live, and acquisition is paused except the SEO lane.
- **Ask:** pick one — (a) switch all copy now, the hosted product framed as
  "live today"; (b) switch when the spike passes; (c) switch with the
  deletion PR that removes `insert()`. The agent records it in `GLOBAL-043`.

## 🔒 Lock whether an `sk_mcp_` key may attach a database

- **Type:** decision · ⏱ ~5 min · since 2026-10-31
- **Done so far:** `END_GOAL.md` row 8 has the coding agent attach with one
  MCP call, but the hosted MCP's `sk_mcp_` key gets `connect_requires_account`
  (`SK-APIKEYS-015` keeps attach its one `sk_live_`-only capability); it can
  already list, apply and reject. Checked `GLOBAL-043` items 5–6,
  `GLOBAL-033`'s security row, `SK-DBCONN-001`: none weighs a stored
  credential against the agent door. Default until locked: attach over MCP
  needs an `sk_live_` key.
- **Ask:** pick one — (a) `sk_mcp_` attaches (amend `SK-APIKEYS-015`);
  (b) keep `sk_live_`-only and amend `END_GOAL.md` row 8 to say so;
  (c) `sk_mcp_` attaches only once per-database scoping ships.

## Recruit 10 builders once rateme12's attach shows a measured delta

- **Type:** account action · ⏱ ~5 h · since 2026-10-14
- **Done so far:** gated — opens when KPI B > 0 on rateme12's D1 (one applied
  change with a measured gain, `GLOBAL-043`).
- **Ask:**
  1. DM ~10 P1 builders who already run a Postgres or D1 app (no content, no
     SEO); each attaches it. Agents track week-2 returns on the scorecard.

## Show HN launch sequence

- **Type:** account action · ⏱ ~30 min · since 2026-06-13
- **Done so far:** gated on the `GLOBAL-043` love gate: ≥ 3 of the first ~10
  founder-recruited builders return unprompted in their second week. Kit:
  [`docs/research/launch-kit.md`](docs/research/launch-kit.md).
- **Ask:**
  1. Pick the angle (§2). Write the Show HN post + first comment in your own
     voice from the §3.1 fact sheet — never agent copy (the r/SQL lesson).
  2. Soft-launch lobste.rs / r/SideProject, then Show HN Tue–Thu morning.
  3. Product Hunt ≥ 1 week later (account-walled).

## Deploy the email-router Worker

- **Type:** account action · ⏱ ~5 min · since 2026-09-18
- **Done so far:** the fix is **merged** (#1134, 2026-09-21) but not live:
  `apps/email-router` is dashboard-managed with no deploy workflow, so `main`
  still runs the old script. Until it ships, the DMARC retry storm and two
  inbound-mail-loss paths stay open.
- **Ask:**
  1. Deploy `apps/email-router`.
  2. Per its `README.md`, send a test to `hello@` and confirm
     `"action":"forwarded"` in `wrangler tail` **and** arrival in the inbox.
  3. Make the **GLOBAL-014** call: accept Cloudflare Workers Logs as the span
     requirement, or require the OTel span (needs a `GRAFANA_OTLP_*` secret
     bound to the Worker — also owner-only).

## Anthropic Claude connector directory

- **Type:** account action · ⏱ ~20 min · since 2026-07-21
- **Done so far:** ledger row #9. Needs a **Team/Enterprise** Claude.ai org
  with Owner or Directory-management access; if reaching it means paying, it
  waits per [`docs/cost-ladder.md`](docs/cost-ladder.md). Gated: the copy
  below pitches the retired hosted product — submit once the attach MCP tools
  ship (`GLOBAL-043`), with the copy rewritten to match.
- **Ask:**
  1. Open <https://claude.ai/admin-settings/directory/submissions/new>,
     remote-MCP path.
  2. Enter: server `https://mcp.nlqdb.com/mcp` (streamable HTTP, same URL for
     every user); name `nlqdb — your autonomous DBA`; tagline
     `Your autonomous DBA — no data modeling. One command.`; docs
     `https://nlqdb.com/agents/?utm_source=claude-dir`; privacy
     `https://nlqdb.com/privacy`; slug `nlqdb` (permanent); OAuth 2.0 with
     dynamic client registration; categories Developer Tools + Data &
     Analytics; first-party API, no health data, no sponsored content.
  3. Give reviewer credentials for a demo account seeded so `nlqdb_query`
     returns rows — all five tools then work end-to-end.

## mcp.directory

- **Type:** account action · ⏱ ~5 min · since 2026-09-01
- **Done so far:** ledger row #23. Expected to pick nlqdb up by crawl from the
  official registry; re-checked live, still 0 results. Lowest-yield — do it
  only when the queue head is parked. Gated like the connector directory: the
  description pitches the retired hosted product. (PulseMCP is off this list:
  its submissions are paused, and it ingests the official registry entry when
  it reopens.)
- **Ask:**
  1. <https://mcp.directory/submit> (SPA form) — repo
     `https://github.com/nlqdb/nlqdb`, homepage
     `https://nlqdb.com/agents/?utm_source=mcpdir`, description:
     `nlqdb — your autonomous DBA: a real Postgres your agent connects to over MCP and queries in plain English; the schema is inferred from what it writes. One command.`
  2. Email to claim the listing.

## `nlqdb-memory` → cc-marketplace

- **Type:** account action · ⏱ ~10 min · since 2026-09-04
- **Done so far:** ledger row #27. Parked until the spike's verdict: on a pass
  agent-memory is deleted (`GLOBAL-043`), and so is this entry. Exact payload:
  [`acquisition-channels-mechanisms.md` §Row #27](docs/research/acquisition-channels-mechanisms.md#row-27).
- **Ask:**
  1. Cross-repo PR to <https://github.com/ananddtyagi/cc-marketplace> per its
     `PLUGIN_SCHEMA.md`, **or** the account-walled
     <https://claudecodecommands.directory/submit> form, with that payload.

<!--
Standing notes, not asks:
- skillsclaude.org was dropped 2026-08-05 (VPN security flag, no reputation
  footprint) — never re-queue.
- The auto-merge-tier proposal was rejected 2026-07-22 — don't re-propose.
- D-02 memory-sync stays dark until the D-04 agent run provisions the prod
  memory DB; that is agent work, not a queue bullet.
-->
