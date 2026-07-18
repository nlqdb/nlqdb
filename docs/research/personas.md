# Personas & Use Cases

This document answers two questions: *who* is nlqdb for in Phase 1, and *what do they actually do with it*. Everything here is deliberate — if a persona isn't listed, we are choosing not to serve them yet.

The personas are ordered by **priority for Phase 1 onboarding**. We optimize the 60-second path for P1 first, then P2. The others should work but we don't tune for them yet.

---

## P1 — The Solo Builder

**Role.** Founder or single engineer building a side-project or early-stage product. Ships alone or on a team of 2–3. Writes code daily.

**Current pain.**
- Spends the first day of every project wiring up Postgres + an ORM + migrations + a schema + an admin panel before the app does anything useful.
- Switches hosting providers every few months chasing free tiers.
- Knows SQL well enough, but begrudges writing it for throwaway internal tools (admin pages, one-off reports, cron jobs that email a number).
- Backups are "I hope Neon is doing it."

**Why they churn off existing DBs.** Provisioning friction + maintenance tax. They don't leave Postgres because Postgres is bad; they leave because running it is a side job.

**What "works" looks like.**
- `nlq db create myapp` from the terminal, a connection string on stdout, and a working chat endpoint — all in one command.
- Drop the connection string into their existing app. Stay there. Use the chat only for ops ("how many signups today").
- Never think about backups.
- Monthly bill is <$10 for a real side project.

**Willingness to pay.** $10–25/mo happily, once the project is real. $0 during the tinkering phase — a card requirement kills them.

**ROI (est.).** ~8–10 hrs/mo saved per active project (skipping initial Postgres setup, writing migrations, building one-off admin pages, worrying about backups). At a $75–100/hr blended builder rate, that's **~$600–1,000/mo** in avoided labor, plus one fewer tool subscription (a Retool/Internal.io hobby seat at $20–50/mo) since the chat replaces the admin UI. Setup time on a new project drops from ~1 day to ~1 minute.

