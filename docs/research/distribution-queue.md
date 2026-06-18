# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

## 2026-06-18 (run 14) — dev.to / lobste.rs post

**Title:** The cheapest text-to-SQL accuracy win is telling the model which columns to join on

**Body:**

> Everyone optimizing LLM text-to-SQL reaches for the big levers: a better
> model, retrieval-augmented few-shot, self-consistency voting. Those work.
> But there's a whole class of *silent* errors that no model size fixes on
> its own, and the cheapest fix is one sentence in the prompt.
>
> The category is **join errors** — the model joins two tables on the wrong
> columns. In the most-cited text-to-SQL error study (arXiv:2501.09310) and
> the 2025/26 schema-linking surveys, this is consistently one of the top
> failure buckets, and it's nasty because *the query runs*. No syntax error,
> no exception. It just joins `orders` to `customers` on a column that
> happens to share a name, or on a non-key column, and silently returns
> mismatched or duplicated rows. Your execution-accuracy score drops and the
> only symptom is "the number is wrong."
>
> Here's the thing: the schema you already hand the model usually *declares
> the right answer*. Every `FOREIGN KEY (customer_id) REFERENCES
> customers(id)` is a labeled join edge sitting in the DDL. The model has it
> in context — it just doesn't always *use* it, preferring whatever columns
> look name-compatible. So you tell it to: "join on the column pair the
> schema declares as a `FOREIGN KEY ... REFERENCES`, not on columns that
> merely share a name or a non-key column."
>
> Two details make this safe rather than a new source of bugs:
>
> 1. **Scope it to declared FKs.** The rule points at a relationship already
>    in the text, so it never invents a join or fires on a single-table query.
> 2. **Have a fallback for schemas without FKs.** Plenty of real schemas (and
>    the entire Spider benchmark's SQLite subset) declare no foreign keys at
>    all. Without a fallback the rule strands the model. So: "when no foreign
>    key is declared between them, join on the corresponding key columns." It
>    degrades to the sensible same-meaning-key join instead of refusing.
>
> The meta-point: before adding retrieval infra or a voting ensemble, audit
> what's *already in your prompt that the model isn't using*. The DDL carries
> the foreign keys; the question carries the grain; the column types carry the
> casts. A directive that points the model at context it already has is the
> highest-leverage, lowest-cost lever there is — ~70 tokens, no new retrieval,
> no extra call. We ship one of these roughly weekly and stack them.
>
> (This was a `/daily` run on nlqdb, a database you query in plain English;
> the directive above feeds its NL→SQL planner. It's unit-measured today; the
> end-to-end BIRD/Spider delta lands on the next eval and is public.)

**Why this is publishable:** join-column errors are a named, widely-cited
text-to-SQL failure mode, and "the fix is already in your DDL — just point the
model at it" is a concrete, reusable insight for anyone building NL→SQL. One
nlqdb mention, in context. Sourced from this run's SK-LLM-040 + the cited error
taxonomy. Pairs naturally with run 13's pruning post (keep the join table →
join it on the right key).

---

## 2026-06-17 (run 13) — dev.to / lobste.rs post

**Title:** Schema pruning for text-to-SQL drops the one table the join needs

**Body:**

