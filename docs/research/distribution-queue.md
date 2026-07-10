# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); publishing is autonomous
(`SK-BLOG-001`, founder-resolved 2026-07-01). Newest first. Once published, the
live URL goes into `docs/scorecard.md` § Shipped distribution; the entry
survives here only as a venue pointer until the venue variant posts.

**Retention (D4, 20 KB cap):** keep the most recent full draft(s) inline — as
many as fit under the cap; older ones collapse to a one-line title + venue +
gist (full body in git history). Earliest drafts: [archive](./distribution-queue-archive.md).

## Drafts — unpublished, newest first

- **"Your metric is only as honest as the layer you emit it from."** slug
  `emit-metrics-where-the-distinction-is-certain` · venue dev.to
  (#programming #observability #architecture) + r/ExperiencedDevs +
  lobste.rs (`practices`) · engineering lesson (`SK-TRUST-004`
  destructive-op retry-rate instrument). Angle: we wanted the destructive-op
  retry rate — the share of write previews a user abandons — as
  `1 − committed / preview_rendered`. The obvious emit site is the HTTP
  route: it already has the principal, surface, request. Wrong place. The
  route sees a `confirm: true` flag and a 200; it does **not** know whether
  the engine's plan was a write or a read. Emit `committed` there and a read
  carrying `confirm: true` inflates the numerator — a `committed` with no
  matching `preview_rendered` — and the rate goes *negative*, a number that
  can't exist. The fix isn't more route validation; it's moving the emission
  down to the orchestrator, where `isWriteVerb(sql)` and the
  preview-vs-commit branch are already decided — there both events fire on
  exactly the boundary they measure, and a stray-confirm read emits nothing.
  Thread down the one thing the route knew that the orchestrator didn't (the
  surface) rather than pulling the whole decision up. Rule: a metric's emit
  point is the lowest layer where the distinction it encodes is *certain*;
  above that you're guessing, and a guessed denominator is worse than no
  metric because it looks precise. Dedup corollary: a per-request volume
  event keys on a random id, not `(principal, day)` — day-bucketing collapses
  the repeated previews that *are* the signal. Honest split: an
  instrumentation-design lesson, not a product feature.

