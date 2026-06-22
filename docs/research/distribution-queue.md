# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

**Retention (D4, 20 KB cap):** keep the **two most recent full drafts** below
inline; everything older collapses to a one-line title + venue + gist, with the
full body recoverable from git history. The earliest drafts live in the
[archive](./distribution-queue-archive.md).

## 2026-06-22 (run 52) — dev.to / lobste.rs: "Some retrieval misses can't be fixed with lexical tricks — and that's a finding" (text-to-SQL engineering)

**Where:** dev.to + lobste.rs (`databases` / `ai`); fourth in the DAIL-SQL
retrieval / eval-honesty series — the "negative result" angle. nlqdb mentioned
once. Pairs with `SK-LLM-041` + persona-bench (`SK-QUAL-018`).

**Title:** Some few-shot retrieval misses can't be fixed with lexical tricks — and measuring *why* is the win

**Body:**

> We pick few-shot demonstrations by masked question similarity before a small
> model writes SQL (the DAIL-SQL trick). After auditing the pool against our own
> users' queries (the last three posts), two misses were left — and both looked
> like ranker bugs, not pool gaps. The right demo *was* in the pool; the ranker
> just didn't pick it.
>
> Miss: **"which predicates does the agent named 'support-bot' use, and how
> often?"** — a filtered `GROUP BY … COUNT(*)`, no `HAVING`. Top-1 retrieved was
> the `HAVING COUNT(*) > N` demo, which would teach the model a threshold filter
> the query doesn't have. The obvious fix is a smarter selector, so we tried the
> two cheapest: drop stopwords before scoring, and normalise synonyms ("how
> often" / "how many times" → one count marker, "more than" → a threshold
> marker). We measured both the boring way — same queries, before vs after.
>
> Stopwords made it *worse* (own-query precision 18/20 → 17/20): the token sets
> got so sparse the misses just moved around. Normalisation left it flat (18/20).
> Neither touched the held-out 14/14. Then we looked at *why*: the bad demo wins
> on `{which, the, col, val}` — generic filler plus a **coincidental masked value
> slot**. Both questions happen to contain a literal, so after masking they each
> have a `val` token, and that spurious match plus two filler words outweighs the
> one token that actually encodes structure. Flat token-overlap can't tell a
> meaningful match from an accidental one; no amount of word-list tuning fixes
> that. The real fix is a different *kind* of similarity — comparing a draft SQL
> skeleton, which needs a model round-trip, so it's a feature, not a config tweak.
>
> Lesson: when a retrieval miss survives the cheap fixes, *measure the cheap
> fixes anyway* — a negative result that says "this class of change can't work
> here, and here's the mechanism" is worth more than a tweak that moves the number
> by luck. We reverted both experiments and wrote down the ceiling. (Free-tier
> NL→SQL chain; the own-users set is ~20 hand-checked queries.)

**Why this advances the north-star:** engine quality (measurement integrity on
the NL→SQL retrieval lever); a genuinely useful negative-result lesson with one
nlqdb mention. No engine/funnel KPI degrades (offline, prod byte-identical).

## 2026-06-22 (run 51) — dev.to / lobste.rs: "The most common query has no benchmark row" (text-to-SQL engineering)

**Where:** dev.to + lobste.rs (`databases` / `ai`); third in the DAIL-SQL
retrieval / eval-honesty series, the "your benchmark is missing the obvious one"
angle. nlqdb mentioned once. Pairs with `SK-LLM-041` + persona-bench
(`SK-QUAL-018`).

**Title:** The most common query in your product has no row in your benchmark

**Body:**

> We pick few-shot demonstrations by masked question similarity before a small
> model writes SQL (the DAIL-SQL trick). Our example pool had a row for every
> *interesting* shape the research benchmarks stress: anti-joins, HAVING,
> COUNT(DISTINCT), top-N-of-an-aggregate, NULL-safe extrema. Held-out
> precision@1: 13/13. Tidy.
>
> Then we ran retrieval over our own users' questions and the very first one
> missed: **"show the 10 most recent signups."** A plain `ORDER BY signup_date
> DESC LIMIT 10` — no grouping, no aggregate, the single most common thing anyone
> asks a dashboard. It retrieved our `group-order-limit` demo (`GROUP BY … ORDER
> BY COUNT(*) DESC LIMIT 1`), which would teach the model to bolt on a `GROUP BY`
> that doesn't belong. The benchmark error-class taxonomy we'd sized the pool
> from never listed "plain top-N" because it's *too easy to be an error class* —
> so the pool had no row for it, and the nearest neighbour was a more complex
> shape that read similar after masking ("most … limit").
>
> The fix was one pool row — a plain `ORDER BY <col> DESC LIMIT n`, ordered after
> the grouped variant so a genuinely *grouped* top-N ("which plan earns the most
> revenue") still ties to the aggregate demo. Measured the boring way, same
> queries before vs after: our own-query precision@1 held at 18/20 but q0 now
> lands the *correct* skeleton instead of a tolerated stand-in, and held-out went
> 13/13 → 14/14 with the new bucket. (Free-tier NL→SQL chain; the own-users set is
> ~20 hand-checked queries.)
>
> Lesson: error-class taxonomies are built from what *goes wrong* on hard
> benchmarks, so they systematically omit the easy, high-frequency shapes that
> dominate real traffic. Your few-shot pool inherits that blind spot. Audit it
> against your product's actual most-common queries — the boring ones are the
> ones your users send all day.

**Why this advances the north-star:** engine quality (NL→SQL retrieval on the
ICP-relevant distribution); a genuinely useful eval-honesty lesson with one
nlqdb mention. No engine/funnel KPI degrades (offline, prod byte-identical).

## Collapsed — full drafts in git history

Newest first; collapsed once past the two-draft inline window above. Each line
is title + venue + one-line gist; `git log -p docs/research/distribution-queue.md`
recovers any body.

### Engine-lesson posts (dev.to / lobste.rs)

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
