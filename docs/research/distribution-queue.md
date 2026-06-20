# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

## 2026-06-19 (run 23) — helpful-answer draft: "vector memory can't aggregate" (r/LangChain / r/AI_Agents)

**Where:** a real recurring thread on r/LangChain / r/AI_Agents where someone
asks "how do I get stats / counts / 'top N' out of my agent's memory?" and the
answers are all "embed it and retrieve top-k." Post once, in context.

**Title (if a fresh post):** Your agent's vector memory can recall a fact. It can't tell you "top 10 this month."

**Body:**

> A pattern I keep hitting: vector/graph memory (Mem0, Zep, LangMem, an
> archival tier in Letta) is great at *retrieval* — "what did the user say
> about pricing?" returns the right fact. But the moment the question is
> **analytical** — "top 10 topics the agent logged this month by count,"
> "average deal size per stage," "how many tasks did it complete per day this
> week" — retrieval falls apart. A vector store returns the top-k *most
> similar* rows; it has no query planner. So your agent ends up doing
> arithmetic over a list of search hits, which is a hallucination generator,
> not a `GROUP BY`.
>
> The fix is boring and correct: keep the unstructured recall where it's good,
> but put the facts the agent will later *count / rank / bucket* in a real
> relational store and let it run actual SQL. That's the half a vector DB
> structurally can't do.
>
> I've been using nlqdb for exactly this (full writeup at
> nlqdb.com/solve/give-ai-agent-persistent-memory): the agent stores typed
> rows via MCP (`nlqdb_query` provisions Postgres from its first English goal),
> then asks "top 5 things I remembered this week by frequency" and gets a real
> aggregation back with the compiled SQL shown. Honest gap: no native vector
> search yet, so for unstructured similarity recall I still reach for
> Mem0/pgvector — the two compose. Retrieval ≠ analytics; you usually want both.

**Why this is publishable:** answers the actual question (analytics over agent
memory), names the architectural reason vector stores can't do it, links the
solve page **once**, and is honest about nlqdb's own gap (no vector search) so
it reads as help, not a plug. Lifts the same retrieval≠analytics wedge the WS-02
`/vs` pages and the sharpened solve page now lead with. Sourced from the
reframed `/solve/give-ai-agent-persistent-memory` page + `docs/competitors.md §4`.

## 2026-06-19 (run 22) — comparison-page draft: nlqdb vs LangMem (r/LangChain / Show HN)

**Title:** LangMem remembers everything for my LangGraph agent. It still can't answer "count per week" about that memory.

**Body:**

> If you've used [LangMem](https://langchain-ai.github.io/langmem/) you know the
> pitch: drop long-term memory into a LangGraph agent and an LLM does the hard
> part for you — it extracts **semantic** (facts), **episodic** (past
> interactions), and **procedural** (behavioral rules) memory, and a background
> manager consolidates and updates it over time. For *learning and recall* it's a
> genuinely clean SDK, and the procedural-memory / prompt-self-tuning angle is
> something most memory tools don't touch.
>
> But it's built to *retrieve*. Once my agent had logged a few hundred entries, I
> wanted to ask questions *about* the memory, not search it:
>
> > "Distinct users who asked about pricing each week this quarter."
> > "Average deal size per stage across everything the agent logged."
>
> LangMem returns the memories most similar to the query — there's no query
> planner under it, so a `COUNT(DISTINCT … ) … GROUP BY week` becomes the LLM
> doing arithmetic over a list of search hits (a hallucination generator, not an
> aggregation). It's also tied to LangGraph's BaseStore, so the memory layer
> rides one agent stack.
>
> The honest split (full side-by-side at nlqdb.com/vs/langmem): LangMem wins on
> automatic semantic/episodic/procedural extraction inside a LangGraph app, and on
> procedural memory the agent uses to refine its own prompts. nlqdb wins when the
> agent needs to **aggregate** its memory — it's a real Postgres the agent
> provisions and queries in English over HTTP or MCP (`nlqdb_query`), framework-
> agnostic, so `GROUP BY / JOIN / HAVING` actually work. They compose: LangMem the
> memory layer, nlqdb the analytical store it reports over.
>
> (Landscape facts verified 2026-06-19; both products' weaknesses are in the
> comparison, not just ours. Note LangMem ships no MCP server of its own — it's an
> in-process Python SDK — so the comparison says exactly that.)

