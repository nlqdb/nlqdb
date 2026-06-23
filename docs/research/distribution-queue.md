# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

**Retention (D4, 20 KB cap):** keep the **two most recent full drafts** below
inline; everything older collapses to a one-line title + venue + gist, with the
full body recoverable from git history. The earliest drafts live in the
[archive](./distribution-queue-archive.md).

## 2026-06-23 (run 75) — Show HN / dev.to / r/mcp: "Every 'database MCP server' assumes you already have a database" (provision-from-English wedge)

**Where:** Show HN + dev.to (`ai` / `mcp` / `databases`) and a one-link r/mcp
helpful answer; build-in-public. The hook: the MCP ecosystem has dozens of DB
connectors and every one starts with "paste your connection string" — an agent
that needs a *scratch* database to write to and query has nowhere to put one
without a human doing the DBA work first. nlqdb mentioned once. Anchors
`/solve/database-claude-cursor-can-query`.

**Title:** Every "database MCP server" assumes you already have a database

**Body:**

> I was wiring up database access for an agent over MCP and went shopping for a
> server. There are a lot of good ones — Postgres, SQL Server, SQLite, a
> multi-DB bridge. Every single one opens the same way: provision a database,
> design the schema, paste the connection string into the host config. Which is
> exactly right when the database is your source of truth and the agent is a
> read client over it.
>
> But that wasn't my case. I wanted the agent to have a *scratch* store — a
> place to log what it did and then answer "how many of each this week" over it.
> That database doesn't exist yet. None of the connectors help, because step one
> of all of them is "have a database." The DBA work is the prerequisite, and the
> agent can't do it for itself through the same tool it queries with.
>
> The shape I actually wanted: the agent's *first English goal* provisions the
> store. No connection string, no `CREATE TABLE`. Call one tool with no database
> set — "tasks grouped by status with a count of each" — and it mints Postgres,
> infers the schema, runs the aggregate, and hands back rows plus the SQL it ran
> so I can audit the grain. Create and query are the same call; there's
> deliberately no separate "create database" verb to get the trust boundary
> wrong.
>
> The trade-off is the honest part, and it's the inverse of the connectors:
> a tool that provisions its own database can't query the one you already run.
> If your warehouse is the source of truth, you want a Postgres-MCP server, not
> this. The two are different jobs — "connect my agent to my database" vs. "give
> my agent a database" — and "database MCP server" is one phrase covering both.
>
> (We hit this building nlqdb's MCP surface; the provision-from-English path is
> `nlqdb_query` with no `db` set against `mcp.nlqdb.com`.)

**Why this advances the north-star:** onboarding / distribution — a
search-shaped on-ramp for the high-volume "database MCP server" query that
names the provision-vs-connect distinction honestly, one nlqdb mention. No
engine/funnel KPI degrades (one solve-page data object + doc edits).

## 2026-06-23 (run 72) — dev.to / lobste.rs: "Your BI tool got an AI assistant. Your agent still can't call it." (assistant-in-an-app vs. callable backend)

**Where:** dev.to + lobste.rs (`ai` / `databases` / `llm`); build-in-public,
the P3-BI sibling to the read-vs-own post (run 70) but on a different axis —
*where the AI lives*, not what it owns. The hook: open-source BI tools are
shipping excellent in-app AI assistants, and that's exactly why it's easy to
mistake one for an agent backend. nlqdb mentioned once. Anchors `/vs/metabase`.

**Title:** Your BI tool got an AI assistant. Your agent still can't call it.

**Body:**

> The open-source BI tools have caught up fast. The one I use just shipped an AI
> assistant that answers questions in plain English, builds a chart from a
> prompt, writes SQL in the native editor, and even has a "fix it" button when
> the SQL errors. It answers in Slack. It's genuinely good, and on the
> open-source edition you get basic SQL generation for free. If a human analyst
> lives in that tool all day, this is a real upgrade.
>
> Then I tried to wire it into an agent, and the shape gave it away. The AI
> assistant is a *feature inside a destination app*: it helps a person who is
> already logged into the dashboard tool, looking at a chart. There's no handle
> an autonomous agent can grab — no "provision me a database, write these rows,
> then query it" primitive. The assistant makes the human faster; it isn't a
> backend the software can call.
>
> That's the distinction the word "AI" papers over. "Natural-language SQL" shows
> up in two completely different products. One is an assistant bolted onto a BI
> UI for analysts — read-only over a warehouse someone else maintains, answers
> rendered as charts in that tool. The other is a queryable data layer: it
> *owns* the database, takes English for the write as well as the read, and is
> callable from code, an HTTP API, or an MCP tool an agent invokes — the answer
> comes back as rows your app embeds, not a dashboard you log in to see.
>
> (At nlqdb that callable shape is the whole product: an agent calls one MCP
> tool, the Postgres materialises on first reference, writes and migrations are
> diff-previewed in English before they apply, and the result renders in one web
> component.)
>
> Lesson: "our BI tool has an AI assistant now" and "an agent can use this as its
> database" are different claims on different axes. One is about *who* the AI
> helps (a logged-in human); the other is about *whether software can call it*.
> Before you point an agent at your analytics stack, ask whether the AI is a
> feature in an app or a primitive in an API.

