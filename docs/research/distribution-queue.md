# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

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

## 2026-06-15 (runs 8–9) — dev.to / lobste.rs posts (condensed; full drafts in git history)

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