**Why this is publishable:** same decision-moment "LangMem alternative" / "LangMem
vs" keyword play as the Zep + Letta drafts, honest-trade-off format (~13.8% vs
2–5% generic), lifted verbatim by Perplexity/ChatGPT. r/LangChain is the on-target
audience (LangMem is a LangChain SDK). Names LangMem in context, leads with a real
architectural distinction (LLM-managed retrieval + framework-lock vs framework-
agnostic analytical store). Sourced from the shipped `/vs/langmem` page +
`docs/competitors.md §4`. Closes the WS-02 trio (Zep → Letta → LangMem).

## 2026-06-21 (run 21) — comparison-page draft: nlqdb vs Letta (r/AI_Agents / Show HN)

**Title:** Letta runs my stateful agent. It still can't answer "average per group" about its own memory.

**Body:**

> If you've built on [Letta](https://www.letta.com) (the runtime out of the
> Berkeley MemGPT paper, Apache-2.0) you know the model: the agent manages its
> own memory like an OS — **core** blocks it self-edits in the context window,
> **recall** for conversation history, and an **archival** tier it searches for
> long-term facts. As a stateful agent runtime it's excellent, and the
> self-editing memory idea is genuinely clever.
>
> But the memory tiers are built to *retrieve*. Once my agent had logged a few
> hundred rows, I wanted to ask questions *about* the memory, not search it:
>
> > "Average deal size per stage for everything the agent logged this quarter."
> > "Top 10 topics this month, ranked by count."
>
> Letta can recall "Alice has a $50k deal." It can't run a `GROUP BY` over the
> archive — there's no relational query layer under the memory tiers, so the LLM
> ends up doing arithmetic over a list of search hits (a hallucination generator,
> not an aggregation).
>
> The honest split (full side-by-side at nlqdb.com/vs/letta): Letta wins on being
> a real stateful runtime with OS-style self-editing memory and semantic recall.
> nlqdb wins when the agent needs to **aggregate** its memory — it's a real
> Postgres the agent provisions and queries in English, so `GROUP BY / JOIN /
> HAVING` actually work. They compose: Letta the runtime, nlqdb the analytical
> store it queries. Pick the one that matches the question you need answered.
>
> (Landscape facts verified 2026-06-19; both products' weaknesses are in the
> comparison, not just ours.)

**Why this is publishable:** same decision-moment "X alternative" / "Letta vs"
keyword play as the Zep draft, honest-trade-off format (~13.8% vs 2–5% generic),
lifted verbatim by Perplexity/ChatGPT. Names Letta once, in context, leads with
a real architectural distinction (runtime + retrieval vs analytical store).
Sourced from the shipped `/vs/letta` page + `docs/competitors.md §4`. Second of
the WS-02 trio (LangMem to follow).

## 2026-06-20 (run 20) — comparison-page draft: nlqdb vs Zep (r/AI_Agents / Show HN)

**Title:** Zep gives my agent perfect recall. It still can't answer "average per group" about its own memory.

**Body:**

> If you've wired up [Zep](https://www.getzep.com) you know the pitch: it's the
> Context Lake — a temporal knowledge graph (Graphiti, 27k+ ⭐) that stores every
> fact your agent learns as a node with a validity window, resolves entities, and
> hands back the most relevant facts at query time. For *recall* it's genuinely
> good, and it publishes benchmarks (LongMemEval, DMR) to prove it.
>
> But I kept hitting the same wall. Once the agent had logged a few hundred
> things, I wanted to ask questions *about* the memory, not retrieve from it:
>
> > "Top 10 topics I logged this month, ranked by count."
> > "Average deal size per stage for enterprise customers."
>
> A knowledge graph has no query planner. It returns relevant facts and hopes the
> LLM does the arithmetic — which is a hallucination generator, not a `GROUP BY`.
>
> The honest split (I wrote the full side-by-side at nlqdb.com/vs/zep): Zep wins
> on temporal validity, entity resolution, and vector recall over conversation.
> nlqdb wins when the agent needs to **aggregate** its memory — it's a real
> Postgres the agent provisions and queries in English, so `GROUP BY / JOIN /
> HAVING` actually work. They compose: Zep the recall layer, nlqdb the analytical
> store. Pick the one that matches the question you actually need answered.
>
> (Landscape facts verified 2026-06-19; both products' weaknesses are in the
> comparison, not just ours.)

