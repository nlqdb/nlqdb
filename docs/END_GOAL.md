# End goal — nlqdb, finished

The autonomous DBA as the user meets it, attached to the database they
already run — no phase labels in the flow. Shaping every row:
[`GLOBAL-043`](decisions/GLOBAL-043-attach-first-autonomous-dba.md),
[`GLOBAL-025`](decisions/GLOBAL-025-north-star.md).

## How agents use this doc

**The top-ranked document in this repo** — it outranks the roadmap, `CLAUDE.md`
P1–P6, every `GLOBAL` and every `FEATURE.md`. Read before taking an item or
judging a PR: whatever contradicts a flow or principle here is the bug, fixed
in that PR (or the founder amends this doc in that PR). A
gap is a [`blocked-by-human.md`](blocked-by-human.md) decision (`GLOBAL-033`),
never a licence to invent.

## Mission

Every company building an app walks the same expensive, trial-and-error road
to a good database infrastructure: data model, indexing, sharding, scheduled
jobs and more. nlqdb's job is to save that journey and encapsulate it, so a
team gets that infrastructure while it builds the app — without giving up any
of the security, performance and error handling it needs to operate at scale.

## Love over reach

**100 users who love nlqdb beat 1 000 000 who like it.** Every trade between
depth and breadth goes to depth: a change that makes nlqdb indispensable to
the users it already fits outranks one that widens reach. Love is measured,
never assumed — users who come back unprompted and would be very disappointed
without it (the Sean-Ellis share and session retention in `GLOBAL-025`) —
never visits, signups or impressions.

## Architecture — simple and scalable

The DBA loop — observe → propose → apply → verify → revert (`GLOBAL-043`) —
runs on one design, never on patches. **Patch-on-patch**: a fix or feature that
adds a conditional, layer, flag, table or special case on top of existing
machinery instead of changing the machinery. Faced with one: stop, re-derive
the simplest design that serves the whole loop, implement that, delete what it
replaces. **Scalable**: that one design holds at 1 table and 1 000 tables,
1 tenant and 10 k tenants, Postgres and D1 — no per-scale rewrite, no
per-tenant or per-engine branch; an engine adds an observer and an apply
call behind the `packages/db` seam, nothing else.

## Personas & entry points

- **Solo builder / small team** ([P1](research/personas.md)) — already on Supabase, Neon, RDS or D1, app shipped, tables growing. Enters by pasting a connection string. Wins: the index nobody added, applied and measured, without becoming a DBA.
- **The coding agent** — Claude Code or Cursor, which just created the database. Enters through MCP. Wins: attaches the DB, lists proposals, applies what its app needs under the owner's ceiling.
- **The fixer** — any agent that changes nlqdb, including `/daily`. Before it designs, it re-reads this doc and holds the whole loop and the four pillars in [`GLOBAL-025`](decisions/GLOBAL-025-north-star.md): engine quality, onboarding, UX, performance. The change advances at least one and leaves the other three at their floors; which pillar moves, and the floor that would show a drop, are named before code. It designs for leverage: what already exists, which category this issue is an instance of, what the next one of that kind will cost, then the simplest change to the machinery the loop already runs on. Category and N+1 are written before code; the three-line verdict is reconciled against the diff. A fix that only covers the symptom in front of it is the patch-on-patch defined above.
- **Operator of a live DB** — the same person weeks on, at `/app/dba`. Wins: every change the DBA made, each with its measurement and its undo.

## The happy path

