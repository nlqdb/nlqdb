# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

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