**Why this is publishable:** "X alternative" / "X vs Y" is the decision-moment
keyword and the honest-trade-off format converts ~13.8% (vs 2–5% generic) while
getting lifted verbatim by Perplexity/ChatGPT. Names Zep once, in context, and
leads with a genuine architectural distinction (retrieval vs analytics) that the
r/AI_Agents crowd respects. Sourced from the shipped `/vs/zep` page +
`docs/competitors.md §4`. First of the WS-02 trio (Letta + LangMem to follow).

## 2026-06-19 (run 19) — agent-memory landscape note (seed for the WS-09 blog post)

**Title:** Your agent's memory can recall a fact. Can it answer a question *about* its facts?

**Body:**

> The agent-memory category in 2026 is crowded and converging on one shape.
> **Mem0** stores a fact graph with time-decay. **Zep** (on the Graphiti engine,
> 27k+ ⭐) stores facts as temporal knowledge-graph nodes with validity windows.
> **Letta** (ex-MemGPT, Apache-2.0) keeps self-editing memory blocks in the
> context window plus a searchable archive. **LangMem** (LangChain) extracts
> semantic / episodic / procedural memories into any store. They differ in
> sophistication — flat vectors → knowledge graph → OS-style blocks — but they
> all answer the same question: *given a query, return the most relevant facts.*
>
> That leaves a whole class of question none of them can answer. Once your agent
> has remembered 500 things, ask it:
>
> > "Average deal size per stage, for enterprise customers, for deals that closed
> > this quarter."
>
> That's not retrieval. It's `GROUP BY ... HAVING ... WHERE`. A memory layer
> built on a vector store or a knowledge graph has no query planner — it can hand
> the LLM a pile of relevant facts and hope the model does the arithmetic in its
> head (a hallucination generator, not a database). Adding real SQL semantics to
> a vector store isn't a feature; it's a rewrite of the storage layer.
>
> nlqdb takes the other branch: the memory *is* a real database. The agent
> designs the schema and queries it in plain English, and the queries compile to
> validated SQL — `GROUP BY`, `JOIN`, `HAVING`, subqueries — not fuzzy recall.
> Recall *and* analytics over the same store.
>
> The honest table (capabilities, not logos): every product above does "remember
> this" and "recall facts about X." nlqdb's column is the one that adds "top 5 by
> value," "average per group," and "the agent created its own schema." Pick the
> memory layer for the question you actually need answered.
>
> (A `/daily` note from nlqdb — a database you talk to. Landscape facts checked
> 2026-06-19; full threat analysis in our open competitor doc.)

**Why this is publishable:** the agent-memory cluster (Mem0/Zep/Letta/LangMem) is
a high-search-volume, decision-moment topic for P2 builders, and the
"retrieval vs. analytics" reframe is a category distinction, not a feature
brawl — it spreads in the same r/AI_Agents / LangChain-Discord crowd that hates
marketing and loves a sharp architectural point. Seeds the WS-09 blog post and
the WS-06 capability matrix; one nlqdb mention, in context. Sourced from
`docs/competitors.md §4` (re-anchored this run) + `docs/research/deepseek-moat-framing.md`.

## 2026-06-19 (run 18) — dev.to / lobste.rs post

**Title:** We were one run away from building the wrong feature. A 40-line classifier on our own benchmark output talked us out of it.

**Body:**