**Representative queries.**
- `"create a users table with email, name, signup date"` (even though we never say "create a table" — they'll type it anyway)
- `"show me the last 10 signups"`
- `"who signed up this week but hasn't logged in"`
- `"export all orders from last month as CSV"`
- `"add a field called 'plan' to users, default 'free'"`

**Real-life use case.** Maya is building a meal-planning side project on a Friday night. She runs `nlq db create mealplan`, drops the connection string into her Next.js app, and by Sunday has real users signing up. Monday morning she types `"how many signups this weekend, grouped by referrer"` into the chat instead of opening psql. Two weeks in she needs a `trial_ends_at` column — says so in chat, reviews the diff, approves. She never writes a migration file, never runs `pg_dump`, never logs into a cloud console.

**Phase 1 success for this persona.** They deploy something real with nlqdb as its actual DB, not just the admin layer.

---

## P2 — The Agent Builder (split: P2a hobbyist · P2b agent-SaaS)

Both build LLM agents and want a `remember`/`recall` tool, not a schema
project. They split on **tenancy**: P2a stores one user's memory; P2b stores
memory *per end-user* in a multi-tenant product, so cross-user leakage is a
correctness bug, not a preference. P2b is the reach track's priority target
(the stage-0 buyer); P2a is today's Jordan. Shared: MCP install, no up-front
schema, usage-based pricing. Both search — and increasingly have their coding
agent (Claude Code/Cursor/Codex) search — at stage 0; the queries they issue
are the [reach intent map](../features/agent-memory-pivot/worksheets/reach/intent-map.md).

### P2a — Hobbyist tool-agent builder

Engineer wiring a single-user agent around Claude/GPT/local via MCP or a custom
tool-use loop. **Pain:** the agent dumps facts into a messy `notes.json` and
forgets between sessions; a real DB needs schema it can't design.
**Default alternative:** a hand-rolled blob store or raw pgvector. **"Works":**
install the MCP server; the agent creates and queries its own DB in NL, cheap
under test load. **Use case:** Jordan's research agent forgot its `notes.json`;
now it calls `nlqdb_remember`/`nlqdb_recall` over `agent_memory_v1` — ~40 lines
of glue, not a bespoke vector + metadata service. **Phase 1 success:** MCP in
3+ agent products; #1 logged use case is "agent giving itself memory."

### P2b — Agent-SaaS builder

Engineer shipping a multi-tenant agent *product* — memory per end-user —
already on Postgres/Supabase, building with Claude Code/Cursor/Codex.
**Pain:** per-user memory means isolation done right (RLS,
`end_user_id`/`thread_id` scoping), TTL, and analytics over what agents
remembered — plumbing they don't want to own; cross-user leakage is a shipping
blocker. **Default alternative:** a DIY `memories` table on the Postgres they
already run — **not** a memory vendor; the honest counter is isolation
correctness at scale, zero schema design, TTL, and NL analytics (reach R-02
build-vs-buy). **"Works":** one command wires memory with per-agent RLS
(`app.agent_id`, SK-PIVOT-009) and per-end-user narrowing server-defaulted; TTL
sweeps `facts`; `nlqdb_query` answers "what did the agent remember per tenant
this week" without a warehouse. **ROI:** ~10–15 hrs/mo saved not hand-rolling
per-tenant memory; at $100–125/hr, **~$1,000–1,800/mo**, plus a Pinecone
Starter (~$70/mo). **Willingness to pay:** usage-based, predictable per-query.
**Phase 1 success:** ≥1 agent *product* publicly uses nlqdb as its per-user
memory layer.

---

## P3 — The Data-Curious Analyst / PM / Ops

**Role.** Not an engineer by title. PM, data analyst, founder's-first-ops-hire, customer success lead. Can write a SQL query if forced, but resents it. Lives in Metabase / Retool / Excel.

**Current pain.**
- The engineering team is the bottleneck for every ad-hoc question.
- Metabase dashboards cover yesterday's questions, not today's.
- They have a CSV from a vendor and want to answer "which of these overlap with our users" *right now*.
- They can't get credentials to prod anyway.

**Why they churn off existing DBs.** They're not on one. They're on spreadsheets.

**What "works" looks like.**
- Upload a CSV via the chat ("here's a vendor list, load it as a table called `vendor_dump`"). Ask questions of it.
- Join their uploaded data with engineering's prod data (read-only, scoped) via the same chat.
- Share a query result as a link. No "install this BI tool."

**Willingness to pay.** Team subscription, $20–50/seat, if their company already pays for similar tools.

**ROI (est.).** ~6–10 hrs/mo reclaimed from waiting on data tickets, pinging engineers, and re-doing analyses in Excel. At a $60–80/hr PM/ops rate, that's **~$400–800/mo** in their own time. The larger (and harder-to-quantify) gain: the 3–5 analyses per month that simply wouldn't have gotten prioritized at all now happen same-day.

**Representative queries.**
- `"load this CSV as 'leads_q2'"` (with a file drop)
- `"how many of these leads are already customers"` (join across datasets)
- `"churn rate by acquisition channel, last 6 months"`
- `"send me this as a weekly email every Monday"` (scheduled queries — Phase 2 feature)

**Real-life use case.** Priya is a growth PM at a 30-person SaaS. Thursday afternoon a conference vendor emails a 12k-row CSV of leads. She drops it in the chat: `"load this as conference_leads_q2"`. Then: `"how many of these are already in our users table, and which plan are they on"` — the chat joins her upload with a read-only mirror of prod. She has the numbers for her 4pm exec sync without opening a data-request ticket, and shares a result link in Slack.

**Phase 1 success for this persona.** A non-engineer completes a real analysis that would have required a 3-day engineering ticket, using only chat + CSV upload. We do need CSV upload in Phase 1 for this to work.

**Note.** This persona stretches Phase 1 scope. If we must cut something, CSV upload is the first thing on the chopping block — but it's cheap to ship and opens this whole segment. Keep it in.

---

## P4 — The Backend Engineer at a Small Startup

**Role.** One of 5–15 engineers at a seed/Series A startup. Runs their own Postgres on RDS or Supabase. Owns the database among other things.

**Current pain.**
- Not provisioning — they're fine with Postgres. The pain is the **internal admin UI** they keep being asked to build: "can you add a page to bulk-refund these orders," "can you show me which users are on the old plan," etc.
- Retool / internal tools cost $50/dev/month and require building forms.

**Why they might adopt nlqdb.** Not as the primary DB (yet). As the **NL layer over their existing Postgres**.

**What "works" looks like.**
- Point nlqdb at their existing Postgres connection string. nlqdb becomes the chat interface without owning the data.
- Team gets a shared workspace with permissioning (who can run destructive queries).
- Auditable query log.

**Willingness to pay.** $100–300/mo for the team, happily, if it kills their Retool bill.

**ROI (est.).** ~10–20 engineering hrs/mo saved across the team by not building and maintaining one-off internal admin pages. At a $125/hr fully-loaded rate, that's **~$1,250–2,500/mo** in reclaimed dev capacity, plus killing a 5-seat Retool subscription (~$250/mo) and cutting the on-call "can you run this query for me" interrupt tax. Realistic blended total: **~$1,500–2,750/mo** per team.

**Representative queries.**
- `"refund orders in state 'pending-dispute' older than 60 days, but preview first"`
- `"users who signed up via the iOS promo link in March"`
- `"migrate users from plan 'starter' to 'basic'"` (with diff preview)

**Real-life use case.** Dmitri is on-call at a 20-person startup. Support escalates: a pricing bug double-charged ~180 customers between 11pm and midnight. Instead of writing a one-off refund script, he opens the team workspace pointed at their existing Postgres, types the refund in plain English, and reviews the generated diff (183 rows, $2,104 total) before approving. The audit log captures who ran it, and the Retool page he would've had to build doesn't need to exist. *(Requires BYO-Postgres mode — active development per `SK-DB-011`; not yet shipped.)*

**Phase 1 treatment.** This persona needs "bring your own Postgres" mode — **now in active development** per [`SK-DB-011`](../features/db-adapter/decisions/SK-DB-011-byo-postgres-promoted.md) (design shape locked in `docs/architecture.md §3.6.7`). Not yet shipped: capture inbound and tell them "we'll email you" when it lands.

---

## P5 — The Student / First-Timer

**Role.** Learning to code. Building a portfolio project. First-time backend exposure.

**Current pain.**
- Setting up Postgres locally is day 1's biggest blocker.
- Doesn't know the difference between a row and a document. Shouldn't have to.

**Why they matter.** They become P1 in two years. Also: a great free-tier audience that doesn't cost us much.

**What "works" looks like.**
- Free forever for small projects.
- The chat teaches them as they go ("I added a `users` table with columns `id`, `email`, `name` — here's the SQL I ran, if you're curious").

**Willingness to pay.** $0 now. Graduates to P1 when their project gets real.

**ROI (est.).** Not a dollar story — ~4–8 hrs of day-1 setup pain eliminated at the start of each project, and a non-zero number of students who would have quit the course on day 2 stay in it. The value here is retention and eventual graduation into P1, not monthly revenue.

**Real-life use case.** Aarav is doing the CS50 web track. Instead of spending day one fighting `brew install postgresql` and password errors, he runs `nlq db create cs50_final` and types `"i need a table for blog posts with title, body, and author"`. The chat creates it and shows him the SQL it ran, which he pastes into his notes for the write-up. He ships the assignment by Wednesday and actually understands what a foreign key is by the end of it.

**Phase 1 treatment.** Served by the free tier. No special product work.

---

## P6 — The Analytics / Observability Engineer

**Role.** SRE debugging incidents against a ClickHouse + OTel stack (SigNoz, HyperDX, ClickStack), or a data / analytics engineer querying ClickHouse for product events (DAU, funnels, revenue). Writes SQL. Has a working data pipeline. The pain is not the storage — it is the query surface.

**Current pain.**
- ClickHouse SQL rewards deep familiarity — `ARRAY JOIN`, aggregate combinators, `MergeTree` semantics. It punishes ad-hoc queries from anyone who didn't write the schema.
- LGTM-stack SREs must juggle PromQL, LogQL, and TraceQL to correlate one incident.
- Existing NL-to-ClickHouse tools (DataStoria, Chat2DB, Beekeeper AI Shell) are generic: they know column names but not domain context; no plan cache, no schema-growth tracking, not embedded where triage happens.
- ClickHouse added native NL-to-SQL in v25.7 but only in the CLI/playground — not embeddable, not API-accessible.

**What "works" looks like.**
- `POST /v1/db/connect { connection_url: "https://ch.company.com:8443", … }` → schema introspected at connect time; NL queries work immediately.
- Same `/v1/ask` endpoint, same chat UI — BYO is invisible to the query path.
- "p99 latency for checkout, last 6 hours, by customer tier" → compiled ClickHouse SQL, executed, streamed back.
- No data migration. No new storage cost to them.

**Willingness to pay.** $25–50/mo individually; team plan natural when the full SRE team uses it. Already paying for ClickHouse Cloud or SigNoz — one more line item is fine if it saves incident hours.

**ROI (est.).** ~5–10 hrs/mo per engineer freed from context-switching and ad-hoc ClickHouse SQL. At $100–125/hr: **~$500–1,250/mo** per engineer. For a 4-person SRE team, blended total: **~$2,000–5,000/mo** in reclaimed investigation time — and faster MTTR on the incidents that actually page people.

**Representative queries.**
- `"p99 and p50 latency for checkout, last 6 hours, grouped by customer tier"`
- `"which trace IDs had errors in the payment flow in the last hour"`
- `"top 10 slowest queries across all services yesterday"`
- `"how many spans per minute arrived during the 8:45–9:15 incident window"`

**Real-life use case.** Yuki is on-call at a 40-person startup running SigNoz on self-hosted ClickHouse. At 9am Monday an alert fires: checkout p99 at 4s. Instead of joining `otel_traces` with `otel_logs` by hand in the ClickHouse console, Yuki opens the nlqdb chat pointed at their cluster: `"which services contributed to the checkout latency spike between 8:45 and 9:10"` — ranked breakdown in under 2s. Then: `"top error messages from those services during that window"`. Five minutes of chat replaces 45 minutes of SQL and dashboard-hopping.

**Phase 1 treatment.** **Now in active development** per [`SK-MULTIENG-005`](../features/multi-engine-adapter/decisions/SK-MULTIENG-005-byo-clickhouse-promoted.md); until it ships, acknowledge inbound on the homepage ("Already running ClickHouse? Tell us"). Do not conflate with the managed OTel ingestion pivot in [`otel-grafana-pivot.md`](./otel-grafana-pivot.md): P6 is an NL query skin over the user's existing ClickHouse, not nlqdb owning the storage.

**Open questions (resolve before promoting to a feature).**
- **Read-only enforcement is non-trivial in ClickHouse.** `readonly = 1` does *not* block DDL — TRUNCATE, DROP, ALTER still execute. Safe BYO requires `readonly = 1` + `allow_ddl = 0` + RBAC `GRANT SELECT`, or extending `sql-allowlist` to ClickHouse grammar. ClickHouse's own `mcp-clickhouse` ships with this gap open.
- **Signal threshold:** follow §6 pattern — ≥5 unsolicited inbound asks before engineering work starts.

---

## Anti-Personas (who we explicitly do NOT serve in Phase 1)

Being clear about this prevents scope creep and bad-fit support tickets.

### A1 — The Regulated Enterprise

Finance, healthcare, anyone with HIPAA/SOC2/GDPR-DPA requirements today. We are not compliant yet, our LLM providers make data-handling a hard conversation, and "an LLM might look at my PII" is a non-starter. Point them at a roadmap page; revisit in Phase 3.

### A2 — High-Volume OLTP at Scale

Payment processors, ad-tech, real-time bidding, anyone doing >10k writes/sec. Our abstraction tax (within 1.3× of hand-written queries, per `docs/features/multi-engine-adapter/FEATURE.md` Phase 2 exit criteria) means we're not for the top of that curve yet. They should run Postgres / CockroachDB / Scylla directly.

### A3 — Strict-Schema Shops Built Around dbt / Great Expectations / Flyway

Their whole workflow is about pinning schema. Our whole workflow is about inferring it. Fundamental mismatch. We will never convince them and shouldn't try.

### A4 — Users Who Want a BI Tool

If someone wants dashboards, charts, scheduled reports, embedded analytics — that is Metabase / Hex / Mode / Superset. We can be the *data* layer underneath one of those eventually, but we are not building the visualization product.

### A5 — Users Who Want an ORM

Prisma / Drizzle / SQLAlchemy are not what we are. If they want codegen from a schema they control, we're the wrong tool.

---

## Use Case → Feature Priority

Ranked by how much of Phase 1 capacity they deserve.

| Use case | Persona | Priority | Notes |
|---|---|---|---|
| Solo dev prototyping a new app's DB | P1 | **P0** | The flagship journey. Optimize onboarding for this. |
| Agent giving itself memory via MCP | P2a | **P0** | MCP server is the first item in the Phase 2 distribution slice (see `docs/phase-plan.md §4`); Phase 1 must still flow for an agent-shaped first call. |
| Non-engineer answering a one-off question from a CSV | P3 | **P1** | Requires CSV upload. Ship it. |
| Solo dev using chat as an admin UI over their own nlqdb | P1 | **P1** | Falls out of P0 naturally. |
| Startup team using chat as admin UI over *their own* PG | P4 | **Active (`SK-DB-011`)** | BYO-connection per `docs/architecture.md §3.6.7`; promoted from Phase 4+; not yet shipped. |
| SRE / data engineer querying their existing ClickHouse | P6 | **Active (`SK-MULTIENG-005`)** | BYO ClickHouse via HTTP — easier on Workers than BYO Postgres; promoted from Phase 4+. |
| Scheduled/recurring queries ("email me this weekly") | P3 | **Phase 2** | Useful but not foundational. |
| Destructive ops with NL-diff preview | P1, P4 | **Phase 1.5 (`GLOBAL-023` SK-TRUST-001)** | Trust-building. Ships with the trust-UX slice. |
| Sharing a query result by link | P3, P1 | **P1** | Cheap to build, high word-of-mouth. |
| Team workspaces with roles | P4 | **Phase 3** | Per `docs/phase-plan.md §5`. |
| Embedded NL-query widget in user's own app | — | **Phase 3** | Tempting but dilutes the message. |

**P0 = must ship in Phase 1. P1 = ship in Phase 1 if capacity allows. Phase 2+ = explicitly deferred.**

---

## Validation plan

For each P0 persona, before we declare Phase 1 done:

- **P1 Solo Builder:** 5 design partners each ship a real project using nlqdb as the primary DB. **Paid-conversion target (≥ 2 to Hobby)** becomes measurable once Stripe live-mode go-live lands (`docs/blocked-by-human.md`). The equivalent qualitative gate is the Sean Ellis "very disappointed" check in [`docs/founder-playbook.md §2`](../founder-playbook.md).
- **P2a/P2b Agent Builders:** MCP server installed in 3 distinct agent frameworks in the wild (P2a). At least 1 agent *product* publicly integrates nlqdb as its per-user memory layer (P2b). (MCP is the first item in the Phase 2 distribution slice — this validation gate is measured *after* MCP ships, not pre-Phase-2.)
- **P3 Analyst:** 3 non-engineers complete a real analysis end-to-end in under 10 minutes, unassisted, in user tests.

If any of these don't hit, we don't ship Phase 2 — we iterate.
