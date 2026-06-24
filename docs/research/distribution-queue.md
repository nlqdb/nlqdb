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

## 2026-06-24 (run 90) — dev.to / r/LangChain / r/LLMDevs: "Your vector store found the chunk. It can't tell you which source you keep retrieving and never use."

**Where:** dev.to + r/LangChain + r/LLMDevs (`rag` / `llm` / `agents`);
build-in-public, sibling to the run-88 tool-call-logs and run-80 chatbot-memory
posts. nlqdb mentioned once. The hook: RAG retrieval is *recall* (find the K
nearest), but "which source gets retrieved most / never surfaces / how relevant
per source" is an aggregation over the retrieval log — and a vector store, like a
flat trace log, is the wrong shape to GROUP BY.

**Title:** Your vector store found the chunk. It can't tell you which source you keep retrieving and never use.

**Body:**

> Your RAG pipeline retrieves chunks on every query. Some sources get pulled
> constantly, some never surface, some score high relevance and still produce bad
> answers. So you reach for the questions that actually tell you if retrieval is
> healthy: *which source documents get retrieved most this week? which ones in my
> corpus never get hit? what's the average relevance score per source?* And then
> you open the vector-store query traces, or `jq` over a retrieval log, and start
> counting by hand.
>
> Those aren't similarity lookups. They're aggregations — `COUNT(*) … GROUP BY
> source`, `AVG(score) … GROUP BY source`, an anti-join for "sources never
> retrieved." A vector store is built for the opposite job: given an embedding,
> return the K nearest. That's *recall*, and it's a different machine from a query
> planner. The moment your question is "across all retrievals, ranked by source,"
> the vector index has nothing to say — it finds neighbors, it doesn't `GROUP BY`.
> So you scrape the log in app code (fragile, slower every week as the corpus
> grows) or — worse — paste it into an LLM and ask it to tally. Arithmetic over a
> list is a confident-wrong-number generator.
>
> The split worth internalizing: **retrieval and analytics are different
> machines.** Your vector store (Pinecone, pgvector, Chroma, Weaviate) is great at
> *which chunks are most similar*. None of them is a query planner over the
> retrieval *log*. The moment your question is "per source, across all queries,
> ranked," you wanted a database, not a vector index.
>
> So log each retrieval as a typed *row* — `query_id`, `source`, `chunk_id`,
> `relevance_score`, `ts` — the moment it returns, in parallel with the search
> itself. Now "retrievals per source this week, most first" and "sources that
> never surface" are one query each, not a script. You don't have to write the SQL
> yourself: that's the demo on
> [nlqdb](https://nlqdb.com/solve/analyze-rag-retrieval-logs/) — you ask in
> English, it provisions the Postgres and runs the `GROUP BY`, and it shows you the
> SQL it ran so you can check the grain (per retrieval vs per query) before you
> trust a number. The retrieval still happens in your vector store; nlqdb is the
> database half you analyze the log with.
>
> The tell that you crossed the line: you're counting retrievals in application
> code, or asking a model to count log lines. Keep the vector store for finding the
> chunk. Put the rows you *count and group* somewhere that speaks SQL.

**Why this advances the north-star:** onboarding / distribution (GLOBAL-025) — a
P2-agent-builder search-intent on-ramp anchoring `/solve/analyze-rag-retrieval-logs`
(solve pages 10 → 11, the RAG retrieval-quality wedge), honest about what nlqdb
doesn't do (no vector search or embedding — that stays in your vector store). One
nlqdb mention. No engine/funnel/ops KPI degrades (additive AEO page, data-only).

## Collapsed — full drafts in git history

Newest first; collapsed once past the single inline draft above (the latest draft
has grown enough that even two no longer fit under the D4 20 KB cap). Each line is
title + venue + one-line gist; `git log -p docs/research/distribution-queue.md`
recovers any body.

- run 88 — dev.to / r/LLMDevs / lobste.rs: "You're grepping your agent's trace logs to count which tool fails. That's a GROUP BY." (agent-observability questions — which tool fails most, p95 latency per tool, calls per session — are aggregations, and a flat trace log built to reconstruct *one* run as a span tree is the wrong shape to `GROUP BY` across all runs; *capture* (OTel/AgentOps/Langfuse) and *query* (a planner) are different machines — log each tool call as a typed row alongside the tracer; anchors `/solve/analyze-agent-tool-call-logs`).
- run 87 — dev.to / lobste.rs: "Your Cmd+K palette is invisible to screen readers — one attribute fixes it" (the palette every app ships is perfect for people who can *see* the highlight move; under a screen reader it's silent because the highlight is just a CSS class and focus never leaves the input; the fix tutorials skip is `aria-activedescendant` letting the focused input point at a *different* "active" option, with `combobox`/`listbox`/`option` + `aria-selected`; keep option ids in one helper and clamp the index in pure logic; palette ARIA associations 0 → 3).
- run 86 — dev.to / lobste.rs / r/LLMDevs: "Your llms.txt is a sitemap for robots that read — and mine was missing the page I care about most" (the machine-readable index LLM-IDE crawlers fetch was hand-curated *before* the flagship landing page existed, so the page our positioning is built around was silently absent; the comparison/how-to lists were data-driven and stayed in sync, but the bespoke top-level array nobody revisited rotted — audit the *rendered* artifact not the source, and pin bespoke entries with a test; also caught a stale "closed beta" status string; `llms.txt` primary routes 4 → 6, pivot page 0 → 1).
- run 85 — dev.to / r/LLMDevs / lobste.rs: "Your token-cost dashboard is doing arithmetic in your app code" (LLM token/cost numbers land in a JSON log, but "spend per customer this month, which model is expensive?" is an aggregation — `SUM(cost) GROUP BY user`/`model` — and a log isn't a thing you aggregate, so you total rows in app code or ask the LLM to add them (a confident-wrong-total generator); *capture* (provider SDK / Langfuse / Helicone) and *query* (a planner) are different machines — the moment a dashboard sums a column in app code it wanted a database; anchors `/solve/track-ai-token-usage-and-cost`).
- run 84 — dev.to / r/LocalLLaMA / lobste.rs: "Scaling your vector store to a billion rows doesn't give it a GROUP BY" (teams outgrow a hosted vector store and reach for Milvus/Qdrant for *scale* — but ANN throughput and a query planner are orthogonal axes; a vector index only finds the K nearest embeddings at any scale, while `JOIN`/multi-column `GROUP BY`/`HAVING` need a relational planner; the tell is counting rows in app code or asking the LLM to count search hits — keep the vector engine for recall, put the rows you count+group in something that speaks SQL; anchors `/vs/milvus`, honest about Milvus's ANN-at-scale strengths).
- run 83 — dev.to / lobste.rs: "I skipped the rich result Google was begging me to add" (the most-recommended structured-data win — the `WebSite` `SearchAction` sitelinks search box — is the one I deliberately *didn't* ship: a `SearchAction` is a promise that a URL template runs a query, but the homepage submits over JS with no `GET /search?q=…` route, so the schema would *validate* and be a *lie*; kept the honest half — `Organization` + `WebSite` with stable `@id`s and every page's `SoftwareApplication` naming that Organization as `publisher`; "would this validate?" is the wrong test, "is this true?" is; brand-entity nodes 1 → 3).
- run 82 — dev.to / lobste.rs: "Your AI app tells sighted users the query failed. Screen readers get silence." (the AI-feature text box swaps *loading*/*result*/*error* async with two quiet a11y misses: the result region isn't a live region (`aria-live`/`role="status"` once on the container), and the *input* never says it's invalid — add `aria-invalid` + `aria-describedby` pointing at one error `id`, collapsing the structured + network error branches into a single `role="alert"` region; test the error path with the reader on; anchored to this run's CreateForm fix, ARIA associations 0 → 2).
- run 81 — dev.to / lobste.rs: "Your collection pages don't tell answer engines they're collections" (leaf `/vs` + `/solve` pages emit `FAQPage`/`BreadcrumbList`, but the hubs listing them carried only the site-wide `SoftwareApplication`; `ItemList` declares "an ordered, complete set" — build it from the same array the `<ul>` renders so it can't drift, item URLs at the trailing-slash 200; hub collection signal 0 → 2).
- run 80 — dev.to / r/LLMDevs / lobste.rs: "Your chatbot's memory and your chatbot's metrics are two different databases" (a vector store answers *what is most similar* — top-k, no query planner; the moment the question is an aggregate ("how many conversations this week?") you either make the LLM count rows (hallucination) or bolt on a real DB; retrieval and analytics are different jobs — store turns as typed rows and the engagement questions become trustworthy `GROUP BY`s; anchors `/solve/store-query-chatbot-conversation-history`).
- run 79 — dev.to / r/LLMDevs / lobste.rs: "Your agent's memory can recall anything and count nothing" (vector stores, Mem0/Zep/Letta/LangMem, and knowledge graphs like Cognee all converge on *recall* — top-k relevant — but counting/aggregation (GROUP BY/COUNT/JOIN/HAVING over the rows the agent stored) is a different job that needs a query planner; recall and analytics want two stores that compose, not one doing both; anchors `/vs/cognee`).
- run 78 — dev.to / lobste.rs: "Your pages can win the FAQ rich result and still be invisible to AI search" (FAQPage earns the rich result but says nothing about where a page sits; `BreadcrumbList` declares a page's position in a hierarchy — match the visible trail from one source of truth so they can't drift, and point `item` URLs at the canonical 200 not the bare-path redirect; `/vs` + `/solve` pages 0 → 24 BreadcrumbList).
- run 77 — dev.to / lobste.rs: "We put FAQ schema on every comparison page — and forgot the page they all point to" (the page you care about most is easiest to leave un-instrumented because it's bespoke; the templated `/vs` + `/solve` pages all emitted `FAQPage`, the hand-authored `/agents` hero didn't — lift the visible Q&As into one typed `faqs` array → `<dl>` + JSON-LD; audit coverage by importance, not template).
- run 76 — dev.to / lobste.rs: "I found the same few-shot bug twice in a week: your examples are speaking SQL to a user speaking English" (two independent few-shot retrieval misses a week apart, same root cause — the exemplar's *question* echoed SQL keywords/phrasing users don't say; `COUNT(DISTINCT)`→"different" and scalar-subquery→"which … list the names" both landed and held out; read your examples aloud before blaming the ranker).
- run 75 — Show HN / dev.to / r/mcp: "Every 'database MCP server' assumes you already have a database" (every DB-MCP connector opens with "paste your connection string"; an agent needing a *scratch* store to write+query has nowhere to put one — provision-from-English makes create and query the same call, no separate create verb; anchors `/solve/database-claude-cursor-can-query`).

### Engine-lesson posts (dev.to / lobste.rs)
- run 72 — "Your BI tool got an AI assistant. Your agent still can't call it." (open-source BI tools shipped genuinely good in-app AI assistants — NL answers, prompt-to-chart, a "fix it" button, Slack replies — but the assistant is a feature inside a destination app that helps a logged-in human; there's no handle an autonomous agent can grab, no "provision a database, write rows, query it" primitive; "who the AI helps" vs. "whether software can call it" are different axes; anchors `/vs/metabase`).
- run 70 — "Your AI BI tool reads your data. It doesn't own it — and can't write to it" (a wave of AI-native BI tools converge on "describe what to track, AI builds the dashboard" — great at it, but "your data" is a read-only connection to a warehouse you already run; they don't own a DB or write to yours; the data layer that provisions the store and takes English for the write *and* the read is a different altitude; anchors `/vs/basedash`).
- run 69 — "Your sitemap is advertising redirects — and your canonical tag points at one" (a static host serving `route/index.html` makes the bare path a 307, but `canonical`/`og:url`/sitemap/llms.txt all emitted the bare path — 27 redirecting sitemap URLs + a self-referential redirecting canonical; `trailingSlash: "always"` plus a one-place path-normalize in the head layout + URL generators, audit with `curl -sI` over every sitemap URL).
- run 68 — "Your offline LLM eval isn't measuring your model — it's measuring your rate limits" (a tiny NL→SQL bench on a free multi-provider chain scored 17/20 then 6/20 ninety seconds later; the engine didn't regress, the providers got tired — `circuit_open`/`rate_limited` errors with p50=0ms are availability, not accuracy; throttle to measure reasoning, pause-and-resume on exhaustion, keep the smoke test apart from the powered windowed run).
- run 67 — "AI made the internal-tool builder faster. It didn't ask whether you needed the tool." (low-code AI — AppGen / Ask AI / agents — scaffolds the admin tool faster, but the output is still a destination a human builds and operates; often the answer belongs inline in the product you already ship, or the asker is an agent that wants a backend primitive, not a built tool — check whether the AI sped up the workflow or the outcome; anchors `/vs/retool`).

*(runs 56–66 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*
- run 55 — "Your text-to-SQL accuracy is measured on schemas your users will never build" (BIRD/Spider run over messy 20–100-table academic schemas, not the small clean ones your users build; we added a third benchmark — hand-authored gold NL→SQL over the ICP shape, same EX scorer, literal-date gold so it never drifts with the clock; anchors persona-bench, SK-QUAL-018).
- run 53 — "Your agent's memory is a vector store. Ask it 'how many' and watch it fall over." (the aggregation gap: similarity search has no GROUP BY/COUNT/JOIN/HAVING; recall is similarity, reporting is aggregation — pick the store per job; anchors `/vs/pinecone`).
- run 52 — "Some few-shot retrieval misses can't be fixed with lexical *selector* tricks — and measuring *why* is the win" (stopword filter regressed 18/20 → 17/20, phrase-normalisation flat, held-out 14/14; the verdict was later narrowed by runs 74/76 to selector-*code* tweaks — pool-exemplar phrasing turned out to be the live lever; both selector experiments reverted).
- run 51 — "The most common query in your product has no row in your benchmark" (error-class taxonomies omit easy high-frequency shapes; "show the 10 most recent signups" retrieved a `GROUP BY` demo; +plain `ORDER BY … LIMIT` row, held-out 13/13 → 14/14, own-query 18/20 held).
- run 48 — "Test your few-shot retrieval against your *own* users' queries — not just the benchmark" (a held-out probe set that paraphrases your own examples reports green while real-user queries silently retrieve the wrong shape; "never logged in" → anti-join not `IS NULL`; own-query precision 17/20 → 18/20, held-out 13/13 unmoved).
- run 46 — "Your few-shot examples might be teaching the model the wrong shape" (retrieval quality is bounded by pool *coverage*, not the ranker; a one-word negation retrieves its own opposite if the pool can't represent the shape; +anti-join/+top-N-of-aggregate, precision held 12/12).
- runs 43–44 — "Your benchmark should look like your users' database, not a research paper's" (persona-bench: NL→SQL on the schema shapes users actually build; sound-ruler invariant 12/12 before any accuracy number).
- run 43 — "Ship your LLM lever as a default-off ablation — measure before you adopt" (`buildPlanSystem(goal, schema, k)`, `k=0` byte-identical; prove inert + token-negative before spending quota; closes runs 38–43 retrieval arc).
- run 42 — "Don't hand-pick few-shot examples — size the pool from your benchmark's error classes" (one exemplar per mismatch class; precision@1 10/10, 3.5× closer skeleton; `packages/llm/plan-exemplar-pool.ts`).
- run 41 — "Cross-schema few-shot retrieval: mask each example against *its own* schema" (`selectExemplarsForSchema`, per-row masking; `packages/llm/few-shot-select.ts`). Runs 37–42 value/identifier-masking + self-consistency stubs consolidated here.
- run 39 — "How nlqdb expires agent memory (and why only facts get a TTL)" (facts-only `expires_at`, per-DB-isolated daily `DELETE` + RLS recency clause; `SK-PIVOT-011`, E-04).
- runs 8–18, 33, 37 — earliest engine-lesson gists archived to keep this doc under the 20 KB cap (CLAUDE.md D4); titles + IDs in [`distribution-queue-archive.md`](./distribution-queue-archive.md), bodies in git history.

### Launch + build-in-public posts (X / Bluesky / HN / dev.to)

- run 57 — "Your 'instrumentation plan' is lying to you — the catalog already shipped" (once the work ships, delete the forward-looking plan table or it quietly becomes a worse copy of your live span/metric catalog + test suite; document the standing rule, not the rollout; observability-docs discipline).
- run 54 — "Your status table is drifting because it answers 'why', not just 'what'" (single-source-of-truth: a status table holds status + one-line essence + a link; the "why" lives once in the feature doc — two homes for one fact is drift with extra steps).
- run 46 — "We cap every doc at 20 KB — even the marketing backlog" (autonomous-agent context discipline; an over-cap edit must net-shrink; rolling two-draft window over the queue itself).
- run 45 — "Our waitlist has 79 rows. The honest count is 1." (honest funnel pull: 78/79 waitlist rows are us, genuine-stranger count is 1; the real bottleneck is engine accuracy).
- run 44 — "We demoted three of our four personas on the home page. On purpose." (agent-memory wedge above the fold; other three folded under a quiet divider; reversible composition change, GLOBAL-036 + WS-12).
- run 43 — "We moved agent memory above the fold — without touching the wordmark" (additive/reversible home band; Mem0·Zep·Letta·nlqdb matrix; GLOBAL-036 + WS-12).
- run 42 — launch image "GROUP BY your agent's memory" (`og/agents.png` + four `vs-*.png` cards, SK-PIVOT-004; the `/agents` share card).
- run 41 — "A live demo of analytical agent memory — the GROUP BY, and the SQL it ran" (fixture-backed `/agents` round-trip, no signup; typed-plan trust boundary).
- runs 27–30 — agent-memory wave (WS-09): "Why your AI agent's memory should be a database, not a vector store" (Replit-incident open, BIRD/Spider sub-target, open harness), "…as four Postgres tables (no schema design)" (`agent_memory_v1` preset), the "one bright column" matrix teaser + FSL-1.1 license note, and the Mem0/Zep/Letta/nlqdb capability matrix → `/agents`. Bodies in git history.

### Helpful-answer + comparison drafts (Reddit / Show HN)

*(runs 21–36 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*

Earliest drafts: [`distribution-queue-archive.md`](./distribution-queue-archive.md).
