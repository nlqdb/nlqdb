# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

**Retention (D4, 20 KB cap):** keep the most recent full draft(s) below inline —
as many as fit under the cap (drafts have grown, so that is currently **one**);
everything older collapses to a one-line title + venue + gist, with the full body
recoverable from git history. The earliest drafts live in the
[archive](./distribution-queue-archive.md).

## 2026-07-01 (run 127) — dev.to / r/SQL / r/PostgreSQL: "Postgres has no MEDIAN(). Here's the query you write instead — and the choice that changes the answer."

**Where:** dev.to + r/SQL + r/PostgreSQL; for the analyst/engineer who typed `MEDIAN(revenue)`,
got a syntax error, and is now re-Googling how to do it. nlqdb mentioned once, at the end, as the
"ask in English, read the SQL" option — the post stands on its own as a straight SQL answer.

**Title:** Postgres has no MEDIAN(). Here's the query you write instead — and the choice that changes the answer.

**Body:**

> Every dialect gives you `AVG()`. Almost none give you `MEDIAN()` — and Postgres is one of the ones
> that doesn't. So the moment the mean lies to you (one whale order, one stalled request dragging the
> average off the typical row) and you reach for the median, you hit a syntax error and go looking.
>
> The answer isn't a function, it's an *ordered-set aggregate*:
>
> ```sql
> SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY revenue) AS median_revenue
> FROM orders;
> ```
>
> That `WITHIN GROUP (ORDER BY ...)` clause is the part that looks nothing like a normal aggregate,
> and it's the part people forget. It's also how you get any percentile, not just the middle: swap
> `0.5` for `0.9` and you have p90; `0.95` for the p95 tail everyone quotes for latency. One shape,
> every percentile.
>
> Here's the bit that quietly changes your answer, though — there are *two* of these functions:
>
> - `percentile_cont(0.5)` **interpolates** between the two middle rows. The median of `[1, 2]` is
>   `1.5` — a value that isn't in your data.
> - `percentile_disc(0.5)` returns an **actual row** from the set. The median of `[1, 2]` is `1`.
>
> On an even-sized set, or on ordered-but-categorical data, those disagree. If two people report "the
> median" and one used `cont` and the other `disc`, they'll get two numbers from the same table and
> spend an afternoon arguing about it. Pick deliberately: `cont` for a continuous quantity where an
> interpolated value is meaningful (revenue, latency), `disc` when the answer must be a real observed
> value.
>
> (One more trap: the ordering lives inside `WITHIN GROUP`, not in a trailing `ORDER BY`, so a
> per-category median is `percentile_cont(0.5) WITHIN GROUP (ORDER BY revenue)` with `GROUP BY
> category` on the outside — the aggregate carries its own sort.)
>
> That's the whole answer. If you'd rather not remember the clause every reporting cycle, the tool I
> work on — [nlqdb](https://nlqdb.com) — lets you ask "median revenue per order" in English, compiles
> exactly this ordered-set aggregate, runs it in Postgres, and *shows you the compiled SQL* so you can
> see which of `cont`/`disc` it used and the order it ran over. Honest limits: it answers with a
> read-only query (not a live p95 dashboard), and the median needs a column it can actually order —
> it won't invent a sort where none exists.

**Why this advances the north-star:** GLOBAL-025 onboarding/UX — rides the perennial "median in SQL /
Postgres has no MEDIAN" search intent anchored by the `/solve/calculate-median-or-percentile-in-sql`
page shipped this run; the query and the `cont`-vs-`disc` gotcha are sourced to the PostgreSQL
aggregate-function docs (earns the citation on the merits), and it concedes nlqdb's read-only /
needs-an-order limits honestly rather than pitching.

## Collapsed — full drafts in git history

- run 126 — dev.to / r/LLMDevs / r/LangChain: "LlamaIndex's text-to-SQL runs the SQL the model wrote. The docs tell you that; the demo doesn't." (LlamaIndex's `NLSQLTableQueryEngine` writes SQL from an English question and *executes it* over a DB you already stood up — great in a notebook/RAG pipeline, but the docs themselves warn "executing arbitrary SQL can be a security risk," and on a product path "generate SQL and run it" is a different posture than "generate SQL, validate against a read-only allow-list, run only that"; it also assumes the DB already exists rather than answering "where does the data live"; honest split — if you need documents+vectors+SQL in one graph LlamaIndex wins and can call nlqdb as one tool, while nlqdb provisions+owns the Postgres, shows the SQL, runs only validated SQL, and diff-previews writes; anchors `/vs/llamaindex`).
- run 125 — dev.to / r/SQL / r/PostgreSQL: "LAG() is the whole month-over-month growth query. The self-join you were about to write is the bug." (month-over-month / period-over-period / YoY / WoW growth is one window-function shape, not a self-join on `month = month - 1` that breaks on missing months and December boundaries: `LAG(value) OVER (ORDER BY month)` reaches the previous row in an order you name, with a `NULLIF(prev, 0)` divide-by-zero guard and the `ORDER BY` as the definition of "previous"; YoY/WoW are the same query with a different offset, distinct from running-total's accumulate-down and top-N's rank-within; ask in English and read the SQL so you check the order and baseline; honest split — one-off read-only answer not a live MoM chart, you still name the period order; anchors `/solve/month-over-month-growth-in-sql`).
- run 124 — dev.to / r/Python / r/dataengineering: "PandasAI runs generated Python to answer your question. That's the feature and the footgun." (PandasAI reads a DataFrame/CSV/Postgres you already loaded and translates the question into Python+SQL and *executes it* to return answers, charts, cleaned columns, generated features — great in a notebook, but on a product path "generate Python and run it" is a bigger blast radius than "generate SQL, validate against an allow-list, run only that," and it assumes the data's already loaded rather than answering "where does the data live"; honest split — if a plotted figure is the deliverable PandasAI wins and the two compose, nlqdb owns+provisions the Postgres, shows the SQL, runs only validated SQL, diff-previews writes, and has no chart/cleansing/feature generation; anchors `/vs/pandasai`).
- run 123 — dev.to / r/SQL / r/PostgreSQL: "The running-total query keeps every row. That's the part GROUP BY can't do." (a running total — revenue-to-date, running headcount, a rolling 7-day sum — needs a window function `SUM(amount) OVER (ORDER BY day)` that accumulates down an explicit order and keeps every row, not a `GROUP BY` that collapses to one number per bucket; `PARTITION BY` restarts the total per group and a frame clause (`ROWS BETWEEN 6 PRECEDING AND CURRENT ROW`) makes it a moving window; the wrong `ORDER BY`, unbroken ties, or a missing frame quietly break it; ask in English and read the SQL so you confirm the order and frame; honest split — you must name the accumulation order, one-off read-only curve not a live chart; anchors `/solve/running-total-cumulative-sum-in-sql`).
- run 122 — dev.to / r/SQL / r/PostgreSQL: "Postgres has no PIVOT keyword. Here's the query you write instead." (SQL Server has a `PIVOT` keyword; Postgres doesn't, so every reporting cycle you re-learn the two real answers — portable conditional aggregation (`SUM(...) FILTER (WHERE ...)` per column, tedious and easy to mis-bucket) or `crosstab()` from the `tablefunc` extension nobody has enabled; either way a plain `GROUP BY` gives tall rows when the spreadsheet wanted wide, and reshaping is the Googled part; ask in English and read the SQL so each column maps to the bucket you meant; honest split — pivot columns must be ones you can name, one-off read-only answer not a live crosstab dashboard, exact SQL over current rows; anchors `/solve/pivot-rows-into-columns`).
- run 121 — dev.to / r/SQL / r/dataengineering: "The top-N-per-group query everyone re-Googles." (`greatest-n-per-group`: keeping the whole row per group needs `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ... DESC)` filtered to rank ≤ N, not `GROUP BY`+`MAX`; anchors `/solve/find-top-n-rows-per-group`).

- run 120 — dev.to / r/dataengineering / r/LLMDevs: "Open-source text-to-SQL is the easy 10%. The golden SQL you maintain forever is the rest." (Dataherald/Vanna/Wren open-sourced the whole NL→SQL engine — the model half is now an MIT-licensed commodity you wire up in an afternoon — but ship it to people who don't know your schema and demo accuracy evaporates; the fix every engine reaches for is *golden SQL*, hand-curated question→query training pairs plus business context tuned to your tables, a standing maintenance job on whoever owns the data model, not a flaw but the part the README undersells; honest evaluation isn't "can it generate SQL" but "who keeps it accurate as the schema moves, and do I already run the warehouse it assumes" — if you run a real warehouse + data team that wants that control an OSS engine is exactly right; honest split — nlqdb *owns* the Postgres it answers and skips golden SQL by prompting from the live schema fingerprint, so no warehouse federation / no golden-SQL knobs, query Snowflake/BigQuery in place and the OSS engine wins; anchors `/vs/dataherald`).
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
- run 106 — dev.to / r/webdev / r/sideproject: "You don't need a backend to store form submissions. You need a place to ask 'how many'." (anchors `/solve/store-form-submissions-without-backend`).
- run 102 — dev.to / r/LLMDevs / r/AI_Agents: "Every data tool shipped an MCP server this year. Your agent still can't build on most of them."
*(runs 75–100 moved to git history under D4; full gists for runs 102–105 also collapsed to titles — `git log -p` recovers all bodies.)*

### Engine-lesson posts (dev.to / lobste.rs)
- run 72 — "Your BI tool got an AI assistant. Your agent still can't call it." (open-source BI tools shipped genuinely good in-app AI assistants — NL answers, prompt-to-chart, a "fix it" button, Slack replies — but the assistant is a feature inside a destination app that helps a logged-in human; there's no handle an autonomous agent can grab, no "provision a database, write rows, query it" primitive; "who the AI helps" vs. "whether software can call it" are different axes; anchors `/vs/metabase`).
- run 70 — "Your AI BI tool reads your data. It doesn't own it — and can't write to it" (a wave of AI-native BI tools converge on "describe what to track, AI builds the dashboard" — great at it, but "your data" is a read-only connection to a warehouse you already run; they don't own a DB or write to yours; the data layer that provisions the store and takes English for the write *and* the read is a different altitude; anchors `/vs/basedash`).
- run 69 — "Your sitemap is advertising redirects — and your canonical tag points at one" (a static host serving `route/index.html` makes the bare path a 307, but `canonical`/`og:url`/sitemap/llms.txt all emitted the bare path — 27 redirecting sitemap URLs + a self-referential redirecting canonical; `trailingSlash: "always"` plus a one-place path-normalize in the head layout + URL generators, audit with `curl -sI` over every sitemap URL).
- run 68 — "Your offline LLM eval isn't measuring your model — it's measuring your rate limits" (a tiny NL→SQL bench on a free multi-provider chain scored 17/20 then 6/20 ninety seconds later; the engine didn't regress, the providers got tired — `circuit_open`/`rate_limited` errors with p50=0ms are availability, not accuracy; throttle to measure reasoning, pause-and-resume on exhaustion, keep the smoke test apart from the powered windowed run).
- run 67 — "AI made the internal-tool builder faster. It didn't ask whether you needed the tool." (low-code AI — AppGen / Ask AI / agents — scaffolds the admin tool faster, but the output is still a destination a human builds and operates; often the answer belongs inline in the product you already ship, or the asker is an agent that wants a backend primitive, not a built tool — check whether the AI sped up the workflow or the outcome; anchors `/vs/retool`).

*(runs 51–52, 56–66 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*
- run 55 — "Your text-to-SQL accuracy is measured on schemas your users will never build" (BIRD/Spider run over messy 20–100-table academic schemas, not the small clean ones your users build; we added a third benchmark — hand-authored gold NL→SQL over the ICP shape, same EX scorer, literal-date gold so it never drifts with the clock; anchors persona-bench, SK-QUAL-018).
- run 53 — "Your agent's memory is a vector store. Ask it 'how many' and watch it fall over." (the aggregation gap: similarity search has no GROUP BY/COUNT/JOIN/HAVING; recall is similarity, reporting is aggregation — pick the store per job; anchors `/vs/pinecone`).
- runs 8–18, 33, 37, 39, 41–44, 46, 48 — earliest engine-lesson gists archived to keep this doc under the 20 KB cap (CLAUDE.md D4); titles + IDs in [`distribution-queue-archive.md`](./distribution-queue-archive.md), bodies in git history.

### Launch + build-in-public posts (X / Bluesky / HN / dev.to)

- run 46 — "We cap every doc at 20 KB — even the marketing backlog" (autonomous-agent context discipline; an over-cap edit must net-shrink; rolling two-draft window over the queue itself).
- run 45 — "Our waitlist has 79 rows. The honest count is 1." (honest funnel pull: 78/79 waitlist rows are us, genuine-stranger count is 1; the real bottleneck is engine accuracy).
- runs 43–44 — "We moved agent memory above the fold and demoted three of our four personas. On purpose." (additive/reversible home reweight; agent-memory wedge + Mem0·Zep·Letta·nlqdb matrix above the fold, other personas folded under a quiet divider; GLOBAL-036 + WS-12).
- *(runs 41–42 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*
- runs 27–30 — agent-memory wave (WS-09): "Why your AI agent's memory should be a database, not a vector store" (Replit-incident open, BIRD/Spider sub-target, open harness), "…as four Postgres tables (no schema design)" (`agent_memory_v1` preset), the "one bright column" matrix teaser + FSL-1.1 license note, and the Mem0/Zep/Letta/nlqdb capability matrix → `/agents`. Bodies in git history.

### Helpful-answer + comparison drafts (Reddit / Show HN)

*(runs 21–36 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*

Earliest drafts: [`distribution-queue-archive.md`](./distribution-queue-archive.md).
