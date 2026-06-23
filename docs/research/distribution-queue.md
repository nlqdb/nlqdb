# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

**Retention (D4, 20 KB cap):** keep the **two most recent full drafts** below
inline; everything older collapses to a one-line title + venue + gist, with the
full body recoverable from git history. The earliest drafts live in the
[archive](./distribution-queue-archive.md).

## 2026-06-24 (run 81) — dev.to / lobste.rs: "Your collection pages don't tell answer engines they're collections"

**Where:** dev.to + lobste.rs (`seo` / `webdev` / `ai`); build-in-public, third
post in the AEO/structured-data thread. nlqdb mentioned once. The hook: you
schema'd every leaf page and forgot the hub that lists them — so the one page
that answers "what's the *whole set*?" is the one an engine has to scrape.

**Title:** Your collection pages don't tell answer engines they're collections

**Body:**

> We generate two families of pages from data: one comparison page per
> competitor, one "how do I solve X" page per recurring search. Each *leaf*
> emits `FAQPage` and `BreadcrumbList`. Solid coverage — on the leaves.
>
> Then I looked at the two `/vs` and `/solve` *index* pages: the hubs that list
> every comparison and every guide. Visibly they're exactly what a crawler
> wants — a clean enumerated list with links. In structured data they had
> nothing but the site-wide `SoftwareApplication` block. An answer engine
> landing on "what does nlqdb compare against?" had to parse prose `<li>`s to
> reconstruct the set instead of reading a declared one.
>
> The fix is `ItemList` — the schema.org type for "here is an ordered, complete
> set of things." Each `ListItem` carries a `position`, the visible link `name`,
> and the page `url`. Answer engines read it to enumerate and cite the set as a
> group; Google treats the page as the index of a set, not one more leaf. Two
> things to pass on:
>
> 1. **Build it from the same array you render** — one `.map` over the data the
>    `<ul>` already maps, so the human's list and the JSON-LD can't drift.
> 2. **Normalise the item URLs to the 200.** Same trap as breadcrumbs: if your
>    host serves `/vs/x/index.html`, point every `ListItem.url` at the
>    trailing-slash canonical, not the redirecting bare path.
>
> If you've done FAQ + breadcrumb schema on your leaves, the hub `ItemList` is
> the cheapest next win — it answers the broadest question you get ("what are
> *all* my options?"), and it was probably the one page you left bare.

**Why this advances the north-star:** onboarding / distribution — a concrete
AEO lesson with a measured before/after (hub pages declaring their collection
0 → 2), one nlqdb mention. No engine/funnel/ops KPI degrades (additive static
structured data, data-driven from the existing list).

## 2026-06-24 (run 80) — dev.to / r/LLMDevs / lobste.rs: "Your chatbot's memory and your chatbot's metrics are two different databases"

**Where:** dev.to + r/LLMDevs + lobste.rs (`ai` / `llm` / `database`); a
build-in-public design lesson for chatbot/agent builders. nlqdb mentioned once.
The hook: people reach for a vector store for *everything* their bot remembers,
then can't answer "how many conversations this week?" without the LLM doing
arithmetic over search hits.

**Title:** Your chatbot's memory and your chatbot's metrics are two different databases

**Body:**

> Every chatbot project hits the same fork. You've wired up a vector store
> (Mem0, Zep, pgvector) so the bot can recall "what did the user say earlier?"
> — and it works. Then a PM asks: *how many conversations did we have last
> week? Which users send the most messages? What's the average turns per
> session?* And you realise your memory layer can't answer any of them.
>
> The reason is structural, not a missing feature. A vector store answers one
> question: *what is the most similar thing to this?* It returns the top-k
> nearest rows. It has no query planner, no `GROUP BY`, no `COUNT`. So the
> moment the question is an aggregate, your only options are (a) pull a pile of
> rows and let the LLM count them — a hallucination generator, because LLMs are
> bad at arithmetic over lists — or (b) bolt a real database alongside the
> vector store and keep two copies of the same conversation in sync.
>
> The cleaner mental model: **retrieval and analytics are different jobs.**
> Similarity recall ("the user prefers Celsius") is retrieval — vector's
> domain. Counting, ranking, and rolling up ("top 10 intents this month",
> "messages per day") is analytics — a SQL database's domain. They look like
> the same "memory" feature in a design doc; they're not. One needs cosine
> distance, the other needs a query planner.
>
> Practically: store conversation turns as **typed rows** — `conversation_id`,
> `user_id`, `role`, `text`, `created_at` — in Postgres, and the engagement
> questions become one-line `GROUP BY`s you can trust, with the SQL visible to
> audit the grain (per message vs per conversation — easy to get wrong, easy to
> verify). Keep the vector store for similarity if you need it; just stop asking
> it to count.
>
> (We built nlqdb around exactly this split — you ask the engagement question
> in English, it runs the `GROUP BY` in Postgres and shows you the SQL. But the
> lesson stands whatever you use: don't make your similarity index do
> arithmetic.)

**Why this advances the north-star:** onboarding / distribution — a
reproducible design lesson for the GLOBAL-036 agent-memory wedge, anchoring the
new `/solve/store-query-chatbot-conversation-history` page; one nlqdb mention.
No engine/funnel/ops KPI degrades (a draft for the queue, not a code change).

## Collapsed — full drafts in git history

Newest first; collapsed once past the two-draft inline window above. Each line
is title + venue + one-line gist; `git log -p docs/research/distribution-queue.md`
recovers any body.

- run 79 — dev.to / r/LLMDevs / lobste.rs: "Your agent's memory can recall anything and count nothing" (vector stores, Mem0/Zep/Letta/LangMem, and knowledge graphs like Cognee all converge on *recall* — top-k relevant — but counting/aggregation (GROUP BY/COUNT/JOIN/HAVING over the rows the agent stored) is a different job that needs a query planner; recall and analytics want two stores that compose, not one doing both; anchors `/vs/cognee`).
- run 78 — dev.to / lobste.rs: "Your pages can win the FAQ rich result and still be invisible to AI search" (FAQPage earns the rich result but says nothing about where a page sits; `BreadcrumbList` declares a page's position in a hierarchy — match the visible trail from one source of truth so they can't drift, and point `item` URLs at the canonical 200 not the bare-path redirect; `/vs` + `/solve` pages 0 → 24 BreadcrumbList).
- run 77 — dev.to / lobste.rs: "We put FAQ schema on every comparison page — and forgot the page they all point to" (the page you care about most is the easiest to leave un-instrumented, because it's bespoke; the templated `/vs` + `/solve` pages all emitted `FAQPage`, the hand-authored `/agents` hero didn't — lift the already-visible Q&As into one typed `faqs` array → visible `<dl>` + JSON-LD; audit coverage by importance, not by template).
- run 76 — dev.to / lobste.rs: "I found the same few-shot bug twice in a week: your examples are speaking SQL to a user speaking English" (two independent few-shot retrieval misses a week apart, same root cause — the exemplar's *question* echoed SQL keywords/phrasing users don't say; `COUNT(DISTINCT)`→"different" and scalar-subquery→"which … list the names" both landed and held out; read your examples aloud before blaming the ranker).
- run 75 — Show HN / dev.to / r/mcp: "Every 'database MCP server' assumes you already have a database" (every DB-MCP connector opens with "paste your connection string"; an agent needing a *scratch* store to write+query has nowhere to put one — provision-from-English makes create and query the same call, no separate create verb; anchors `/solve/database-claude-cursor-can-query`).

### Engine-lesson posts (dev.to / lobste.rs)
- run 72 — "Your BI tool got an AI assistant. Your agent still can't call it." (open-source BI tools shipped genuinely good in-app AI assistants — NL answers, prompt-to-chart, a "fix it" button, Slack replies — but the assistant is a feature inside a destination app that helps a logged-in human; there's no handle an autonomous agent can grab, no "provision a database, write rows, query it" primitive; "who the AI helps" vs. "whether software can call it" are different axes; anchors `/vs/metabase`).
- run 70 — "Your AI BI tool reads your data. It doesn't own it — and can't write to it" (a wave of AI-native BI tools converge on "describe what to track, AI builds the dashboard" — great at it, but "your data" is a read-only connection to a warehouse you already run; they don't own a DB or write to yours; the data layer that provisions the store and takes English for the write *and* the read is a different altitude; anchors `/vs/basedash`).
- run 69 — "Your sitemap is advertising redirects — and your canonical tag points at one" (a static host serving `route/index.html` makes the bare path a 307, but `canonical`/`og:url`/sitemap/llms.txt all emitted the bare path — 27 redirecting sitemap URLs + a self-referential redirecting canonical; `trailingSlash: "always"` plus a one-place path-normalize in the head layout + URL generators, audit with `curl -sI` over every sitemap URL).
- run 68 — "Your offline LLM eval isn't measuring your model — it's measuring your rate limits" (a tiny NL→SQL bench on a free multi-provider chain scored 17/20 then 6/20 ninety seconds later; the engine didn't regress, the providers got tired — `circuit_open`/`rate_limited` errors with p50=0ms are availability, not accuracy; throttle to measure reasoning, pause-and-resume on exhaustion, keep the smoke test apart from the powered windowed run).
- run 67 — "AI made the internal-tool builder faster. It didn't ask whether you needed the tool." (low-code AI — AppGen / Ask AI / agents — scaffolds the admin tool faster, but the output is still a destination a human builds and operates; often the answer belongs inline in the product you already ship, or the asker is an agent that wants a backend primitive, not a built tool — check whether the AI sped up the workflow or the outcome; anchors `/vs/retool`).

*(runs 60–66 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*
- run 59 — "Hybrid search made your recall smarter. It still can't count." (hybrid search optimises *which* items rank, not what you can compute over them; BM25+vector fusion is still a relevance score, not a `GROUP BY`/`COUNT`/`HAVING` — recall and reporting are two jobs; anchors `/vs/weaviate`).
- run 58 — "Your text-to-SQL eval is failing the wrong schema" (BIRD 0.52 / Spider 0.19 are academic-schema scores; the same free chain scores 0.90 EX on the ICP shape — score against your product's schema, and the two misses it surfaces are the ones users actually hit; persona-bench, SK-QUAL-018).
- run 56 — "'Self-hosted' fixes lock-in, not the query model — your open-source vector store still can't GROUP BY" (self-hosting answers vendor lock-in but not the query model; an OSS vector store still has no GROUP BY/JOIN/COUNT/HAVING — deployment and capability are orthogonal axes; anchors `/vs/chroma`).
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
- run 37 — "Agent memory should be authed-only" (no durable identity to scope row reads on a throwaway anon DB; write verb + create both need a session).
- run 33 — "We were grading our text-to-SQL engine on questions it couldn't possibly answer" (Spider external-knowledge dropped; 13/135 unanswerable; SK-QUAL-016).
- runs 8–18 — earliest engine-lesson gists archived to keep this doc under the 20 KB cap (CLAUDE.md D4); titles + IDs in [`distribution-queue-archive.md`](./distribution-queue-archive.md), bodies in git history.

### Launch + build-in-public posts (X / Bluesky / HN / dev.to)

- run 57 — "Your 'instrumentation plan' is lying to you — the catalog already shipped" (once the work ships, delete the forward-looking plan table or it quietly becomes a worse copy of your live span/metric catalog + test suite; document the standing rule, not the rollout; observability-docs discipline).
- run 54 — "Your status table is drifting because it answers 'why', not just 'what'" (single-source-of-truth: a status table holds status + one-line essence + a link; the "why" lives once in the feature doc — two homes for one fact is drift with extra steps).
- run 46 — "We cap every doc at 20 KB — even the marketing backlog" (autonomous-agent context discipline; an over-cap edit must net-shrink; rolling two-draft window over the queue itself).
- run 45 — "Our waitlist has 79 rows. The honest count is 1." (honest funnel pull: 78/79 waitlist rows are us, genuine-stranger count is 1; the real bottleneck is engine accuracy).
- run 44 — "We demoted three of our four personas on the home page. On purpose." (agent-memory wedge above the fold; other three folded under a quiet divider; reversible composition change, GLOBAL-036 + WS-12).
- run 43 — "We moved agent memory above the fold — without touching the wordmark" (additive/reversible home band; Mem0·Zep·Letta·nlqdb matrix; GLOBAL-036 + WS-12).
- run 42 — launch image "GROUP BY your agent's memory" (`og/agents.png` + four `vs-*.png` cards, SK-PIVOT-004; the `/agents` share card).
- run 41 — "A live demo of analytical agent memory — the GROUP BY, and the SQL it ran" (fixture-backed `/agents` round-trip, no signup; typed-plan trust boundary).
- run 30 — "Show HN: Analytical memory for AI agents — a database it can GROUP BY, not just recall" (HN + r/AI_Agents/r/LocalLLaMA → `/agents`).
- run 53 — "Your agent's memory is a vector store. Ask it 'how many' and watch it fall over." (the aggregation gap: similarity search has no `GROUP BY`/`COUNT`/`JOIN`/`HAVING`; recall is similarity, reporting is aggregation — pick the store per job; anchors `/vs/pinecone`).
- runs 27–30 — agent-memory wave (WS-09): "Why your AI agent's memory should be a database, not a vector store" (Replit-incident open, BIRD/Spider sub-target, open harness), "…as four Postgres tables (no schema design)" (`agent_memory_v1` preset), the "one bright column" matrix teaser + FSL-1.1 license note, and the Mem0/Zep/Letta/nlqdb capability matrix → `/agents`. Bodies in git history.

### Helpful-answer + comparison drafts (Reddit / Show HN)

- run 36 — "run a GROUP BY over your agent's memory in 30s, no signup" (r/AI_Agents / r/LocalLLaMA; one `/agents` link).
- run 32 — "Agent-memory scoping in nlqdb is row-level RLS, not query-rewriting" (dev.to / lobste.rs; SK-PIVOT-009, hold until E-03 lands).
- run 32 — "Give your AI agent memory from the terminal" (`nlq remember`; target must be a memory-preset DB).
- runs 23, 25 — analytics-over-agent-memory threads → `/solve/analytical-queries-over-agent-memory`, `/solve/give-ai-agent-persistent-memory`.
- runs 21–22 — WS-02 "X vs nlqdb" / "X alternative" posts → `/vs/langmem`, `/vs/letta`.

Earliest drafts: [`distribution-queue-archive.md`](./distribution-queue-archive.md).
