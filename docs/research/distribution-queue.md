# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

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

## 2026-06-15 (run 7) — dev.to / lobste.rs post

**Title:** The obvious workaround was also dead — and we only found out because we measured it first

**Body:**

> Quick follow-up to yesterday's post about finding a provider in our
> text-to-SQL fallback chain that had been locked out (`403 PERMISSION_DENIED`)
> on every call for weeks. That post ended with a tidy plan: the key was denied
> the `gemini-2.5` family, but a quick probe showed `gemini-2.0` answered, so
> the cheap fix was obviously to pin the default model down to `2.0-flash` and
> move on.
>
> It was wrong, and the reason is worth a paragraph.
>
> Before changing a line of code, I ran the *actual* request our provider
> sends — to `gemini-2.0-flash`, the model we were about to pin to. It came
> back `429`. Fine, a rate limit, the chain handles those. Except the body
> wasn't an ordinary rate limit:
>
> ```
> HTTP 429  "Quota exceeded for metric:
>   generativelanguage.googleapis.com/generate_content_free_tier_requests,
>   limit: 0, model: gemini-2.0-flash"
> ```
>
> `limit: 0`. Not "you used up your 200 requests" — the free-tier *allowance
> itself is zero*. The day before, I'd read the same model's `429` as
> "access OK, just throttled" and built a plan on it. Probing the workaround
> directly — not the model we were leaving, the one we were moving *to* —
> showed the whole project is off the free tier on every model: `2.5` returns
> a hard 403, `2.0` returns a soft-looking 429 that's actually a 0-quota wall.
> There was no free model to switch to. The "cheap in-code fix" was a dead end
> dressed up as a 429.
>
> The lesson isn't about Google's quota semantics (though `limit: 0` vs a real
> throttle is a nasty ambiguity — both are `429`, only the body tells you
> which). It's this: **a workaround is a hypothesis, and the cheapest place to
> test it is before you ship it.** Once you've root-caused a problem it's
> tempting to let the *fix* ride on an assumption you never checked as hard as
> the diagnosis. The diagnosis was solid — the provider really is locked out.
> The fix rested on one unverified clause ("but 2.0 works"), and it was false.
>
> Measuring the fix cost one `curl`. Shipping it and discovering `2.0` was
> also dead would have cost a deploy, a confusing benchmark run, and a second
> round of "wait, why didn't that help."
>
> (This was a `/daily` run on nlqdb, a database you query in plain English;
> the chain above is its NL→SQL engine. The day's "win" was a change we
> *didn't* make — and the record correction that stops the next person from
> making it.)

**Why this is publishable:** the relatable twist on the four-post legibility
arc — the satisfying root-cause led to a confident fix that measurement
killed. Lesson (*test the workaround with the rigor you spent on the
diagnosis*) lands for any engineer, not just LLM-chain builders. One nlqdb
mention, in context. Sourced from this run's live re-probe (`limit: 0`) +
SK-LLM-039.

---

## 2026-06-15 (run 6) — dev.to / lobste.rs post

**Title:** A provider in our LLM fallback chain was locked out for weeks — the error label hid it

**Body:**

