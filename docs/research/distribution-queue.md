# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

**Retention (D4, 20 KB cap):** keep the **two most recent full drafts** below
inline; everything older collapses to a one-line title + venue + gist, with the
full body recoverable from git history. The earliest drafts live in the
[archive](./distribution-queue-archive.md).

## 2026-06-23 (run 67) — dev.to / lobste.rs: "AI made the internal-tool builder faster. It didn't ask whether you needed the tool." (build-vs-skip)

**Where:** dev.to + lobste.rs (`ai` / `databases` / `lowcode`); pairs with the
new `/vs/retool` page (the internal-tools incumbent, P4). The wedge: low-code AI
(AppGen, Ask AI, native agents) scaffolds the admin tool faster — but it's still
a destination tool a human builds and ships, and the faster path is often *no
tool at all*. nlqdb mentioned once.

**Title:** AI made the internal-tool builder faster. It didn't ask whether you needed the tool.

**Body:**

> Every low-code platform now has an AI layer. Describe the app, it scaffolds the
> screens against your schema. Ask in English, it writes the SQL. Point an agent
> at it and it plans, calls tools, and queries your data with guardrails. This is
> real and it's good — the thing that used to take an afternoon of dragging
> components and wiring queries takes a prompt.
>
> But notice what got faster: *building the tool*. The output is still a
> destination — an internal app a human opens, logs into, and reads. AI shortened
> the path from "I need a dashboard" to "I have a dashboard." It didn't question
> the premise that the answer to a data question is a dashboard you build.
>
> A lot of the time it isn't. The data question lives *inside* a product you're
> already shipping — "show this customer their last five orders," "what did this
> account spend this quarter" — and the honest deliverable isn't a separate admin
> app, it's an answer rendered inline, on the page the user is already on. Or the
> asker isn't a human at all: it's an agent that needs to provision a database,
> write to it, and query it programmatically on every request, with no UI in the
> loop ever. Neither of those wants a built tool. They want a backend primitive.
>
> That's the fork. A builder — even an AI-supercharged one — assumes a human will
> assemble and operate the result. A backend primitive assumes nobody will: you
> embed one element or call one API, pass an English goal, and get typed rows
> back. (At nlqdb we took the second side on purpose — English compiles to SQL
> over a Postgres the product or agent *provisions and owns*, writes diff-previewed,
> no app to assemble first — which is exactly why we don't ship a drag-drop
> canvas. Different job.) The builder wins when the deliverable genuinely is a
> standalone tool a team will run; the primitive wins when the answer belongs in
> the product, or the asker is code.
>
> Lesson: when an AI feature makes an old workflow 10× faster, check whether it
> made the *workflow* faster or the *outcome* faster. Scaffolding an internal tool
> faster is a real win — but if what you actually needed was the answer in your
> own app, or a database your agent stands up itself, the fastest builder is still
> building something you didn't need.

**Why this advances the north-star:** onboarding / distribution (AEO on the
"Retool alternative" / "skip building the admin UI" P4 keyword), anchors the new
`/vs/retool` page with one nlqdb mention. No engine/funnel KPI degrades
(content + one data object only).

## 2026-06-23 (run 66) — dev.to / lobste.rs: "Your most over-documented code is your security code — and that's where stale docs lie loudest" (engineering-doc discipline)

**Where:** dev.to + lobste.rs (`security` / `engineering`); build-in-public,
the security-flavoured sibling to run 62 (docs narrating code) — the twist is
*which* code attracts the worst narration, and why it's the most dangerous
place for it. nlqdb mentioned once.

**Title:** Your most over-documented code is your security code — and that's where stale docs lie loudest

**Body:**

