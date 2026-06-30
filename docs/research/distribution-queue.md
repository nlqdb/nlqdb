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

## 2026-06-30 (run 120) — dev.to / r/dataengineering / r/LLMDevs: "Open-source text-to-SQL is the easy 10%. The golden SQL you maintain forever is the rest."

**Where:** dev.to + r/dataengineering + r/LLMDevs; for engineers and data teams evaluating an
open-source NL→SQL engine (Dataherald, Vanna, Wren) over a warehouse they already run. nlqdb
mentioned once, as the other-end-of-the-trade option — not the headline.

**Title:** Open-source text-to-SQL is the easy 10%. The golden SQL you maintain forever is the rest.

**Body:**

> Dataherald did the genuinely generous thing and open-sourced their entire text-to-SQL product —
> engine, API, the lot. So did Vanna. So did a half-dozen others. If you've ever wanted "ask my
> warehouse a question in English," the model half is now a solved, MIT-licensed commodity. Clone it,
> point it at Postgres or Snowflake, ask "revenue by region last quarter," get SQL back. An
> afternoon.
>
> Then you ship it to people who don't know your schema, and the accuracy you saw in the demo
> evaporates. The fix every one of these engines reaches for is the same: *golden SQL* — curated
> question→query training pairs, plus written business context ("'active' means a login in the last
> 28 days"), tuned against your specific tables. That's not a flaw; it's how you get a generic model
> to speak *your* schema. But it's also the part the README undersells. Golden SQL is a dataset you
> author by hand, and then maintain — every renamed column, every new join path, every metric whose
> definition shifts is a training pair to add or fix. The engine is free. The curation is a standing
> job that lands on whoever owns the data model.
>
> So the honest evaluation isn't "can this generate SQL from English" (they all can). It's "who's on
> the hook for keeping it accurate as the schema moves, and do I already have the warehouse it
> assumes." If you run a real warehouse and a data team that *wants* that control — golden SQL, your
> own LLM stack, self-hosted for compliance — an OSS engine like Dataherald is exactly right, and the
> curation is worth it.
>
> (The other end of that trade is the one we took with [nlqdb](https://nlqdb.com): it *owns* the
> Postgres it answers — provisioned from English — and skips the golden-SQL set entirely, prompting
> from the live schema fingerprint with the compiled SQL shown on every answer and writes
> diff-previewed. Honest split — that means no warehouse federation and no golden-SQL knobs; if you
> need to query Snowflake or BigQuery in place, or want to hand-curate the training pairs, the OSS
> engine is the better fit, not this.)

**Why this advances the north-star:** GLOBAL-025 onboarding/UX — rides the "open-source text-to-SQL"
evaluation intent the `/vs/dataherald` page shipped this run anchors; the golden-SQL-maintenance
framing earns a citation by being useful to someone *choosing the competitor*, and concedes the
warehouse-federation and training-control gaps honestly.

## Collapsed — full drafts in git history

- run 119 — dev.to / r/SQL / r/analytics: "The duplicate-rows query you re-Google every six weeks." (find-the-duplicates is the query nobody memorises and everybody needs — `GROUP BY` the suspect columns `HAVING COUNT(*) > 1`, but it's fiddly in quiet ways: group on the wrong columns and you mis-count, want the *whole* duplicate row not just the key and you're suddenly in `ROW_NUMBER() OVER (PARTITION BY …)`, a different query than the one you Googled; the case for asking in English and *reading the SQL it generates* is that the grain matters and you want to verify it before trusting the count, and a chat model can write the query but can't run it against your data; honest split — nlqdb *reports* duplicates with a read-only query, which row to keep/merge is a deliberate write and matching is exact not fuzzy; anchors `/solve/find-duplicate-rows-in-my-data`).
- run 118 — dev.to / r/LangChain / lobste.rs: "You don't need to build a SQL agent. Here's when you should anyway." (the `create_sql_agent` + `SQLDatabaseToolkit` demo (now assembled directly in LangGraph) gets the happy path working in an afternoon — the 10%; the other 90% is a `DELETE` guardrail (the default toolkit runs whatever SQL the model emits), bounded retries, a question cache, somewhere to *show* the SQL, a deployment, and an eval harness, all yours to own forever for a non-core feature; the honest build-vs-buy test isn't "can I generate SQL from English" but "do I want to own that stack" — build with LangChain if you're building an agent framework / need the reasoning graph / want self-hosted-free; buy if it's a feature inside your product; honest split — nlqdb is a hosted pipeline you embed, not a vendored library, and a LangChain agent can just *call* it as one tool; anchors `/vs/langchain-sql-agent`).
- run 117 — dev.to / r/devops / r/sysadmin: "Your cron jobs already write run history. You just can't query it." (which-job-fails-most / how-long / how-many-ran are aggregations grepped out of scheduler logs the wrong way; capture is one row per run, reporting is the windowed `GROUP BY`, and even `pg_cron` keeps a `cron.job_run_details` table because run history is worth querying; a heartbeat monitor like Healthchecks.io/Cronitor answers the *other* question — did it run at all, the dead-man's-switch — presence-vs-absence, not which-fails-most; honest split — nlqdb is no scheduler and does no alerting, it stores the runs you write and gives a planner over them; anchors `/solve/track-background-job-run-history`).
- run 116 — dev.to / r/mcp / r/LLMDevs: "A federated query engine connects your agent to the data you have. Some agents need data they don't have yet." (federation — one SQL endpoint over the 200+ sources you already run, which MindsDB does well and wraps in an MCP server — assumes the data already exists in a system you administer; but much agent work (logging what it did, remembering structured facts, then "how many this week by type") needs a store the agent *provisions and owns*, not a read-mostly federated view; honest split — nlqdb has no 200-source federation / in-database ML / unstructured RAG, for querying across systems you run MindsDB is right and the two compose; anchors `/vs/mindsdb`, the GLOBAL-036 "a database, not just an adapter" wedge).
- run 115 — dev.to / r/SaaS / Indie Hackers: "Product analytics is two problems. Only one of them needs a warehouse." (the most-upvoted "what do you use for product analytics" answer is "just store events in Postgres and query them" — right, and it hides the work; product analytics is *capture* (a tiny `{user, event, ts, props}` insert) vs *reporting* (windowed `GROUP BY` that wants a planner); per-event SaaS prices you off a tier exactly when a side project can least pay and a warehouse is oversized for 40k events; honest split — no autocapture/replay/funnel UI, PostHog is right for those and the two compose; anchors `/solve/track-product-usage-without-a-data-warehouse`).
- run 114 — dev.to / r/dataengineering / r/analytics: "Your analytics canvas is where humans look. Your product runs where no one's looking." (the new agentic-analytics canvases — Count put SQL+Python+visuals on one freeform whiteboard and dropped the notebook metaphor ("Bye-bye notebooks. Hello, canvas."), an AI agent exploring your warehouse alongside you — are genuinely good *for a data team watching the cell*; the trouble starts when someone wires that agent into the product (its MCP endpoint behind an in-app "ask your data" box, a 3am refresh, an agent answering mid-conversation), because a canvas assumes a human reads the SQL and eyeballs the chart and a runtime has none of that; the two aren't competitors, they're different altitudes — interactive analysis wants a fast forgiving human-in-the-loop, headless runtime wants the SQL inspectable *before* it runs and any write diff-previewed *before* it applies; honest split — nlqdb has no canvas/Python/charts, for collaborative exploration over a warehouse you run Count/Hex/Mode/Fabi.ai is right and the two compose; anchors `/vs/count`).
- run 113 — dev.to / r/webdev / r/node: "The webhook receiver is the easy half. The database behind it is the part nobody wants to own." (the receiver is a 20-minute job — accept the POST, verify the signature, return 200; the skipped part is the queryable store behind it, where "how many `checkout.session` events failed yesterday by error code" means standing up Postgres, schema-ing a payload the provider mutates without warning, and hand-writing reporting `GROUP BY`s; patterns — JSONB payload beside extracted columns for idempotency, and separate *capture* from *reporting*; honest split — nlqdb is not the receiver and does no signature verification; anchors `/solve/store-and-query-webhook-events`).
- run 112 — dev.to / r/dataengineering / r/LLMDevs: "Your notebook's AI analyst assumes someone's watching the cell. Your product runs when no one is." (the AI-notebook tools — Fabi.ai's "Smartbooks," Hex, Mode — are genuinely good at interactive exploration where a human watches each cell, accepts the agent's suggestion, and iterates; the loop bakes in a human-in-the-loop assumption that breaks when you wire that same agent or its MCP endpoint onto an unattended product path — a 3am dashboard refresh, an in-app "ask your data" box, an agent answering mid-conversation — where the SQL must be inspectable *before* it runs and a write diff-previewed *before* it applies; the fix isn't distrusting the notebook, it's not conflating two altitudes — interactive analysis vs headless runtime want different guarantees and compose; honest split — nlqdb has no notebook/Python/charts, for interactive exploration Fabi.ai or Hex is right; anchors `/vs/fabi`).
- run 111 — dev.to / r/AI_Agents / r/LLMDevs: "Your agent knows how the user thinks. It still can't tell you how many of them churned." (the agent-memory frontier is *modelling* not recall — Honcho's dialectic theory-of-mind builds a model of *how each user reasons*, the right primitive for "explain or just do for this person"; but a different-shaped question arrives the week after launch — "how many pro-tier users completed onboarding this month, grouped by signup week" is `COUNT`/`GROUP BY`/`JOIN`/threshold, and a user model can't answer *how many of them did X*; the two compose once you stop expecting one store to do both — a user-modelling layer for how someone reasons, a relational layer for how many did what; honest limit — nlqdb has no user model or theory-of-mind, for "how does this person think" Honcho is the right shape; anchors `/vs/honcho`).
- run 110 — dev.to / r/dataengineering / r/BusinessIntelligence: "Your BI tool got acquired. Your data layer shouldn't have to care." (the analyst notebook (Mode → ThoughtSpot, Looker → Google, Periscope → Sisense) is a roll-up target and each acquisition rewrites the AI story on top of it — fine when it's a *destination* humans log into to explore and publish; not fine when you've wired it into your *product*, because your runtime then inherits whatever the next buyer does to that notebook's API/pricing/AI direction; name the split — a destination analytics app and a runtime data layer are different altitudes, the first is where humans look, the second is what your software calls; honest caveat — nlqdb is not a notebook or BI suite, for collaborative analysis/charts/dashboards a Mode or Hex is right and the two compose; anchors `/vs/mode`).
- run 109 — dev.to / r/SaaS / r/ExperiencedDevs: "The text-to-SQL demo takes an afternoon. The other 90% is why you should buy it." (the obvious "ask your data" build — prompt + schema + model + run the SQL — is 10% of the job; production adds a fail-closed verb-allowlist validator, a plan cache keyed on question + schema version, and an eval harness watching a labelled set, all yours to maintain forever for a non-core feature; the honest buy-vs-build test isn't "can I generate SQL from English" but "do I want to own that stack" — if it's a reporting tab / search box / in-app assistant, buy and embed; honest caveat — hosted pipeline you embed, not a vendored library, and many users over their own rows still means a DB or isolation scope per tenant; anchors `/solve/add-ask-your-data-feature-without-building-text-to-sql`).
- run 108 — dev.to / r/analytics / r/BusinessIntelligence: "Half your data-team tickets aren't analysis. They're a SELECT someone's afraid to write." (most of a data team's queue is throwaway `GROUP BY`s that took 30s to write and 3 days to reach; self-service BI moved the bottleneck to the modelling ticket; governed questions stay with the data team, throwaway ones just need to not be a ticket — a plain-English path against the live schema with the SQL shown; honest limit — not a governed semantic layer; anchors `/solve/answer-data-questions-without-the-data-team`).
- run 107 — Show HN / r/LocalLLaMA / dev.to: "Your agent's memory tops LongMemEval. Can it answer 'how many'?" (anchors `/vs/supermemory`).
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
