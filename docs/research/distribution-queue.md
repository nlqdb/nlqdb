# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

**Retention (D4, 20 KB cap):** keep the **two most recent full drafts** below
inline; everything older collapses to a one-line title + venue + gist, with the
full body recoverable from git history. The earliest drafts live in the
[archive](./distribution-queue-archive.md).

## 2026-06-22 (run 46) — build-in-public: "We cap every doc at 20 KB — even the marketing backlog" (dev.to / lobste.rs)

**Where:** dev.to + lobste.rs (`ai` / `engineering`); a build-in-public note on
running an autonomous daily agent and why its own context discipline is a
product input, not overhead.

**Title:** We cap every doc at 20 KB — even the marketing backlog

**Body:**

> An autonomous agent runs our daily build-in-public loop: measure the funnel,
> pull one lever, draft one post, open one PR. The thing nobody warns you about
> is that the agent's *reading list* is the bottleneck. Every doc it must load to
> decide what to do competes for the same finite context window the actual work
> needs. A 36 KB backlog of old marketing drafts is 36 KB the agent reads before
> it does anything useful — and pays for, every single run.
>
> So we cap every markdown doc in the repo at 20 KB, and the rule has teeth: an
> edit to an over-cap file *must net-shrink it*. This week the cap bit our own
> distribution queue — the list of drafted-but-unpublished posts. The fix wasn't
> to raise the cap, it was to notice the queue had quietly become an archive:
> a dozen full drafts from days ago sitting inline when their bodies already live
> in git history. We keep a rolling window — the two newest drafts full, the rest
> collapsed to a title and a one-line gist, one `git show` away if the founder
> wants the body back.
>
> The discipline generalises. If a doc is too big to keep under 20 KB, that's
> usually a signal it's two docs, or that half of it is history pretending to be
> state. The cap forces the split before the rot sets in — and it keeps the agent
> that reads it next fast, cheap, and focused on the one lever that matters today.
> Lean docs aren't tidiness. For an agent, they're throughput.

**Why this advances the north-star:** onboarding/UX of the autonomous loop — a
leaner agent-facing doc set is faster and cheaper context for every subsequent
`/daily` run; the post itself is a build-in-public credibility artifact. No
engine/funnel KPI degrades (docs-only).

## 2026-06-22 (run 45) — build-in-public: "We measure 'real strangers', and the number is still 0" (X / Bluesky / dev.to)

**Where:** X / Bluesky build-in-public note + dev.to; an honest funnel update —
the discipline of bot-filtering your own metrics before you believe them.

**Title:** Our waitlist has 79 rows. The honest count is 1.

**Body:**

> Today's funnel pull, live from the database: 79 waitlist rows, 119 databases
> created, 113 of them with a recorded first answer (100%), 0 errors across ~1,300
> worker requests. A founder's dashboard would screenshot the 79.
>
> But 78 of those 79 rows are us — our own end-to-end "stranger test" walker
> signs up a throwaway address daily to prove the funnel works, plus a few
> probes. Filter them out and the genuine-stranger count is **1**: me. The users
> table tells the same story — 7 rows, every one founder or test, 0 real strangers.
>
> We keep the bot-filtered number on the scorecard on purpose: the unfiltered
> one would let us lie to ourselves. Walker traffic is load — it proves the
> pipes carry water, not that anyone's thirsty. What gates real adoption isn't
> the landing page, it's the engine: first answers stay behind an invite valve
> until NL→SQL accuracy clears the bar, and that's where every lever goes. When
> the stranger count leaves 1, it'll be because the model got good enough to
> open the valve — and we'll have the honest baseline to prove it moved.

## Collapsed — full drafts in git history

Newest first; collapsed once past the two-draft inline window above. Each line
is title + venue + one-line gist; `git log -p docs/research/distribution-queue.md`
recovers any body.

### Engine-lesson posts (dev.to / lobste.rs)

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
