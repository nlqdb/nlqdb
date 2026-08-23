# Distribution queue

Drafts queued per [`/daily`](../../.claude/commands/daily.md) step 3
(drafting is optional, founder-resolved 2026-07-11); publishing is autonomous
(`SK-BLOG-001`). A published entry survives here as a venue pointer. The
**dev.to** variant is drained autonomously by the daily loop via
`scripts/syndicate-devto.ts` (one/day, `SK-BLOG-003`); Reddit/HN/lobste.rs
pointers stay for human posting (platform
norms forbid unattended submission). **For those human-posted venues, agents
deliver a fact sheet only (numbers, code, links) — never final copy.** Verbatim
agent prose was flagged as "ChatGPT copy-paste" and downvoted on r/SQL
(2026-07-16); the founder writes the post in their own voice
([lesson](../history/reddit-ai-voice-rejection.md)).

**Retention (D4, 20 KB cap):** keep as many of the newest full drafts inline as
fit under the cap; older ones collapse to a one-line title + venue + gist (full
body in git history). Earliest drafts: [archive](./distribution-queue-archive.md).

## Drafts — unpublished, newest first

_(none — the dogfood-run draft shipped run 179 as `/blog/success-rate-cant-see-a-wrong-answer/`.)_

## Published — canonical `/blog` copies live; venue variants pending

The dev.to variant posts autonomously (daily loop, `SK-BLOG-003`) and is
dropped from the line on success; Reddit/HN/lobste.rs are posted by a human and
removed by hand. Delete the whole line once no venues remain.

Venue variant = venue list + anchor; the gist lives in the linked post.

