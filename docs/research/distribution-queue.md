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

## 2026-06-29 (run 106) — dev.to / r/webdev / r/sideproject: "You don't need a backend to store form submissions. You need a place to ask 'how many'."

**Where:** dev.to + r/webdev + r/sideproject; a transferable how-to for indie builders
shipping a landing page who hit the "where do the signups go?" wall. nlqdb mentioned
once, as the shape that answered the second half of the problem.

**Title:** You don't need a backend to store form submissions. You need a place to ask "how many."

**Body:**

> Every landing page hits the same wall around hour three: the waitlist form works, but
> where do the emails *go*? The reflex is to stand up a server and a database for what is,
> honestly, an `INSERT` and an occasional `COUNT`. So most people reach for a form SaaS
> instead — and that solves storage, but quietly splits your data from your questions.
> The submissions live in someone's dashboard; the moment you want "signups per day since
> launch" or "which referrer actually converted," you're exporting a CSV and pivoting it
> by hand.
>
> There are two problems hiding in one, and they have different shapes. **Capture** is a
> write — a small one, and it genuinely doesn't need a server: an insert call from the
> page's own `fetch`, or a ten-line serverless function, is enough, as long as the write
> key isn't sitting in your client HTML. **Reporting** is a read, and it's the part that
> actually wants a database — because "how many per day," "top source this week," "what's
> the conversion by campaign" are aggregations, and aggregations want a query planner, not
> a spreadsheet and a human.
>
> The mistake is picking a tool that's great at the write and leaves you alone with the
> read. A form service nails capture and hands you a list. A spreadsheet-via-webhook nails
> capture and hands you a tab you pivot manually. What you want is for the place the rows
> land to also be a place you can *ask questions of* — ideally in plain English, so the
> day-one launch question ("did anyone sign up?") and the week-two question ("which tweet
> drove it?") are the same two-second action, not a data chore.
>
> That's the shape worth looking for, whatever you build it on: storage you can also
> interrogate. I wired ours so each submission is a row in a real Postgres and the
> reporting question is one English goal — `signups grouped by day with a count` — that
> compiles to SQL I can see. (We do this with [nlqdb](https://nlqdb.com); the point isn't
> the tool, it's refusing to let your form data land somewhere you can't ask it anything.)
> The honest caveat that applies to *any* version of this: the public read widget isn't a
> write endpoint — capture still goes through a key the browser never sees, and email
> delivery + spam filtering stay your ESP's and your front-end's job. Storage isn't the
> hard part. Not being able to ask your own data a question is.

**Why this advances the north-star:** GLOBAL-025 onboarding/UX — answers a real, recurring
indie-builder search ("store form submissions without a backend") with a genuinely useful
framing (split capture from reporting), drawn from the `/solve` page shipped this run; the
post earns a citation without a pitch and seeds the search-intent on-ramp.

## Collapsed — full drafts in git history

- run 105 — dev.to / r/LLMDevs / lobste.rs: "COUNT(*) is three different questions. Your few-shot pool probably teaches one." (`COUNT(*)` isn't one shape — scalar count, `GROUP BY` count, and filtered count over a join are three answers sharing a keyword; a masked few-shot pool with a teacher for two of them retrieves the confidently-wrong neighbor for the third, so when retrieval returns the wrong example suspect a missing shape before a smarter ranker; label shapes by the answer they produce, not the operators, and pin each with a held-out probe; `join-aggregate-filter` pool row, ICP retrieval 22/23 → 23/23).
- run 104 — dev.to / lobste.rs / r/SEO: "The '25 words max' rule in your style guide is a lie your CMS can't catch." (content style-guide rules — "bullets ≤25 words" — are soft, so they decay the way unenforced rules do; measured our own `/solve` bullets and found 25 of ~50 over budget with no single bad edit; the fix moves the rule from a code comment into a six-line test that names offenders, because a constraint enforced by attention decays at the rate attention does — if you can write it as "for all X, P(X)," write the predicate, not the guideline).
- run 102 — dev.to / r/LLMDevs / r/AI_Agents: "Every data tool shipped an MCP server this year. Your agent still can't build on most of them." (by 2026 "has an MCP server" is the new "has an API" — universal and uninformative; two MCP shapes look identical in a feature matrix but aren't — one wraps a *destination app* (ask my notebook, answer from my dashboard: read-only over a human's workflow), the other exposes *infrastructure the agent owns* (provision a DB, write rows, migrate schema); the tell is what the agent *owns* after the call returns — a view it can read but not accumulate into is a calculator, not a coworker; ask "what does it let the agent own," not "does it exist").
- run 103 — dev.to / lobste.rs / r/ExperiencedDevs: "Your style rule lives in a code comment. That's why it's already broken." (the SK-CMP-001 `/vs` "≤16 words per when-to-choose bullet" rule lived only as a TypeScript comment and had silently drifted — one competitor entry held seven over-budget bullets because the diff that broke it touched a different file than the comment; a doc-comment *reads* like enforcement but is not load-bearing, so it decays at the rate attention does; the fix moves the rule into a six-line test that names offenders and fails the next over-long bullet in its own PR — a constraint you can state as "for all X, P(X)" belongs in a predicate, not prose).
- run 100 — dev.to / r/LLMDevs / lobste.rs: "Two SQL examples that use the same clauses are not the same example — and your few-shot retriever can't tell." (a ranked grouped count — `GROUP BY x, COUNT(*) … ORDER BY COUNT(*) DESC LIMIT n` — retrieved a percentage/`CAST … REAL` example on generic word overlap; the deeper bug was a pool that conflated "return the top group's *key*" with "return the top groups *and their count*" — same clauses, different answer, so one teacher taught the other shape wrong; rule: a few-shot pool needs a teacher for every *output shape*, not every SQL operation; verify offline with a held-out cross-domain probe per shape; 21/23 → 22/23).
- run 99 — dev.to / r/LLMDevs / lobste.rs: "Your few-shot retriever ranked by word overlap and taught the model a filter the question never asked for." (dynamic few-shot for text-to-SQL masks the question to match its *skeleton*; a grouped-count-over-join with no threshold retrieved a `HAVING COUNT(*) > n` example because flat token overlap can't tell a structural token from a coincidental one; the bug wasn't the ranker — measured, it just shuffles which question breaks — it was the *pool* having no teacher for that shape, so the question fell to the nearest wrong one; a retrieval pool is a curriculum, a missing shape returns the closest wrong thing confidently; hold out a cross-domain probe per shape as a unit test; 20/23 → 21/23).
- run 98 — dev.to / lobste.rs / r/webdev: "Your AI crawlers read llms.txt. Your sitemap forgot a page. They disagreed." (a site has three machine-readable indexes of itself — `robots.txt`/`sitemap.xml`/`llms.txt` — maintained by three reflexes that drift because nothing forces them to agree; a real indexable page advertised in `llms.txt` + allowed in `robots.txt` was never in the hand-rolled `sitemap.xml`, so link-followers found it and sitemap-trusting crawlers never knew it existed; fix re-derives the real top-level-page set and asserts every one is in the sitemap so the next forgotten page fails CI not search — if two lists must agree, don't maintain two, derive one or test the divergence).
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
*(runs 75–85 moved to git history under D4 — `git log -p` recovers the bodies.)*

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
- runs 8–18, 33, 37, 39, 41–44, 46, 48 — earliest engine-lesson gists archived to keep this doc under the 20 KB cap (CLAUDE.md D4); titles + IDs in [`distribution-queue-archive.md`](./distribution-queue-archive.md), bodies in git history.

### Launch + build-in-public posts (X / Bluesky / HN / dev.to)

- run 46 — "We cap every doc at 20 KB — even the marketing backlog" (autonomous-agent context discipline; an over-cap edit must net-shrink; rolling two-draft window over the queue itself).
- run 45 — "Our waitlist has 79 rows. The honest count is 1." (honest funnel pull: 78/79 waitlist rows are us, genuine-stranger count is 1; the real bottleneck is engine accuracy).
- runs 43–44 — "We moved agent memory above the fold and demoted three of our four personas. On purpose." (additive/reversible home reweight; agent-memory wedge + Mem0·Zep·Letta·nlqdb matrix above the fold, other personas folded under a quiet divider; GLOBAL-036 + WS-12).
- run 42 — launch image "GROUP BY your agent's memory" (`og/agents.png` + four `vs-*.png` cards, SK-PIVOT-004; the `/agents` share card).
- run 41 — "A live demo of analytical agent memory — the GROUP BY, and the SQL it ran" (fixture-backed `/agents` round-trip, no signup; typed-plan trust boundary).
- runs 27–30 — agent-memory wave (WS-09): "Why your AI agent's memory should be a database, not a vector store" (Replit-incident open, BIRD/Spider sub-target, open harness), "…as four Postgres tables (no schema design)" (`agent_memory_v1` preset), the "one bright column" matrix teaser + FSL-1.1 license note, and the Mem0/Zep/Letta/nlqdb capability matrix → `/agents`. Bodies in git history.

### Helpful-answer + comparison drafts (Reddit / Show HN)

*(runs 21–36 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*

Earliest drafts: [`distribution-queue-archive.md`](./distribution-queue-archive.md).
