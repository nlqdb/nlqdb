# WS-14 — Memori response: `/vs/memori` + "recall-only surface" copy

**Status:** ⬜ not started
**Sequence:** 14 of 14 · **Risk:** low · **Runs:** ~2 · **Prereqs:** none (Memori anchored in `competitors.md §4`, 2026-08-30) · **Gate:** none

## Why (2026-08-30 research)

Memori (Memori Labs, ex-GibsonAI; Apache-2.0, $3.7M raised, ~16k stars,
Cloud launched 2026-03) is the first funded competitor to adopt the
"memory belongs in SQL" substrate. It stores memories in SQL (BYODB:
SQLite/Postgres/MySQL) but exposes only recall to the agent — no
NL→SQL / `GROUP BY`, no agent-designed schema, no diff preview. Free
tier is 5k memories created / 15k recalled per month; the next rung is
Team at $60K/yr. Two consequences:

- "Vector stores can't do SQL" is no longer a safe market-wide framing.
  The durable line is **"your agent can query its memory, not just be
  reminded of it"** — the enemy is recall-only *surfaces*, whatever the
  storage substrate.
- The $0 → $60K/yr pricing cliff leaves the indie/mid lane uncontested
  for nlqdb's $0 BYO-key wedge.

Sources: memorilabs.ai/pricing, `MemoriLabs/Memori` README + LICENSE
(re-verify at run time). Landscape entry: `docs/competitors.md §4`.

## Scorecard number it moves

Same as WS-02: each `/vs` page is a new AEO entry point → **registered
strangers reaching a first answer**. `Pivot:` line: `+1 memory /vs page`.

## Run 1 — `/vs/memori`

Follow WS-02's steps exactly (one `Competitor` entry in
`apps/web/src/data/competitors.ts`, persona `P2 agent builder`, bullets
≤ 16 words, real MCP tool names only, slug into `verify-flows.sh` +
stranger-test, checks green). Differentiation must reflect that Memori
**is** SQL-stored — lead with query-surface rows: aggregations/reporting
(`them: no`), agent designs its own schema (`no`), diff preview (`no`),
auto-capture from traces (`them: shipped`, us `no` — the honesty lever),
and the pricing shape (free cliff → $60K/yr vs $0 BYO-key).

## Run 2 — copy sharpen

Grep the wedge surfaces (`/agents` moat copy, the WS-09 blog, solve
pages) for "vector store"-shaped absolutes; where a claim would be
falsified by a SQL-storing recall-only competitor, reframe to the
recall-only-surface phrasing (the matrix aggregate-row note was already
sharpened 2026-08-30). Matrix stays four columns (SK-PIVOT-001).

## Cross-track notes (recorded here so they aren't lost; not this worksheet's slices)

- **Engine (E-track):** extend the SK-QUAL-023 agent-memory-quality
  head-to-head to include Memori's free tier as a compared backend.
- **Reach (R-track, `/reach` loop only):** "priced out of Memori Team"
  and "Memori can't answer analytical questions" are candidate
  interception moments for the reach backlog.
- **FOUNDER-GATED — auto-capture parity:** Memori's trace-native capture
  (SDK wraps the LLM client; memory happens passively) is a real
  onboarding edge over deliberate `nlqdb_remember`. An auto-capture SDK
  hook writing into `agent_memory_v1` would neutralize it while the
  analytical read side stays unique — scope and whose-LLM-cost are
  undecided; founder call before any E-slice is written.
- **WS-11 urgency:** an Apache-2.0 self-hostable neighbor makes the
  unshipped-container gap more visible. WS-11 stays infra-gated but
  rises in priority; do not lead with openness against Memori
  (GLOBAL-036 — lead on the true moat).

## Done when

- [ ] `/vs/memori` builds clean; facts web-verified with a date; slug
      lists updated; INDEX ticked.
- [ ] No wedge surface carries an absolute claim falsified by a
      SQL-storing recall-only competitor.

## Artifact

Show-HN / Reddit comparison draft ("Memori stores memory in SQL. nlqdb
lets your agent query it.") appended to `distribution-queue.md`.

## Rollback

Additive — delete the `competitors.ts` entry + slug-list lines; copy
edits revert cleanly.
