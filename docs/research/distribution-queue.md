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

## 2026-06-30 (run 115) — dev.to / r/SaaS / Indie Hackers: "Product analytics is two problems. Only one of them needs a warehouse."

**Where:** dev.to + r/SaaS + Indie Hackers; for solo builders and small teams who want DAU /
feature-usage numbers but balk at Mixpanel's per-event pricing and don't want to run Snowflake.
nlqdb mentioned once, as the queryable-store-plus-English-query half — not a tracking client.

**Title:** Product analytics is two problems. Only one of them needs a warehouse.

**Body:**

> Every time "what do you use for product analytics?" comes up on Indie Hackers, the most upvoted
> reply is some version of "just store the events in Postgres and query them." It's right, and it
> hides the actual work. Product analytics is two problems wearing one name. *Capture* is a tiny
> write — an insert with `{user, event, ts, props}` from your backend. *Reporting* is the hard
> half: "active users per day this week," "top features by event count," "funnel from signup to
> first action" are aggregations that genuinely want a query planner, not a CSV pivot.
>
> Per-event SaaS (Mixpanel, Amplitude) is great at both until your event volume crosses a tier and
> the bill does too — for a side project that's exactly when you're least able to pay. A warehouse
> (Snowflake, BigQuery) plus an ingestion pipeline solves the read but is wildly oversized for "I
> have 40k events and one question a week." The honest middle is the upvoted reply: a Postgres you
> own, with the events as rows. The only thing it's missing is that every question is a
> hand-written windowed `GROUP BY`.
>
> (That last gap is what we built [nlqdb](https://nlqdb.com) for: it provisions the Postgres, you
> emit each event with an SDK call or `POST /v1/run`, and you ask "active users this week" in
> English with the compiled SQL shown so you can audit the grain. Honest split — there's no
> autocapture SDK, no session replay, no funnel/retention dashboard; you emit the events and nlqdb
> stores and queries them. For autocapture and replay, PostHog is the right shape; the two compose
> — point its sink at an nlqdb insert.)

**Why this advances the north-star:** GLOBAL-025 onboarding/UX — rides "track product usage /
product analytics without a warehouse" search intent surfaced by the
`/solve/track-product-usage-without-a-data-warehouse` page shipped this run, with a
capture-vs-reporting framing that earns a citation without a pitch and concedes the
no-autocapture/no-replay line honestly.

## Collapsed — full drafts in git history

- run 113 — dev.to / r/webdev / r/node: "The webhook receiver is the easy half. The database behind it is the part nobody wants to own." (the receiver is a 20-minute job — accept the POST, verify the signature, return 200; the skipped part is the queryable store behind it, where "how many `checkout.session` events failed yesterday by error code" means standing up Postgres, schema-ing a payload the provider mutates without warning, and hand-writing reporting `GROUP BY`s; patterns — JSONB payload beside extracted columns for idempotency, and separate *capture* from *reporting*; honest split — nlqdb is not the receiver and does no signature verification; anchors `/solve/store-and-query-webhook-events`).

- run 112 — dev.to / r/dataengineering / r/LLMDevs: "Your notebook's AI analyst assumes someone's watching the cell. Your product runs when no one is." (the AI-notebook tools — Fabi.ai's "Smartbooks," Hex, Mode — are genuinely good at interactive exploration where a human watches each cell, accepts the agent's suggestion, and iterates; the loop bakes in a human-in-the-loop assumption that breaks when you wire that same agent or its MCP endpoint onto an unattended product path — a 3am dashboard refresh, an in-app "ask your data" box, an agent answering mid-conversation — where the SQL must be inspectable *before* it runs and a write diff-previewed *before* it applies; the fix isn't distrusting the notebook, it's not conflating two altitudes — interactive analysis vs headless runtime want different guarantees and compose; honest split — nlqdb has no notebook/Python/charts, for interactive exploration Fabi.ai or Hex is right; anchors `/vs/fabi`).
- run 111 — dev.to / r/AI_Agents / r/LLMDevs: "Your agent knows how the user thinks. It still can't tell you how many of them churned." (the agent-memory frontier is *modelling* not recall — Honcho's dialectic theory-of-mind builds a model of *how each user reasons*, the right primitive for "explain or just do for this person"; but a different-shaped question arrives the week after launch — "how many pro-tier users completed onboarding this month, grouped by signup week" is `COUNT`/`GROUP BY`/`JOIN`/threshold, and a user model can't answer *how many of them did X*; the two compose once you stop expecting one store to do both — a user-modelling layer for how someone reasons, a relational layer for how many did what; honest limit — nlqdb has no user model or theory-of-mind, for "how does this person think" Honcho is the right shape; anchors `/vs/honcho`).
- run 110 — dev.to / r/dataengineering / r/BusinessIntelligence: "Your BI tool got acquired. Your data layer shouldn't have to care." (the analyst notebook (Mode → ThoughtSpot, Looker → Google, Periscope → Sisense) is a roll-up target and each acquisition rewrites the AI story on top of it — fine when it's a *destination* humans log into to explore and publish; not fine when you've wired it into your *product*, because your runtime then inherits whatever the next buyer does to that notebook's API/pricing/AI direction; name the split — a destination analytics app and a runtime data layer are different altitudes, the first is where humans look, the second is what your software calls; honest caveat — nlqdb is not a notebook or BI suite, for collaborative analysis/charts/dashboards a Mode or Hex is right and the two compose; anchors `/vs/mode`).
- run 109 — dev.to / r/SaaS / r/ExperiencedDevs: "The text-to-SQL demo takes an afternoon. The other 90% is why you should buy it." (the obvious "ask your data" build — prompt + schema + model + run the SQL — is 10% of the job; production adds a fail-closed verb-allowlist validator, a plan cache keyed on question + schema version, and an eval harness watching a labelled set, all yours to maintain forever for a non-core feature; the honest buy-vs-build test isn't "can I generate SQL from English" but "do I want to own that stack" — if it's a reporting tab / search box / in-app assistant, buy and embed; honest caveat — hosted pipeline you embed, not a vendored library, and many users over their own rows still means a DB or isolation scope per tenant; anchors `/solve/add-ask-your-data-feature-without-building-text-to-sql`).
- run 108 — dev.to / r/analytics / r/BusinessIntelligence: "Half your data-team tickets aren't analysis. They're a SELECT someone's afraid to write." (most of a data team's queue is throwaway `GROUP BY`s that took 30s to write and 3 days to reach; self-service BI moved the bottleneck to the modelling ticket; governed questions stay with the data team, throwaway ones just need to not be a ticket — a plain-English path against the live schema with the SQL shown; honest limit — not a governed semantic layer; anchors `/solve/answer-data-questions-without-the-data-team`).
- run 107 — Show HN / r/LocalLLaMA / dev.to: "Your agent's memory tops LongMemEval. Can it answer 'how many'?" (agent-memory tools are in a real recall arms race — LongMemEval/LoCoMo/ConvoMem all measure "given a question, surface the right past fact," and Supermemory tops all three; but a second question those benchmarks never ask bites later — "how many X this month grouped by Y for users who did Z" is `GROUP BY`/`JOIN`/threshold, and ranking the nearest k embeddings is the wrong primitive for it; the two shapes compose if you stop expecting one tool to do both — a recall layer for "what was said," a relational layer for "how many" over the rows the agent writes; honest limit — nlqdb is not a recall engine, for "most similar past conversation" you still want Supermemory or pgvector; anchors `/vs/supermemory`).
- run 106 — dev.to / r/webdev / r/sideproject: "You don't need a backend to store form submissions. You need a place to ask 'how many'." (a landing-page waitlist form is two problems wearing one coat — *capture* is a tiny write that genuinely doesn't need a server (an insert from the page's own `fetch` behind a key the browser never sees), *reporting* is a read that actually wants a database because "signups per day," "top referrer this week" are aggregations a query planner answers and a CSV pivot doesn't; the mistake is a tool great at the write that leaves you alone with the read; pick storage you can also interrogate; honest limit — the public read widget isn't a write endpoint; anchors `/solve/store-form-submissions-without-backend`).
- run 105 — dev.to / r/LLMDevs / lobste.rs: "COUNT(*) is three different questions. Your few-shot pool probably teaches one." (`COUNT(*)` isn't one shape — scalar count, `GROUP BY` count, and filtered count over a join are three answers sharing a keyword; a masked few-shot pool with a teacher for two of them retrieves the confidently-wrong neighbor for the third, so when retrieval returns the wrong example suspect a missing shape before a smarter ranker; label shapes by the answer they produce, not the operators, and pin each with a held-out probe; `join-aggregate-filter` pool row, ICP retrieval 22/23 → 23/23).
- run 104 — dev.to / lobste.rs / r/SEO: "The '25 words max' rule in your style guide is a lie your CMS can't catch." (content style-guide rules — "bullets ≤25 words" — are soft, so they decay the way unenforced rules do; measured our own `/solve` bullets and found 25 of ~50 over budget with no single bad edit; the fix moves the rule from a code comment into a six-line test that names offenders, because a constraint enforced by attention decays at the rate attention does — if you can write it as "for all X, P(X)," write the predicate, not the guideline).
- run 102 — dev.to / r/LLMDevs / r/AI_Agents: "Every data tool shipped an MCP server this year. Your agent still can't build on most of them." (by 2026 "has an MCP server" is the new "has an API" — universal and uninformative; two MCP shapes look identical in a feature matrix but aren't — one wraps a *destination app* (ask my notebook, answer from my dashboard: read-only over a human's workflow), the other exposes *infrastructure the agent owns* (provision a DB, write rows, migrate schema); the tell is what the agent *owns* after the call returns — a view it can read but not accumulate into is a calculator, not a coworker; ask "what does it let the agent own," not "does it exist").
- run 103 — dev.to / lobste.rs / r/ExperiencedDevs: "Your style rule lives in a code comment. That's why it's already broken." (the SK-CMP-001 `/vs` "≤16 words per bullet" rule lived only as a TS comment and silently drifted to seven over-budget bullets; moved into a six-line test that names offenders — same lesson as run 104, applied to `/vs` instead of `/solve`).
*(runs 99–100 moved to git history under D4 — `git log -p` recovers the bodies.)*

- run 96 — dev.to / lobste.rs / r/ExperiencedDevs: "Your status doc keeps its own history. That's why nobody reads it." (a freshness-capped, daily-read status doc bloated to 3× its cap because each run glued a changelog line onto it; status answers "what's true now" and dies of length, changelog only works by accreting — in one file the accretion instinct always wins; fix is structural, give the capped doc a sibling that remembers and route "what happened" there).
- run 95 — dev.to / lobste.rs / r/MachineLearning: "Your eval harness will report 0% when the problem is your Wi-Fi" (an NL→SQL eval printed `EA=0.00%` from a sandbox that couldn't reach any provider — every attempt failed `network`, scored "no SQL," averaged to a meaningless 0 that would re-seed the baseline; "couldn't measure" and "measured zero" were the same outcome; fix makes non-measurement a loud distinct state — if *every* row failed for an infra reason it's an outage not a result, so refuse to compare/emit and exit non-zero; one-sided, never hides a regression; `isTransportCollapse`, SK-QUAL-020).

- run 94 — dev.to / lobste.rs: "We made share cards for half our buyer's journey and forgot the other half" (two page clusters serve one buyer — comparison `/vs` + solve pages; bespoke OG cards shipped for `/vs` months earlier, solve pages silently fell back to the generic card; each cluster internally consistent so nothing looked broken — the gap lived *between* them; coverage audits keyed on a template miss gaps between parallel clusters — diff instrumentation cluster-against-cluster; P2 solve-page OG cards 0 → 10).

- run 90 — dev.to / r/LangChain / r/LLMDevs: "Your vector store found the chunk. It can't tell you which source you keep retrieving and never use." (RAG retrieval is *recall*; "which source retrieved most / never surfaces / avg relevance" is an aggregation over the retrieval log — a vector store is the wrong shape to `GROUP BY`; log each retrieval as a typed row; anchors `/solve/analyze-rag-retrieval-logs`).
*(runs 75–88 moved to git history under D4 — `git log -p` recovers the bodies.)*

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