> For four days our top-ranked next lever for our text-to-SQL engine was *value
> retrieval*: feed the model a few sample cell-values from each low-cardinality
> column so it stops guessing `'Discount'` when the data says `'discount'`. We
> had the evidence, too — an offline harness showed that **12.8%** of the
> columns gold queries reference are named by their *values*, not their headers,
> and no amount of schema-name pruning can recover those. Additive, zero risk,
> obviously next. We'd even sketched the prod plumbing.
>
> Before building it, we ran one more cheap check — and it killed the feature.
>
> The 12.8% number was measured on *column names*, in the abstract. It never
> asked the only question that matters: **on the questions we actually get
> wrong, would feeding sample values flip any of them to correct?** So we taught
> our mismatch classifier one new trick — diff the string *literals* between the
> model's SQL and the gold SQL — and ran it over all 238 wrong answers from our
> latest 500-question BIRD run.
>
> The headline tag lit up: **90 of 238** wrong answers (38%) use a different
> string literal than the gold query. Value grounding looks like the bottleneck!
> Then the second number: of those 90, exactly **0** are *literal-only* — i.e.
> mismatches where, if you fixed just the literal, the query would match. Every
> single one *also* gets a table, a column, a GROUP BY, or a predicate wrong.
> Feeding the right value into a query that's structurally broken changes
> nothing. (And of the 90, only 6 were even casing slips; ~16 were date-format
> mistakes, which a one-line directive fixes more cheaply than any retrieval.)
>
> So value retrieval, on its own, would have moved our benchmark by ~0 — after a
> multi-file build that also meant piping customers' real cell-values into a
> third-party LLM. We're not doing it. The real remaining loss is *structural
> reasoning* — grain and shape — which points at self-consistency and
> similarity-retrieved examples, not data sampling.
>
> The transferable lesson: **"X% of cases involve Y" is not "fixing Y wins X%."**
> A theoretical ceiling measured on inputs (column names) can be off by the
> entire feature once you measure it on outputs (the actual mistakes). The check
> cost an afternoon and a downloadable benchmark file; the feature would have
> cost a sprint and a privacy review.
>
> (A `/daily` run on nlqdb, a database you query in plain English. The classifier
> and the BIRD harness are open; every number is reproducible from the public
> benchmark on a $0 free-LLM chain.)

**Why this is publishable:** the "ceiling-on-inputs ≠ win-on-outputs" trap is a
mistake almost everyone wiring an LLM eval makes, and the falsification is a
crisp, reproducible story with real numbers (90 → 0). Pairs as a sequel to the
run-17 "flat benchmark" post and *corrects* its closing claim. One nlqdb
mention, in context. Sourced from `tools/eval/src/analyze-mismatches.ts` +
the committed 2026-06-19 baseline.

## 2026-06-19 (run 17) — SUPERSEDED by run 18

"We shipped four fixes, measured at once, the BIRD benchmark didn't move
(0.522 → 0.520) — and proving it flat (McNemar p = 0.50) was the answer." Its
closing "next lever = sample values" was falsified by run 18; publish the run-18
post instead.

## 2026-06-18 (run 16) — dev.to / lobste.rs post

**Title:** Before you prune the schema you send an LLM, measure what the prune would throw away

**Body:**