**Why this advances the north-star:** onboarding / distribution — an
assistant-in-an-app vs. callable-backend framing (one nlqdb mention) that
anchors `/vs/metabase` and the P3 analyst/BI lane. No engine/funnel KPI degrades
(positioning content only).

## Collapsed — full drafts in git history

Newest first; collapsed once past the two-draft inline window above. Each line
is title + venue + one-line gist; `git log -p docs/research/distribution-queue.md`
recovers any body.

### Engine-lesson posts (dev.to / lobste.rs)
- run 70 — "Your AI BI tool reads your data. It doesn't own it — and can't write to it" (a wave of AI-native BI tools converge on "describe what to track, AI builds the dashboard" — great at it, but "your data" is a read-only connection to a warehouse you already run; they don't own a DB or write to yours; the data layer that provisions the store and takes English for the write *and* the read is a different altitude; anchors `/vs/basedash`).
- run 69 — "Your sitemap is advertising redirects — and your canonical tag points at one" (a static host serving `route/index.html` makes the bare path a 307, but `canonical`/`og:url`/sitemap/llms.txt all emitted the bare path — 27 redirecting sitemap URLs + a self-referential redirecting canonical; `trailingSlash: "always"` plus a one-place path-normalize in the head layout + URL generators, audit with `curl -sI` over every sitemap URL).
- run 68 — "Your offline LLM eval isn't measuring your model — it's measuring your rate limits" (a tiny NL→SQL bench on a free multi-provider chain scored 17/20 then 6/20 ninety seconds later; the engine didn't regress, the providers got tired — `circuit_open`/`rate_limited` errors with p50=0ms are availability, not accuracy; throttle to measure reasoning, pause-and-resume on exhaustion, keep the smoke test apart from the powered windowed run).
- run 67 — "AI made the internal-tool builder faster. It didn't ask whether you needed the tool." (low-code AI — AppGen / Ask AI / agents — scaffolds the admin tool faster, but the output is still a destination a human builds and operates; often the answer belongs inline in the product you already ship, or the asker is an agent that wants a backend primitive, not a built tool — check whether the AI sped up the workflow or the outcome; anchors `/vs/retool`).
- run 66 — "Your most over-documented code is your security code — and that's where stale docs lie loudest" (security code attracts callsite-by-callsite "consequence in code" narration because terse feels irresponsible; but a list of today's callsites + test names is the fastest-rotting prose in the repo, and a stale "every site is checked" reads as a guarantee — document the enforced invariant + review rule, not the implementation tour).
- run 65 — "Two homes for one decision is drift — even inside the same file" (single-source-of-truth isn't only cross-file: a long doc paraphrasing its own decision two headings down is the same drift bug; a pointer can't drift, a paraphrase is a hand-synced copy — link up and add only what's local to the section).
- run 64 — "Your AI data analyst can't be your app's backend (and vice versa)" (an analysis app is a destination — a human uploads/connects data and reads a chart; a product backend owns the write path and is queried programmatically on every request; "talks to your data in English" is one phrase covering two contracts — pick the one you're buying; anchors `/vs/julius`).

- run 62 — "Your decision record is just narrating code the reader can already read" (a "Consequence in code" section that lists files, functions, and line numbers is a second, worse copy of the code — untestable and already stale; keep only the why / rejected path / non-obvious constraint, cut the implementation narration; load-bearing decisions only).
- run 61 — "Quantization made your recall cheaper. It still can't count." (quantization optimises *how cheaply* you retrieve the nearest items, not *what* you can compute over them; scalar/binary/product compression still yields a ranked list, never a `GROUP BY`/`COUNT`/`HAVING` — recall and reporting are two jobs; anchors `/vs/qdrant`).
- run 60 — "Your architecture doc is describing a pipeline your code deleted" (a superseded decision record gets fixed in its one canonical place, but every other doc that paraphrased it keeps narrating the dead version; link, don't restate, and grep the ID across all docs when something is superseded).
- run 59 — "Hybrid search made your recall smarter. It still can't count." (hybrid search optimises *which* items rank, not what you can compute over them; BM25+vector fusion is still a relevance score, not a `GROUP BY`/`COUNT`/`HAVING` — recall and reporting are two jobs; anchors `/vs/weaviate`).
- run 58 — "Your text-to-SQL eval is failing the wrong schema" (BIRD 0.52 / Spider 0.19 are academic-schema scores; the same free chain scores 0.90 EX on the ICP shape — score against your product's schema, and the two misses it surfaces are the ones users actually hit; persona-bench, SK-QUAL-018).
- run 56 — "'Self-hosted' fixes lock-in, not the query model — your open-source vector store still can't GROUP BY" (self-hosting answers vendor lock-in but not the query model; an OSS vector store still has no GROUP BY/JOIN/COUNT/HAVING — deployment and capability are orthogonal axes; anchors `/vs/chroma`).
- run 55 — "Your text-to-SQL accuracy is measured on schemas your users will never build" (BIRD/Spider run over messy 20–100-table academic schemas, not the small clean ones your users build; we added a third benchmark — hand-authored gold NL→SQL over the ICP shape, same EX scorer, literal-date gold so it never drifts with the clock; anchors persona-bench, SK-QUAL-018).
- run 53 — "Your agent's memory is a vector store. Ask it 'how many' and watch it fall over." (the aggregation gap: similarity search has no GROUP BY/COUNT/JOIN/HAVING; recall is similarity, reporting is aggregation — pick the store per job; anchors `/vs/pinecone`).
- run 52 — "Some few-shot retrieval misses can't be fixed with lexical tricks — and measuring *why* is the win" (two pinned ICP misses (q8/q10) are lexically unfixable; stopword filter regresses 18/20 → 17/20, phrase-normalisation flat (18/20), held-out 14/14; the bad demo wins on generic filler + a coincidental masked-value slot, so flat token-overlap can't resolve it — the real fix is SQL-skeleton similarity, a model round-trip; both experiments reverted).
- run 51 — "The most common query in your product has no row in your benchmark" (error-class taxonomies omit easy high-frequency shapes; "show the 10 most recent signups" retrieved a `GROUP BY` demo; +plain `ORDER BY … LIMIT` row, held-out 13/13 → 14/14, own-query 18/20 held).
- run 48 — "Test your few-shot retrieval against your *own* users' queries — not just the benchmark" (a held-out probe set that paraphrases your own examples reports green while real-user queries silently retrieve the wrong shape; "never logged in" → anti-join not `IS NULL`; own-query precision 17/20 → 18/20, held-out 13/13 unmoved).
- run 46 — "Your few-shot examples might be teaching the model the wrong shape" (retrieval quality is bounded by pool *coverage*, not the ranker; a one-word negation retrieves its own opposite if the pool can't represent the shape; +anti-join/+top-N-of-aggregate, precision held 12/12).
- runs 43–44 — "Your benchmark should look like your users' database, not a research paper's" (persona-bench: NL→SQL on the schema shapes users actually build; sound-ruler invariant 12/12 before any accuracy number).
- run 43 — "Ship your LLM lever as a default-off ablation — measure before you adopt" (`buildPlanSystem(goal, schema, k)`, `k=0` byte-identical; prove inert + token-negative before spending quota; closes runs 38–43 retrieval arc).
- run 42 — "Don't hand-pick few-shot examples — size the pool from your benchmark's error classes" (one exemplar per mismatch class; precision@1 10/10, 3.5× closer skeleton; `packages/llm/plan-exemplar-pool.ts`).
- run 41 — "Cross-schema few-shot retrieval: mask each example against *its own* schema" (`selectExemplarsForSchema`, per-row masking; `packages/llm/few-shot-select.ts`). Runs 37–42 value/identifier-masking + self-consistency stubs consolidated here.
- run 39 — "How nlqdb expires agent memory (and why only facts get a TTL)" (facts-only `expires_at`, per-DB-isolated daily `DELETE` + RLS recency clause; `SK-PIVOT-011`, E-04).
- run 37 — "Agent memory should be authed-only" (no durable identity to scope row reads on a throwaway anon DB; write verb + create both need a session).
- run 33 — "We were grading our text-to-SQL engine on questions it couldn't possibly answer" (Spider external-knowledge dropped; 13/135 unanswerable; SK-QUAL-016).
- run 18 — "We were one run away from building the wrong feature" (value-retrieval falsified, 90→0 literal-only; SK-QUAL-014).
- run 17 — "Our text-to-SQL benchmark went flat. That was the signal to stop tuning prompts" (directive levers saturated; McNemar p=0.50).
- run 16 — "Before you prune the schema you send an LLM, measure what the prune would throw away" (SK-QUAL-015).
- run 15 — "We thought our text-to-SQL engine couldn't join. A regex bug was lying to us" (SK-QUAL-014).
- run 14 — "The text-to-SQL mistake that fails two ways — and only one of them throws" (HAVING vs WHERE; SK-LLM-040).
- run 13 — "Schema pruning for text-to-SQL drops the one table the join needs" (inbound junction tables; SK-LLM-037).
- run 11 — "Failover, retry, repair: the three error classes in an LLM text-to-SQL pipeline" (SK-ASK-022).
- run 10 — "'Auto-re-probes so it recovers without a deploy' — a comment that was quietly false" (30-min `auth_denied` cooldown).
- run 9 — "The dead provider in the fast lane: when a hedged request races a 403" (SK-LLM-039).
- run 8 — "One bad row shouldn't cost you all the rows: salvaging LLM-generated seed data" (SK-HDC-019).

### Launch + build-in-public posts (X / Bluesky / HN / dev.to)

- run 57 — "Your 'instrumentation plan' is lying to you — the catalog already shipped" (once the work ships, delete the forward-looking plan table or it quietly becomes a worse copy of your live span/metric catalog + test suite; document the standing rule, not the rollout; observability-docs discipline).
- run 54 — "Your status table is drifting because it answers 'why', not just 'what'" (single-source-of-truth: a status table holds status + one-line essence + a link; the "why" lives once in the feature doc — two homes for one fact is drift with extra steps).
- run 46 — "We cap every doc at 20 KB — even the marketing backlog" (autonomous-agent context discipline; an over-cap edit must net-shrink; rolling two-draft window over the queue itself).
- run 45 — "Our waitlist has 79 rows. The honest count is 1." (honest funnel pull: 78/79 waitlist rows are us, genuine-stranger count is 1; gated on engine accuracy, GLOBAL-027).
- run 44 — "We demoted three of our four personas on the home page. On purpose." (agent-memory wedge above the fold; other three folded under a quiet divider; reversible composition change, GLOBAL-036 + WS-12).
- run 43 — "We moved agent memory above the fold — without touching the wordmark" (additive/reversible home band; Mem0·Zep·Letta·nlqdb matrix; GLOBAL-036 + WS-12).
- run 42 — launch image "GROUP BY your agent's memory" (`og/agents.png` + four `vs-*.png` cards, SK-PIVOT-004; the `/agents` share card).
- run 41 — "A live demo of analytical agent memory — the GROUP BY, and the SQL it ran" (fixture-backed `/agents` round-trip, no signup; typed-plan trust boundary).
- run 30 — "Show HN: Analytical memory for AI agents — a database it can GROUP BY, not just recall" (HN + r/AI_Agents/r/LocalLLaMA → `/agents`).
- run 53 — "Your agent's memory is a vector store. Ask it 'how many' and watch it fall over." (the aggregation gap: similarity search has no `GROUP BY`/`COUNT`/`JOIN`/`HAVING`; recall is similarity, reporting is aggregation — pick the store per job; anchors `/vs/pinecone`).
- run 30 — "Why your AI agent's memory should be a database, not a vector store" (WS-09 centrepiece; opens on the Replit incident, sub-target BIRD/Spider shown, open harness; → `/agents`).
- run 29 — "Your AI agent's memory, as four Postgres tables (no schema design required)" (the `agent_memory_v1` preset is the argument; docs page + dev.to).
- run 28 — agent-memory social/note drafts: "the one bright column" matrix teaser + "'Source-available' isn't a trap if you read the license" (FSL-1.1).
- run 27 — "Mem0 vs Zep vs Letta vs nlqdb — what can your agent actually DO with its memory?" (the capability matrix is the whole post; honest ◐ self-host row).

### Helpful-answer + comparison drafts (Reddit / Show HN)

- run 36 — "run a GROUP BY over your agent's memory in 30s, no signup" (r/AI_Agents / r/LocalLLaMA; one `/agents` link).
- run 32 — "Agent-memory scoping in nlqdb is row-level RLS, not query-rewriting" (dev.to / lobste.rs; SK-PIVOT-009, hold until E-03 lands).
- run 32 — "Give your AI agent memory from the terminal" (`nlq remember`; target must be a memory-preset DB).
- runs 23, 25 — analytics-over-agent-memory threads → `/solve/analytical-queries-over-agent-memory`, `/solve/give-ai-agent-persistent-memory`.
- runs 21–22 — WS-02 "X vs nlqdb" / "X alternative" posts → `/vs/langmem`, `/vs/letta`.

Earliest drafts: [`distribution-queue-archive.md`](./distribution-queue-archive.md).
