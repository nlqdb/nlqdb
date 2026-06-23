# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

**Retention (D4, 20 KB cap):** keep the **two most recent full drafts** below
inline; everything older collapses to a one-line title + venue + gist, with the
full body recoverable from git history. The earliest drafts live in the
[archive](./distribution-queue-archive.md).

## 2026-06-23 (run 65) — dev.to / lobste.rs: "Two homes for one decision is drift — even inside the same file" (engineering-doc discipline)

**Where:** dev.to + lobste.rs (`architecture` / `engineering`); build-in-public,
the intra-file sibling to run 62 (doc narrating *code*) and run 60 (one doc
narrating *another* doc). This one is the subtlest: a single file paraphrasing
its *own* decision two headings down. nlqdb mentioned once.

**Title:** Two homes for one decision is drift — even inside the same file

**Body:**

> We keep a strict rule that every decision has exactly one canonical home, and
> everything else *links* to it. It's obvious why across files: if two docs both
> describe how retries work, one of them is wrong within a month. What I didn't
> expect was to catch the same bug *inside a single file*.
>
> The doc had a clean decision block — "each pipeline stage wraps its work in a
> 3-attempt retry, feeding the previous attempt's error into the next prompt;
> non-recoverable cases skip the retry." Good: the why, the shape, the escape
> hatch. Then, four screens down, under a section that maps the doc's local
> decisions to the cross-cutting rules they obey, there it was again — a second,
> longer paragraph re-explaining the exact same retry mechanism, stage by stage,
> in slightly different words. Same fact, two homes, one file. The instant
> someone tightens the retry count in the decision block, the paraphrase below
> becomes a confident lie that passes every review because nobody scrolls that
> far.
>
> The tell is paraphrase. A *pointer* — "see the retry decision above for the
> mechanism; here we only note it satisfies the never-surface-a-fixable-error
> rule" — can't drift, because it carries no restated facts, only the one
> sentence that's genuinely local to this section (which rule it maps to). A
> *paraphrase* restates the mechanism, and a restatement is a copy you've
> volunteered to keep in sync by hand. The fix was to cut the second copy down
> to the pointer plus the one local sentence. Net: a few hundred bytes lighter,
> zero facts lost, and one fewer place the file can contradict itself.
>
> Lesson: "single source of truth" isn't only a cross-file discipline. A long
> document is a small filesystem — every heading is a place a fact can hide a
> second copy of itself. When a section needs to *reference* a decision made
> elsewhere in the same doc, link up to it and add only what's local to that
> section. The moment you find yourself re-explaining a mechanism you already
> explained, you're not documenting — you're forking. (We hold this hard because
> our repo is edited by AI agents daily, and an agent that updates the canonical
> block will not hunt down the paraphrase four screens away.)

**Why this advances the north-star:** onboarding / engine quality — a genuinely
useful doc-discipline post (one nlqdb mention) that names a failure mode the
"two homes for one fact" rule exists to prevent, applied at a finer grain than
the usual cross-file framing. No engine/funnel KPI degrades (docs-only).

## 2026-06-23 (run 64) — dev.to / lobste.rs: "Your AI data analyst can't be your app's backend (and vice versa)" (two-jobs split)

**Where:** dev.to + lobste.rs (`ai` / `databases` / `data`); pairs with the new
`/vs/julius` page (the first P3-analyst comparison after the vector-DB cluster
closed). The wedge: "talks to your data in English" is one phrase covering two
products — an analyst's destination app vs. an application's data layer. nlqdb
mentioned once.

**Title:** Your AI data analyst can't be your app's backend (and vice versa)

**Body:**

> There's a whole category of tools now where you upload a spreadsheet, ask a
> question in English, and get back a chart and the Python that made it. They're
> genuinely good at it — drop in a CSV and a non-technical analyst is producing
> presentation-ready dashboards in minutes. The job is *ad-hoc analysis*: a
> human, a dataset, an answer.
>
> It's tempting to assume that same tool can sit behind your product. It can't,
> and the reason isn't quality — it's shape. An analysis app is a destination: a
> human logs in, uploads or connects data, and reads the output. A product
> backend is the opposite — no human in the loop at request time, it owns the
> data your app writes to, and something (your code, or increasingly an AI
> agent) queries it programmatically, on every request, forever.
>
> Those are different contracts. The analysis app's is "give me an answer and a
> chart for this dataset right now." The backend's is "provision and own a
> database, accept writes, evolve the schema, and answer queries via an API or
> an embeddable element — no chat window, no upload step, no human." A chart is
> the deliverable in one; a typed result set you render in your own UI is the
> deliverable in the other. Connecting-to-read and owning-the-write-path are not
> the same job.
>
> Teams that try to collapse the two get stuck halfway: the analysis tool reads
> their warehouse beautifully but can't be the thing their app provisions and
> writes to; the backend speaks SQL over its own database but won't draw the
> chart the analyst wanted. (At nlqdb we picked the backend side on purpose —
> English compiles to SQL over a Postgres the product or agent provisions and
> queries, with writes diff-previewed — which is exactly why we don't generate
> charts or take a CSV upload. Different job.)
>
> Lesson: "talks to your data in English" is one phrase covering two products.
> One is an analyst's destination app; the other is your application's data
> layer. Before you adopt either, decide which contract you're buying — a human
> reading an answer, or your code (or your agent) querying a database it owns.
> Tools that nail one rarely nail the other, and that's fine.

**Why this advances the north-star:** onboarding / distribution (AEO on the
"Julius AI alternative" / "AI data analyst vs. app backend" P3 keyword), anchors
the new `/vs/julius` page with one nlqdb mention. No engine/funnel KPI degrades
(content + one data object only).

## Collapsed — full drafts in git history

Newest first; collapsed once past the two-draft inline window above. Each line
is title + venue + one-line gist; `git log -p docs/research/distribution-queue.md`
recovers any body.

### Engine-lesson posts (dev.to / lobste.rs)

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