> A known text-to-SQL trick: don't hand the model your whole schema, hand it
> just the tables the question is about. We already prune *tables* this way,
> and it's recall-safe — the join closure re-admits any table you'd drop.
>
> The obvious next step is pruning *columns* inside a kept table. But columns
> have no join closure to save you: drop one the query needs and the query is
> silently wrong. So before writing a line of it, I measured the ceiling — of
> the columns the *gold* queries reference on BIRD (500 questions), what
> fraction would a "keep columns whose name matches a word in the question"
> rule keep?
>
> **59.8%.** A naive column prune throws away **40% of the columns the correct
> answers need.** That alone kills the naive version. The breakdown is the
> interesting part:
>
> - **27.4% are keys** — `customerId`, `raceId`, `CDSCode`. The question never
>   says "customer id" but the join needs it. Rescuable with the same
>   key-protection rule that saves tables.
> - **12.8% are values named by their *content*, not their column.** "SME
>   customers" → column `Segment`; "paid in CZK" → column `Currency`. No
>   name-matching rule recovers those — "segment" appears nowhere in the
>   question. The only fix is to show the model the actual values.
>
> So the measurement *re-ordered* the roadmap. Column pruning drops to "later,
> with key protection, re-measured on the real schema." And the half that was
> going to be second — feeding sample cell-values into the prompt — is now
> first: it's the only lever that touches that irreducible 12.8%, and it can't
> hurt recall (you're adding context, not removing it).
>
> The harness is ~120 lines, runs offline against the public gold answers, uses
> the same tokenizer the real pruner uses (so the ceiling is honest), and burns
> zero API quota. Measure what you're about to throw away before you throw it
> away.
>
> (A `/daily` run on nlqdb, a database you query in plain English. The harness
> is `bun column-coverage` in the open eval harness; no benchmark number moved.)

## 2026-06-18 (run 15) — dev.to / lobste.rs post

**Title:** We thought our text-to-SQL engine couldn't join. A regex bug was lying to us.

**Body:**

> Our NL→SQL engine gets ~half of a hard benchmark (BIRD) wrong, and the
> failures are *mismatches*: the query runs and returns rows, they're just the
> wrong rows. To pick what to fix next, you have to know *how* they're wrong —
> so I wrote a small diff that buckets each wrong query against the gold answer:
> missing DISTINCT, wrong aggregate, fewer tables joined, and so on.
>
> The histogram was emphatic: **"fewer tables joined" was the #1 class, 105 of
> 236.** Clear story — the model isn't joining to all the tables it needs, a
> schema-linking problem. I almost shipped a week of work against it.
>
> Then I eyeballed the actual rows, and the story fell apart. Take a query that
> joins three tables. My classifier said it joined two. Why? It counted tables
> with `FROM\s+(\w+)` — and the model had written `FROM "transactions_1k"`.
> The quotes. `\w+` doesn't match a leading `"`, so every quoted table name was
> invisible to the counter, and "fewer tables" got credited to dozens of
> queries that joined exactly the right tables.
>
> Fix the parser to handle the four quoting forms (`"x"`, `` `x` ``, `[x]`,
> bare) and **"fewer tables" collapses from 105 to 35.** It wasn't the
> bottleneck at all. The real mass is aggregation/DISTINCT *grain* and subquery
> *shape* — and when you read *those* rows, a lot of them are the model
> guessing the wrong literal: `'discount'` where the data says `'Discount'`,
> a column called `Amount` where it's `Price`, `'2012-01%'` where the date is
> stored `'201201'`. That's not a reasoning failure you fix with a prompt rule.
> It's a *grounding* failure — the model never saw the actual values — and it
> points at a completely different lever (feed sample cell-values into the
> prompt) than the one the buggy histogram pointed at.
>
> Two lessons, both cheap to relearn the hard way:
>
> 1. **A measurement tool is code, and code has bugs that point the same
>    direction every time.** A miscount that only ever *under*-counts tables
>    manufactures a "can't join" signal out of nothing. Verify the instrument
>    on a handful of hand-read cases before you trust its ranking.
> 2. **Histograms rank; they don't explain.** The bucket said "wrong
>    aggregate." Reading the row said "wrong string literal, and the aggregate
>    is fine." The tag was a lead, not a verdict.
>
> (A `/daily` run on nlqdb, a database you query in plain English. The
> classifier is `bun analyze-mismatches` in the open eval harness; this run
> shipped the tool + the corrected breakdown, no benchmark number moved.)

**Why this is publishable:** "your metrics tool has a bug that confirms your
prior" is a universal data/ML lesson, and the concrete regex-vs-quoted-identifier
miss is a satisfying, debuggable story. The grounding-vs-reasoning distinction
is genuinely useful for anyone doing text-to-SQL. One nlqdb mention, in context.
Sourced from this run's SK-QUAL-014 + the corrected histogram.

## 2026-06-18 (run 14) — dev.to / lobste.rs post

**Title:** The text-to-SQL mistake that fails two ways — and only one of them throws

**Body:**

> If you ask an LLM for *"customers who placed more than 5 orders,"* there's a
> specific way the generated SQL goes wrong — and it's worth knowing because
> **half the time it doesn't error.**
>
> The wrong query is:
>
> ```sql
> SELECT customer_id FROM orders
> WHERE COUNT(*) > 5
> GROUP BY customer_id
> ```
>
> `COUNT(*) > 5` is a condition on a *group*, but `WHERE` runs *before* rows
> are grouped — it filters individual rows and can't see an aggregate. Postgres
> and SQLite both reject this outright ("aggregate functions are not allowed in
> WHERE" / "misuse of aggregate function"). If your pipeline retries on errors,
> you pay a round-trip and hope the model fixes it the second time.
>
> That's the *loud* failure. The quiet one is worse: the model drops the
> threshold entirely and returns every customer. The query runs, returns rows,
> and is simply wrong — and unless you check results against a ground truth,
> nothing tells you.
>
> The fix the model needs is the oldest rule in SQL: **a filter on an aggregate
> goes in `HAVING`, after `GROUP BY`; a filter on a row goes in `WHERE`.**
>
> ```sql
> SELECT customer_id FROM orders
> GROUP BY customer_id
> HAVING COUNT(*) > 5
> ```
>
> We ship this to our planner as one tightly-scoped instruction — *group
> thresholds in HAVING, per-row predicates stay in WHERE* — because the
> over-correction (shoving ordinary row filters into HAVING, so the engine
> aggregates rows it could have skipped) is its own bug. It's one bullet in a
> stack of small, named corrections, each targeting a documented text-to-SQL
> error class; this one is the HAVING half of "unaligned aggregation structure"
> from a 2025 BIRD/Spider error study.
>
> The meta-point for anyone prompting an LLM to write SQL: **the dangerous
> errors aren't the ones that throw.** A crash gets retried; wrong rows ship.
> Spend your prompt budget on the silent-mismatch classes first.
>
> (This was a `/daily` run on nlqdb, a database you query in plain English; the
> rule above is one directive in its NL→SQL planner. Prompt-only; the
> end-to-end benchmark delta lands on the next eval and is public.)

**Why this is publishable:** WHERE-vs-HAVING is a near-universal SQL gotcha,
and the framing (*one failure throws, one is silent*) is a real LLM-pipeline
lesson, not a product pitch. One nlqdb mention, in context. Grounded in
arXiv:2501.09310 (E5) + SK-LLM-040.

## 2026-06-17 (run 13) — dev.to / lobste.rs post (condensed; full draft in git history)

- **run 13 — "Schema pruning for text-to-SQL drops the one table the join
  needs."** Pruning a big schema to "the tables the question mentions" silently
  drops the junction table the question never names (`student → enrollment →
  course`). A foreign-key closure doesn't save you — it walks *outbound*, and the
  bridge is reachable only *inbound*. Fix: also keep any table that references two
  or more matched tables. Lesson: schema relevance is the named tables *plus the
  connectors between them*. Sourced from SK-LLM-037 revision + its unit-measured
  before/after.

---

## 2026-06-15/16 (runs 8–11) — dev.to / lobste.rs posts (condensed; full drafts in git history)

- **run 11 — "Failover, retry, repair: the three error classes in an LLM
  text-to-SQL pipeline."** The run step had one failure mode in mind (DB
  unreachable), so it retried the *same* SQL on a deterministic Postgres error
  (`42703 column does not exist`, missing `GROUP BY`, type mismatch) — three
  guaranteed failures, then a dead-end. The third error class wants *repair*:
  feed the DB's own error back to the planner and re-plan **once** (reads only;
  a repaired write is rejected, never run). Zero added happy-path latency;
  converts dead-ends into answers and compounds with model quality for free.
  Lesson: before you retry, ask whether the thing that failed will fail the same
  way again — if so, it's a diagnosis, not a transient.