- **"You need to rotate an encryption key. You don't need a key-version
  column."** slug `rotate-encryption-key-without-a-version-column` · venue
  dev.to (#security #database #architecture) + r/programming + lobste.rs
  (`security`) · security/architecture lesson (`GLOBAL-031` KEK-rotation).
  Gist: put the KEK version in the self-describing ciphertext prefix
  (`v1.…`→`v2.…`), not a `key_version` column — zero-migration rotation,
  prefix-filterable stale rows without decrypting, two-key overlap window +
  lazy re-wrap; the column only earns its keep if the sweep must find stale
  rows blind, and the prefix already finds them. *(Full body in git history —
  collapsed for the D4 20 KB cap; recover at publish time.)*

- **"You added a second SQL engine. Your text-to-SQL model is still being
  told it's the first one."** slug `text-to-sql-planner-told-wrong-dialect` ·
  venue dev.to (#sql #llm #database) + r/dataengineering + lobste.rs (`sql`) ·
  engine/architecture lesson (byo-connect OQ (b)). Gist: the wrong-dialect bug
  isn't in the model, it's the one line filling `Dialect:` — a hardcoded
  `"postgres"` or a `"postgres" | "sqlite"` union that never grew a
  `clickhouse` member; fix is threading the DB's real engine into that field
  *and* adding the dialect member to the type so the compiler flags every
  hardcoded call site (not a transpile layer). Twin of the validator post —
  generator + validator both silently assume engine #1. *(Full body in git
  history — collapsed for the D4 20 KB cap; recover at publish time.)*

## Published — canonical `/blog` copies live; venue variants pending

Post each venue variant as a pointer to (or excerpt of) the canonical URL, then
delete its line.

Venue variant = venue list + anchor; the gist lives in the linked post.

- run 35 — **https://nlqdb.com/blog/postgres-validator-rejects-valid-clickhouse-sql/** — dev.to (#sql #clickhouse #security) + r/dataengineering + lobste.rs (`sql`) · engine/security lesson (`SK-MULTIENG-004` — a wrong-dialect parse failure means "wrong parser," not "dangerous query"; keep the dialect-agnostic destructive-verb allowlist authoritative, make the AST walk best-effort per engine)
- run 31 — **https://nlqdb.com/blog/blog-without-a-feed-is-a-dead-end/** — dev.to (#webdev #seo #rss) + r/webdev + lobste.rs · distribution lesson (volume-vs-yield: a blog with no RSS feed is sealed to every machine that would redistribute it — feed readers + dev.to/Medium/Hashnode import-from-RSS with `rel=canonical`; fix is a ~40-line no-dependency RSS endpoint over the same typed data file; count the doors into your content, not the pages)
- run 28 — **https://nlqdb.com/blog/one-way-internal-links-leak-yield/** — dev.to (#seo #webdev #contentmarketing) + r/SEO + r/webdev + lobste.rs · distribution lesson (volume-vs-yield: invert the existing `anchor` field into a reciprocal backlink; a tree link-graph starves fresh pages of inbound links and dead-ends readers — measure the graph, not the count)
- run 24 — **https://nlqdb.com/blog/serverless-db-cold-start-retry/** — dev.to (#database #serverless #postgres) + r/PostgreSQL + r/webdev + lobste.rs · engine/ops lesson (SK-ASK-013 — a retry policy is one-per-failure-mode; back off the DB stage, fail over the LLM stages instantly)

- run 20 — **https://nlqdb.com/blog/llm-timeout-looks-like-hallucination/** — dev.to (#llm #benchmarking #eval) + r/LLMDevs + lobste.rs · engine lesson (SK-QUAL-022 eval-budget ≠ prod SLA; abort ≠ parse failure; latency fingerprint)
- run 106 — **https://nlqdb.com/blog/store-form-submissions-without-a-backend/** — dev.to + r/webdev + r/sideproject · `/solve/store-form-submissions-without-backend`
- run 130 — **https://nlqdb.com/blog/not-in-subquery-null-trap/** — dev.to + r/SQL + r/PostgreSQL · `/solve/find-rows-with-no-match-in-another-table`
- run 102 — **https://nlqdb.com/blog/mcp-server-what-does-the-agent-own/** — dev.to + r/LLMDevs + r/AI_Agents · `/vs/hex`
- run 55 — **https://nlqdb.com/blog/text-to-sql-accuracy-schemas-your-users-never-build/** — dev.to + lobste.rs + r/LLMDevs
- run 67 — **https://nlqdb.com/blog/ai-internal-tool-builder-faster/** — dev.to + lobste.rs · `/vs/retool`
- run 68 — **https://nlqdb.com/blog/offline-llm-eval-rate-limits/** — dev.to + lobste.rs
- run 69 — **https://nlqdb.com/blog/sitemap-advertising-redirects/** — dev.to + lobste.rs
- run 109 — **https://nlqdb.com/blog/text-to-sql-build-vs-buy/** — dev.to + r/SaaS + r/ExperiencedDevs · `/solve/add-ask-your-data-feature-without-building-text-to-sql`
- run 119 — **https://nlqdb.com/blog/find-duplicate-rows-you-re-google-every-time/** — dev.to + r/SQL + r/analytics · `/solve/find-duplicate-rows-in-my-data`
- run 110 — **https://nlqdb.com/blog/your-bi-tool-got-acquired-data-layer/** — dev.to + r/dataengineering + r/BusinessIntelligence · `/vs/mode`
- run 131 — **https://nlqdb.com/blog/top-n-rows-per-group/** — dev.to + r/SQL + r/PostgreSQL · `/solve/find-top-n-rows-per-group`
- run 7 — **https://nlqdb.com/blog/http-200-error-in-body/** — dev.to (#llm #api #debugging) + r/LocalLLaMA + lobste.rs · engine lesson (res.ok necessary not sufficient)
- run 12 — **https://nlqdb.com/blog/llm-concatenates-columns-text-to-sql/** — r/SQL · engine lesson (positional-tuple EX vs fused columns; SK-LLM-043 projection directive) · dev.to posted 2026-07-07: https://dev.to/omer_hochman/your-llm-fused-the-two-columns-you-asked-for-and-the-eval-marked-it-wrong-5gge
- run 14 — **https://nlqdb.com/blog/bird-gold-noise-distinct/** — dev.to (#sql #llm #ai) + r/LLMDevs + lobste.rs (`llm`) · engine lesson (benchmark number = floor bounded by gold quality; `SK-QUAL-014`)
- run 16 — **https://nlqdb.com/blog/model-preset-fail-loud/** — dev.to (#llm #api #ux) + r/LLMDevs · engine/product lesson (a model knob is a contract not a capability: pin `fast` / upgrade `best` or 409 `model_unavailable` + fix-it link; refusal count = paid-lane demand signal; `SK-PREMIUM-014`, GLOBAL-012 fail-loud)
- run 17 — **https://nlqdb.com/blog/llm-preflight-probe-health/** — dev.to (#llm #ci #testing) + r/LLMDevs · CI/engine lesson (health ≠ competence; probe the tool-call shape, read the body not the status; `SK-LLM-042`)

## Collapsed — full drafts in git history

- run 129 — dev.to / r/SQL / r/PostgreSQL: "The 'percent of total' query has a denominator problem. Two, actually." (two quiet traps: integer division floors `revenue / SUM(revenue) OVER ()` to 0 unless you write `100.0 *`; empty `OVER ()` grand-total vs `OVER (PARTITION BY region)` per-group total is a denominator choice the clause spells out; anchors `/solve/calculate-percentage-of-total-in-sql`).

- run 128 — dev.to / r/PostgreSQL / r/SaaS: "Neon's MCP server lets your coding agent run your database. That's not the same as your app answering a question." (Neon's MCP is dev-time DB *administration* with you as caller — branch, run+merge a migration from your IDE — not your *product* answering an end-user at runtime, which needs compiled-SQL shown, read-only allow-list, diff-previewed writes, try-before-sign-in; anchors `/vs/neon`).
- run 127 — dev.to / r/SQL / r/PostgreSQL: "Postgres has no MEDIAN(). Here's the query you write instead — and the choice that changes the answer." (no `MEDIAN()` in Postgres; the answer is the ordered-set aggregate `percentile_cont(0.5) WITHIN GROUP (ORDER BY revenue)`, and swapping `0.5` gives any percentile; the trap is `percentile_cont` interpolates between the two middle rows while `percentile_disc` returns a real row, so they disagree on even/categorical sets — `cont` for continuous quantities, `disc` when it must be an observed value; order lives inside `WITHIN GROUP`; honest split — read-only, not a live p95 dashboard; anchors `/solve/calculate-median-or-percentile-in-sql`).

- run 126 — dev.to / r/LLMDevs / r/LangChain: "LlamaIndex's text-to-SQL runs the SQL the model wrote. The docs tell you that; the demo doesn't." (`NLSQLTableQueryEngine` writes + *executes* the generated SQL — LlamaIndex's own docs call arbitrary SQL a security risk and leave restricted roles / read-only DB / sandboxing to you — and it assumes the DB already exists; same English prompt, two different jobs; honest split — LlamaIndex wins for SQL-as-one-retriever-among-docs+vectors and can call nlqdb as a tool, nlqdb is not a RAG framework; anchors `/vs/llamaindex`).
- run 125 — dev.to / r/SQL / r/PostgreSQL: "LAG() is the whole month-over-month growth query. The self-join you were about to write is the bug." (MoM/YoY/WoW growth is one window shape — `LAG(value) OVER (ORDER BY month)` with a `NULLIF(prev,0)` guard — not a self-join on `month = month-1` that breaks on gaps/boundaries; anchors `/solve/month-over-month-growth-in-sql`).
- run 124 — dev.to / r/Python / r/dataengineering: "PandasAI runs generated Python to answer your question. That's the feature and the footgun." (PandasAI reads a DataFrame/CSV/Postgres you already loaded and translates the question into Python+SQL and *executes it* to return answers, charts, cleaned columns, generated features — great in a notebook, but on a product path "generate Python and run it" is a bigger blast radius than "generate SQL, validate against an allow-list, run only that," and it assumes the data's already loaded rather than answering "where does the data live"; honest split — if a plotted figure is the deliverable PandasAI wins and the two compose, nlqdb owns+provisions the Postgres, shows the SQL, runs only validated SQL, diff-previews writes, and has no chart/cleansing/feature generation; anchors `/vs/pandasai`).
- run 123 — dev.to / r/SQL / r/PostgreSQL: "The running-total query keeps every row. That's the part GROUP BY can't do." (a running total needs `SUM(amount) OVER (ORDER BY day)` that accumulates down an order and keeps every row, not a `GROUP BY` that collapses to one per bucket; `PARTITION BY` restarts per group, a frame clause makes it a moving window; anchors `/solve/running-total-cumulative-sum-in-sql`).
- run 122 — dev.to / r/SQL / r/PostgreSQL: "Postgres has no PIVOT keyword. Here's the query you write instead." (Postgres lacks SQL Server's `PIVOT`, so the two real answers are portable conditional aggregation (`SUM(...) FILTER (WHERE ...)` per column) or `crosstab()` from the `tablefunc` extension; a plain `GROUP BY` gives tall rows when you wanted wide; anchors `/solve/pivot-rows-into-columns`).
- run 121 — dev.to / r/SQL / r/dataengineering: "The top-N-per-group query everyone re-Googles." (`greatest-n-per-group`: keeping the whole row per group needs `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ... DESC)` filtered to rank ≤ N, not `GROUP BY`+`MAX`; anchors `/solve/find-top-n-rows-per-group`).

- run 120 — dev.to / r/dataengineering / r/LLMDevs: "Open-source text-to-SQL is the easy 10%. The golden SQL you maintain forever is the rest." (Dataherald/Vanna/Wren open-sourced the NL→SQL engine — a commodity you wire up in an afternoon — but ship it to people who don't know your schema and accuracy evaporates; the fix is *golden SQL*, hand-curated question→query pairs, a standing maintenance job the README undersells; honest split — nlqdb owns the Postgres it answers and skips golden SQL by prompting from the live schema fingerprint, no warehouse federation; anchors `/vs/dataherald`).
- run 118 — dev.to / r/LangChain / lobste.rs: "You don't need to build a SQL agent. Here's when you should anyway." (the `create_sql_agent` + `SQLDatabaseToolkit` demo (now assembled directly in LangGraph) gets the happy path working in an afternoon — the 10%; the other 90% is a `DELETE` guardrail (the default toolkit runs whatever SQL the model emits), bounded retries, a question cache, somewhere to *show* the SQL, a deployment, and an eval harness, all yours to own forever for a non-core feature; the honest build-vs-buy test isn't "can I generate SQL from English" but "do I want to own that stack" — build with LangChain if you're building an agent framework / need the reasoning graph / want self-hosted-free; buy if it's a feature inside your product; honest split — nlqdb is a hosted pipeline you embed, not a vendored library, and a LangChain agent can just *call* it as one tool; anchors `/vs/langchain-sql-agent`).
- run 117 — dev.to / r/devops / r/sysadmin: "Your cron jobs already write run history. You just can't query it." (anchors `/solve/track-background-job-run-history`).
- run 116 — dev.to / r/mcp / r/LLMDevs: "A federated query engine connects your agent to the data you have. Some agents need data they don't have yet." (anchors `/vs/mindsdb`).
- run 115 — dev.to / r/SaaS / Indie Hackers: "Product analytics is two problems. Only one of them needs a warehouse." (anchors `/solve/track-product-usage-without-a-data-warehouse`).
- run 114 — dev.to / r/dataengineering / r/analytics: "Your analytics canvas is where humans look. Your product runs where no one's looking." (anchors `/vs/count`).
- run 113 — dev.to / r/webdev / r/node: "The webhook receiver is the easy half. The database behind it is the part nobody wants to own." (anchors `/solve/store-and-query-webhook-events`).
- run 112 — dev.to / r/dataengineering / r/LLMDevs: "Your notebook's AI analyst assumes someone's watching the cell. Your product runs when no one is." (anchors `/vs/fabi`).
- run 111 — dev.to / r/AI_Agents / r/LLMDevs: "Your agent knows how the user thinks. It still can't tell you how many of them churned." (user-modelling (Honcho's theory-of-mind) vs. relational aggregation over what the agent stored; anchors `/vs/honcho`).
*(runs 75–100 moved to git history under D4; full gists for runs 103–105 also collapsed to titles — `git log -p` recovers all bodies.)*

### Engine-lesson posts (dev.to / lobste.rs)
- run 131 — dev.to / r/LLMDevs / lobste.rs (`llm`): "Don't give your LLM provider's model ID a fallback default. Ship it empty." (the tempting line is `model: env.OPENAI_MODEL ?? "gpt-4o"` — a hardcoded default that *feels* safe but silently ships a stale guess the day the provider renames or retires it, and the failure is a quiet quality regression, not an error; provider model IDs churn ~monthly — `gpt-5.5`/`gpt-5.4-mini` today weren't the names last quarter; the safer pattern is a **fail-loud empty default** so an unset env var is a config error at boot, not a wrong model in prod, plus a **dated, sourced verified-IDs list in the doc** the operator sets against at enable time; nlqdb's multi-provider frontier lane does exactly this — Anthropic ladder pinned to the eval baseline, OpenAI defaults empty until the founder sets them against a P2-verified list, so a guessed ID can never ship silently — GLOBAL-026 BYOLLM/hosted-premium; honest split — this is a config-hygiene pattern, not a product feature, and it costs one boot-time error the first time you forget).
- run 72 — "Your BI tool got an AI assistant. Your agent still can't call it." (open-source BI tools shipped genuinely good in-app AI assistants — NL answers, prompt-to-chart, a "fix it" button, Slack replies — but the assistant is a feature inside a destination app that helps a logged-in human; there's no handle an autonomous agent can grab, no "provision a database, write rows, query it" primitive; "who the AI helps" vs. "whether software can call it" are different axes; anchors `/vs/metabase`).
- run 70 — "Your AI BI tool reads your data. It doesn't own it — and can't write to it" (a wave of AI-native BI tools converge on "describe what to track, AI builds the dashboard" — great at it, but "your data" is a read-only connection to a warehouse you already run; they don't own a DB or write to yours; the data layer that provisions the store and takes English for the write *and* the read is a different altitude; anchors `/vs/basedash`).

*(runs 51–52, 56–66 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*
- runs 8–18, 33, 37, 39, 41–44, 46, 48 — earliest engine-lesson gists archived to keep this doc under the 20 KB cap (CLAUDE.md D4); titles + IDs in [`distribution-queue-archive.md`](./distribution-queue-archive.md), bodies in git history.

### Launch + build-in-public posts (X / Bluesky / HN / dev.to)

- runs 43–44 — "We moved agent memory above the fold and demoted three of our four personas. On purpose." (additive/reversible home reweight; agent-memory wedge + Mem0·Zep·Letta·nlqdb matrix above the fold, other personas folded under a quiet divider; GLOBAL-036 + WS-12).
- *(runs 41–42 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*
- runs 27–30 — agent-memory wave (WS-09): "Why your AI agent's memory should be a database, not a vector store" (Replit-incident open, BIRD/Spider sub-target, open harness), "…as four Postgres tables (no schema design)" (`agent_memory_v1` preset), the "one bright column" matrix teaser + FSL-1.1 license note, and the Mem0/Zep/Letta/nlqdb capability matrix → `/agents`. Bodies in git history.

### Helpful-answer + comparison drafts (Reddit / Show HN)

*(runs 21–36 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*

Earliest drafts: [`distribution-queue-archive.md`](./distribution-queue-archive.md).
