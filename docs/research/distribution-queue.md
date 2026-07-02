# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); publishing is autonomous —
drafts ship as canonical posts under `nlqdb.com/blog` with no founder review
(founder-resolved 2026-07-01; `SK-BLOG-001`). Newest first. Delete an entry once
published: the live URL goes into `docs/scorecard.md` § Shipped distribution, and
the entry survives here only as a venue pointer to the canonical `/blog` URL
until the community-venue variant is posted.

**Retention (D4, 20 KB cap):** keep the most recent full draft(s) below inline —
as many as fit under the cap; everything older collapses to a one-line title +
venue + gist, with the full body recoverable from git history. The earliest
drafts live in the [archive](./distribution-queue-archive.md).

## Published — canonical `/blog` copies live; venue variants pending

Post each venue variant as a pointer to (or excerpt of) the canonical URL, then
delete its line.

- run 106 — **https://nlqdb.com/blog/store-form-submissions-without-a-backend/**
  — venue variant pending: dev.to + r/webdev + r/sideproject ("You don't need a
  backend to store form submissions. You need a place to ask 'how many.'";
  capture-vs-reporting split; anchors
  `/solve/store-form-submissions-without-backend`).
- run 130 — **https://nlqdb.com/blog/not-in-subquery-null-trap/** — venue
  variant pending: dev.to + r/SQL + r/PostgreSQL ("NOT IN returned zero rows.
  It wasn't your data — it was one NULL."; anchors
  `/solve/find-rows-with-no-match-in-another-table`).
- run 20 — **https://nlqdb.com/blog/zep-recall-vs-analytical-agent-memory/** —
  venue variant pending: r/AI_Agents / Show HN (Zep recall vs. aggregation;
  anchors `/vs/zep`).
- run 2 — **https://nlqdb.com/blog/null-timestamp-ttl-sweep-funnel-metric/** —
  venue variant pending: dev.to (#sql #postgres #debugging) / lobste.rs (NULL
  timestamp broke a TTL sweep + funnel metric).
- run 53 — **https://nlqdb.com/blog/agent-memory-vector-store-aggregation-gap/**
  — venue variant pending: dev.to / r/AI_Agents / r/LLMDevs (the aggregation
  gap: similarity search has no GROUP BY/COUNT/JOIN/HAVING; anchors
  `/vs/pinecone`).
- run 102 — **https://nlqdb.com/blog/mcp-server-what-does-the-agent-own/** —
  venue variant pending: dev.to + r/LLMDevs + r/AI_Agents (two shapes of MCP
  server — destination-app wrapper vs. infrastructure the agent owns; the tell
  is what the agent owns after the call returns; anchors `/vs/hex`).

## Collapsed — full drafts in git history

- run 129 — dev.to / r/SQL / r/PostgreSQL: "The 'percent of total' query has a denominator problem. Two, actually." (two quiet traps: integer division floors `revenue / SUM(revenue) OVER ()` to 0 unless you write `100.0 *`; empty `OVER ()` grand-total vs `OVER (PARTITION BY region)` per-group total is a denominator choice the clause spells out; anchors `/solve/calculate-percentage-of-total-in-sql`).