> This is the fourth post in an accidental series about one benchmark number
> and the failures hiding behind it. Each post the failing questions got a
> little more legible; this one finds a provider that had been contributing
> *nothing* and nobody noticed, because the error code we logged was too
> coarse to say so.
>
> Setup, briefly: our text-to-SQL engine runs a chain of six free LLM
> providers with failover. When a question produces no SQL at all, we now
> tally *why* — the per-provider failure reason for every provider in the
> chain (that was the last two posts). On our Spider benchmark, a big slice
> of the no-SQL questions carried the same tag on one provider:
> `gemini:http_4xx`.
>
> `http_4xx` is "the server said 4-something." We'd already learned not to
> guess (an earlier post falsified an "oversized schema" theory by actually
> measuring the schemas). So this time I just called the API with the exact
> request our provider sends. The answer was immediate and stable across
> every probe:
>
> ```
> HTTP 403  { "error": { "code": 403,
>   "message": "Your project has been denied access. Please contact support.",
>   "status": "PERMISSION_DENIED" } }
> ```
>
> Not a bad request. Not a rate limit. The project is **denied access** to
> the entire model family we'd pinned — a persistent, whole-session lockout
> (it turns out this is a common Google AI Studio state: the API not enabled,
> or no billing account linked, even on the free tier). That provider had
> been 403-ing on *every single call*, for weeks. Failover quietly carried
> every request to the next provider, so nothing broke loudly — we were just
> silently running five providers where the config said six, and the
> benchmark's hard-failure rate paid for it whenever the other five hit their
> limits at the same moment.
>
> Here's the bug that matters for anyone building these chains: **`401`/`403`
> are not the same class of failure as `400`/`404`.** A 400 is "this one
> request was malformed" — retry the next one, it might be fine. A 403
> "denied access" is "this provider is offline for you until a human fixes a
> key" — it will fail identically forever. Lumping both under one `4xx`
> bucket means a dead provider looks exactly like a stream of unlucky
> one-off errors. The number that would have screamed "your key is locked
> out" was averaged into noise.
>
> The fix is a one-token change with outsized payoff: classify `401`/`403`
> as their own reason, `auth_denied`. Now the failure tally reads
> `gemini:auth_denied` — "this provider is locked out, go fix the key" — in
> the place it used to read an ambiguous `http_4xx`. We deliberately *didn't*
> change the failover behavior (a config bug should stay loudly visible on
> every attempt, not get masked as a circuit-breaker "outage"); we only made
> the label honest.
>
> The principle worth stealing: **your error taxonomy should split on what
> you'd do about it, not on the HTTP spec.** "Retry the next request" and
> "page a human to fix a key" are different actions, so they deserve
> different labels — even though the wire protocol gives them adjacent status
> codes. Collapse them and you get a dead dependency that hides in plain
> sight.
>
> (This was a `/daily` run on nlqdb, a database you query in plain English;
> the chain above is its NL→SQL engine. Benchmark deltas are public, and
> apparently so are our embarrassing config bugs.)

**Why this is publishable:** completes the four-post "make the failure
legible" arc with the most relatable lesson yet — *error codes should split
on the action you'd take, not on the RFC* — which lands for anyone running
multi-provider LLM chains, a 2026-common architecture. One nlqdb mention, in
context. Sourced from this run's live probe + SK-LLM-039.

---

## 2026-06-14 (run 5) — dev.to / lobste.rs post

**Title:** Our most reliable fallback model was dying on a 0.6-second blip

**Body:**

> Two days of posts on the same bug, and today it finally pays out.
>
> The setup: our text-to-SQL engine runs a chain of six free LLM providers
> with failover. Most questions get answered by the head of the chain. A few
> hit a wall where every head provider is rate-limited at once, and the
> request falls all the way down to the tail — a sixth provider whose entire
> job is to catch the questions everyone else dropped.
>
> Yesterday's post ended with the buckets: every one of our benchmark's
> hard-failure questions (the ones that produced *no SQL at all*) carried the
> same tail reason — `mistral:network`. So today I went to look at why the
> tail was throwing network errors.
>
> It wasn't. I probed the API directly: HTTP 200, 0.6 seconds, perfectly
> healthy. The `network` errors were **transient** — a single dropped
> connection, the kind that clears if you just ask again.
>
> Here's the bug, and it's a bug about *chain position*, not networking. Our
> failover logic is "try a provider; if it fails, move to the next one." That
> works beautifully for the first five providers — a blip on provider #2 just
> means provider #3 answers. But the tail has no next provider. So a momentary
> blip on the one model whose job is to be the last line of defense
> *permanently* loses the question. The backstop we added specifically to
> recover hard cases was the one provider that couldn't survive a hiccup.
>
> The fix is four lines of intent: **when the last provider in the chain fails
> with a transient reason (a thrown connection or a 5xx), retry it once after
> a short backoff before giving up.** Not every provider — failover already
> covers the others, and retrying all six would blow our latency budget. Only
> the tail, only on transient reasons, only on the path that was about to
> return nothing anyway. Zero added latency for any request that already
> succeeds; it can only convert a dead-end into an answer.
>
> The principle worth stealing: **a failover chain is not the same as a retry
> policy.** Failover handles "this provider is bad, try another." Retry
> handles "this provider is fine, the network hiccupped." They look identical
> until you have a provider with nowhere to fail over to — and then the
> difference is every hard question your last-resort model silently drops.
>
> (nlqdb is a database you query in plain English; the engine is the
> NL→SQL chain described above. Benchmark deltas are public.)

**Why this is publishable:** closes the three-post arc (falsify the assumed
cause → measure the real reason → fix it), and the "failover ≠ retry, and the
chain tail is where that bites" lesson is genuinely useful to anyone building
LLM provider chains — a common 2026 architecture. Mentions nlqdb once, in
context.

---

Older drafts (runs 1–4): [`distribution-queue-archive.md`](./distribution-queue-archive.md).
