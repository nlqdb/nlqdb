---
name: nlqdb-docs-memory
description: Turn this repo's markdown docs into a queryable nlqdb memory database — decision IDs and statuses, open questions with ages, queues, ledgers, and the cross-references between them. Use when asked which features have stale open questions, which decisions reference a given ID, what is blocked and since when, or to re-sync the memory DB after docs change. Extracts structure only; never ingests prose.
---

# nlqdb — turn this repo's docs into queryable memory

A repo's `docs/` already holds its operating state: decision records with IDs
and statuses, open questions, queues, trackers, and the references between
them. Grep answers "where is it written". It cannot answer **"which features
have open questions older than 30 days"** — that is an aggregation, and it is
the reason this skill exists.

This skill extracts that structure into an nlqdb memory database and keeps it
fresh. **One-way only:** markdown stays the canonical, git-reviewed source of
truth; the memory DB is a derived index. Never edit a markdown file to match
the DB — if they disagree, the DB is wrong, so re-sync.

## What to extract — structure only

Extract an item only when it has an **identity** and at least one **queryable
attribute** (a status, a date, or an edge to another item):

- **Decisions / ADRs** — id, title, status, date, superseded-by.
- **Open questions** — one line each, the doc they live in, the date they
  first appeared (that date is what makes an *age* query possible).
- **Queues, trackers, ledgers** — item, state (`todo` / `blocked` / `done`),
  what it is blocked on, and since when.
- **Cross-references** — "X references Y" as its own row, so reference
  questions are a join and not a grep.

**Never ingest arbitrary prose.** No paragraph chunking, no whole-file dumps,
no embeddings of narrative text. Rationale sections, guides, tutorials and
READMEs are out of scope in v1: a chunked-prose store answers recall questions
that `grep` and your own context window already answer, while making every
aggregate query unreliable. If an item has no id, no status, no date and no
edge, **skip it** — a skipped row costs nothing; a fabricated one poisons every
count built on it.

**Never store secret values.** If a doc mentions a credential — an API key,
token, password — store only its *metadata* (service, key name, scope, dates).
The value itself never enters a `content` field, even redacted.

Keep each `content` a single self-describing sentence including the id
(`"SK-AUTH-004 status: implemented"`, not `"implemented"`), so a row still
reads correctly on its own in a result set.

## Setup (once)

Connect the hosted MCP server — run in your terminal:

```bash
claude mcp add --transport http nlqdb https://mcp.nlqdb.com/mcp
```

The first tool call opens a browser OAuth page once; approve it and the host
stores the token. For the **unattended** re-sync below nobody is at a browser,
so use the headless route instead — the same tools run locally over stdio
against the same production API, authenticated by a key. Mint an `sk_mcp_` MCP
key at https://app.nlqdb.com/app/keys — scoped to MCP (ask, list, describe,
read/write memory; no external-database connects, no key management) and
revocable on its own — then:

```bash
claude mcp add --env NLQDB_API_KEY=sk_mcp_REPLACE_ME --transport stdio nlqdb -- npx -y @nlqdb/mcp
```

## Availability — verify with one call, don't trust this snapshot

`nlqdb_remember` and the typed `agent_memory_v1` preset are **live in
production for signed-in keys** (`MEMORY_PRESET=1` since 2026-07-29) — but the
flag is a one-var rollback and this file lands in repos nobody re-reads, so
check rather than assume: if the flag is ever off, `nlqdb_remember` returns
`wrong_preset` and creating a preset database returns `preset_disabled`. The
tool is registered and visible either way, so do not read its presence as
availability.

**The always-on path:** `nlqdb_query` — reads *and* writes, in plain English,
against a database nlqdb provisions on first reference. If the preset is
unavailable to you (anonymous session, or a rollback), everything below runs
on that path too: describe the four-table shape in your first call's goal,
then write and read with `nlqdb_query`. Be honest with yourself about the
difference — that schema is *inferred*, so column names may vary; call
`nlqdb_describe` once and adapt. The extraction rules, the sync protocol and
the queries are identical on both paths, so nothing has to be redone if you
started on the fallback.

