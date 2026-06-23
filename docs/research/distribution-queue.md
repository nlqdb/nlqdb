# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

**Retention (D4, 20 KB cap):** keep the **two most recent full drafts** below
inline; everything older collapses to a one-line title + venue + gist, with the
full body recoverable from git history. The earliest drafts live in the
[archive](./distribution-queue-archive.md).

## 2026-06-23 (run 69) — dev.to / lobste.rs: "Your sitemap is advertising redirects — and your canonical tag points at one" (AEO/SEO hygiene)

**Where:** dev.to + lobste.rs (`webdev` / `seo` / `astro`); build-in-public,
the static-site / AEO sibling to the engine-eval posts. The hook: a one-line
config default quietly turns every URL you advertise to crawlers into a 307.
nlqdb mentioned once.

**Title:** Your sitemap is advertising redirects — and your canonical tag points at one

**Body:**

> I went to confirm our marketing site was crawl-clean and found something I'd
> walked past a dozen times. Every page served fine: `/agents/` returned 200,
> `/vs/pinecone/` returned 200. But the *bare* paths — `/agents`, `/vs/pinecone`
> — all 307-redirected to the trailing-slash version. That's normal for a
> static host that emits `route/index.html`. The problem was *which* URL we were
> handing to crawlers.
>
> Three places advertise URLs to machines: the `<link rel="canonical">` tag, the
> `og:url` meta, and the XML sitemap. All three of ours emitted the *bare* path.
> So the sitemap listed 27 URLs that every one 307-redirected, and each page's
> canonical tag pointed at a URL that redirected right back to the page
> declaring it — a self-referential redirect. Google follows it, but it treats a
> redirecting canonical as a weak signal and burns crawl budget on the hop;
> AI crawlers fetching your `llms.txt` links eat the same redirect.
>
> The root cause was a single unset config default. Our static-site generator
> defaults `trailingSlash` to "ignore", which leaves `Astro.url.pathname` bare
> even though the build emits directory-style `index.html` files served *with* a
> slash. Setting `trailingSlash: "always"` fixed the dev-server expectation —
> but, thanks to a long-standing quirk, the build-time `pathname` *still* came
> out bare, so the canonical/og tags didn't move. The reliable fix was to
> normalize the path in one place — the layout that renders `<head>` — and the
> sitemap/llms.txt generators the same way: if it doesn't end in `/`, append
> one. Now all three signals point at the 200, zero redirects.
>
> (We hit this on nlqdb's marketing site; the fix was four lines across the
> config, the head layout, and the two URL generators.)
>
> Lesson: "the page loads fine" and "the URL I advertise to crawlers is the
> canonical 200" are different claims. Audit them separately — `curl -sI` every
> URL in your sitemap and watch the status column. Any 3xx is you paying twice
> for one page.

**Why this advances the north-star:** onboarding / distribution (AEO/SEO
hygiene on the marketing surface — every crawler-advertised URL now resolves to
the 200 directly), one nlqdb mention. No engine/funnel KPI degrades
(static-site config + URL-formatting only).

## 2026-06-23 (run 68) — dev.to / lobste.rs: "Your offline LLM eval isn't measuring your model — it's measuring your rate limits" (eval-harness discipline)

**Where:** dev.to + lobste.rs (`ai` / `llm` / `databases`); build-in-public, the
empirical sibling to the "score against your own schema" post (run 58). The wedge:
a small benchmark on a free multi-provider chain reports an *availability* number
wearing an *accuracy* number's clothes. nlqdb mentioned once.

**Title:** Your offline LLM eval isn't measuring your model — it's measuring your rate limits

**Body:**