- run 179 — **https://nlqdb.com/blog/success-rate-cant-see-a-wrong-answer/** — dev.to (#ai #sql #testing) + r/SQL (human) + Show HN (human, launch-gated) · measurement/engine lesson (the D-04 dogfood run — a first-10 success counter scores an ask "ok" when its SQL is valid, executes, and returns a row, so a confident wrong answer passes silently; query #8 compiled `kind='question'` against stored `open_question` → 0 rows, true 11, `confidence:1`; the fix is a separate wrong-answer judgement plus declaring the categorical domain in DDL (`CHECK`/enum) so value-linking is legitimate schema egress, not data egress — `E-09`/`GLOBAL-037`)
- run 171 — **https://nlqdb.com/blog/link-checker-cant-see-your-javascript/** — dev.to (#testing #webdev #frontend) + r/webdev + lobste.rs (`web`) · testing/UX-integrity lesson (`SK-WEB-022` — a built-HTML dead-link sweep is blind to `location.assign("/path")` JS-string navigations; move the invariant to a source-level test matching the string-literal argument of a real navigation)
- run 169 — **https://nlqdb.com/blog/restrictive-rls-agent-memory-scoping/** — dev.to (#postgres #security #ai) + r/PostgreSQL + lobste.rs (`databases`, `security`) · security lesson (`SK-PIVOT-009` — Postgres RLS policies are `PERMISSIVE` by default and OR-combine, so a per-agent `agent_isolation` policy beside the schema's `tenant_isolation` widens access instead of narrowing it; `AS RESTRICTIVE` AND-combines and is the load-bearing keyword; four traps — link table inherits scope, a `FOR ALL` TTL arm blinds your own cleanup DELETE, model SQL can re-arm the GUC, and "unset" is `nullif(current_setting,'') IS NULL` not `IS NULL` on a pooled backend)
- run 151 — **https://nlqdb.com/blog/guard-advertised-capabilities-against-code/** — dev.to (#api #testing #devrel) + r/ExperiencedDevs + lobste.rs (`practices`) · integrity/testing lesson (run-62→64 arc — advertised `nlqdb_recall`, a verb never built, so a new user's first call hit "tool not found"; the drift-guard had the same bug; derive the allow-set from the shipped artifact, closed-world, every surface)
- run 78 — **https://nlqdb.com/blog/smoke-test-walks-the-old-ui/** — r/ExperiencedDevs + lobste.rs (`testing`) · e2e/measurement lesson (the run-58 walker re-true — pinned-literal acceptance walkers are a regression detector, but a red that mixes product-breakage with test-drift costs a full triage; make the fail detail name element + expectation, triage reds within a bounded window, and gate "re-run the walker on PRs touching a walked surface" instead of leaving it a convention) · dev.to posted 2026-07-16: https://dev.to/omer_hochman/the-redesign-shipped-the-smoke-test-kept-walking-the-old-ui-47c8
- run 65 — **https://nlqdb.com/blog/one-shot-recovery-permanent-outage/** — dev.to (#postgres #reliability #architecture) + r/ExperiencedDevs + lobste.rs (`practices`) · reliability lesson (`SK-ASK-024` — a run-exactly-once best-effort repair turns one silent skip into a permanent outage; fix the root, keep it idempotent, and re-trigger from the steady-state symptom because the original event never recurs)
- run 60 — **https://nlqdb.com/blog/green-checkmark-has-a-half-life/** — dev.to (#ci #testing #devops) + r/ExperiencedDevs + lobste.rs (`practices`) · CI/measurement lesson (the scorecard row #15 freshness method — manual-dispatch e2e makes "passing" an event not a state; score `pass × freshness` with a linear 7-day decay so the number rots until an operator re-runs it)
- run 56 — **https://nlqdb.com/blog/ephemeral-staging-persistent-registry/** — dev.to (#testing #ci #database) + r/ExperiencedDevs + lobste.rs (`practices`) · CI/test-infra lesson (the `SK-E2E-007` spin-up purge — an environment is only as ephemeral as the most persistent store that references it; reset at spin-up, not teardown)
- run 54 — **https://nlqdb.com/blog/ownership-transfer-outlives-least-privilege/** — dev.to (#postgres #security #database) + r/PostgreSQL + lobste.rs (`databases`, `security`) · product/security lesson (the adoption ACL gap, `SK-ANON-003` amendment — an ownership transfer must retarget every authorization store; a catch-all must log the code it swallows)
- run 53 — **https://nlqdb.com/blog/most-active-user-is-your-test-suite/** — dev.to (#analytics #testing #startup) + r/ExperiencedDevs + lobste.rs (`practices`) · measurement-hygiene lesson (the scorecard funnel bot-filter — a metric that doesn't name its population is measuring your robots; filter at read time, not the write path)
- run 51 — **https://nlqdb.com/blog/five-fallback-models-one-provider/** — dev.to (#llm #ci #testing) + r/LLMDevs + lobste.rs (`practices`) · CI/engine lesson (the opencheck agent-lane fallback — redundancy must cross the failure-domain boundary; the lane, not the model, is the fallback unit)
- run 49 — **https://nlqdb.com/blog/decided-questions-rot-in-your-decision-log/** — dev.to (#documentation #architecture #engineering) + r/ExperiencedDevs + lobste.rs (`practices`) · engineering-process lesson (the scorecard row #17 docs-ambiguity method — resolved is a greppable state; unmarked bullets are counted debt)
- run 47 — **https://nlqdb.com/blog/emit-metrics-where-the-distinction-is-certain/** — dev.to (#programming #observability #architecture) + r/ExperiencedDevs + lobste.rs (`practices`) · engineering lesson (`SK-TRUST-004` — emit a metric at the lowest layer where the distinction it encodes is certain)
- run 44 — **https://nlqdb.com/blog/rotate-encryption-key-without-a-version-column/** — dev.to (#security #database #architecture) + r/programming + lobste.rs (`security`) · security/architecture lesson (`GLOBAL-031` KEK rotation — version in the ciphertext prefix, not a column)
- run 40 — **https://nlqdb.com/blog/text-to-sql-planner-told-wrong-dialect/** — dev.to (#sql #llm #database) + r/dataengineering + lobste.rs (`sql`) · engine/architecture lesson (thread the real engine into the dialect field; twin of the validator post)
- run 35 — **https://nlqdb.com/blog/postgres-validator-rejects-valid-clickhouse-sql/** — dev.to (#sql #clickhouse #security) + r/dataengineering + lobste.rs (`sql`) · engine/security lesson (`SK-MULTIENG-004` — wrong-dialect parse failure means "wrong parser," not "dangerous query")
- run 31 — **https://nlqdb.com/blog/blog-without-a-feed-is-a-dead-end/** — r/webdev + lobste.rs · distribution lesson (count the doors into your content, not the pages) · dev.to posted 2026-07-26 (tags `webdev,blogging,seo` — queue line said `#rss`, posted `#blogging`): https://dev.to/omer_hochman/we-published-20-blog-posts-and-never-shipped-a-feed-nothing-could-subscribe-1pln
- run 28 — **https://nlqdb.com/blog/one-way-internal-links-leak-yield/** — dev.to (#seo #webdev #contentmarketing) + r/SEO + r/webdev + lobste.rs · distribution lesson (measure the link graph, not the page count)
- run 24 — **https://nlqdb.com/blog/serverless-db-cold-start-retry/** — r/PostgreSQL + r/webdev + lobste.rs · engine/ops lesson (SK-ASK-013 — a retry policy is one-per-failure-mode; back off the DB stage, fail over the LLM stages instantly) · dev.to posted 2026-07-29 (tags `database,serverless,webdev`): https://dev.to/omer_hochman/your-database-scales-to-zero-your-retry-loop-doesnt-know-that-373e