> If you feed an LLM a 60-table schema to write one query, most of those
> tables are noise — and noise measurably lowers accuracy on smaller models.
> So you prune: keep the tables the question mentions, drop the rest. We do
> this, and it works (a clean before/after on our Spider benchmark moved a
> smoke run from 0.15 to 0.25 just by cutting distractor tables).
>
> But there's a trap in "keep the tables the question mentions," and it cost
> us silently. Take *"list each student's name and the courses they're
> enrolled in."* The question names **students** and **courses**. A naive
> pruner keeps exactly those two tables — and produces a schema you *cannot
> write the query against*, because the join goes `student → enrollment →
> course` and `enrollment` is gone. The junction table is the one table the
> question never names and the query can't live without.
>
> Our first fix was a foreign-key closure: after keeping a matched table,
> also keep everything it `REFERENCES`. That sounds complete. It isn't —
> it's **directional**. `enrollment` references `student` and `course`; they
> don't reference it back. Closure walks *outbound* from the tables you kept,
> and the bridge is reachable only *inbound*. So it stays dropped.
>
> You might think column-name matching saves you — `enrollment.student_id`
> contains "student," so the table gets matched on its column. Often it does!
> Which is exactly why this bug hides: it only bites when the junction's
> columns are generic (`a`, `b`, `parent_ref`) or named for the relationship
> rather than the endpoints. Then the bridge matches nothing and closure
> can't reach it, and you only notice because some fraction of your join
> queries quietly come back wrong.
>
> The fix is one pass: **also keep any table that references two or more of
> the tables the question matched.** A table linking two things you explicitly
> asked about is the junction you join through — keep it. Seed the rule from
> the *matched* set only, so you pull in genuine bridges and not every table
> that happens to point at a popular dimension. It can only add tables, so it
> can't regress the distractor-removal win; it just closes the recall hole.
>
> The principle worth stealing: **schema relevance is not the set of tables
> the question names — it's that set plus the connectors between them.** Prune
> for the question and you'll drop the plumbing. Prune for the *query you'll
> have to write* and you keep the bridge.
>
> (This was a `/daily` run on nlqdb, a database you query in plain English;
> the pruner above feeds its NL→SQL planner. The recall fix is unit-measured;
> the end-to-end benchmark delta lands on the next eval and is public.)

**Why this is publishable:** schema linking / pruning is a 2026-common
text-to-SQL technique, and "outbound FK closure silently drops junction
tables" is a concrete, non-obvious gotcha that lands for anyone building one.
One nlqdb mention, in context. Sourced from this run's SK-LLM-037 revision +
its unit-measured before/after.

---

## 2026-06-16 (run 11) — dev.to / lobste.rs post

**Title:** Failover, retry, repair: the three error classes in an LLM text-to-SQL pipeline

**Body:**

> A few days ago I wrote that a failover chain is not the same as a retry
> policy. Failover is "this provider is bad, try the next one." Retry is "this
> provider is fine, the network hiccupped." Today I found the third member of
> that family, and it's the one that was quietly costing us the most.
>
> Our text-to-SQL engine turns a plain-English question into SQL, then runs it.
> The run step had exactly one failure mode in its head: the database is
> unreachable. So when a query threw, it did the obvious thing — retried the
> *same SQL* a couple of times, then gave up with "couldn't reach the
> database."
>
> But look at what Postgres actually throws. `42703 column "revenue" does not
> exist`. `42803 column must appear in the GROUP BY clause`. `42883 operator
> does not exist: text = integer`. These are not the database being
> unreachable. The database is right there, and it's telling you *exactly*
> what's wrong with the query. And here's the thing that makes retry useless:
> they're **deterministic**. The same SQL against the same schema fails the
> same way every time. Retrying it three times is three guaranteed failures and
> a slower error message.
>
> The error classes are distinct, and each wants a different response:
>
> - **Connection dropped / 5xx** → *retry*. Same SQL, the transient clears.
> - **Provider down** → *failover*. Different provider, same request.
> - **The SQL is wrong in a fixable way** → *repair*. Same goal, **re-plan
>   with the error fed back.**
>
> That third one is the highest-value move in text-to-SQL, and it was the one
> we weren't making. The fix is almost embarrassing in hindsight: when the
> database returns a re-plannable error, hand the model its own goal plus the
> exact error string ("you wrote `revenue`, here's why that failed") and let it
> re-plan **once**. A wrong column becomes the right column. A missing GROUP BY
> gets added. The model is good at this — it just never saw the error, because
> the run step was busy treating a diagnostic message as a network blip.
>
> Three guardrails kept it honest:
>
> 1. **Bound it to one re-plan.** Execution-guided repair can loop forever if
>    you let it. One shot, then surface the failure.
> 2. **Only on the deterministic error classes.** A connection drop still
>    retries; a missing *table* (vs. a missing column) is a different bug class
>    we route elsewhere. Repair is for "the SQL is malformed but fixable."
> 3. **Reads only.** A repaired query that comes back as a `DELETE` is rejected,
>    never executed — repair must not smuggle a write past the preview gate.
>
> The payoff is asymmetric: zero added latency on every query that already
> works (repair only fires on the failure path), and it converts a class of
> dead-ends into answers. And it compounds with model quality for free — a
> better model reads the error better, so the same scaffolding gets stronger
> the moment you swap the model.
>
> The principle worth stealing: **before you retry, ask whether the thing that
> failed is going to fail the same way again.** If it is, you don't have a
> transient — you have a diagnosis. Feed it back.
>
> (nlqdb is a database you query in plain English; the repair loop above is in
> the NL→SQL engine. Benchmark deltas are public.)

