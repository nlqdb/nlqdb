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

## Stop `swiss-prices-comparison` draining the shared D1 read cap

- **Type:** account action · ⏱ ~5 min · since 2026-11-18
- **Done so far:** on 11-18 that D1 database (not nlqdb's) read **132.9 M
  rows** (589 k on 11-17), 26× the account's 5 M/day free cap. Every D1
  query on the account then failed with code 7500: **signed-in
  `app.nlqdb.com` requests 500/503 (`auth_unavailable`) until 00:00 UTC**,
  and #1288's Deploy API, Deploy — Canary and CI's rateme12 attach job went
  red (re-run at 14:44 UTC, still refused). `bun scripts/cf-quota.ts`
  reads the headroom each run (nlqdb itself: 0.4–2.0 M/day). Any day it
  reads ≥ 5 M again takes nlqdb down.
- **Ask:** recommended (a) — shared cap, one hog · nlqdb isolated for good
  · none, both stay free · fix its query instead. Options: (a) move
  `swiss-prices-comparison` to its own free Cloudflare account; (b) have
  that repo's agent cut the query reading 133 M rows/day. Reply in chat.

## Rotate `LOGSNAG_TOKEN` — it shipped in every page until run 306

- **Type:** secret · ⏱ ~3 min · since 2026-11-22
- **Done so far:** run 306 moved browser events to `POST /v1/events/web` →
  PostHog (`SK-EVENTS-015`); the token is in 0 / 141 built pages (was
  141 / 141). The old value stays valid and public in caches and archives:
  anyone holding it can drain the 2,500/mo quota the pages ride on, or push
  a fake page.
- **Ask:**
  1. <https://app.logsnag.com> → Settings → API Tokens → revoke the current
     token → create a new one.
  2. Put it in `.envrc` as `LOGSNAG_TOKEN=…`, then run
     `./scripts/mirror-secrets-all.sh` (GitHub + Workers).

## Call the spike pass or fail

- **Type:** decision · ⏱ ~2 min · since 2026-11-13
- **Done so far:** the spike Postgres's one applied index (run 283),
  re-read on its due date (11-19, run 301, 227.9 h after the apply): its hot
  fingerprint went **p95 est. 65.214 → 1.976 ms** (33×; mean 7.706 →
  0.345 ms; 32,562 calls before, **4,627 since**), judged **keep** by the
  loop's verify — [`scorecard.md`](docs/scorecard.md) row 16. `GLOBAL-043`
  item 10 makes pass "a measured delta the founder would pay for"; only the
  founder can say that. Default until called: nothing is deleted.
- **Ask:** recommended (a) — two weeks, delta held · deletion series starts ·
  one index, one DB · fail keeps everything. Options: (a) **pass** — 33×
  p95 est. over 4,627 calls; (b) **fail** — evidence kept, nothing deleted.
  Reply in chat; the agent records it in [`docs/ROADMAP.md`](docs/ROADMAP.md) §2.

## Attach the shared account's other D1 apps as dogfood workloads

- **Type:** decision · ⏱ ~2 min · since 2026-11-24
- **Done so far:** four null runs (307–310): every `ROADMAP.md` box is ⛔ or
  date-gated, and rateme12 has no missing index, so KPI B on a real D1 is 0.
  The same Cloudflare account holds two busier D1 apps nlqdb doesn't watch:
  `swiss-prices-comparison` (one day at **132.9 M rows**, the 11-18 outage)
  and `successful` (top reader 11-23, 0.96 M). That is the loop's exact case.
  `bun scripts/cf-quota.ts` already reads their rows-read totals. Run 310's
  four-null proposal (`daily.md` step 2); not self-executed.
- **Ask:** recommended (a) — real scans, read-only · KPI B, outage root ·
  another repo's prod DB · wait for builders. Options: (a) attach both
  read-only like rateme12 (002 brief), proposals only, an apply waits on that
  repo's PR; (b) also apply the index here; (c) no. Reply in chat.

## Re-gate recruiting 10 builders: rateme12 has no missing index

- **Type:** decision · ⏱ ~2 min · since 2026-11-16
- **Done so far:** `GLOBAL-043` recruits ~10 builders once rateme12 shows
  KPI B > 0. Run 294 made Tier 1 plan its joins and subqueries: 0 proposals
  — its heaviest texts (24 h and 7 d) already plan through indexes; the rest
  is whole-table counts and aggregates. So no index applies there until its
  workload changes; the spike's index is kept (33× p95 est. at 227.9 h).
- **Ask:** recommended (a) — gate stuck on rateme12 · spike delta already
  measured · one DB, Postgres only · wait, or new kind. Options: (a) recruit
  when the spike passes; (b) keep the rateme12 gate and wait; (c) gate on a
  D1 unused-index drop's write delta (playbook kind 1, first). Then: DM ~10
  P1 builders who run a Postgres or D1 app; each attaches it (~5 h). The
  agent amends `GLOBAL-043`.

## Submit `docs.nlqdb.com/sitemap-index.xml` in GSC

- **Type:** account action · ⏱ ~1 min · since 2026-11-16
- **Done so far:** the docs sitemap is live (200, `application/xml`) and
  `docs.nlqdb.com/robots.txt` advertises it; GSC knows only
  `nlqdb.com/sitemap.xml`, and `docs.nlqdb.com/mcp/` already has 98
  impressions at pos 44.8. The agent's service account is a Restricted
  GSC user, and Restricted users can't submit sitemaps (run 295).
- **Ask:**
  1. Open <https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Anlqdb.com>
  2. Paste `https://docs.nlqdb.com/sitemap-index.xml` → **Submit**.

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