- run 20 — **https://nlqdb.com/blog/llm-timeout-looks-like-hallucination/** — dev.to (#llm #benchmarking #eval) + r/LLMDevs + lobste.rs · engine lesson (SK-QUAL-022 eval-budget ≠ prod SLA; abort ≠ parse failure; latency fingerprint)
- run 106 — **https://nlqdb.com/blog/store-form-submissions-without-a-backend/** — r/webdev + r/sideproject · `/solve/store-form-submissions-without-backend` · dev.to posted 2026-07-24: https://dev.to/omer_hochman/you-dont-need-a-backend-to-store-form-submissions-you-need-a-place-to-ask-how-many-3kec
- run 130 — **https://nlqdb.com/blog/not-in-subquery-null-trap/** — r/SQL + r/PostgreSQL · `/solve/find-rows-with-no-match-in-another-table` · dev.to posted 2026-07-20: https://dev.to/omer_hochman/not-in-returned-zero-rows-it-wasnt-your-data-it-was-one-null-4inj
- run 102 — **https://nlqdb.com/blog/mcp-server-what-does-the-agent-own/** — r/LLMDevs + r/AI_Agents · `/vs/hex` · dev.to posted 2026-08-03: https://dev.to/omer_hochman/every-data-tool-shipped-an-mcp-server-this-year-your-agent-still-cant-build-on-most-of-them-4cn
- run 55 — **https://nlqdb.com/blog/text-to-sql-accuracy-schemas-your-users-never-build/** — lobste.rs + r/LLMDevs · dev.to posted 2026-08-06: https://dev.to/omer_hochman/your-text-to-sql-accuracy-is-measured-on-schemas-your-users-will-never-build-32b2
- run 67 — **https://nlqdb.com/blog/ai-internal-tool-builder-faster/** — lobste.rs · `/vs/retool` · dev.to posted 2026-07-28: https://dev.to/omer_hochman/ai-made-the-internal-tool-builder-faster-it-didnt-ask-whether-you-needed-the-tool-32ea
- run 68 — **https://nlqdb.com/blog/offline-llm-eval-rate-limits/** — lobste.rs · dev.to posted 2026-08-08: https://dev.to/omer_hochman/your-offline-llm-eval-isnt-measuring-your-model-its-measuring-your-rate-limits-2ph0
- run 69 — **https://nlqdb.com/blog/sitemap-advertising-redirects/** — lobste.rs · dev.to posted 2026-07-21: https://dev.to/omer_hochman/your-sitemap-is-advertising-redirects-and-your-canonical-tag-points-at-one-2860
- run 109 — **https://nlqdb.com/blog/text-to-sql-build-vs-buy/** — r/SaaS + r/ExperiencedDevs · dev.to ✓ https://dev.to/omer_hochman/the-text-to-sql-demo-takes-an-afternoon-the-other-90-is-why-you-should-buy-it-4iko · `/solve/add-ask-your-data-feature-without-building-text-to-sql`
- run 119 — **https://nlqdb.com/blog/find-duplicate-rows-you-re-google-every-time/** — r/SQL + r/analytics · `/solve/find-duplicate-rows-in-my-data` · dev.to posted 2026-08-18: https://dev.to/omer_hochman/the-duplicate-rows-query-you-re-google-every-six-weeks-39km
- run 110 — **https://nlqdb.com/blog/your-bi-tool-got-acquired-data-layer/** — r/dataengineering + r/BusinessIntelligence · `/vs/mode` · dev.to posted 2026-08-19: https://dev.to/omer_hochman/your-bi-tool-got-acquired-your-data-layer-shouldnt-have-to-care-461i
- run 131 — **https://nlqdb.com/blog/top-n-rows-per-group/** — r/SQL + r/PostgreSQL · `/solve/find-top-n-rows-per-group` · dev.to posted 2026-07-27 (tags `sql,database,webdev`; queue line named none): https://dev.to/omer_hochman/top-n-per-group-is-the-query-limit-cant-write-57eb
- run 7 — **https://nlqdb.com/blog/http-200-error-in-body/** — r/LocalLLaMA + lobste.rs · engine lesson (res.ok necessary not sufficient) · dev.to posted 2026-08-12: https://dev.to/omer_hochman/your-text-to-sql-eval-is-lying-the-gateway-returns-http-200-with-the-error-in-the-body-4i8i
- run 14 — **https://nlqdb.com/blog/bird-gold-noise-distinct/** — r/LLMDevs + lobste.rs (`llm`) · engine lesson (benchmark number = floor bounded by gold quality; `SK-QUAL-014`) · dev.to posted 2026-08-07: https://dev.to/omer_hochman/your-text-to-sql-model-isnt-as-wrong-as-your-benchmark-says-the-gold-sql-is-p16
- run 16 — **https://nlqdb.com/blog/model-preset-fail-loud/** — dev.to (#llm #api #ux) + r/LLMDevs · engine/product lesson (a model knob is a contract not a capability: pin `fast` / upgrade `best` or 409 `model_unavailable` + fix-it link; refusal count = paid-lane demand signal; `SK-PREMIUM-014`, GLOBAL-012 fail-loud)
- run 17 — **https://nlqdb.com/blog/llm-preflight-probe-health/** — r/LLMDevs (human) · CI/engine lesson (health ≠ competence; probe the tool-call shape, read the body not the status; `SK-LLM-042`) · dev.to posted 2026-08-22: https://dev.to/omer_hochman/your-llm-health-probe-passed-your-agent-still-starved-50d0