**Why this is publishable:** completes the failover → retry → **repair**
taxonomy from the run-5 post with the highest-value member, and the
"deterministic error = diagnosis, not transient" framing is a genuinely useful
lesson for anyone wiring an LLM to a real backend (DB, API, compiler).
Execution-guided repair is well-known in the text-to-SQL literature, so the
post lands as "here's how we wired it cleanly," not a novelty claim. Mentions
nlqdb once, in context.

---

## 2026-06-16 (run 10) — dev.to / lobste.rs post

**Title:** "Auto-re-probes so it recovers without a deploy" — a comment that was quietly false

**Body:**

> Yesterday I wrote about pulling a permanently-dead LLM provider out of our
> hedged fast lane: a `403 PERMISSION_DENIED` key that we'd left *out* of the
> circuit breaker, so it got re-dialed on every request. The fix was to open
> the breaker on the first `auth_denied` while keeping the skip legible. Good.
> But the fix shipped with a justification, written in the decision record and
> the code comment, that I want to come back to — because it was wrong in a
> way that's easy to miss:
>
> > *"Open the breaker for the standard cooldown … the cooldown auto-re-probes,
> > so a re-keyed provider recovers without a deploy."*
>
> The "standard cooldown" is 60 seconds. The sentence sounds reasonable: park
> the dead provider, but re-check it every minute so that the moment someone
> fixes the key, traffic flows again — no redeploy required. Self-healing.
> Who could argue?
>
> Two facts kill it. **First, a 401/403 is human-gated.** It is not a capacity
> blip that clears on its own in 60 seconds; it clears when a person edits a
> console — billing, an API toggle, an abuse flag. Re-probing every minute is
> re-asking a question whose answer only changes on human time. **Second — and
> this is the one I'd missed — for an env-keyed provider, the re-key *is* a
> deploy.** The key lives in an environment secret. Changing it means a deploy.
> A deploy spins up fresh worker isolates with fresh in-memory breaker state.
> So the "recovers without a deploy" path described a recovery that, for our
> architecture, can never happen: by the time the key is good, the breaker that
> was supposed to re-probe it no longer exists.
>
> Net effect: the 60-second re-probe caught exactly zero recoveries and cost a
> guaranteed-failed round-trip — plus, on hedged calls, the slow-path hedge
> slot the live provider behind it should have had — once a minute, for the
> entire life of every isolate.
>
> The fix is one constant. Park an `auth_denied` provider for **30 minutes**,
> not 60 seconds. Still periodic (a genuinely transient 403 — an abuse flag
> lifted, a gateway hiccup — still self-heals on the next probe), but a
> permanent denial now costs ~2 probes an hour instead of ~60.
>
> Measured the only way you can without the real key: a unit test with a fake
> clock, simulating a 10-minute isolate serving one planning call a minute.
> Before: the dead provider is dialed ~10 times. After: once. Same shape as
> yesterday's 5 → 1, one level up.
>
> The meta-lesson, again: the *cost claim* attached to a decision is the part
> that rots. "Near-zero, it sits 3rd" was false because the chain reordered.
> "Recovers without a deploy" was false because the recovery mechanism and the
> deploy mechanism were the same mechanism. Both read as obviously-true the day
> they were written. The cheapest audit in software is to take one load-bearing
> justification per change and ask: *is this still true of the system I have
> now?*
>
> (A `/daily` run on nlqdb, where every change names the number it moves. This
> one: round-trips to a dead provider over a 10-minute isolate, ~10 → 1.)

<!-- Runs 7–9 (2026-06-15, past their weekly-review window) rolled off here for
the D4 20 KB cap; the queue is a rolling window — published drafts are deleted
and stale unpublished ones roll off the bottom. Recover from git history if a
trimmed draft is still wanted. -->

Older drafts (runs 1–6): [`distribution-queue-archive.md`](./distribution-queue-archive.md).