> We keep a 20-question NL→SQL benchmark over the database shapes our users
> actually build, and we can run it locally against our free LLM chain (a handful
> of providers behind a failover router). Yesterday it scored 17/20. Then I ran it
> again, immediately, with a different decoding setting — and it scored 6/20.
>
> The engine didn't get three times worse in ninety seconds. The *providers* got
> tired. The first run hammered every free tier; the second run hit open circuit
> breakers on nearly every question and recorded them as "no SQL produced." My
> "accuracy" number had quietly become an availability number — and at N=20, one
> exhausted provider is five percentage points.
>
> The tell was in the failure reasons. A real engine miss looks like a wrong
> `JOIN` or a dropped `WHERE` clause — you can read the SQL and see the mistake.
> A starved run looks like `circuit_open`, `rate_limited`, `network`, and a p50
> latency of *zero milliseconds*: the model was never called. Those aren't the
> same event, and averaging them into one percentage hides which one you're
> looking at.
>
> Two fixes, one principle. (1) Throttle between questions so the low-RPM head of
> your chain doesn't cascade every breaker open — pace the run to measure
> reasoning, not capacity. With a 4-second gap the same bench scored 21/23, stable.
> (2) Treat a wall of breaker-opens as a *pause*, not a score: checkpoint, stop,
> resume when the quota resets — never write `0%` for questions no model saw. The
> principle underneath both: a tiny offline run on shared free tiers is a smoke
> test, not a measurement. The number you can defend comes from a larger run, on
> dedicated keys, spread across quota windows — and you keep the two apart on
> purpose. (At nlqdb the offline pass is exactly that smoke check; the powered
> accuracy numbers come from a separate, windowed run that resumes from a
> checkpoint instead of restarting.)
>
> Lesson: before you trust an LLM eval delta, look at the failure reasons and the
> latency. If your misses are circuit-breaker errors and your p50 is zero, you
> measured your rate limits. Pace the run, pause on exhaustion, and never let a
> provider's bad afternoon look like your model's regression.

**Why this advances the north-star:** engine quality / onboarding — a genuinely
useful eval-discipline post (one nlqdb mention) that names the
availability-vs-accuracy trap and the throttle-and-resume fix. No engine/funnel
KPI degrades (the post reports an already-shipped harness behavior).

## Collapsed — full drafts in git history

Newest first; collapsed once past the two-draft inline window above. Each line
is title + venue + one-line gist; `git log -p docs/research/distribution-queue.md`
recovers any body.