## Collapsed — full drafts in git history

- run 129 — dev.to / r/SQL / r/PostgreSQL: "The 'percent of total' query has a denominator problem. Two, actually." (two quiet traps: integer division floors `revenue / SUM(revenue) OVER ()` to 0 unless you write `100.0 *`; empty `OVER ()` grand-total vs `OVER (PARTITION BY region)` per-group total is a denominator choice the clause spells out; anchors `/solve/calculate-percentage-of-total-in-sql`).

- run 121 — dev.to / r/SQL / r/dataengineering: "The top-N-per-group query everyone re-Googles." (`greatest-n-per-group`: keeping the whole row per group needs `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ... DESC)` filtered to rank ≤ N, not `GROUP BY`+`MAX`; anchors `/solve/find-top-n-rows-per-group`).

- run 120 — dev.to / r/dataengineering / r/LLMDevs: "Open-source text-to-SQL is the easy 10%. The golden SQL you maintain forever is the rest." (Dataherald/Vanna/Wren open-sourced the NL→SQL engine — a commodity you wire up in an afternoon — but ship it to people who don't know your schema and accuracy evaporates; the fix is *golden SQL*, hand-curated question→query pairs, a standing maintenance job the README undersells; honest split — nlqdb owns the Postgres it answers and skips golden SQL by prompting from the live schema fingerprint, no warehouse federation; anchors `/vs/dataherald`).
- run 118 — dev.to / r/LangChain / lobste.rs: "You don't need to build a SQL agent. Here's when you should anyway." (the `create_sql_agent` + `SQLDatabaseToolkit` demo (now assembled directly in LangGraph) gets the happy path working in an afternoon — the 10%; the other 90% is a `DELETE` guardrail (the default toolkit runs whatever SQL the model emits), bounded retries, a question cache, somewhere to *show* the SQL, a deployment, and an eval harness, all yours to own forever for a non-core feature; the honest build-vs-buy test isn't "can I generate SQL from English" but "do I want to own that stack" — build with LangChain if you're building an agent framework / need the reasoning graph / want self-hosted-free; buy if it's a feature inside your product; honest split — nlqdb is a hosted pipeline you embed, not a vendored library, and a LangChain agent can just *call* it as one tool; anchors `/vs/langchain-sql-agent`).
- run 117 — dev.to / r/devops / r/sysadmin: "Your cron jobs already write run history. You just can't query it." (anchors `/solve/track-background-job-run-history`).
- run 116 — dev.to / r/mcp / r/LLMDevs: "A federated query engine connects your agent to the data you have. Some agents need data they don't have yet." (anchors `/vs/mindsdb`).
- run 115 — dev.to / r/SaaS / Indie Hackers: "Product analytics is two problems. Only one of them needs a warehouse." (anchors `/solve/track-product-usage-without-a-data-warehouse`).
- run 114 — dev.to / r/dataengineering / r/analytics: "Your analytics canvas is where humans look. Your product runs where no one's looking." (anchors `/vs/count`).
- run 113 — dev.to / r/webdev / r/node: "The webhook receiver is the easy half. The database behind it is the part nobody wants to own." (anchors `/solve/store-and-query-webhook-events`).
- run 112 — dev.to / r/dataengineering / r/LLMDevs: "Your notebook's AI analyst assumes someone's watching the cell. Your product runs when no one is." (anchors `/vs/fabi`).
- run 111 — dev.to / r/AI_Agents / r/LLMDevs: "Your agent knows how the user thinks. It still can't tell you how many of them churned." (user-modelling (Honcho's theory-of-mind) vs. relational aggregation over what the agent stored; anchors `/vs/honcho`).
*(runs 75–100 moved to git history under D4; full gists for runs 103–105 collapsed to titles; runs 122–128 titles moved to the [archive](./distribution-queue-archive.md) — `git log -p` recovers all bodies.)*

### Engine-lesson posts (dev.to / lobste.rs)
- run 131 — dev.to / r/LLMDevs / lobste.rs (`llm`): "Don't give your LLM provider's model ID a fallback default. Ship it empty." (the tempting line is `model: env.OPENAI_MODEL ?? "gpt-4o"` — a hardcoded default that *feels* safe but silently ships a stale guess the day the provider renames or retires it, and the failure is a quiet quality regression, not an error; provider model IDs churn ~monthly — `gpt-5.5`/`gpt-5.4-mini` today weren't the names last quarter; the safer pattern is a **fail-loud empty default** so an unset env var is a config error at boot, not a wrong model in prod, plus a **dated, sourced verified-IDs list in the doc**; nlqdb's frontier lane does exactly this — GLOBAL-026 BYOLLM/hosted-premium; honest split — a config-hygiene pattern, not a product feature).
- run 72 — "Your BI tool got an AI assistant. Your agent still can't call it." (open-source BI tools shipped genuinely good in-app AI assistants — NL answers, prompt-to-chart, a "fix it" button, Slack replies — but the assistant is a feature inside a destination app that helps a logged-in human; there's no handle an autonomous agent can grab, no "provision a database, write rows, query it" primitive; "who the AI helps" vs. "whether software can call it" are different axes; anchors `/vs/metabase`).
- run 70 — "Your AI BI tool reads your data. It doesn't own it — and can't write to it" (a wave of AI-native BI tools converge on "describe what to track, AI builds the dashboard" — great at it, but "your data" is a read-only connection to a warehouse you already run; they don't own a DB or write to yours; the data layer that provisions the store and takes English for the write *and* the read is a different altitude; anchors `/vs/basedash`).

*(runs 51–52, 56–66 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*
- runs 8–18, 33, 37, 39, 41–44, 46, 48 — earliest engine-lesson gists archived to keep this doc under the 20 KB cap (CLAUDE.md D4); titles + IDs in [`distribution-queue-archive.md`](./distribution-queue-archive.md), bodies in git history.

### Launch + build-in-public posts (X / Bluesky / HN / dev.to)

- **Launch fact sheets + readiness audit live in
  [`launch-kit.md`](./launch-kit.md)** (2026-07-19) — Show HN / lobste.rs /
  r/SideProject / Product Hunt, founder-fired; supersedes the 2026-06-13
  archived Show HN draft as the current launch source.

- runs 43–44 — "We moved agent memory above the fold and demoted three of our four personas. On purpose." (additive/reversible home reweight; agent-memory wedge + Mem0·Zep·Letta·nlqdb matrix above the fold, other personas folded under a quiet divider; GLOBAL-036 + WS-12).
- *(runs 41–42 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*
- runs 27–30 — agent-memory wave (WS-09): "Why your AI agent's memory should be a database, not a vector store" (Replit-incident open, BIRD/Spider sub-target, open harness), "…as four Postgres tables (no schema design)" (`agent_memory_v1` preset), the "one bright column" matrix teaser + FSL-1.1 license note, and the Mem0/Zep/Letta/nlqdb capability matrix → `/agents`. Bodies in git history.

### Helpful-answer + comparison drafts (Reddit / Show HN)

*(runs 21–36 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*

Earliest drafts: [`distribution-queue-archive.md`](./distribution-queue-archive.md).
