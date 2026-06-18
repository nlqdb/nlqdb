# Distribution queue — archive (runs 1–7)

Older [`distribution-queue.md`](./distribution-queue.md) drafts, split off to keep the active queue under the 20 KB doc cap (CLAUDE.md D4). Same rule: delete an entry once published (the live URL goes into `docs/scorecard.md`).

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

## 2026-06-14 (run 4) — dev.to / lobste.rs post

**Title:** The error reason was in our logs the whole time — we just never counted it

**Body:**

> Yesterday I wrote about falsifying a root cause we'd never measured (the
> "oversized schema" that turned out to be 1.9 K tokens). The post ended on a
> promise: the *real* reason each failing benchmark question produced no SQL
> was already in a field we log per question — "the next run just buckets
> those error bodies."
>
> Today I went to do the bucketing and found the punchline. We *persist* the
> reason. We never *aggregate* it.
>
> Our text-to-SQL engine runs a free chain of six LLM providers with
> failover. When all six fail on a question, we record the whole story
> verbatim:
>
> ```
> llm.plan: all providers in chain failed
>   (cerebras:rate_limited, gemini:rate_limited, groq:circuit_open,
>    workers-ai:rate_limited, openrouter:rate_limited, mistral:network)
> ```
>
> Perfect forensic detail — for *one* question. With 36 failing questions you
> get 36 of these strings and a strong urge to close the tab. So the
> "diagnosis" had been pattern-matching on the coarse tag (`mistral:network`)
> instead of reading the bodies, which is how we'd ended up chasing a schema
> size that didn't matter.
>
> The fix was about 15 lines: parse the `provider:reason` tags back out of
> each failed row and tally them per chain. No model calls. Run it against
> our committed baseline and the noise collapses into a sentence:
>
> ```
> no_sql reasons: mistral:network×3, groq:circuit_open×3,
>                 cerebras:circuit_open×2, ...
> ```
>
> Every single failed question ends in `mistral:network`. Mistral is the last
> backstop in the chain — and it's the one consistently erroring out. The
> failure was never "the schema is too big" or even "rate limits." It's a
> flaky tail provider, and the aggregate made that legible in one line where
> 36 raw strings made it invisible.
>
> Two things worth keeping:
>
> 1. **"We log it" and "we can see it" are different claims.** Per-event
>    detail you have to read N times to summarize is detail you won't use
>    under any real time pressure. The cheapest observability win is often
>    not more logging — it's *counting* the logs you already have.
> 2. **The aggregate is also a guardrail.** A failure that's purely rate
>    limits should pause and resume, not count as an engine error. Bucketing
>    the reasons is how you tell "the model got it wrong" apart from "the
>    quota ran out" — which is exactly the distinction a quality benchmark
>    has to get right to mean anything.
>
> (This was a `/daily` run on nlqdb, where every change names the number it
> moves. Run 3 promised the bucketing; run 4 shipped it and read the answer
> off the first run.)

---

## 2026-06-13 (run 3) — dev.to / lobste.rs post

**Title:** We blamed a 7 KB schema for an LLM 4xx — then we actually measured it

**Body:**

> Our text-to-SQL engine runs an open benchmark (Spider 2.0-lite, the
> SQLite subset). 36 of 135 questions came back as "no SQL produced" — the
> model never answered. Someone looked at the error tags (`gemini:http_4xx`,
> `mistral:network`), noticed they clustered on "the biggest schemas," and
> wrote the root cause into our progress doc: **oversized DDL — the request
> is too big, the fix is to prune the schema harder.** It sounded right.
> "Biggest schemas → too many tokens → 4xx" is a clean story. The next
> engineering task practically wrote itself: build column-level schema
> pruning.
>
> Before building it, I did the one thing nobody had: I measured the
> schemas. No model calls, no GPUs — just fetch the DDL for all 30
> databases and count characters for each of the 135 questions.
>
> The biggest schema in the entire set is **7,520 characters — about 1,880
> tokens.** p90 is ~1,531. Not one schema is over 12 K characters.
>
> Gemini's context window is **one million** tokens. Mistral's is 128 K. A
> 1.9 K-token schema isn't remotely close to overflowing either. The
> "oversized DDL" root cause was **physically impossible**, and the
> column-pruning project it justified would have moved the number by zero.
>
> Two lessons worth the detour:
>
> 1. **An unmeasured root cause is a hypothesis wearing a lab coat.** "On
>    its biggest schemas" did a lot of quiet work in that sentence — it
>    *felt* like evidence ("biggest" implies "too big") when it was just a
>    correlation nobody had put a number to. The cheapest measurement
>    (count the characters) falsified it outright.
> 2. **The real evidence was already there.** Our eval harness persists the
>    actual provider error string for every failed question. The "diagnosis"
>    skipped reading them and pattern-matched on the tag instead. The next
>    run just buckets those error bodies — the answer to *why* the 4xx
>    happens is sitting in a field we already log.
>
> If you keep an engineering-quality progress doc, audit it for root causes
> that were never measured. They're the ones that send you building the
> wrong fix with total confidence. (This was a `/daily` run on nlqdb, where
> every change has to name the number it moves — which is exactly the rule
> that caught this one.)