### Engine-lesson posts (dev.to / lobste.rs)
- run 67 — "AI made the internal-tool builder faster. It didn't ask whether you needed the tool." (low-code AI — AppGen / Ask AI / agents — scaffolds the admin tool faster, but the output is still a destination a human builds and operates; often the answer belongs inline in the product you already ship, or the asker is an agent that wants a backend primitive, not a built tool — check whether the AI sped up the workflow or the outcome; anchors `/vs/retool`).
- run 66 — "Your most over-documented code is your security code — and that's where stale docs lie loudest" (security code attracts callsite-by-callsite "consequence in code" narration because terse feels irresponsible; but a list of today's callsites + test names is the fastest-rotting prose in the repo, and a stale "every site is checked" reads as a guarantee — document the enforced invariant + review rule, not the implementation tour).
- run 65 — "Two homes for one decision is drift — even inside the same file" (single-source-of-truth isn't only cross-file: a long doc paraphrasing its own decision two headings down is the same drift bug; a pointer can't drift, a paraphrase is a hand-synced copy — link up and add only what's local to the section).
- run 64 — "Your AI data analyst can't be your app's backend (and vice versa)" (an analysis app is a destination — a human uploads/connects data and reads a chart; a product backend owns the write path and is queried programmatically on every request; "talks to your data in English" is one phrase covering two contracts — pick the one you're buying; anchors `/vs/julius`).

- run 62 — "Your decision record is just narrating code the reader can already read" (a "Consequence in code" section that lists files, functions, and line numbers is a second, worse copy of the code — untestable and already stale; keep only the why / rejected path / non-obvious constraint, cut the implementation narration; load-bearing decisions only).
- run 61 — "Quantization made your recall cheaper. It still can't count." (quantization optimises *how cheaply* you retrieve the nearest items, not *what* you can compute over them; scalar/binary/product compression still yields a ranked list, never a `GROUP BY`/`COUNT`/`HAVING` — recall and reporting are two jobs; anchors `/vs/qdrant`).
- run 60 — "Your architecture doc is describing a pipeline your code deleted" (a superseded decision record gets fixed in its one canonical place, but every other doc that paraphrased it keeps narrating the dead version; link, don't restate, and grep the ID across all docs when something is superseded).
- run 59 — "Hybrid search made your recall smarter. It still can't count." (hybrid search optimises *which* items rank, not what you can compute over them; BM25+vector fusion is still a relevance score, not a `GROUP BY`/`COUNT`/`HAVING` — recall and reporting are two jobs; anchors `/vs/weaviate`).
- run 58 — "Your text-to-SQL eval is failing the wrong schema" (BIRD 0.52 / Spider 0.19 are academic-schema scores; the same free chain scores 0.90 EX on the ICP shape — score against your product's schema, and the two misses it surfaces are the ones users actually hit; persona-bench, SK-QUAL-018).
- run 56 — "'Self-hosted' fixes lock-in, not the query model — your open-source vector store still can't GROUP BY" (self-hosting answers vendor lock-in but not the query model; an OSS vector store still has no GROUP BY/JOIN/COUNT/HAVING — deployment and capability are orthogonal axes; anchors `/vs/chroma`).
- run 55 — "Your text-to-SQL accuracy is measured on schemas your users will never build" (BIRD/Spider run over messy 20–100-table academic schemas, not the small clean ones your users build; we added a third benchmark — hand-authored gold NL→SQL over the ICP shape, same EX scorer, literal-date gold so it never drifts with the clock; anchors persona-bench, SK-QUAL-018).
- run 53 — "Your agent's memory is a vector store. Ask it 'how many' and watch it fall over." (the aggregation gap: similarity search has no GROUP BY/COUNT/JOIN/HAVING; recall is similarity, reporting is aggregation — pick the store per job; anchors `/vs/pinecone`).
- run 52 — "Some few-shot retrieval misses can't be fixed with lexical tricks — and measuring *why* is the win" (two pinned ICP misses (q8/q10) are lexically unfixable; stopword filter regresses 18/20 → 17/20, phrase-normalisation flat (18/20), held-out 14/14; the bad demo wins on generic filler + a coincidental masked-value slot, so flat token-overlap can't resolve it — the real fix is SQL-skeleton similarity, a model round-trip; both experiments reverted).
- run 51 — "The most common query in your product has no row in your benchmark" (error-class taxonomies omit easy high-frequency shapes; "show the 10 most recent signups" retrieved a `GROUP BY` demo; +plain `ORDER BY … LIMIT` row, held-out 13/13 → 14/14, own-query 18/20 held).
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

- run 57 — "Your 'instrumentation plan' is lying to you — the catalog already shipped" (once the work ships, delete the forward-looking plan table or it quietly becomes a worse copy of your live span/metric catalog + test suite; document the standing rule, not the rollout; observability-docs discipline).
- run 54 — "Your status table is drifting because it answers 'why', not just 'what'" (single-source-of-truth: a status table holds status + one-line essence + a link; the "why" lives once in the feature doc — two homes for one fact is drift with extra steps).
- run 46 — "We cap every doc at 20 KB — even the marketing backlog" (autonomous-agent context discipline; an over-cap edit must net-shrink; rolling two-draft window over the queue itself).
- run 45 — "Our waitlist has 79 rows. The honest count is 1." (honest funnel pull: 78/79 waitlist rows are us, genuine-stranger count is 1; gated on engine accuracy, GLOBAL-027).
- run 44 — "We demoted three of our four personas on the home page. On purpose." (agent-memory wedge above the fold; other three folded under a quiet divider; reversible composition change, GLOBAL-036 + WS-12).
- run 43 — "We moved agent memory above the fold — without touching the wordmark" (additive/reversible home band; Mem0·Zep·Letta·nlqdb matrix; GLOBAL-036 + WS-12).
- run 42 — launch image "GROUP BY your agent's memory" (`og/agents.png` + four `vs-*.png` cards, SK-PIVOT-004; the `/agents` share card).
- run 41 — "A live demo of analytical agent memory — the GROUP BY, and the SQL it ran" (fixture-backed `/agents` round-trip, no signup; typed-plan trust boundary).
- run 30 — "Show HN: Analytical memory for AI agents — a database it can GROUP BY, not just recall" (HN + r/AI_Agents/r/LocalLLaMA → `/agents`).
- run 53 — "Your agent's memory is a vector store. Ask it 'how many' and watch it fall over." (the aggregation gap: similarity search has no `GROUP BY`/`COUNT`/`JOIN`/`HAVING`; recall is similarity, reporting is aggregation — pick the store per job; anchors `/vs/pinecone`).
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