- run 128 — dev.to / r/PostgreSQL / r/SaaS: "Neon's MCP server lets your coding agent run your database. That's not the same as your app answering a question." (Neon's official MCP is one of the better DB MCP integrations — spin up a project, branch copy-on-write, run+verify+merge a migration all from your IDE — but that whole loop is *dev-time database administration* with you as the caller, not your *product* answering an end-user's question at runtime; the runtime job has requirements the admin one doesn't — compiled SQL shown, read-only allow-list failing closed, writes diff-previewed, try-before-sign-in — none a knock on Neon, just a layer above the DB; honest split — nlqdb has no Neon-grade branching/scale-to-zero and no BYO-Postgres yet, so it owns the DB it answers; anchors `/vs/neon`).
- run 127 — dev.to / r/SQL / r/PostgreSQL: "Postgres has no MEDIAN(). Here's the query you write instead — and the choice that changes the answer." (no `MEDIAN()` in Postgres; the answer is the ordered-set aggregate `percentile_cont(0.5) WITHIN GROUP (ORDER BY revenue)`, and swapping `0.5` gives any percentile; the trap is `percentile_cont` interpolates between the two middle rows while `percentile_disc` returns a real row, so they disagree on even/categorical sets — `cont` for continuous quantities, `disc` when it must be an observed value; order lives inside `WITHIN GROUP`; honest split — read-only, not a live p95 dashboard; anchors `/solve/calculate-median-or-percentile-in-sql`).

- run 126 — dev.to / r/LLMDevs / r/LangChain: "LlamaIndex's text-to-SQL runs the SQL the model wrote. The docs tell you that; the demo doesn't." (`NLSQLTableQueryEngine` writes + *executes* the generated SQL — LlamaIndex's own docs call arbitrary SQL a security risk and leave restricted roles / read-only DB / sandboxing to you — and it assumes the DB already exists; same English prompt, two different jobs; honest split — LlamaIndex wins for SQL-as-one-retriever-among-docs+vectors and can call nlqdb as a tool, nlqdb is not a RAG framework; anchors `/vs/llamaindex`).
- run 125 — dev.to / r/SQL / r/PostgreSQL: "LAG() is the whole month-over-month growth query. The self-join you were about to write is the bug." (month-over-month / period-over-period / YoY / WoW growth is one window-function shape, not a self-join on `month = month - 1` that breaks on missing months and December boundaries: `LAG(value) OVER (ORDER BY month)` reaches the previous row in an order you name, with a `NULLIF(prev, 0)` divide-by-zero guard and the `ORDER BY` as the definition of "previous"; YoY/WoW are the same query with a different offset, distinct from running-total's accumulate-down and top-N's rank-within; ask in English and read the SQL so you check the order and baseline; honest split — one-off read-only answer not a live MoM chart, you still name the period order; anchors `/solve/month-over-month-growth-in-sql`).
- run 124 — dev.to / r/Python / r/dataengineering: "PandasAI runs generated Python to answer your question. That's the feature and the footgun." (PandasAI reads a DataFrame/CSV/Postgres you already loaded and translates the question into Python+SQL and *executes it* to return answers, charts, cleaned columns, generated features — great in a notebook, but on a product path "generate Python and run it" is a bigger blast radius than "generate SQL, validate against an allow-list, run only that," and it assumes the data's already loaded rather than answering "where does the data live"; honest split — if a plotted figure is the deliverable PandasAI wins and the two compose, nlqdb owns+provisions the Postgres, shows the SQL, runs only validated SQL, diff-previews writes, and has no chart/cleansing/feature generation; anchors `/vs/pandasai`).
- run 123 — dev.to / r/SQL / r/PostgreSQL: "The running-total query keeps every row. That's the part GROUP BY can't do." (a running total — revenue-to-date, running headcount, a rolling 7-day sum — needs a window function `SUM(amount) OVER (ORDER BY day)` that accumulates down an explicit order and keeps every row, not a `GROUP BY` that collapses to one number per bucket; `PARTITION BY` restarts the total per group and a frame clause (`ROWS BETWEEN 6 PRECEDING AND CURRENT ROW`) makes it a moving window; the wrong `ORDER BY`, unbroken ties, or a missing frame quietly break it; ask in English and read the SQL so you confirm the order and frame; honest split — you must name the accumulation order, one-off read-only curve not a live chart; anchors `/solve/running-total-cumulative-sum-in-sql`).
- run 122 — dev.to / r/SQL / r/PostgreSQL: "Postgres has no PIVOT keyword. Here's the query you write instead." (SQL Server has a `PIVOT` keyword; Postgres doesn't, so every reporting cycle you re-learn the two real answers — portable conditional aggregation (`SUM(...) FILTER (WHERE ...)` per column, tedious and easy to mis-bucket) or `crosstab()` from the `tablefunc` extension nobody has enabled; either way a plain `GROUP BY` gives tall rows when the spreadsheet wanted wide, and reshaping is the Googled part; ask in English and read the SQL so each column maps to the bucket you meant; honest split — pivot columns must be ones you can name, one-off read-only answer not a live crosstab dashboard, exact SQL over current rows; anchors `/solve/pivot-rows-into-columns`).
- run 121 — dev.to / r/SQL / r/dataengineering: "The top-N-per-group query everyone re-Googles." (`greatest-n-per-group`: keeping the whole row per group needs `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ... DESC)` filtered to rank ≤ N, not `GROUP BY`+`MAX`; anchors `/solve/find-top-n-rows-per-group`).

- run 120 — dev.to / r/dataengineering / r/LLMDevs: "Open-source text-to-SQL is the easy 10%. The golden SQL you maintain forever is the rest." (Dataherald/Vanna/Wren open-sourced the NL→SQL engine — a commodity you wire up in an afternoon — but ship it to people who don't know your schema and accuracy evaporates; the fix is *golden SQL*, hand-curated question→query pairs, a standing maintenance job the README undersells; honest split — nlqdb owns the Postgres it answers and skips golden SQL by prompting from the live schema fingerprint, no warehouse federation; anchors `/vs/dataherald`).
- run 119 — dev.to / r/SQL / r/analytics: "The duplicate-rows query you re-Google every six weeks." (the find-duplicates answer hasn't changed in thirty years — `GROUP BY` the suspect columns, `HAVING COUNT(*) > 1` — yet non-daily-SQL folks look it up every time, and wanting the *whole* duplicate row not just the key pushes you into a `ROW_NUMBER()` window function, a different query than you Googled; ask in English and read the SQL so you verify the grain; honest split — nlqdb reports duplicates read-only, which row to keep/merge is a deliberate write, matching is exact not fuzzy; anchors `/solve/find-duplicate-rows-in-my-data`).
- run 118 — dev.to / r/LangChain / lobste.rs: "You don't need to build a SQL agent. Here's when you should anyway." (the `create_sql_agent` + `SQLDatabaseToolkit` demo (now assembled directly in LangGraph) gets the happy path working in an afternoon — the 10%; the other 90% is a `DELETE` guardrail (the default toolkit runs whatever SQL the model emits), bounded retries, a question cache, somewhere to *show* the SQL, a deployment, and an eval harness, all yours to own forever for a non-core feature; the honest build-vs-buy test isn't "can I generate SQL from English" but "do I want to own that stack" — build with LangChain if you're building an agent framework / need the reasoning graph / want self-hosted-free; buy if it's a feature inside your product; honest split — nlqdb is a hosted pipeline you embed, not a vendored library, and a LangChain agent can just *call* it as one tool; anchors `/vs/langchain-sql-agent`).
- run 117 — dev.to / r/devops / r/sysadmin: "Your cron jobs already write run history. You just can't query it." (which-job-fails-most / how-long / how-many-ran are aggregations grepped out of scheduler logs the wrong way; capture is one row per run, reporting is the windowed `GROUP BY`, and even `pg_cron` keeps a `cron.job_run_details` table because run history is worth querying; a heartbeat monitor like Healthchecks.io/Cronitor answers the *other* question — did it run at all, the dead-man's-switch — presence-vs-absence, not which-fails-most; honest split — nlqdb is no scheduler and does no alerting, it stores the runs you write and gives a planner over them; anchors `/solve/track-background-job-run-history`).
- run 116 — dev.to / r/mcp / r/LLMDevs: "A federated query engine connects your agent to the data you have. Some agents need data they don't have yet." (federation over sources you already run vs. a store the agent provisions and owns; anchors `/vs/mindsdb`).
- run 115 — dev.to / r/SaaS / Indie Hackers: "Product analytics is two problems. Only one of them needs a warehouse." (the most-upvoted "what do you use for product analytics" answer is "just store events in Postgres and query them" — right, and it hides the work; product analytics is *capture* (a tiny `{user, event, ts, props}` insert) vs *reporting* (windowed `GROUP BY` that wants a planner); per-event SaaS prices you off a tier exactly when a side project can least pay and a warehouse is oversized for 40k events; honest split — no autocapture/replay/funnel UI, PostHog is right for those and the two compose; anchors `/solve/track-product-usage-without-a-data-warehouse`).
- run 114 — dev.to / r/dataengineering / r/analytics: "Your analytics canvas is where humans look. Your product runs where no one's looking." (agentic-analytics canvases like Count are great for a data team watching the cell, but wiring that agent into the product — MCP endpoint behind an "ask your data" box, a 3am refresh — breaks the human-in-the-loop a canvas assumes; interactive analysis vs headless runtime are different altitudes and compose; honest split — nlqdb has no canvas/Python/charts; anchors `/vs/count`).
- run 113 — dev.to / r/webdev / r/node: "The webhook receiver is the easy half. The database behind it is the part nobody wants to own." (anchors `/solve/store-and-query-webhook-events`).
- run 112 — dev.to / r/dataengineering / r/LLMDevs: "Your notebook's AI analyst assumes someone's watching the cell. Your product runs when no one is." (anchors `/vs/fabi`).
- run 111 — dev.to / r/AI_Agents / r/LLMDevs: "Your agent knows how the user thinks. It still can't tell you how many of them churned." (user-modelling (Honcho's theory-of-mind) vs. relational aggregation over what the agent stored; anchors `/vs/honcho`).
- run 110 — dev.to / r/dataengineering / r/BusinessIntelligence: "Your BI tool got acquired. Your data layer shouldn't have to care." (the analyst notebook is a roll-up target; a destination humans log into vs. a runtime your software calls; anchors `/vs/mode`).
- run 109 — dev.to / r/SaaS / r/ExperiencedDevs: "The text-to-SQL demo takes an afternoon. The other 90% is why you should buy it." (the buy-vs-build test isn't "can I generate SQL" but "do I want to own the validator/cache/eval stack forever"; anchors `/solve/add-ask-your-data-feature-without-building-text-to-sql`).
*(runs 75–100 moved to git history under D4; full gists for runs 103–105 also collapsed to titles — `git log -p` recovers all bodies.)*

### Engine-lesson posts (dev.to / lobste.rs)
- run 72 — "Your BI tool got an AI assistant. Your agent still can't call it." (open-source BI tools shipped genuinely good in-app AI assistants — NL answers, prompt-to-chart, a "fix it" button, Slack replies — but the assistant is a feature inside a destination app that helps a logged-in human; there's no handle an autonomous agent can grab, no "provision a database, write rows, query it" primitive; "who the AI helps" vs. "whether software can call it" are different axes; anchors `/vs/metabase`).
- run 70 — "Your AI BI tool reads your data. It doesn't own it — and can't write to it" (a wave of AI-native BI tools converge on "describe what to track, AI builds the dashboard" — great at it, but "your data" is a read-only connection to a warehouse you already run; they don't own a DB or write to yours; the data layer that provisions the store and takes English for the write *and* the read is a different altitude; anchors `/vs/basedash`).
- run 69 — "Your sitemap is advertising redirects — and your canonical tag points at one" (a static host serving `route/index.html` makes the bare path a 307, but `canonical`/`og:url`/sitemap/llms.txt all emitted the bare path — 27 redirecting sitemap URLs + a self-referential redirecting canonical; `trailingSlash: "always"` plus a one-place path-normalize in the head layout + URL generators, audit with `curl -sI` over every sitemap URL).
- run 68 — "Your offline LLM eval isn't measuring your model — it's measuring your rate limits" (a tiny NL→SQL bench on a free multi-provider chain scored 17/20 then 6/20 ninety seconds later; the engine didn't regress, the providers got tired — `circuit_open`/`rate_limited` errors with p50=0ms are availability, not accuracy; throttle to measure reasoning, pause-and-resume on exhaustion, keep the smoke test apart from the powered windowed run).
- run 67 — "AI made the internal-tool builder faster. It didn't ask whether you needed the tool." (low-code AI — AppGen / Ask AI / agents — scaffolds the admin tool faster, but the output is still a destination a human builds and operates; often the answer belongs inline in the product you already ship, or the asker is an agent that wants a backend primitive, not a built tool — check whether the AI sped up the workflow or the outcome; anchors `/vs/retool`).

*(runs 51–52, 56–66 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*
- run 55 — "Your text-to-SQL accuracy is measured on schemas your users will never build" (BIRD/Spider run over messy 20–100-table academic schemas, not the small clean ones your users build; we added a third benchmark — hand-authored gold NL→SQL over the ICP shape, same EX scorer, literal-date gold so it never drifts with the clock; anchors persona-bench, SK-QUAL-018).
- runs 8–18, 33, 37, 39, 41–44, 46, 48 — earliest engine-lesson gists archived to keep this doc under the 20 KB cap (CLAUDE.md D4); titles + IDs in [`distribution-queue-archive.md`](./distribution-queue-archive.md), bodies in git history.

### Launch + build-in-public posts (X / Bluesky / HN / dev.to)

- runs 43–44 — "We moved agent memory above the fold and demoted three of our four personas. On purpose." (additive/reversible home reweight; agent-memory wedge + Mem0·Zep·Letta·nlqdb matrix above the fold, other personas folded under a quiet divider; GLOBAL-036 + WS-12).
- *(runs 41–42 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*
- runs 27–30 — agent-memory wave (WS-09): "Why your AI agent's memory should be a database, not a vector store" (Replit-incident open, BIRD/Spider sub-target, open harness), "…as four Postgres tables (no schema design)" (`agent_memory_v1` preset), the "one bright column" matrix teaser + FSL-1.1 license note, and the Mem0/Zep/Letta/nlqdb capability matrix → `/agents`. Bodies in git history.

### Helpful-answer + comparison drafts (Reddit / Show HN)

*(runs 21–36 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*

Earliest drafts: [`distribution-queue-archive.md`](./distribution-queue-archive.md).