---

## 2026-06-13 (run 2) — dev.to / lobste.rs post

**Title:** The NULL timestamp that broke a TTL sweep and a funnel metric at
the same time

**Body:**

> A row in our `databases` registry has a `last_queried_at` column. Two
> unrelated systems read it: a daily sweep that evicts anonymous DBs whose
> `last_queried_at` is older than 90 days, and a funnel metric that counts
> "DBs that have ever returned an answer." Both quietly broke for the same
> reason, and the bug is worth sharing because it's a whole *class* of
> mistake, not a one-off.
>
> We added the column in a migration that backfilled existing rows
> (`UPDATE … SET last_queried_at = updated_at WHERE last_queried_at IS
> NULL`) — textbook. What we forgot: the `INSERT` on the create path never
> set the column. So every row created *after* the migration was `NULL`.
>
> Now watch both readers fail, differently:
>
> - **The sweep silently keeps everything.** `WHERE last_queried_at <
>   :cutoff` looks like it evicts old rows. But in SQL, `NULL < anything`
>   is `NULL`, which is not `TRUE`, so a `NULL` row never matches a
>   `<` predicate. The age-based eviction became a no-op for every new
>   row. No error, no log — the table just grows.
> - **The metric silently reads zero.** "DBs that returned an answer" was
>   `COUNT(*) WHERE last_queried_at IS NOT NULL`. Every new row is `NULL`,
>   so the metric is pinned at 0 regardless of what users actually did. We
>   nearly shipped a "fix" for a conversion problem that didn't exist —
>   the *instrument* was broken, not the funnel.
>
> Three takeaways:
>
> 1. **A backfill is not a default.** If a column needs a value, set it at
>    write time (a `DEFAULT`, or in every `INSERT`). A one-time backfill
>    fixes the past and nothing else.
> 2. **`NULL` is not "old" or "zero" — it's "unknown," and it poisons
>    comparisons.** Any `<`/`>`/`!=` against a nullable column has a third
>    outcome you have to design for. `COALESCE` at the read, or forbid the
>    `NULL`.
> 3. **Before "fixing" a metric that reads 0, prove the instrument can
>    ever read non-zero.** Ours structurally couldn't.
>
> (Context: this was in [nlqdb](https://nlqdb.com), a service that turns
> plain-English HTML components into SQL — the anonymous-DB sweep is how we
> keep the free tier's storage bounded. The fix was two lines: seed the
> column at create, re-run the backfill once.)

*Reviewer notes: pure engineering-story post, one product mention. Sourced
from this run's fix (`neon-provision.ts` + migration `0017`). Good fit for
dev.to (#sql #postgres #debugging) or lobste.rs (`databases`, `practices`).*

## 2026-06-13 — Show HN draft

**Title:** Show HN: nlqdb – HTML components that query a database in plain English

**Body:**

> I'm building nlqdb: you write HTML, each component asks for what it wants in
> plain English, and nlqdb answers — there's no backend to write. A
> `<nlq-data>` element (or the React/Vue/Svelte/etc. wrapper) carries a prompt
> like "the five most recent orders with customer names"; the service plans
> the SQL against your schema, validates it against a read-allowlist, runs it,
> and streams the rows back.
>
> The part I think is technically interesting: it runs on a chain of *free*
> LLMs (Cerebras, Gemini, Groq, Workers AI…), and the bet is that scaffolding
> — schema pruning, plan caching, structured-output fallbacks — compounds with
> the model, so being great on free models makes it invincible on frontier
> ones. Current honest numbers on that bet: BIRD execution accuracy 52.2%,
> Spider 17% (a third of the Spider gap is provider `4xx`/`network` errors,
> not SQL quality — being bucketed).
> You can also bring your own LLM key (any tier, 0% markup) — it rides
> Cloudflare AI Gateway with the key sealed in an AES-256-GCM envelope.
>
> It's pre-alpha behind an invite gate, but the waitlist auto-invites
> instantly (weekly-capped to protect the free-LLM quota), so you can try it
> in under a minute: https://nlqdb.com
>
> Stack: Cloudflare Workers + D1/KV, Neon Postgres, OpenTelemetry throughout.
> BYO Postgres/ClickHouse is landing (the SSRF egress-guard work for that was
> a rabbit hole of IPv4-mapped IPv6 and decimal-encoded IPs). Happy to answer
> anything about the NL→SQL pipeline or the free-LLM routing.

*Reviewer notes: numbers sourced from `apps/api/src/gate/eval-baseline.ts`
(2026-06-12 canonical run). Verify the auto-invite valve is healthy
(scorecard #4) before posting. Best posted weekday morning US-East.*
