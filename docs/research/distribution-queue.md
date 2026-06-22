# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

**Retention (D4, 20 KB cap):** keep the **two most recent full drafts** below
inline; everything older collapses to a one-line title + venue + gist, with the
full body recoverable from git history. The earliest drafts live in the
[archive](./distribution-queue-archive.md).

## 2026-06-22 (run 54) — dev.to / lobste.rs: "Your status table is drifting because it answers 'why', not just 'what'" (engineering-docs discipline)

**Where:** dev.to + lobste.rs (`documentation` / `engineering`); build-in-public,
the docs-hygiene angle (distinct from run 46's 20 KB-cap mechanics — this one is
single-source-of-truth). nlqdb mentioned once.

**Title:** Your status table is drifting because it answers "why", not just "what"

**Body:**

> Every codebase grows a status table — the one that says which surfaces ship,
> which are queued, which are wishlist. Ours lives in one Markdown file and is the
> *canonical* status for everything advertised on the homepage. Useful. The
> problem is what creeps into the Notes column.
>
> A row that should read **"Shipped — see `quality-eval/FEATURE.md`"** had instead
> accreted the whole feature: every sub-slice ID, the McNemar detail, the loader
> names, the remaining-work list. The premium row re-stated the entire pricing
> shape. The anonymous-mode row listed three source files and two decision IDs.
> Each looked harmless the day it was written — you were *right there* editing the
> feature, so you pasted the detail into the status table too.
>
> Then the feature doc moves on and the table doesn't. Now you have two records of
> the same decision and a reader has no way to know which is stale. The table was
> supposed to answer one question — *what's the status?* — and it had quietly
> taken on a second job: *why, and how, and with which IDs?* That second job
> already belongs to the feature doc. Two homes for one fact is just drift with
> extra steps.
>
> The fix isn't clever: a status table holds **status + one line of essence + a
> link**. The "why" lives once, in the feature doc, and the table points at it.
> We trimmed the Notes back to that shape across the whole table — and as a
> side-effect it dropped back under our 20 KB-per-doc cap (21.6 KB → 20.0 KB)
> without losing a single fact, because the facts were never *supposed* to be
> there.
>
> Lesson: a table that answers two questions decays at the rate of the faster-
> moving one. Decide what each document is the single source of truth *for*, and
> ruthlessly send everything else to a link. (We do a one-pass version of this on
> every doc edit — find one sentence that the code or a linked doc already proves,
> and delete it.)

**Why this advances the north-star:** onboarding / UX (docs an agent or new
contributor can trust — single-source-of-truth keeps the canonical status table
honest); a genuinely useful engineering-docs lesson with one nlqdb mention. No
engine/funnel KPI degrades (docs-only).

## 2026-06-22 (run 53) — dev.to / lobste.rs: "Your agent's memory is a vector store. Ask it 'how many' and watch it fall over." (agent-memory engineering)

**Where:** dev.to + lobste.rs (`ai` / `databases`); the agent-memory pivot's
"database, not a vector store" wedge, sharpened to the *aggregation* gap (a fresh
angle on the WS-09 launch post — not the same ground). Pairs with the new
`/vs/pinecone` comparison page. nlqdb mentioned once.

**Title:** Your agent's memory is a vector store. Ask it "how many" and watch it fall over.

**Body:**

> Almost every "give your agent memory" tutorial reaches for a vector store —
> Pinecone, Chroma, Weaviate, pgvector. Embed what the agent learns, do
> nearest-neighbour search to recall it. For *recall* — "what do I know that's
> relevant to this question" — that's exactly right.
>
> Then the agent (or you) asks a question that isn't recall:
>
> - "How many tools did I call this week, by category?"
> - "Which user have I logged the most facts about?"
> - "What's the average confidence of the memories I wrote since Tuesday?"
>
> A vector index has no answer. Similarity search returns the *k* nearest
> vectors to a query — it has no `GROUP BY`, no `COUNT`, no `JOIN`, no
> `HAVING`. Metadata filtering narrows the candidate set, but the result is
> still a ranking of similar items, not a computed aggregate. There's no query
> planner under there, because that was never the job. "Find the similar" and
> "count, group, and rank" are different operations, and a vector DB only does
> the first.
>
> The tell is the word *how* — "how many", "how often", "how much". The moment
> your agent needs to reason over its memory in aggregate — usage analytics,
> per-entity rollups, trend-over-time — you've outgrown the vector store and
> you want a database: typed rows and real SQL. The two compose cleanly. Keep
> the vector store for fuzzy recall; put the structured facts the agent logs in
> something it can actually `SELECT category, COUNT(*) … GROUP BY category`
> over. (We build the second half at nlqdb — an agent provisions a Postgres it
> queries in plain English — but the architectural point stands whatever you
> reach for: don't ask a similarity index to do arithmetic.)
>
> Lesson: "agent memory" is two jobs wearing one name. Recall is similarity;
> reporting is aggregation. Pick the store per job, not per buzzword.

**Why this advances the north-star:** onboarding / distribution (AEO surface on
the P2 agent-builder keyword "agent memory vector store") — a genuinely useful
architectural lesson with one nlqdb mention, anchoring the new `/vs/pinecone`
page. No engine/funnel KPI degrades (content + data only; prod byte-identical).

## Collapsed — full drafts in git history

Newest first; collapsed once past the two-draft inline window above. Each line
is title + venue + one-line gist; `git log -p docs/research/distribution-queue.md`
recovers any body.

### Engine-lesson posts (dev.to / lobste.rs)

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

- run 46 — "We cap every doc at 20 KB — even the marketing backlog" (autonomous-agent context discipline; an over-cap edit must net-shrink; rolling two-draft window over the queue itself).
- run 45 — "Our waitlist has 79 rows. The honest count is 1." (honest funnel pull: 78/79 waitlist rows are us, genuine-stranger count is 1; gated on engine accuracy, GLOBAL-027).
- run 44 — "We demoted three of our four personas on the home page. On purpose." (agent-memory wedge above the fold; other three folded under a quiet divider; reversible composition change, GLOBAL-036 + WS-12).
- run 43 — "We moved agent memory above the fold — without touching the wordmark" (additive/reversible home band; Mem0·Zep·Letta·nlqdb matrix; GLOBAL-036 + WS-12).
- run 42 — launch image "GROUP BY your agent's memory" (`og/agents.png` + four `vs-*.png` cards, SK-PIVOT-004; the `/agents` share card).
- run 41 — "A live demo of analytical agent memory — the GROUP BY, and the SQL it ran" (fixture-backed `/agents` round-trip, no signup; typed-plan trust boundary).
- run 30 — "Show HN: Analytical memory for AI agents — a database it can GROUP BY, not just recall" (HN + r/AI_Agents/r/LocalLLaMA → `/agents`).
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