| # | Sees | Does | Latency |
|---|------|------|---------|
| 1 | One attach, four doors: the nlqdb.com form, `npx nlqdb attach <connection-string>`, `POST /v1/attach` via `@nlqdb/sdk`, or an MCP tool call. D1 attaches with a Cloudflare API token + account and database id. The permissions it needs are named up front: observe = `pg_read_all_stats`, apply = `CREATE` | pastes a connection string, once | seconds |
| 2 | First proposals: catalog findings (FKs without indexes, sizes, settings) at once; workload findings from `pg_stat_statements` after a snapshot window | waits, or leaves — nothing to configure | KPI A < 5 min |
| 3 | One proposal: the diff, the fingerprint it targets, expected effect (HypoPG what-if, or selectivity heuristics where the host lacks it), the inverse, and its cost — build time, size, write overhead | reads one card | — |
| 4 | **Apply** queues it for a low-load window and builds it (`CONCURRENTLY` on Postgres); **reject** asks for a reason and records it | one click | the window |
| 5 | The verify window: before/after p95 on the same fingerprint, from the same counters — on D1 also rows read, the billed cost | watches, or doesn't | 30 min–72 h |
| 6 | Kept with its measured delta, or auto-reverted on regression with both measurements shown; **undo** replays the inverse at any time | nothing, or one click | one round trip |
| 7 | `/app/dba` — every change, newest first: who decided (person, agent, policy), diff, inverse, before/after, cost; proposals waiting; per-category auto-apply (off by default) and agent-approval limits (default: the owner's one-click ceiling) | opens one page | page-load |
| 8 | The agent door: the coding agent attaches the DB it just created with one MCP call; `nlqdb_list_proposals`, `nlqdb_apply_proposal`, `nlqdb_reject_proposal` | one tool call | KPI A |
| 9 | The coding agent lists proposals, applies the index its app needs, and the verify window judges it like any other apply | one tool call | the window |
| 10 | The playbook keeps growing on the same card: unused-index drops, bloat and autovacuum, retypes and enums, partitioning, retention, then placement | applies, or rejects | — |

**Not in this flow:** no migration onto nlqdb, nothing of nlqdb in the app's
request path, no change applied without a click (until the owner opts a category
in), no advisory-only tab — every proposal can be applied from where it is
shown.

**Surface feel:** nlqdb.com has one primary action — paste a connection
string — and every other band is secondary to row 1.

## Empty, error, and edge states

| State | Trigger | Sees | Can do |
|-------|---------|------|--------|
| No `pg_stat_statements` | Extension not enabled | Catalog-tier proposals only, and the one statement (or host toggle) that enables it | Enable it; workload proposals follow after a snapshot window |
| No HypoPG | Host lacks it (RDS) | The expected effect from `pg_stats` selectivity, labelled as an estimate; the verify window decides | Apply; the measurement keeps or reverts it |
| Read-only role | The role can observe but not `CREATE` | Every proposal as a copy-paste migration with its inverse — never a silent skip | Run it by hand, or grant `CREATE` |
| Regression in the window | p95 on the fingerprint worsens | Auto-reverted; both measurements on the ledger row | Nothing — the old plan is back |
| An agent's apply regresses | An agent principal approved it | Auto-reverted exactly like a human's; both measurements in the ledger, the agent's principal named | Restrict that agent's category in `/app/dba` |
| Too big to build | A D1 index can't finish inside D1's 30 s statement cap | The proposal says so and offers the DDL for a maintenance window | Run it in that window |
| Nothing to improve | Healthy DB | "Nothing worth changing yet — watching" and what was checked; never an invented proposal | Leave it attached |
| Can't connect | Bad string, network, egress guard, or revoked role | Which one, in one sentence (`GLOBAL-035`); no partial state | Fix and retry the same attach |

## Done looks like

- [ ] Every row above works on nlqdb.com, `/app/dba`, `@nlqdb/sdk`, the CLI and MCP (`GLOBAL-003`), Postgres and D1, inside the [`performance.md` §1](performance.md) SLOs.
- [ ] KPI A < 5 min, KPI B > 0 on every attached DB with a workload, KPI C = 100 % (`GLOBAL-043`); the other `GLOBAL-025` KPIs at their floors.
- [ ] The real rateme12's D1 is attached and its ledger shows applied changes with measured deltas ([`002-rateme12-attach.md`](history/dogfood-iterations/002-rateme12-attach.md)).
- [ ] The love gate opened: ≥ 3 of the first 10 hand-recruited builders came back unprompted in week 2, and the share keeps rising.
- [ ] Every change — index, drop, retype, partition, retention, placement — is a proposal with its inverse, its measurement and who decided.

## Non-goals

- **Not a database host, not an NL→SQL product, not a recommend-only advisor** (`GLOBAL-043`).
- **No LLM in any hot path.** The LLM explains and names, async; it never decides an apply or a revert.
- **Never on the app's request path.** An outage of nlqdb never takes the app down.
- **No change without its inverse and its measurement**, whoever decided it.