## Where each doc structure lands

Four tables (`agent_memory_v1`):

| Doc structure | Table | How |
|---|---|---|
| Feature, decision id, queue item, doc | `entities` | `kind` = `feature` / `decision` / `queue_item` / `doc`, `canonical_name` = the id or slug. Upserts on (agent, kind, name) — re-running is free. |
| Status, open question, blocked reason, tracker row, reference | `facts` | `kind` = `decision_status` / `open_question` / `blocked` / `tracker_row` / `reference` / `retired`, `content` = the one-line statement. |
| Which entities a fact is about | `entity_facts` | The precise join. `nlqdb_remember` cannot write this link table — write it with one `nlqdb_query` call after the fact + entities exist, or rely on `facts.tags` (below) and skip it. |
| Each sync run | `episodes` | `role: "sync"`, `content` = commit sha + counts. This is the audit trail of the index itself. |

On every fact set:

- `tags` — every id the row touches (`["auth", "SK-AUTH-004", "GLOBAL-013"]`).
  Cheapest link, and enough for most queries on its own.
- `source` — `{ "path": "docs/features/auth/FEATURE.md", "key": "<stable
  key>", "digest": "<short hash of the extracted value>" }`. The `key` is what
  makes re-runs converge; the `digest` is what makes them cheap.

Pick the `key` so it survives an unrelated edit to the same file: prefer
`<path>#<item-id>` (`docs/features/auth/FEATURE.md#SK-AUTH-004`), and for
items with no id use `<path>#<heading-slug>:<stable-slug-of-the-line>`. Never
put a line number in a key — every insert above it would look like a change.

## Sync protocol — idempotent and convergent

Facts are append-only (there is no fact-update verb, and the history is worth
keeping: it is what answers "since when"). Convergence comes from the `key`:

1. **Read first.** For each doc you are about to sync, ask nlqdb for the
   newest fact per `source.key` under that path, with its digest.
2. **Write only what differs.** New key → write the fact. Same key, different
   digest → write a **new** fact with the same key; the newest row wins on
   read (see the current-status query below). Same key, same digest → write
   nothing.
3. **Removed from markdown** → write one `kind: "retired"` fact under the same
   key. A later run sees the tombstone and does nothing. Never delete history.
4. **Close the run** with one `episodes` row: commit sha, facts written,
   changed, retired.

Run this twice on an unchanged tree and the second run writes exactly one row
(the episode). That is the invariant to check before trusting any count.

## Keeping it fresh

Pick one — both are one-way, both are safe to run repeatedly:

- **On merge** — a CI step on pushes to the default branch that syncs only the
  docs the merge touched (`git diff --name-only`). Use the headless route
  above with an `sk_mcp_` key from the runner's secrets. Cheapest and the
  most current.
- **At session start** — sync the docs changed since the last `episodes` row's
  commit sha before doing anything else. Costs one read per session and needs
  no CI, but the index is only as fresh as the last session.

Never wire a hook in the other direction. nlqdb does not write markdown.

## The queries this exists for

Ask these with `nlqdb_query` — plain English, and it returns rows plus the SQL
it ran in `trace`:

- `nlqdb_query(q: "which features have open questions older than 30 days? show the feature and the oldest question's age in days")`
- `nlqdb_query(q: "which decisions reference GLOBAL-013?")`
- `nlqdb_query(q: "what is blocked, and since when?")`
- `nlqdb_query(q: "what is SK-ASK-011's current status? use the most recent decision_status fact")`
- `nlqdb_query(q: "how many open questions does each feature have? ignore duplicates re-written by later syncs")`
- `nlqdb_query(q: "which tracker facts have expired?")`
- `nlqdb_query(q: "list the doc-sync runs in order, with what each one wrote")`

Every one is a `GROUP BY` / `JOIN` / date-arithmetic question. That is the
whole point: a vector store returns the paragraphs that *mention* open
questions; this returns the count per feature, and the ages.

Full guide: https://docs.nlqdb.com/agent-memory/?utm_source=agent-artifacts ·
Learn more: https://nlqdb.com/agents?utm_source=agent-artifacts
