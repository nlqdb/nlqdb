# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); publishing is autonomous
(`SK-BLOG-001`, founder-resolved 2026-07-01). Newest first. Once published, the
live URL goes into `docs/scorecard.md` § Shipped distribution; the entry
survives here only as a venue pointer until the venue variant posts.

**Retention (D4, 20 KB cap):** keep the most recent full draft(s) inline — as
many as fit under the cap; older ones collapse to a one-line title + venue +
gist (full body in git history). Earliest drafts: [archive](./distribution-queue-archive.md).

## Drafts — unpublished, newest first

- **"We rebuilt staging's database every run. The registry remembered
  everything."** slug `ephemeral-staging-persistent-registry` · venue dev.to
  (#testing #ci #database) + r/ExperiencedDevs + lobste.rs (`practices`) ·
  CI/infra lesson (the stale-fixture purge, `SK-E2E-007`, 2026-07-11). Angle:
  ephemeral e2e staging done by the book — a fresh Postgres branch per run,
  deleted at run end, previews aliased per-run — except the control plane
  (the registry mapping "database" rows to schemas, plus sessions and chat
  history) is the production D1 the preview binds by default, and it survives
  every teardown. So each run's fixture rows outlived their schemas: the
  sidebar filled with same-name ghosts, tests that pin a DB by name landed on
  schemas that no longer existed ("Couldn't reach the database" — reads
  exactly like an infra flake), and the cleanup test that deletes leftovers
  through the UI grew a backlog it could never finish (~27 rows, one
  typed-confirm modal at a time, against a 300 s budget — and its name-scoped
  walk never matched leftovers with other names at all). The suite reported
  "app red" for state no real user could reach. Two rules fell out. (1) An
  environment is only as ephemeral as the most persistent store that
  references it — enumerate every store that outlives the rebuild (registry,
  sessions, queues, caches) and reset the slice that points at the rebuilt
  one at spin-up, not teardown (a crashed run skips teardown by definition).
  (2) In-band cleanup — tests deleting through the UI — verifies the delete
  *feature*; it cannot be the *invariant*: the invariant needs an out-of-band
  guarantee that runs before the suite. Honest split: a CI/test-infra lesson
  from our E2E harness, not a product feature.

- **"Ownership transfer was a one-row UPDATE. Then we added least-privilege."**
  slug `ownership-transfer-outlives-least-privilege` · venue dev.to (#postgres
  #security #database) + r/PostgreSQL + lobste.rs (`databases`, `security`) ·
  product/security lesson (the adoption ACL gap, `SK-ANON-003` amendment,
  2026-07-11). Gist: transfer flipped `tenant_id` in the registry while
  least-privilege exec (`SET LOCAL ROLE` + per-tenant grants + RLS literal)
  still named the old tenant — every transferred DB unqueryable, masked as
  "couldn't reach the database" with no SQLSTATE logged. Rules: retarget ALL
  authorization layers idempotently on transfer; a catch-all error branch
  must log the code it swallows. Full draft: git history (collapsed
  2026-07-11 run 52, D4 retention).

## Published — canonical `/blog` copies live; venue variants pending

Post each venue variant as a pointer to (or excerpt of) the canonical URL, then
delete its line.

Venue variant = venue list + anchor; the gist lives in the linked post.

- run 53 — **https://nlqdb.com/blog/most-active-user-is-your-test-suite/** — dev.to (#analytics #testing #startup) + r/ExperiencedDevs + lobste.rs (`practices`) · measurement-hygiene lesson (the scorecard funnel bot-filter — a metric that doesn't name its population is measuring your robots; filter at read time, not the write path)
- run 51 — **https://nlqdb.com/blog/five-fallback-models-one-provider/** — dev.to (#llm #ci #testing) + r/LLMDevs + lobste.rs (`practices`) · CI/engine lesson (the opencheck agent-lane fallback — redundancy must cross the failure-domain boundary; the lane, not the model, is the fallback unit)
- run 49 — **https://nlqdb.com/blog/decided-questions-rot-in-your-decision-log/** — dev.to (#documentation #architecture #engineering) + r/ExperiencedDevs + lobste.rs (`practices`) · engineering-process lesson (the scorecard row #17 docs-ambiguity method — resolved is a greppable state; unmarked bullets are counted debt)
- run 47 — **https://nlqdb.com/blog/emit-metrics-where-the-distinction-is-certain/** — dev.to (#programming #observability #architecture) + r/ExperiencedDevs + lobste.rs (`practices`) · engineering lesson (`SK-TRUST-004` — emit a metric at the lowest layer where the distinction it encodes is certain)
- run 44 — **https://nlqdb.com/blog/rotate-encryption-key-without-a-version-column/** — dev.to (#security #database #architecture) + r/programming + lobste.rs (`security`) · security/architecture lesson (`GLOBAL-031` KEK rotation — version in the ciphertext prefix, not a column)
- run 40 — **https://nlqdb.com/blog/text-to-sql-planner-told-wrong-dialect/** — dev.to (#sql #llm #database) + r/dataengineering + lobste.rs (`sql`) · engine/architecture lesson (thread the real engine into the dialect field; twin of the validator post)
- run 35 — **https://nlqdb.com/blog/postgres-validator-rejects-valid-clickhouse-sql/** — dev.to (#sql #clickhouse #security) + r/dataengineering + lobste.rs (`sql`) · engine/security lesson (`SK-MULTIENG-004` — wrong-dialect parse failure means "wrong parser," not "dangerous query")
- run 31 — **https://nlqdb.com/blog/blog-without-a-feed-is-a-dead-end/** — dev.to (#webdev #seo #rss) + r/webdev + lobste.rs · distribution lesson (count the doors into your content, not the pages)
- run 28 — **https://nlqdb.com/blog/one-way-internal-links-leak-yield/** — dev.to (#seo #webdev #contentmarketing) + r/SEO + r/webdev + lobste.rs · distribution lesson (measure the link graph, not the page count)
- run 24 — **https://nlqdb.com/blog/serverless-db-cold-start-retry/** — dev.to (#database #serverless #postgres) + r/PostgreSQL + r/webdev + lobste.rs · engine/ops lesson (SK-ASK-013 — a retry policy is one-per-failure-mode; back off the DB stage, fail over the LLM stages instantly)

- run 20 — **https://nlqdb.com/blog/llm-timeout-looks-like-hallucination/** — dev.to (#llm #benchmarking #eval) + r/LLMDevs + lobste.rs · engine lesson (SK-QUAL-022 eval-budget ≠ prod SLA; abort ≠ parse failure; latency fingerprint)
- run 106 — **https://nlqdb.com/blog/store-form-submissions-without-a-backend/** — dev.to + r/webdev + r/sideproject · `/solve/store-form-submissions-without-backend`
- run 130 — **https://nlqdb.com/blog/not-in-subquery-null-trap/** — dev.to + r/SQL + r/PostgreSQL · `/solve/find-rows-with-no-match-in-another-table`
- run 102 — **https://nlqdb.com/blog/mcp-server-what-does-the-agent-own/** — dev.to + r/LLMDevs + r/AI_Agents · `/vs/hex`
- run 55 — **https://nlqdb.com/blog/text-to-sql-accuracy-schemas-your-users-never-build/** — dev.to + lobste.rs + r/LLMDevs
- run 67 — **https://nlqdb.com/blog/ai-internal-tool-builder-faster/** — dev.to + lobste.rs · `/vs/retool`
- run 68 — **https://nlqdb.com/blog/offline-llm-eval-rate-limits/** — dev.to + lobste.rs
- run 69 — **https://nlqdb.com/blog/sitemap-advertising-redirects/** — dev.to + lobste.rs
- run 109 — **https://nlqdb.com/blog/text-to-sql-build-vs-buy/** — dev.to + r/SaaS + r/ExperiencedDevs · `/solve/add-ask-your-data-feature-without-building-text-to-sql`
- run 119 — **https://nlqdb.com/blog/find-duplicate-rows-you-re-google-every-time/** — dev.to + r/SQL + r/analytics · `/solve/find-duplicate-rows-in-my-data`
- run 110 — **https://nlqdb.com/blog/your-bi-tool-got-acquired-data-layer/** — dev.to + r/dataengineering + r/BusinessIntelligence · `/vs/mode`
- run 131 — **https://nlqdb.com/blog/top-n-rows-per-group/** — dev.to + r/SQL + r/PostgreSQL · `/solve/find-top-n-rows-per-group`
- run 7 — **https://nlqdb.com/blog/http-200-error-in-body/** — dev.to (#llm #api #debugging) + r/LocalLLaMA + lobste.rs · engine lesson (res.ok necessary not sufficient)
- run 12 — **https://nlqdb.com/blog/llm-concatenates-columns-text-to-sql/** — r/SQL · engine lesson (positional-tuple EX vs fused columns; SK-LLM-043 projection directive) · dev.to posted 2026-07-07: https://dev.to/omer_hochman/your-llm-fused-the-two-columns-you-asked-for-and-the-eval-marked-it-wrong-5gge
- run 14 — **https://nlqdb.com/blog/bird-gold-noise-distinct/** — dev.to (#sql #llm #ai) + r/LLMDevs + lobste.rs (`llm`) · engine lesson (benchmark number = floor bounded by gold quality; `SK-QUAL-014`)
- run 16 — **https://nlqdb.com/blog/model-preset-fail-loud/** — dev.to (#llm #api #ux) + r/LLMDevs · engine/product lesson (a model knob is a contract not a capability: pin `fast` / upgrade `best` or 409 `model_unavailable` + fix-it link; refusal count = paid-lane demand signal; `SK-PREMIUM-014`, GLOBAL-012 fail-loud)
- run 17 — **https://nlqdb.com/blog/llm-preflight-probe-health/** — dev.to (#llm #ci #testing) + r/LLMDevs · CI/engine lesson (health ≠ competence; probe the tool-call shape, read the body not the status; `SK-LLM-042`)

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
- run 131 — dev.to / r/LLMDevs / lobste.rs (`llm`): "Don't give your LLM provider's model ID a fallback default. Ship it empty." (the tempting line is `model: env.OPENAI_MODEL ?? "gpt-4o"` — a hardcoded default that *feels* safe but silently ships a stale guess the day the provider renames or retires it, and the failure is a quiet quality regression, not an error; provider model IDs churn ~monthly — `gpt-5.5`/`gpt-5.4-mini` today weren't the names last quarter; the safer pattern is a **fail-loud empty default** so an unset env var is a config error at boot, not a wrong model in prod, plus a **dated, sourced verified-IDs list in the doc** the operator sets against at enable time; nlqdb's multi-provider frontier lane does exactly this — Anthropic ladder pinned to the eval baseline, OpenAI defaults empty until the founder sets them against a P2-verified list, so a guessed ID can never ship silently — GLOBAL-026 BYOLLM/hosted-premium; honest split — this is a config-hygiene pattern, not a product feature, and it costs one boot-time error the first time you forget).
- run 72 — "Your BI tool got an AI assistant. Your agent still can't call it." (open-source BI tools shipped genuinely good in-app AI assistants — NL answers, prompt-to-chart, a "fix it" button, Slack replies — but the assistant is a feature inside a destination app that helps a logged-in human; there's no handle an autonomous agent can grab, no "provision a database, write rows, query it" primitive; "who the AI helps" vs. "whether software can call it" are different axes; anchors `/vs/metabase`).
- run 70 — "Your AI BI tool reads your data. It doesn't own it — and can't write to it" (a wave of AI-native BI tools converge on "describe what to track, AI builds the dashboard" — great at it, but "your data" is a read-only connection to a warehouse you already run; they don't own a DB or write to yours; the data layer that provisions the store and takes English for the write *and* the read is a different altitude; anchors `/vs/basedash`).

*(runs 51–52, 56–66 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*
- runs 8–18, 33, 37, 39, 41–44, 46, 48 — earliest engine-lesson gists archived to keep this doc under the 20 KB cap (CLAUDE.md D4); titles + IDs in [`distribution-queue-archive.md`](./distribution-queue-archive.md), bodies in git history.

### Launch + build-in-public posts (X / Bluesky / HN / dev.to)

- runs 43–44 — "We moved agent memory above the fold and demoted three of our four personas. On purpose." (additive/reversible home reweight; agent-memory wedge + Mem0·Zep·Letta·nlqdb matrix above the fold, other personas folded under a quiet divider; GLOBAL-036 + WS-12).
- *(runs 41–42 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*
- runs 27–30 — agent-memory wave (WS-09): "Why your AI agent's memory should be a database, not a vector store" (Replit-incident open, BIRD/Spider sub-target, open harness), "…as four Postgres tables (no schema design)" (`agent_memory_v1` preset), the "one bright column" matrix teaser + FSL-1.1 license note, and the Mem0/Zep/Letta/nlqdb capability matrix → `/agents`. Bodies in git history.

### Helpful-answer + comparison drafts (Reddit / Show HN)

*(runs 21–36 moved to [`distribution-queue-archive.md`](./distribution-queue-archive.md) under D4.)*

Earliest drafts: [`distribution-queue-archive.md`](./distribution-queue-archive.md).