> I net-shrank a feature doc this week — the one for the part of our system that
> takes an LLM's output and turns it into a real database: typed-plan
> validation, a DDL compiler, SQL-injection defenses, a rollback primitive. The
> security-critical surface. And that's exactly where the rot was worst.
>
> Every one of those decisions had a clean record — what we decided, why, the
> alternatives we rejected. Good. But each one also carried a "consequence in
> code" section that had ballooned into a guided tour: *this helper is called at
> line 237; tests cover schema-present-row-present, schema-missing,
> row-missing, both-missing; the span is named `db.transaction` with a
> `statement_count` attribute; `safeRollback` was removed.* Four screens of it.
> I think I know why security code attracts this: it feels irresponsible to
> document a SQL-injection guard tersely, so you over-prove it — you narrate
> every callsite to show you were thorough. But a list of today's callsites and
> test names is the fastest-rotting prose in the repo, and on a security feature
> a stale "we validate every interpolation site" reads as a *guarantee* long
> after someone adds the site that doesn't.
>
> The load-bearing part of a security decision isn't the tour of where the check
> runs today. It's the invariant plus the rule that keeps it true: "every
> identifier passes `assertSafeIdentifier` before interpolation; **a new
> interpolation site that skips it fails review.**" That sentence is worth more
> than the whole callsite tour, because it survives refactors — it describes the
> *gate*, not the current floor plan. I cut the line numbers, the test-case
> enumerations, and the span names (those live once, in the observability
> section that owns them) and kept the invariant + the review rule for each of
> the twenty decisions. Net a few percent lighter; not one "why", rejected
> alternative, or enforcement rule lost — because none of those were what I was
> cutting.
>
> Lesson: the more security-critical the code, the *less* its doc should read
> like a changelog of the implementation, and the more it should read like the
> contract a reviewer enforces. "Here's where we check it today" ages into a
> lie. "Here's the check, and here's why a PR that skips it doesn't merge" stays
> true through every refactor. (We hold this as a hard rule because the repo is
> edited by AI agents daily — an agent that adds a new interpolation site will
> trust a doc that says "every site is checked" unless the doc is really a rule
> the review gate enforces, not a snapshot of last month's callsites.)

**Why this advances the north-star:** engine quality / onboarding — a genuinely
useful security-doc-discipline post (one nlqdb mention) that doubles as the
rationale for the "document the enforced invariant, not the implementation
tour" rule keeping our agent-edited security surface coherent. No engine/funnel
KPI degrades (docs-only).

## Collapsed — full drafts in git history

Newest first; collapsed once past the two-draft inline window above. Each line
is title + venue + one-line gist; `git log -p docs/research/distribution-queue.md`
recovers any body.

### Engine-lesson posts (dev.to / lobste.rs)

- run 65 — "Two homes for one decision is drift — even inside the same file" (single-source-of-truth at intra-file grain: a doc paraphrasing its *own* decision two headings down is a copy you've volunteered to hand-sync; replace the paraphrase with a pointer up to the canonical block plus only the sentence local to that section; engineering-doc discipline).
- run 64 — "Your AI data analyst can't be your app's backend (and vice versa)" (the same English-over-data phrase covers two products: an analyst's destination app whose deliverable is a chart, vs. an application's data layer whose deliverable is typed rows it owns and writes to; connecting-to-read and owning-the-write-path are different jobs; anchors `/vs/julius`).
- run 62 — "Your decision record is just narrating code the reader can already read" (a "Consequence in code" section that lists files, functions, and line numbers is a second, worse copy of the code — untestable and already stale; keep only the why / rejected path / non-obvious constraint, cut the implementation narration; load-bearing decisions only).
- run 61 — "Quantization made your recall cheaper. It still can't count." (quantization optimises *how cheaply* you retrieve the nearest items, not *what* you can compute over them; scalar/binary/product compression still yields a ranked list, never a `GROUP BY`/`COUNT`/`HAVING` — recall and reporting are two jobs; anchors `/vs/qdrant`).
- run 60 — "Your architecture doc is describing a pipeline your code deleted" (a superseded decision record gets fixed in its one canonical place, but every other doc that paraphrased it keeps narrating the dead version; link, don't restate, and grep the ID across all docs when something is superseded).
- run 59 — "Hybrid search made your recall smarter. It still can't count." (hybrid search optimises *which* items rank, not what you can compute over them; BM25+vector fusion is still a relevance score, not a `GROUP BY`/`COUNT`/`HAVING` — recall and reporting are two jobs; anchors `/vs/weaviate`).
- run 58 — "Your text-to-SQL eval is failing the wrong schema" (BIRD 0.52 / Spider 0.19 are academic-schema scores; the same free chain scores 0.90 EX on the ICP shape — score against your product's schema, and the two misses it surfaces are the ones users actually hit; persona-bench, SK-QUAL-018).
- run 56 — "'Self-hosted' fixes lock-in, not the query model — your open-source vector store still can't GROUP BY" (self-hosting answers vendor lock-in but not the query model; an OSS vector store still has no GROUP BY/JOIN/COUNT/HAVING — deployment and capability are orthogonal axes; anchors `/vs/chroma`).
- run 55 — "Your text-to-SQL accuracy is measured on schemas your users will never build" (BIRD/Spider run over messy 20–100-table academic schemas, not the small clean ones your users build; we added a third benchmark — hand-authored gold NL→SQL over the ICP shape, same EX scorer, literal-date gold so it never drifts with the clock; anchors persona-bench, SK-QUAL-018).
- run 53 — "Your agent's memory is a vector store. Ask it 'how many' and watch it fall over." (the aggregation gap: similarity search has no GROUP BY/COUNT/JOIN/HAVING; recall is similarity, reporting is aggregation — pick the store per job; anchors `/vs/pinecone`).
- run 52 — "Some few-shot retrieval misses can't be fixed with lexical tricks — and measuring *why* is the win" (two pinned ICP misses (q8/q10) are lexically unfixable; stopword filter regresses 18/20 → 17/20, phrase-normalisation flat (18/20), held-out 14/14; the bad demo wins on generic filler + a coincidental masked-value slot, so flat token-overlap can't resolve it — the real fix is SQL-skeleton similarity, a model round-trip; both experiments reverted).
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
- run 18 — "We were one run away from building the wrong feature" (value-retrieval falsified, 90→0 literal-only; SK-QUAL-014).
- run 17 — "Our text-to-SQL benchmark went flat. That was the signal to stop tuning prompts" (directive levers saturated; McNemar p=0.50).
- run 16 — "Before you prune the schema you send an LLM, measure what the prune would throw away" (SK-QUAL-015).
- run 15 — "We thought our text-to-SQL engine couldn't join. A regex bug was lying to us" (SK-QUAL-014).
- run 14 — "The text-to-SQL mistake that fails two ways — and only one of them throws" (HAVING vs WHERE; SK-LLM-040).
- run 13 — "Schema pruning for text-to-SQL drops the one table the join needs" (inbound junction tables; SK-LLM-037).
- run 11 — "Failover, retry, repair: the three error classes in an LLM text-to-SQL pipeline" (SK-ASK-022).
- run 10 — "'Auto-re-probes so it recovers without a deploy' — a comment that was quietly false" (30-min `auth_denied` cooldown).
- run 9 — "The dead provider in the fast lane: when a hedged request races a 403" (SK-LLM-039).
- run 8 — "One bad row shouldn't cost you all the rows: salvaging LLM-generated seed data" (SK-HDC-019).

### Launch + build-in-public posts (X / Bluesky / HN / dev.to)

- run 57 — "Your 'instrumentation plan' is lying to you — the catalog already shipped" (once the work ships, delete the forward-looking plan table or it quietly becomes a worse copy of your live span/metric catalog + test suite; document the standing rule, not the rollout; observability-docs discipline).
- run 54 — "Your status table is drifting because it answers 'why', not just 'what'" (single-source-of-truth: a status table holds status + one-line essence + a link; the "why" lives once in the feature doc — two homes for one fact is drift with extra steps).
- run 46 — "We cap every doc at 20 KB — even the marketing backlog" (autonomous-agent context discipline; an over-cap edit must net-shrink; rolling two-draft window over the queue itself).
- run 45 — "Our waitlist has 79 rows. The honest count is 1." (honest funnel pull: 78/79 waitlist rows are us, genuine-stranger count is 1; gated on engine accuracy, GLOBAL-027).
- run 44 — "We demoted three of our four personas on the home page. On purpose." (agent-memory wedge above the fold; other three folded under a quiet divider; reversible composition change, GLOBAL-036 + WS-12).
- run 43 — "We moved agent memory above the fold — without touching the wordmark" (additive/reversible home band; Mem0·Zep·Letta·nlqdb matrix; GLOBAL-036 + WS-12).
- run 42 — launch image "GROUP BY your agent's memory" (`og/agents.png` + four `vs-*.png` cards, SK-PIVOT-004; the `/agents` share card).
- run 41 — "A live demo of analytical agent memory — the GROUP BY, and the SQL it ran" (fixture-backed `/agents` round-trip, no signup; typed-plan trust boundary).
- run 30 — "Show HN: Analytical memory for AI agents — a database it can GROUP BY, not just recall" (HN + r/AI_Agents/r/LocalLLaMA → `/agents`).
- run 53 — "Your agent's memory is a vector store. Ask it 'how many' and watch it fall over." (the aggregation gap: similarity search has no `GROUP BY`/`COUNT`/`JOIN`/`HAVING`; recall is similarity, reporting is aggregation — pick the store per job; anchors `/vs/pinecone`).
- run 30 — "Why your AI agent's memory should be a database, not a vector store" (WS-09 centrepiece; opens on the Replit incident, sub-target BIRD/Spider shown, open harness; → `/agents`).
- run 29 — "Your AI agent's memory, as four Postgres tables (no schema design required)" (the `agent_memory_v1` preset is the argument; docs page + dev.to).
- run 28 — agent-memory social/note drafts: "the one bright column" matrix teaser + "'Source-available' isn't a trap if you read the license" (FSL-1.1).
- run 27 — "Mem0 vs Zep vs Letta vs nlqdb — what can your agent actually DO with its memory?" (the capability matrix is the whole post; honest ◐ self-host row).

### Helpful-answer + comparison drafts (Reddit / Show HN)

- run 36 — "run a GROUP BY over your agent's memory in 30s, no signup" (r/AI_Agents / r/LocalLLaMA; one `/agents` link).
- run 32 — "Agent-memory scoping in nlqdb is row-level RLS, not query-rewriting" (dev.to / lobste.rs; SK-PIVOT-009, hold until E-03 lands).
- run 32 — "Give your AI agent memory from the terminal" (`nlq remember`; target must be a memory-preset DB).
- runs 23, 25 — analytics-over-agent-memory threads → `/solve/analytical-queries-over-agent-memory`, `/solve/give-ai-agent-persistent-memory`.
- runs 21–22 — WS-02 "X vs nlqdb" / "X alternative" posts → `/vs/langmem`, `/vs/letta`.

Earliest drafts: [`distribution-queue-archive.md`](./distribution-queue-archive.md).
