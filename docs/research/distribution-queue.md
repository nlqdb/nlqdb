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

## 2026-07-01 (run 123) — dev.to / r/SQL / r/PostgreSQL: "The running-total query keeps every row. That's the part GROUP BY can't do."

**Where:** dev.to + r/SQL + r/PostgreSQL; for analysts and PMs who want a cumulative curve —
revenue-to-date, running headcount, a rolling 7-day sum — and keep reaching for `GROUP BY`. nlqdb
mentioned once, as the "ask in English, read the SQL" half — not a BI tool.

**Title:** The running-total query keeps every row. That's the part GROUP BY can't do.

**Body:**

> Sooner or later every dashboard needs a line that only goes up: revenue to date, a running
> headcount, cumulative signups, an account balance after each transaction. So you write
> `SUM(amount)` with a `GROUP BY` and get one number per bucket — the rows collapsed. That's the
> total, not the *running* total.
>
> A running total has to keep every row and show the sum accumulated *up to* that row. That's a
> window function: `SUM(amount) OVER (ORDER BY day)`. The `OVER (ORDER BY ...)` is the whole trick —
> it computes down an explicit order without collapsing anything. Add `PARTITION BY` to restart the
> total per group (a running total per customer), or a frame clause — `ROWS BETWEEN 6 PRECEDING AND
> CURRENT ROW` — for a rolling 7-day sum instead of an all-time one.
>
> The details are where it quietly breaks. The wrong `ORDER BY` accumulates in the wrong sequence
> and still *looks* plausible. Unbroken ties make the running value ambiguous. A missing frame
> clause silently gives you an all-time total when you wanted a moving window.
>
> This is a good case for asking in plain English and *reading the SQL it generates*. "Running total
> of revenue by day" should hand back both the accumulating rows and the `SUM(...) OVER (ORDER BY
> ...)` it ran, so you can confirm the order and the frame before you trust the curve.
>
> (That's the half we built [nlqdb](https://nlqdb.com) for: ask the cumulative curve in English over
> a Postgres it provisions, or one you already run via a signed-in connect, and get the rows plus the
> compiled SQL. Honest split — you have to name the order it accumulates in, it's a one-off read-only
> answer rather than a live running-total chart, and it's exact SQL over current rows, not a cached
> dashboard.)

**Why this advances the north-star:** GLOBAL-025 onboarding/UX — rides the perennial
running-total / cumulative-sum search intent surfaced by the
`/solve/running-total-cumulative-sum-in-sql` page shipped this run; the "`GROUP BY` collapses, the
window function keeps every row" hook plus read-the-SQL framing earns a citation without a pitch and
concedes the named-order and read-only limits honestly.

## Collapsed — full drafts in git history

- run 122 — dev.to / r/SQL / r/PostgreSQL: "Postgres has no PIVOT keyword. Here's the query you write instead." (rows-into-columns comes up every reporting cycle and SQL Server has a `PIVOT` keyword, but Postgres doesn't — the portable answer is conditional aggregation, one `SUM(...) FILTER (WHERE ...)` per column, or `crosstab()` from the `tablefunc` extension most people don't have enabled; a plain `GROUP BY` gives tall rows when the spreadsheet wanted them wide; ask in English and read the SQL so you confirm each column's bucket; honest split — pivot columns must be ones you can name, one-off read-only wide report not a live crosstab dashboard, exact SQL over current rows; anchors `/solve/pivot-rows-into-columns`).

- run 121 — dev.to / r/SQL / r/dataengineering: "The top-N-per-group query everyone re-Googles." (the top *N* rows per group has a Stack Overflow tag — `greatest-n-per-group` — because it comes up constantly; the obvious `GROUP BY` + `MAX` gives the top *value* but throws away the rest of the row, so keeping the whole row needs `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ... DESC)` filtered to rank ≤ N or a lateral join — a different query than you started typing, and the partition/tiebreak bite quietly; ask in English and read the SQL so you verify the partition and whether ties wanted `RANK`/`DENSE_RANK`; honest split — one-off read-only ranked answer, not a live dashboard or rank-change alert, exact ordering not fuzzy; anchors `/solve/find-top-n-rows-per-group`).

- run 120 — dev.to / r/dataengineering / r/LLMDevs: "Open-source text-to-SQL is the easy 10%. The golden SQL you maintain forever is the rest." (Dataherald/Vanna/Wren open-sourced the whole NL→SQL engine — the model half is now an MIT-licensed commodity you wire up in an afternoon — but ship it to people who don't know your schema and demo accuracy evaporates; the fix every engine reaches for is *golden SQL*, hand-curated question→query training pairs plus business context tuned to your tables, a standing maintenance job on whoever owns the data model, not a flaw but the part the README undersells; honest evaluation isn't "can it generate SQL" but "who keeps it accurate as the schema moves, and do I already run the warehouse it assumes" — if you run a real warehouse + data team that wants that control an OSS engine is exactly right; honest split — nlqdb *owns* the Postgres it answers and skips golden SQL by prompting from the live schema fingerprint, so no warehouse federation / no golden-SQL knobs, query Snowflake/BigQuery in place and the OSS engine wins; anchors `/vs/dataherald`).
- run 119 — dev.to / r/SQL / r/analytics: "The duplicate-rows query you re-Google every six weeks." (the find-duplicates answer hasn't changed in thirty years — `GROUP BY` the suspect columns, `HAVING COUNT(*) > 1` — yet non-daily-SQL folks look it up every time, and wanting the *whole* duplicate row not just the key pushes you into a `ROW_NUMBER()` window function, a different query than you Googled; ask in English and read the SQL so you verify the grain; honest split — nlqdb reports duplicates read-only, which row to keep/merge is a deliberate write, matching is exact not fuzzy; anchors `/solve/find-duplicate-rows-in-my-data`).
- run 118 — dev.to / r/LangChain / lobste.rs: "You don't need to build a SQL agent. Here's when you should anyway." (the `create_sql_agent` + `SQLDatabaseToolkit` demo (now assembled directly in LangGraph) gets the happy path working in an afternoon — the 10%; the other 90% is a `DELETE` guardrail (the default toolkit runs whatever SQL the model emits), bounded retries, a question cache, somewhere to *show* the SQL, a deployment, and an eval harness, all yours to own forever for a non-core feature; the honest build-vs-buy test isn't "can I generate SQL from English" but "do I want to own that stack" — build with LangChain if you're building an agent framework / need the reasoning graph / want self-hosted-free; buy if it's a feature inside your product; honest split — nlqdb is a hosted pipeline you embed, not a vendored library, and a LangChain agent can just *call* it as one tool; anchors `/vs/langchain-sql-agent`).
- run 117 — dev.to / r/devops / r/sysadmin: "Your cron jobs already write run history. You just can't query it." (which-job-fails-most / how-long / how-many-ran are aggregations grepped out of scheduler logs the wrong way; capture is one row per run, reporting is the windowed `GROUP BY`, and even `pg_cron` keeps a `cron.job_run_details` table because run history is worth querying; a heartbeat monitor like Healthchecks.io/Cronitor answers the *other* question — did it run at all, the dead-man's-switch — presence-vs-absence, not which-fails-most; honest split — nlqdb is no scheduler and does no alerting, it stores the runs you write and gives a planner over them; anchors `/solve/track-background-job-run-history`).
- run 116 — dev.to / r/mcp / r/LLMDevs: "A federated query engine connects your agent to the data you have. Some agents need data they don't have yet." (federation — one SQL endpoint over the 200+ sources you already run, which MindsDB does well and wraps in an MCP server — assumes the data already exists in a system you administer; but much agent work (logging what it did, remembering structured facts, then "how many this week by type") needs a store the agent *provisions and owns*, not a read-mostly federated view; honest split — nlqdb has no 200-source federation / in-database ML / unstructured RAG, for querying across systems you run MindsDB is right and the two compose; anchors `/vs/mindsdb`, the GLOBAL-036 "a database, not just an adapter" wedge).
- run 115 — dev.to / r/SaaS / Indie Hackers: "Product analytics is two problems. Only one of them needs a warehouse." (the most-upvoted "what do you use for product analytics" answer is "just store events in Postgres and query them" — right, and it hides the work; product analytics is *capture* (a tiny `{user, event, ts, props}` insert) vs *reporting* (windowed `GROUP BY` that wants a planner); per-event SaaS prices you off a tier exactly when a side project can least pay and a warehouse is oversized for 40k events; honest split — no autocapture/replay/funnel UI, PostHog is right for those and the two compose; anchors `/solve/track-product-usage-without-a-data-warehouse`).
- run 114 — dev.to / r/dataengineering / r/analytics: "Your analytics canvas is where humans look. Your product runs where no one's looking." (agentic-analytics canvases like Count are great for a data team watching the cell, but wiring that agent into the product — MCP endpoint behind an "ask your data" box, a 3am refresh — breaks the human-in-the-loop a canvas assumes; interactive analysis vs headless runtime are different altitudes and compose; honest split — nlqdb has no canvas/Python/charts; anchors `/vs/count`).
- run 113 — dev.to / r/webdev / r/node: "The webhook receiver is the easy half. The database behind it is the part nobody wants to own." (the receiver is a 20-minute job — accept the POST, verify the signature, return 200; the skipped part is the queryable store behind it, where "how many `checkout.session` events failed yesterday by error code" means standing up Postgres, schema-ing a payload the provider mutates without warning, and hand-writing reporting `GROUP BY`s; patterns — JSONB payload beside extracted columns for idempotency, and separate *capture* from *reporting*; honest split — nlqdb is not the receiver and does no signature verification; anchors `/solve/store-and-query-webhook-events`).
- run 112 — dev.to / r/dataengineering / r/LLMDevs: "Your notebook's AI analyst assumes someone's watching the cell. Your product runs when no one is." (AI-notebook tools — Fabi.ai, Hex, Mode — shine at interactive exploration with a human watching each cell, but the same agent on an unattended product path (3am refresh, in-app "ask your data") needs the SQL inspectable and writes diff-previewed *before* they run; two altitudes, not competitors; honest split — nlqdb has no notebook/Python/charts; anchors `/vs/fabi`).
- run 111 — dev.to / r/AI_Agents / r/LLMDevs: "Your agent knows how the user thinks. It still can't tell you how many of them churned." (the agent-memory frontier is *modelling* not recall — Honcho's dialectic theory-of-mind builds a model of *how each user reasons*, the right primitive for "explain or just do for this person"; but a different-shaped question arrives the week after launch — "how many pro-tier users completed onboarding this month, grouped by signup week" is `COUNT`/`GROUP BY`/`JOIN`/threshold, and a user model can't answer *how many of them did X*; the two compose once you stop expecting one store to do both — a user-modelling layer for how someone reasons, a relational layer for how many did what; honest limit — nlqdb has no user model or theory-of-mind, for "how does this person think" Honcho is the right shape; anchors `/vs/honcho`).
- run 110 — dev.to / r/dataengineering / r/BusinessIntelligence: "Your BI tool got acquired. Your data layer shouldn't have to care." (the analyst notebook (Mode → ThoughtSpot, Looker → Google, Periscope → Sisense) is a roll-up target and each acquisition rewrites the AI story on top of it — fine when it's a *destination* humans log into to explore and publish; not fine when you've wired it into your *product*, because your runtime then inherits whatever the next buyer does to that notebook's API/pricing/AI direction; name the split — a destination analytics app and a runtime data layer are different altitudes, the first is where humans look, the second is what your software calls; honest caveat — nlqdb is not a notebook or BI suite, for collaborative analysis/charts/dashboards a Mode or Hex is right and the two compose; anchors `/vs/mode`).
- run 109 — dev.to / r/SaaS / r/ExperiencedDevs: "The text-to-SQL demo takes an afternoon. The other 90% is why you should buy it." (the obvious "ask your data" build — prompt + schema + model + run the SQL — is 10% of the job; production adds a fail-closed verb-allowlist validator, a plan cache keyed on question + schema version, and an eval harness watching a labelled set, all yours to maintain forever for a non-core feature; the honest buy-vs-build test isn't "can I generate SQL from English" but "do I want to own that stack" — if it's a reporting tab / search box / in-app assistant, buy and embed; honest caveat — hosted pipeline you embed, not a vendored library, and many users over their own rows still means a DB or isolation scope per tenant; anchors `/solve/add-ask-your-data-feature-without-building-text-to-sql`).
- run 106 — dev.to / r/webdev / r/sideproject: "You don't need a backend to store form submissions. You need a place to ask 'how many'." (anchors `/solve/store-form-submissions-without-backend`).
- run 105 — dev.to / r/LLMDevs / lobste.rs: "COUNT(*) is three different questions. Your few-shot pool probably teaches one."
- run 104 — dev.to / lobste.rs / r/SEO: "The '25 words max' rule in your style guide is a lie your CMS can't catch."
- run 103 — dev.to / lobste.rs / r/ExperiencedDevs: "Your style rule lives in a code comment. That's why it's already broken."
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
