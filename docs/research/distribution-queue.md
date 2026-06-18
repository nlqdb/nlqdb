# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

## 2026-06-18 (run 14) — dev.to / lobste.rs post

**Title:** Your LLM benchmark is only reproducible if you freeze the thing under test

**Body:**

> We run a text-to-SQL engine against a fixed benchmark (BIRD, 500 questions)
> to get one number: how often the generated SQL returns the right rows. The
> number is the whole point — it's the gate that decides whether real users
> get let in. So you'd think the discipline would be obvious. It wasn't, and
> the way it broke is worth writing down for anyone running long LLM evals in
> CI.
>
> Two facts about our eval collide. First, it's **slow and quota-bounded**:
> 500 questions through a chain of free-tier LLM providers, paced to stay
> under per-minute limits, takes longer than a single CI job is allowed to
> run. So the runner **checkpoints** — when it hits a rate-limit wall it
> saves what it's scored and exits "resumable," and the next dispatch picks
> up where it left off. A full run is stitched from four or five of these
> windows over a day.
>
> Second — and this is the trap — the checkpoint is **keyed by commit SHA**.
> That's correct: you must never blend scores from two versions of the engine
> into one number, or the benchmark is meaningless. But it has a consequence
> nobody states out loud: **if `main` moves while a resumable run is in
> flight, the next window's SHA no longer matches the checkpoint, the cache
> misses, and the run silently restarts from zero.** You don't get an error.
> You get a run that never finishes, burning quota re-scoring questions it
> already scored, because every day's merge resets the clock.
>
> The fix isn't code, it's protocol: **freeze the artifact under test for the
> duration of the measurement.** Dispatch the eval pinned to a specific SHA,
> and don't merge anything to that branch until the number lands. Our daily
> automation now does engine *changes* on a side branch and only fast-forwards
> `main` once no resumable eval is mid-flight against it. Docs-only changes —
> like the one shipping this post — can't move the SHA the eval reads, so they
> ride freely.
>
> The general principle: a benchmark measures a *fixed* system. The moment
> measurement takes longer than your release cadence, "fixed" stops being
> automatic and becomes something you have to actively defend. Resumable runs
> make the cadence problem invisible until you notice the same 80 questions in
> three consecutive run logs. Pin the SHA. Hold the branch. Then read the
> number.
>
> (A `/daily` run on nlqdb — a database you query in plain English. Today's
> run dispatched the BIRD eval to attribute an accumulated batch of NL→SQL
> engine changes whose real benchmark delta hadn't been measured yet; the
> number is public when the run completes.)

**Why this is publishable:** "long, resumable, quota-bounded LLM evals in CI"
is an increasingly common setup, and "a SHA-keyed checkpoint silently
restarts when main moves under it" is a concrete, non-obvious failure mode
that bites anyone who builds one. The lesson (freeze the artifact under test;
measurement latency turns "fixed system" into a discipline) generalises past
LLMs. One nlqdb mention, in context. Sourced from this run's eval-dispatch +
the SK-QUAL-013 resumable-runner / daily resume protocol.

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

## 2026-06-15 (runs 7–9) — condensed (full drafts in git history)

Three same-day legibility-arc drafts, condensed to reclaim space under the
D4 20 KB cap; `git log -p` on this file restores any full body if the founder
wants to publish one.

- **run 9 — "The dead provider in the fast lane: when a hedged request races a
  403."** A 401/403-denied provider sat 2nd in the chain — exactly the slot the
  latency hedge fires — so every slow planner call raced a healthy lead against
  a guaranteed instant 403. Fix: open the breaker on first `auth_denied` but
  keep the skip legible. Measured: dead-provider round-trips per 5 calls 5 → 1.
  Source: SK-LLM-039.
- **run 8 — "One bad row shouldn't cost you all the rows: salvaging
  LLM-generated seed data."** LLM-authored seed rows insert as one atomic txn,
  so one constraint-violating row rolled back the whole set to empty. Fix: a
  deterministic pre-insert pass drops only provably-uninsertable rows (unknown
  col, NOT NULL gap, uncoercible value, orphan FK). Measured: one-bad-of-four
  seeded rows 0 → 3. Source: SK-HDC-019.
- **run 7 — "The obvious workaround was also dead — and we only found out
  because we measured it first."** The `gemini-2.0` pin-to-fix was falsified by
  a live probe: `429 … limit: 0` (free-tier allowance is zero, not a throttle),
  so no in-code model swap recovers the leg. Lesson: test the workaround with
  the rigor you spent on the diagnosis. Source: SK-LLM-039.

---

Older drafts (runs 1–4): [`distribution-queue-archive.md`](./distribution-queue-archive.md).
