# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

**Retention (D4, 20 KB cap):** keep the **two most recent full drafts** below
inline; everything older collapses to a one-line title + venue + gist, with the
full body recoverable from git history. The earliest drafts live in the
[archive](./distribution-queue-archive.md).

## 2026-06-22 (run 59) — dev.to / lobste.rs: "Hybrid search made your recall smarter. It still can't count." (agent-memory architecture)

**Where:** dev.to + lobste.rs (`ai` / `databases` / `search`); pairs with the new
`/vs/weaviate` page (the enterprise/hybrid-search wing of the "database, not a
vector store" wedge). The third angle in the wedge: run 53 was the *aggregation
gap*, run 56 was *open-source-doesn't-fix-it*, this one is *better recall isn't
reporting*. nlqdb mentioned once.

**Title:** Hybrid search made your recall smarter. It still can't count.

**Body:**

> Hybrid search is the upgrade everyone reaches for when pure vector recall
> gets fuzzy. Fuse BM25 keyword scoring with dense-vector similarity, blend the
> two rankings, and the right passage surfaces even when the embedding alone
> would have missed it. Weaviate, Qdrant, and the rest ship it first-class now,
> and it genuinely helps: keyword precision rescues the exact-match cases,
> vectors rescue the paraphrases. Recall gets measurably smarter.
>
> But notice *what kind* of question hybrid search answers better. It's still
> "what's most relevant to this query?" — just with a better relevance score.
> The output is the same shape: a ranked list of the top-k objects. Make the
> fusion as clever as you like and you never change the operation. It ranks.
>
> Now ask your agent's memory a different kind of question: "how many tools did
> I call per category this week, and only the categories above twenty calls."
> There's no query to rank against — there's a `GROUP BY`, a `COUNT`, and a
> `HAVING`. Hybrid search has no answer because it's not a relevance problem.
> No amount of BM25-plus-vector tuning produces an aggregate; aggregation is a
> different operation that lives in a different kind of engine.
>
> This is the trap in "we upgraded to hybrid search." You made the *recall* leg
> of your agent better, and recall was probably the leg that needed it. But if
> the agent also has to *report* over what it stored — counts, groupings,
> thresholds, joins across what it logged — a smarter ranking buys you exactly
> nothing there. (We build that second leg at nlqdb: the agent provisions a
> Postgres it queries in plain English, so "group and count my memory" compiles
> to SQL. The point holds whatever you reach for: recall and reporting are two
> jobs.)
>
> Lesson: hybrid search optimises *which* items come back, not *what you can
> compute over them*. If your roadmap item is "smarter recall," ship it. If it's
> "the agent needs to count its own history," no ranking function will get you
> there — you need something that speaks SQL.

**Why this advances the north-star:** onboarding / distribution (AEO surface on
the "Weaviate hybrid search agent memory" P2 keyword) — a genuinely useful
architectural lesson with one nlqdb mention, anchoring the new `/vs/weaviate`
page. No engine/funnel KPI degrades (content + data + one OG PNG only).

## 2026-06-22 (run 57) — dev.to / lobste.rs: "Your 'instrumentation plan' is lying to you — the catalog already shipped" (observability-docs discipline)

**Where:** dev.to + lobste.rs (`observability` / `engineering`); build-in-public,
the "stale forward-looking plan" angle (sibling to run 54's single-source-of-truth
post, applied to a telemetry doc). nlqdb mentioned once.

**Title:** Your "instrumentation plan" is lying to you — the catalog already shipped

**Body:**

> Open a mature repo's observability doc and you'll usually find a section called
> something like "instrumentation plan" — a table of slices, each with the spans
> and metrics it *will* add and the CI assertions it *should* have.
> Forward-looking, sensible, written early.
>
> Ours had one too: slices 3–7 — the DB adapter, the LLM router, auth, the query
> pipeline, the billing webhook. Each row listed its new spans and metrics. All
> five shipped months ago.
>
> The trap: right above that table sat the *actual* catalog — every span and
> metric name we emit, kept current as we added analytics, MCP, DNS, and billing
> instrumentation. The "plan" table only ever knew about the original five
> slices. So we had two lists of span names: one live and complete, one frozen on
> the day the plan was written — and a reader had no signal which was which. The
> stale one even looked *more* authoritative, because it had a tidy "CI
> assertion" column.
>
> But those CI-assertion blurbs weren't documentation — they were a paraphrase of
> assertions that already live in the test files. The test is the spec. Re-typing
> it into prose just makes a second copy that drifts.
>
> So we deleted the slice table. What stays is the only part that's load-bearing
> *and* not inferable from anything else — the standing rule: every new slice
> ships its spans/metrics (named from the one catalog), a test that asserts
> they're emitted, and a budget assertion that fails if it's too slow. Three
> sentences. The catalog is the catalog; the tests are the spec; the doc holds
> only the rule that binds them.
>
> Lesson: a "plan" section is a stale list waiting to happen. Once the work
> ships, delete the plan — or it quietly becomes a worse copy of your catalog and
> your test suite. Document the *rule*, not the rollout.

**Why this advances the north-star:** performance / onboarding (the observability
doc's front door lands on the live catalog + the durable rule, not a frozen
rollout list a contributor might trust); a genuinely useful docs-discipline lesson
with one nlqdb mention. No engine/funnel KPI degrades (docs-only).

## Collapsed — full drafts in git history

Newest first; collapsed once past the two-draft inline window above. Each line
is title + venue + one-line gist; `git log -p docs/research/distribution-queue.md`
recovers any body.

### Engine-lesson posts (dev.to / lobste.rs)

- run 55 — "Your text-to-SQL accuracy is measured on schemas your users will never build" (BIRD/Spider run over messy 20–100-table academic schemas, not the small clean ones your users build; we added a third benchmark — hand-authored gold NL→SQL over the ICP shape, same EX scorer, literal-date gold so it never drifts with the clock; anchors persona-bench, SK-QUAL-018).
- run 56 — "'Self-hosted' fixes lock-in, not the query model — your open-source vector store still can't GROUP BY" (self-hosting answers lock-in but not the query model; an OSS vector store still has no GROUP BY/JOIN/COUNT/HAVING; deployment model and data model are independent axes; anchors `/vs/chroma`).
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