- **run 10 — "'Auto-re-probes so it recovers without a deploy' — a comment that
  was quietly false."** A dead `auth_denied` provider was parked for the
  standard 60 s breaker cooldown, justified as "self-heals on the next probe."
  False twice over: a 401/403 is human-gated (clears on a console edit, not in
  60 s), and for an env-keyed provider the re-key *is* a deploy — which spins up
  fresh isolates with fresh breaker state, so the re-probe never catches the
  recovery. Fix: park `auth_denied` for 30 min, not 60 s (dead-provider
  round-trips over a 10-min isolate ~10 → 1). Lesson: a decision's stated *cost*
  rots; re-read one load-bearing justification per change against the system you
  have now.
- **run 9 — "The dead provider in the fast lane: when a hedged request races a
  403."** A dead-key provider (`403 PERMISSION_DENIED`) sat 2nd in the chain —
  exactly the slot the latency hedge fires — so every slow planning call raced
  the healthy lead against a guaranteed instant 403. Fix: open the breaker on
  the first `auth_denied` but keep the skip legible; hedge slot rotates to the
  live provider behind it (round-trips 5 → 1). Lesson: a decision's *stated
  cost* is a claim that rots; re-read load-bearing justifications against the
  code (and a live probe) today.
- **run 8 — "One bad row shouldn't cost you all the rows: salvaging
  LLM-generated seed data."** LLM-designed seed rows insert as one atomic txn,
  so one constraint-violating row rolls back the whole batch → empty DB on
  first impression. Fix: a deterministic pre-insert pass that drops *only*
  provably-uninsertable rows (unknown col, NOT NULL gap, uncoercible type,
  orphan FK) against the schema's own constraints; sound, zero added latency
  (0 → 12 of 13 rows kept). Lesson: an LLM batch is independent bets — salvage
  what provably works, degrade only what provably doesn't.

Older drafts (runs 1–7): [`distribution-queue-archive.md`](./distribution-queue-archive.md).
