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

## 2026-06-28 (run 98) — dev.to / lobste.rs / r/webdev: "Your AI crawlers read llms.txt. Your sitemap forgot a page. They disagreed."

**Where:** dev.to + lobste.rs + r/webdev; a short, transferable web-infra lesson (the
run-95/96 "self-inflicted measurement bug" family). nlqdb mentioned once, as the place
the lesson came from.

**Title:** Your AI crawlers read llms.txt. Your sitemap forgot a page. They disagreed.

**Body:**

> A site now has three machine-readable indexes of itself, and they're maintained by
> three different reflexes. `robots.txt` says who may crawl. `sitemap.xml` says what
> exists. `llms.txt` says what an LLM should read first. They overlap almost entirely —
> which is exactly why they drift: nothing forces them to agree, and three lists that
> *mostly* match are the easiest kind to stop checking.
>
> We found ours disagreeing. A real, indexable marketing page was advertised in
> `llms.txt` and allowed in `robots.txt`, but it had never been added to the hand-rolled
> `sitemap.xml`. So a human or an LLM following links found it fine — and a crawler that
> trusts the sitemap as the canonical "what exists" list never knew it was there. For a
> site whose primary acquisition channel is *being cited by Perplexity / ChatGPT /
> Claude*, an indexable page missing from the sitemap isn't cosmetic; it's a page that
> doesn't exist as far as half your discovery surface is concerned.
>
> The root cause is the usual one: the dynamic routes (`/vs/*`, `/solve/*`) were derived
> from a data file, so they could never drift — but the *static* top-level pages were a
> hand-kept array, and a hand-kept list is a list someone will forget. The fix wasn't
> "add the page" (that's the symptom). It was a test that re-derives the set of real
> top-level pages and asserts every one appears in the sitemap, so the next forgotten
> page fails CI instead of search.
>
> The transferable rule: **if two lists must agree, don't maintain two lists — derive
> one from the other, or write the test that fails when they diverge.** Drift between
> machine-readable indexes is invisible to humans (we navigate by links) and total to
> crawlers (they navigate by the index). The cheapest moment to catch it is the commit
> that creates it. (At [nlqdb](https://nlqdb.com) the sitemap, `llms.txt`, and
> `robots.txt` are now parity-tested against the actual page set.)

**Why this advances the north-star:** GLOBAL-025 onboarding on-ramp — the post drives a
genuinely-useful read to the site and the underlying fix makes more of the site
discoverable by the AI/search crawlers that are the primary acquisition channel; engine +
performance untouched.

## Collapsed — full drafts in git history

- run 97 — dev.to / r/LLMDevs / r/AI_Agents: "Your multi-tenant agent memory is one forgotten WHERE clause from a leak." (one DB holds a thousand customers' agent memory; the only thing between tenant A's rows and tenant B's answer is a `WHERE tenant_id = ?` the LLM has to remember in every query forever, and one miss leaks every tenant at once; fix moves isolation below the SQL into Postgres RLS keyed on `current_setting('app.tenant_id')` so a query with no filter sees nothing, not everything — isolation belongs in the layer that can't forget it; anchors `/solve/isolate-ai-agent-memory-per-tenant`).

- run 96 — dev.to / lobste.rs / r/ExperiencedDevs: "Your status doc keeps its own history. That's why nobody reads it." (a freshness-capped, daily-read status doc bloated to 3× its cap because each run glued a changelog line onto it; status answers "what's true now" and dies of length, changelog only works by accreting — in one file the accretion instinct always wins; fix is structural, give the capped doc a sibling that remembers and route "what happened" there).
- run 95 — dev.to / lobste.rs / r/MachineLearning: "Your eval harness will report 0% when the problem is your Wi-Fi" (an NL→SQL eval printed `EA=0.00%` from a sandbox that couldn't reach any provider — every attempt failed `network`, scored "no SQL," averaged to a meaningless 0 that would re-seed the baseline; "couldn't measure" and "measured zero" were the same outcome; fix makes non-measurement a loud distinct state — if *every* row failed for an infra reason it's an outage not a result, so refuse to compare/emit and exit non-zero; one-sided, never hides a regression; `isTransportCollapse`, SK-QUAL-020).

- run 94 — dev.to / lobste.rs: "We made share cards for half our buyer's journey and forgot the other half" (two page clusters serve one buyer — comparison `/vs` + solve pages; bespoke OG cards shipped for `/vs` months earlier, solve pages silently fell back to the generic card; each cluster internally consistent so nothing looked broken — the gap lived *between* them; coverage audits keyed on a template miss gaps between parallel clusters — diff instrumentation cluster-against-cluster; P2 solve-page OG cards 0 → 10).
- run 93 — dev.to / r/LLMDevs / r/AI_Agents: "Your agents each have their own memory. That's why they keep redoing each other's work." (a crew breaks memory a new way — one agent's facts are invisible to another; "shared vector store" fixes recall only, but "what did each agent decide / tasks each closed / latest fact" is `GROUP BY`/`COUNT`/most-recent; one shared store where each row carries `agent_id` lets any agent read another's and roll the crew up per agent; honest limits — no per-agent access control, no vector recall; anchors `/solve/share-memory-across-multiple-ai-agents`).
- run 92 — dev.to / r/LLMDevs / r/AI_Agents: "Your 'read-only' AI agent is one SQL comment away from a write." (a read-only role + connection string leaks via a write in a SQL comment, a `DROP` in a CTE, a `JOIN` onto `oauth_tokens`, a pool-draining query; root cause is the agent holding credentials *and* authoring SQL — take authorship away: server-built parameterised writes + fail-closed read validator + engine RLS, not a regex; anchors `/solve/safely-give-ai-agent-database-access`).
- run 91 — dev.to / r/LLMDevs / r/LangChain: "Your eval results live in a spreadsheet. The question 'which version regressed' lives in SQL." (an eval run is scored cases, but "pass rate per version, which regressed, trend per model" are aggregations across every run — a pivot rots, asking the LLM to tally hallucinates; scoring and tracking are different machines — log each case as a typed row; anchors `/solve/track-llm-eval-scores-across-prompt-versions`).

- run 90 — dev.to / r/LangChain / r/LLMDevs: "Your vector store found the chunk. It can't tell you which source you keep retrieving and never use." (RAG retrieval is *recall*; "which source retrieved most / never surfaces / avg relevance" is an aggregation over the retrieval log — a vector store is the wrong shape to `GROUP BY`; log each retrieval as a typed row; anchors `/solve/analyze-rag-retrieval-logs`).
- run 88 — dev.to / r/LLMDevs / lobste.rs: "You're grepping your agent's trace logs to count which tool fails. That's a GROUP BY." (which tool fails most, p95 per tool, calls per session are aggregations, and a span-tree trace log is the wrong shape to `GROUP BY` across runs; *capture* (OTel/AgentOps/Langfuse) and *query* are different machines — log each tool call as a typed row; anchors `/solve/analyze-agent-tool-call-logs`).
- run 87 — dev.to / lobste.rs: "Your Cmd+K palette is invisible to screen readers — one attribute fixes it" (the palette every app ships is perfect for people who can *see* the highlight move; under a screen reader it's silent because the highlight is just a CSS class and focus never leaves the input; the fix tutorials skip is `aria-activedescendant` letting the focused input point at a *different* "active" option, with `combobox`/`listbox`/`option` + `aria-selected`; keep option ids in one helper and clamp the index in pure logic; palette ARIA associations 0 → 3).
- run 86 — dev.to / lobste.rs / r/LLMDevs: "Your llms.txt is a sitemap for robots that read — and mine was missing the page I care about most" (the LLM-crawler index was hand-curated *before* the flagship landing page existed, so it was silently absent; data-driven lists stayed in sync, the bespoke array nobody revisited rotted — audit the *rendered* artifact, pin bespoke entries with a test; `llms.txt` primary routes 4 → 6).
- run 85 — dev.to / r/LLMDevs / lobste.rs: "Your token-cost dashboard is doing arithmetic in your app code" (LLM token/cost numbers land in a JSON log, but "spend per customer this month, which model is expensive?" is an aggregation — `SUM(cost) GROUP BY user`/`model` — and a log isn't a thing you aggregate, so you total rows in app code or ask the LLM to add them (a confident-wrong-total generator); *capture* (provider SDK / Langfuse / Helicone) and *query* (a planner) are different machines — the moment a dashboard sums a column in app code it wanted a database; anchors `/solve/track-ai-token-usage-and-cost`).
- run 84 — dev.to / r/LocalLLaMA / lobste.rs: "Scaling your vector store to a billion rows doesn't give it a GROUP BY" (teams reach for Milvus/Qdrant for *scale*, but ANN throughput and a query planner are orthogonal — a vector index finds the K nearest embeddings at any scale, `JOIN`/`GROUP BY`/`HAVING` need a relational planner; keep the vector engine for recall, put rows you count+group in something that speaks SQL; anchors `/vs/milvus`).
- run 83 — dev.to / lobste.rs: "I skipped the rich result Google was begging me to add" (the most-recommended structured-data win — the `WebSite` `SearchAction` sitelinks search box — is the one I deliberately *didn't* ship: a `SearchAction` is a promise that a URL template runs a query, but the homepage submits over JS with no `GET /search?q=…` route, so the schema would *validate* and be a *lie*; kept the honest half — `Organization` + `WebSite` with stable `@id`s and every page's `SoftwareApplication` naming that Organization as `publisher`; "would this validate?" is the wrong test, "is this true?" is; brand-entity nodes 1 → 3).
- run 82 — dev.to / lobste.rs: "Your AI app tells sighted users the query failed. Screen readers get silence." (the AI-feature text box swaps *loading*/*result*/*error* async with two quiet a11y misses: the result region isn't a live region (`aria-live`/`role="status"` once on the container), and the *input* never says it's invalid — add `aria-invalid` + `aria-describedby` pointing at one error `id`, collapsing the structured + network error branches into a single `role="alert"` region; test the error path with the reader on; anchored to this run's CreateForm fix, ARIA associations 0 → 2).
- run 81 — dev.to / lobste.rs: "Your collection pages don't tell answer engines they're collections" (leaf `/vs` + `/solve` pages emit `FAQPage`/`BreadcrumbList`, but the hubs listing them carried only the site-wide `SoftwareApplication`; `ItemList` declares "an ordered, complete set" — build it from the same array the `<ul>` renders so it can't drift, item URLs at the trailing-slash 200; hub collection signal 0 → 2).
- run 80 — dev.to / r/LLMDevs / lobste.rs: "Your chatbot's memory and your chatbot's metrics are two different databases" (a vector store answers *what is most similar* — top-k, no query planner; the moment the question is an aggregate ("how many conversations this week?") you either make the LLM count rows (hallucination) or bolt on a real DB; retrieval and analytics are different jobs — store turns as typed rows and the engagement questions become trustworthy `GROUP BY`s; anchors `/solve/store-query-chatbot-conversation-history`).
- run 79 — dev.to / r/LLMDevs / lobste.rs: "Your agent's memory can recall anything and count nothing" (vector stores, Mem0/Zep/Letta/LangMem, and knowledge graphs like Cognee all converge on *recall* — top-k relevant — but counting/aggregation (GROUP BY/COUNT/JOIN/HAVING over the rows the agent stored) is a different job that needs a query planner; recall and analytics want two stores that compose, not one doing both; anchors `/vs/cognee`).
- run 78 — dev.to / lobste.rs: "Your pages can win the FAQ rich result and still be invisible to AI search" (FAQPage earns the rich result but says nothing about where a page sits; `BreadcrumbList` declares a page's position in a hierarchy — match the visible trail from one source of truth so they can't drift, and point `item` URLs at the canonical 200 not the bare-path redirect; `/vs` + `/solve` pages 0 → 24 BreadcrumbList).
*(runs 75–77 moved to git history under D4 — `git log -p` recovers the bodies.)*

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
- runs 8–18, 33, 37, 39, 41–44 — earliest engine-lesson gists archived to keep this doc under the 20 KB cap (CLAUDE.md D4); titles + IDs in [`distribution-queue-archive.md`](./distribution-queue-archive.md), bodies in git history.

### Launch + build-in-public posts (X / Bluesky / HN / dev.to)

- run 57 — "Your 'instrumentation plan' is lying to you — the catalog already shipped" (once the work ships, delete the forward-looking plan table or it quietly becomes a worse copy of your live span/metric catalog + test suite; document the standing rule, not the rollout; observability-docs discipline).
- run 54 — "Your status table is drifting because it answers 'why', not just 'what'" (single-source-of-truth: a status table holds status + one-line essence + a link; the "why" lives once in the feature doc — two homes for one fact is drift with extra steps).
- run 46 — "We cap every doc at 20 KB — even the marketing backlog" (autonomous-agent context discipline; an over-cap edit must net-shrink; rolling two-draft window over the queue itself).
- run 45 — "Our waitlist has 79 rows. The honest count is 1." (honest funnel pull: 78/79 waitlist rows are us, genuine-stranger count is 1; the real bottleneck is engine accuracy).
- runs 43–44 — "We moved agent memory above the fold and demoted three of our four personas. On purpose." (additive/reversible home reweight; agent-memory wedge + Mem0·Zep·Letta·nlqdb matrix above the fold, other personas folded under a quiet divider; GLOBAL-036 + WS-12).
- run 42 — launch image "GROUP BY your agent's memory" (`og/agents.png` + four `vs-*.png` cards, SK-PIVOT-004; the `/agents` share card).
- run 41 — "A live demo of analytical agent memory — the GROUP BY, and the SQL it ran" (fixture-backed `/agents` round-trip, no signup; typed-plan trust boundary).
- runs 27–30 — agent-memory wave (WS-09): "Why your AI agent's memory should be a database, not a vector store" (Replit-incident open, BIRD/Spider sub-target, open harness), "…as four Postgres tables (no schema design)" (`agent_memory_v1` preset), the "one bright column" matrix teaser + FSL-1.1 license note, and the Mem0/Zep/Letta/nlqdb capability matrix → `/agents`. Bodies in git history.

### Helpful-answer + comparison drafts (Reddit / Show HN)

*(runs 21–36 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*

Earliest drafts: [`distribution-queue-archive.md`](./distribution-queue-archive.md).
