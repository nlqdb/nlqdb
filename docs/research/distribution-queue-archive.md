# Distribution queue — archive

Older [`distribution-queue.md`](./distribution-queue.md) drafts, split off to keep the active queue under the 20 KB doc cap (CLAUDE.md D4). Same rule: delete an entry once published (the live URL goes into `docs/scorecard.md`).

## Published from this archive (canonical `/blog` copies live 2026-07-01)

Venue variants pending — post each as a pointer to the canonical URL (tracked in
[`distribution-queue.md`](./distribution-queue.md) § Published):

- run 20 (2026-06-20, nlqdb vs Zep) → https://nlqdb.com/blog/zep-recall-vs-analytical-agent-memory/
- run 2 (2026-06-13, NULL timestamp / TTL sweep) → https://nlqdb.com/blog/null-timestamp-ttl-sweep-funnel-metric/
- run 53 (nlqdb vs Pinecone, vector-store aggregation gap) → https://nlqdb.com/blog/agent-memory-vector-store-aggregation-gap/

## 2026-06-13/15 (runs 3–7) — engine-lesson dev.to / lobste.rs posts (titles only; full drafts in git history)

The Gemini-lockout / failover-legibility arc — falsify the assumed cause, make the failure legible, then fix it:

- run 7 — "The obvious workaround was also dead — and we only found out because we measured it first" (`gemini-2.0` was 0-quota `429`, not a fallback; test the fix with the rigour of the diagnosis).
- run 6 — "A provider in our LLM fallback chain was locked out for weeks — the error label hid it" (`403 PERMISSION_DENIED` bucketed under `http_4xx`; split error taxonomy on the action you'd take; SK-LLM-039).
- run 5 — "Our most reliable fallback model was dying on a 0.6-second blip" (transient `mistral:network` at the chain tail; failover ≠ retry).
- run 4 — "The error reason was in our logs the whole time — we just never counted it" (we persist per-provider reasons but never aggregated them; counting beats more logging).
- run 3 — "We blamed a 7 KB schema for an LLM 4xx — then we actually measured it" (max schema ~1.9 K tokens vs 1 M context; an unmeasured root cause is a hypothesis in a lab coat).

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
> It's early but open — you can try it in under a minute: https://nlqdb.com
>
> Stack: Cloudflare Workers + D1/KV, Neon Postgres, OpenTelemetry throughout.
> BYO Postgres/ClickHouse is landing (the SSRF egress-guard work for that was
> a rabbit hole of IPv4-mapped IPv6 and decimal-encoded IPs). Happy to answer
> anything about the NL→SQL pipeline or the free-LLM routing.

*Reviewer notes: numbers sourced from `tools/eval/baseline-2026-06-15.json`
(2026-06-12 canonical run). Best posted weekday morning US-East.*

## One-line gists (runs 51–52, 56–66) — bodies in git history

Moved from the queue's collapsed list to hold that doc under the 20 KB cap (D4).

- run 66 — "Your most over-documented code is your security code — and that's where stale docs lie loudest" (a callsite list + test names is the fastest-rotting prose; document the enforced invariant + review rule, not the tour).
- run 65 — "Two homes for one decision is drift — even inside the same file" (a long doc paraphrasing its own decision two headings down is the same drift bug; link up, add only what's local).
- run 64 — "Your AI data analyst can't be your app's backend (and vice versa)" (analysis app = a human reads a chart; product backend = queried programmatically on every request; anchors `/vs/julius`).
- run 62 — "Your decision record is just narrating code the reader can already read" (a "Consequence in code" file/line list is a second, worse copy of the code; keep the why / rejected path / non-obvious constraint).
- run 61 — "Quantization made your recall cheaper. It still can't count." (compression optimises how cheaply you retrieve the nearest items, not what you compute over them; recall ≠ reporting; anchors `/vs/qdrant`).
- run 60 — "Your architecture doc is describing a pipeline your code deleted" (fix a superseded decision in its canonical place, then grep the ID across all docs; link, don't restate).
- run 59 — "Hybrid search made your recall smarter. It still can't count." (hybrid search optimises *which* items rank, not what you can compute over them; BM25+vector fusion is still a relevance score, not a `GROUP BY`/`COUNT`/`HAVING` — recall and reporting are two jobs; anchors `/vs/weaviate`).
- run 58 — "Your text-to-SQL eval is failing the wrong schema" (BIRD 0.52 / Spider 0.19 are academic-schema scores; the same free chain scores 0.90 EX on the ICP shape — score against your product's schema, and the two misses it surfaces are the ones users actually hit; persona-bench, SK-QUAL-018).
- run 56 — "'Self-hosted' fixes lock-in, not the query model — your open-source vector store still can't GROUP BY" (self-hosting answers vendor lock-in but not the query model; an OSS vector store still has no GROUP BY/JOIN/COUNT/HAVING — deployment and capability are orthogonal axes; anchors `/vs/chroma`).
- run 52 — "Some few-shot retrieval misses can't be fixed with lexical *selector* tricks — and measuring *why* is the win" (stopword filter regressed 18/20 → 17/20, phrase-normalisation flat, held-out 14/14; later narrowed by runs 74/76 to selector-*code* tweaks — pool-exemplar phrasing was the live lever; both selector experiments reverted).
- run 51 — "The most common query in your product has no row in your benchmark" (error-class taxonomies omit easy high-frequency shapes; "show the 10 most recent signups" retrieved a `GROUP BY` demo; +plain `ORDER BY … LIMIT` row, held-out 13/13 → 14/14, own-query 18/20 held).

## One-line engine-lesson gists (runs 8–18, 33, 37, 39, 41, 46, 48) — bodies in git history

Moved from [`distribution-queue.md`](./distribution-queue.md)'s collapsed list to hold that doc under the 20 KB cap (CLAUDE.md D4). `git log -p docs/research/distribution-queue.md` recovers any body.

- run 48 — "Test your few-shot retrieval against your *own* users' queries — not just the benchmark" (a held-out probe set that paraphrases your own examples reports green while real-user queries silently retrieve the wrong shape; own-query precision 17/20 → 18/20).
- run 46 — "Your few-shot examples might be teaching the model the wrong shape" (retrieval quality is bounded by pool *coverage*, not the ranker; a one-word negation retrieves its own opposite if the pool can't represent the shape).
- run 41 — "Cross-schema few-shot retrieval: mask each example against *its own* schema" (`selectExemplarsForSchema`, per-row masking; `packages/llm/few-shot-select.ts`; runs 37–42 value/identifier-masking + self-consistency stubs consolidated here).
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

## Helpful-answer + comparison drafts (runs 21–36) — bodies in git history

Moved from [`distribution-queue.md`](./distribution-queue.md)'s collapsed list to hold that doc under the 20 KB cap (CLAUDE.md D4). `git log -p docs/research/distribution-queue.md` recovers any body.

- run 36 — "run a GROUP BY over your agent's memory in 30s, no signup" (r/AI_Agents / r/LocalLLaMA; one `/agents` link).
- run 32 — "Agent-memory scoping in nlqdb is row-level RLS, not query-rewriting" (dev.to / lobste.rs; SK-PIVOT-009, hold until E-03 lands).
- run 32 — "Give your AI agent memory from the terminal" (`nlq remember`; target must be a memory-preset DB).
- runs 23, 25 — analytics-over-agent-memory threads → `/solve/analytical-queries-over-agent-memory`, `/solve/give-ai-agent-persistent-memory`.
- runs 21–22 — WS-02 "X vs nlqdb" / "X alternative" posts → `/vs/langmem`, `/vs/letta`.
- runs 43–44 — "Your benchmark should look like your users' database, not a research paper's" (persona-bench: NL→SQL on the schema shapes users actually build; sound-ruler invariant 12/12 before any accuracy number).
- run 43 — "Ship your LLM lever as a default-off ablation — measure before you adopt" (`buildPlanSystem(goal, schema, k)`, `k=0` byte-identical; prove inert + token-negative before spending quota; closes runs 38–43 retrieval arc).
- run 42 — "Don't hand-pick few-shot examples — size the pool from your benchmark's error classes" (one exemplar per mismatch class; precision@1 10/10, 3.5× closer skeleton; `packages/llm/plan-exemplar-pool.ts`).
- run 101 — dev.to / lobste.rs / r/ExperiencedDevs: "We shipped the feature. Nine pages still told users we hadn't." (a "not yet / roadmap" line is a dated assertion with nothing watching it, so the day a feature ships the most honest sentence on the site becomes the most dishonest; store capability claims in typed data and grep every "roadmap / not shipped" string for the feature name as part of the shipping change).
- run 93 — dev.to / r/LLMDevs / r/AI_Agents: "Your agents each have their own memory. That's why they keep redoing each other's work." (a crew breaks memory a new way — one agent's facts are invisible to another; "shared vector store" fixes recall only, but "what did each agent decide / tasks each closed / latest fact" is `GROUP BY`/`COUNT`/most-recent; one shared store where each row carries `agent_id` lets any agent read another's and roll the crew up per agent; honest limits — no per-agent access control, no vector recall; anchors `/solve/share-memory-across-multiple-ai-agents`).
- run 92 — dev.to / r/LLMDevs / r/AI_Agents: "Your 'read-only' AI agent is one SQL comment away from a write." (a read-only role + connection string leaks via a write in a SQL comment, a `DROP` in a CTE, a `JOIN` onto `oauth_tokens`, a pool-draining query; root cause is the agent holding credentials *and* authoring SQL — take authorship away: server-built parameterised writes + fail-closed read validator + engine RLS, not a regex; anchors `/solve/safely-give-ai-agent-database-access`).
- run 91 — dev.to / r/LLMDevs / r/LangChain: "Your eval results live in a spreadsheet. The question 'which version regressed' lives in SQL." (an eval run is scored cases, but "pass rate per version, which regressed, trend per model" are aggregations across every run — a pivot rots, asking the LLM to tally hallucinates; scoring and tracking are different machines — log each case as a typed row; anchors `/solve/track-llm-eval-scores-across-prompt-versions`).
- run 98 — dev.to / lobste.rs / r/webdev: "Your AI crawlers read llms.txt. Your sitemap forgot a page. They disagreed." (a site has three machine-readable indexes of itself — `robots.txt`/`sitemap.xml`/`llms.txt` — maintained by three reflexes that drift because nothing forces them to agree; a real indexable page in `llms.txt` + allowed in `robots.txt` was never in the hand-rolled `sitemap.xml`; fix re-derives the real top-level-page set and asserts every one is in the sitemap so the next forgotten page fails CI not search).
- run 97 — dev.to / r/LLMDevs / r/AI_Agents: "Your multi-tenant agent memory is one forgotten WHERE clause from a leak." (one DB holds a thousand customers' agent memory; the only thing between tenant A's rows and tenant B's answer is a `WHERE tenant_id = ?` the LLM must remember every query forever; fix moves isolation below the SQL into Postgres RLS keyed on `current_setting('app.tenant_id')` so a query with no filter sees nothing; anchors `/solve/isolate-ai-agent-memory-per-tenant`).
- run 42 — launch image "GROUP BY your agent's memory" (`og/agents.png` + four `vs-*.png` cards, SK-PIVOT-004; the `/agents` share card).
- run 41 — "A live demo of analytical agent memory — the GROUP BY, and the SQL it ran" (fixture-backed `/agents` round-trip, no signup; typed-plan trust boundary).
- run 108 — dev.to / r/analytics / r/BusinessIntelligence: "Half your data-team tickets aren't analysis. They're a SELECT someone's afraid to write." (most of a data team's queue is throwaway `GROUP BY`s that took 30s to write and 3 days to reach; self-service BI moved the bottleneck to the modelling ticket; governed questions stay with the data team, throwaway ones just need to not be a ticket — a plain-English path against the live schema with the SQL shown; honest limit — not a governed semantic layer; anchors `/solve/answer-data-questions-without-the-data-team`).
- run 107 — Show HN / r/LocalLLaMA / dev.to: "Your agent's memory tops LongMemEval. Can it answer 'how many'?" (anchors `/vs/supermemory`).
- run 105 — dev.to / r/LLMDevs / lobste.rs: "COUNT(*) is three different questions. Your few-shot pool probably teaches one."
- run 104 — dev.to / lobste.rs / r/SEO: "The '25 words max' rule in your style guide is a lie your CMS can't catch."
- run 103 — dev.to / lobste.rs / r/ExperiencedDevs: "Your style rule lives in a code comment. That's why it's already broken."
