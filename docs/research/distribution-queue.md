# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

## 2026-06-18 (run 14) — dev.to / lobste.rs post (follow-up to run 13)

**Title:** We shipped a text-to-SQL recall fix. The benchmark moved +2 questions. We're publishing that anyway.

**Body:**

> Last week: a schema-pruning bug. When you trim a DB schema to "the tables the
> question mentions" before asking an LLM for SQL, you can drop the *junction
> table* the join routes through — the one the question never names. The fix:
> also keep any table linking two tables the question did mention.
>
> We promised the benchmark number on the next eval run. Unedited: BIRD-dev (500
> questions, our free open-model chain) went **0.522 → 0.526**. That's **+2
> questions** — McNemar p = 1.0, i.e. noise. So did the fix do nothing?
>
> No, and the gap is the point. The fix is provably *recall-monotonic*: it only
> adds tables, never removes one, so it can't un-write a query that was
> writable. It barely moved BIRD because the bug only bites when a junction's
> FK columns are *generic* (`a`, `b`, `parent_ref`) and match no word in the
> question. BIRD mostly names them after endpoints (`student_id`), which the old
> pruner already caught. The bug is real; this benchmark just under-samples it —
> production schemas with generic link columns don't.
>
> Two takeaways for anyone running an eval loop: (1) **A monotonic, regression-
> free change is a keep even at a noise-level delta** — shipping only headline-
> movers quietly overfits your system to your benchmark. (2) **Publish the +2
> anyway** — the same run showed mismatch flat at 236 and capacity failures 3 →
> 0, which says we no longer lose questions to availability or missing tables;
> we lose them to **SQL reasoning**. The null result *relocated the bottleneck*.
> That's what measurement is for.
>
> (A `/daily` run on nlqdb — a database you query in plain English. Every number
> is from a real, resumable GitHub Actions run on free open models; nothing
> cherry-picked, including the parts that didn't move.)

**Why publishable:** "shipped it, moved the metric by noise, telling you anyway"
is rare, credible engineering content — models honest evaluation, keeps the
run-13 promise publicly, plants the free-open-model positioning without a pitch.
Sequel to the run-13 schema-pruning post.

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

---

## 2026-06-15 (run 9) — dev.to / lobste.rs post

**Title:** The dead provider in the fast lane: when a hedged request races a 403

**Body:**

> Our text-to-SQL engine fronts six free LLM providers with a failover
> chain: try the strongest, fall through on failure, and — for the latency-
> sensitive planning step — *hedge*. Hedging is the trick from Dean &
> Barroso's "The Tail at Scale": if the first provider hasn't answered in
> 800 ms, fire the second one in parallel and take whoever finishes first.
> On free tiers the marginal cost is zero, so racing is pure upside. That's
> the theory.
>
> Here's what we actually shipped. One of the six providers had a dead key —
> a whole-project denial that returns `403 PERMISSION_DENIED` on every single
> call, forever, until a human fixes it in a console we don't control. We'd
> already done the right *observability* thing: a 401/403 gets its own
> failure reason (`auth_denied`) so a locked-out provider is legible in one
> token instead of hiding inside a generic "4xx". And we'd made a deliberate
> decision to keep `auth_denied` *out* of the circuit breaker — the reasoning
> being that a config bug should stay visible on every attempt, not get
> masked as a generic "circuit open" outage. The decision even noted, to
> justify the cost: *"it sits 3rd in the chain, so re-hitting it is near-zero
> when the head providers are healthy."*
>
> Two things were wrong with that sentence, and a 60-second live probe of all
> six providers found both.
>
> **It didn't sit 3rd. It sat 2nd.** And second place is special, because
> second place is exactly who the hedge fires. So on every planning call slow
> enough to trigger the hedge — the precise slow tail the hedge exists to
> cover — we were racing our healthy lead provider against a guaranteed
> instant `403`. The hedge "fired," lost nothing worth losing, and the live
> provider that *should* have been in that slot (3rd in line, actually
> healthy) never got raced. We had built a fast lane and parked a dead car in
> it.
>
> The fix reconciles the two goals the old decision treated as opposed. Open
> the breaker on the first `auth_denied` — so a permanently-dead provider is
> skipped instead of re-dialed on every request — *but* record the skip with
> its real reason (`auth_denied`), not a generic `circuit_open`. You keep the
> legibility (the dead provider is still obvious in the metrics) and you stop
> paying for it (one wasted round-trip per cooldown window instead of one per
> call), and the hedge slot rotates to the provider behind it — the live one.
> The breaker auto-re-probes after a cooldown, so the moment someone fixes the
> key, the provider comes back with no deploy.
>
> Measured the only way you can without the real key: a unit test that fires
> five consecutive denials. Before, the dead provider was dialed five times.
> After, once. The change is inert when a key actually works — a 200 never
> trips the breaker — so it's safe to ship without knowing whether prod's key
> is the same dead one.
>
> The lesson I keep relearning: a decision's *stated cost* is a claim about
> the system, and claims rot. "It sits 3rd, the cost is near-zero" was true
> of some earlier chain order and quietly became false. The cheapest audit in
> the world is to re-read your own load-bearing justifications against what
> the code does today — and, when you can, against a live probe. Ours took
> one `curl` per provider and turned a paragraph of confident reasoning into
> two off-by-one bugs.
>
> (A `/daily` run on nlqdb, where every change names the number it moves.
> This one: round-trips to a dead provider per five calls, 5 → 1.)

## 2026-06-15 (run 8) — dev.to / lobste.rs post

**Title:** One bad row shouldn't cost you all the rows: salvaging LLM-generated seed data

**Body:**

> When you let an LLM design a database from a one-line goal ("a tiny CRM",
> "a meal planner for couples"), it also writes you a handful of sample rows
> so the thing isn't empty when you first open it. Those rows are the entire
> first impression — a populated table you can immediately query, versus a
> bare schema you have to fill yourself.
>
> The rows go in as one atomic transaction. Which means: if *one* of them
> violates a constraint the model itself just declared — a foreign key that
> points at a row defined three lines later, a NOT NULL column left blank, a
> `"twelve"` where an integer goes — the whole insert rolls back. Our
> safety net caught the obvious failure mode (never 500 the user; hand them
> a working empty database instead), but "empty database" was still the
> outcome for the *whole* seed set whenever a single row was bad. We measured
> it: across a set of goals, only about a quarter to three-quarters seeded
> cleanly; the rest fell all the way to empty. One bad row of thirteen cost
> the user the other twelve.
>
> The fix isn't a smarter prompt (we have one of those too, and it's
> probabilistic — it raises the odds, it doesn't guarantee). The fix is a
> deterministic pass that runs *before* the insert and drops only the rows it
> can **prove** won't insert, against the schema's own declared constraints:
>
> - unknown table or column → the INSERT names something that doesn't exist;
> - a NOT NULL column (including primary keys) with no default and no value;
> - a value no Postgres input function for that type would accept
>   (`"twelve"` into `integer`, a non-UUID string into `uuid`) — while
>   *keeping* the coercible forms (`"2"` into integer, `"1.5e3"` into numeric,
>   `"NaN"`, the boolean literals);
> - a foreign-key value with no matching parent row seen earlier in insert
>   order — and dropping a parent cascades to its now-dangling children.
>
> The discipline that makes this safe is **soundness**: it only ever drops a
> row it can prove will fail. A clean batch prunes nothing, so the common
> case is byte-for-byte unchanged; a mixed batch keeps everything that can
> survive. FK matching even compares string-coerced (`"7"` matches `7`), so a
> parent Postgres *would* accept is never mistaken for missing. Twelve rows
> instead of zero, and not one line of LLM-call latency added — it's pure
> in-memory validation.
>
> The general lesson for anyone wiring an LLM into a system with hard
> constraints: the model's output is a batch of independent bets, and
> all-or-nothing failure handling makes the worst bet set the price for all
> of them. Salvage what provably works; degrade only what provably doesn't.
>
> (This was a `/daily` run on nlqdb — a database you query in plain English.
> The seed rows above are what makes an invited stranger's very first query
> land on populated tables.)

**Why this is publishable:** concrete, debuggable, and broadly applicable —
"LLM emits a batch, one item is bad, don't throw away the good ones" is a
pattern anyone building LLM-to-structured-output pipelines hits. Pairs with
the run-6/7 legibility posts as a third "we measured the real cost, then
fixed it deterministically" story. One soft product mention at the end.

---

---

Older drafts (runs 1–7): [`distribution-queue-archive.md`](./distribution-queue-archive.md).
