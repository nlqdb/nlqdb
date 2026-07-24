# Distribution queue

Drafts queued per [`/daily`](../../.claude/commands/daily.md) step 3
(drafting is optional, founder-resolved 2026-07-11); publishing is autonomous
(`SK-BLOG-001`, founder-resolved 2026-07-01). A published entry survives here
as a venue pointer. The **dev.to** variant is drained
autonomously by the daily loop via `scripts/syndicate-devto.ts` (one/day,
`SK-BLOG-003`); Reddit/HN/lobste.rs pointers stay for human posting (platform
norms forbid unattended submission). **For those human-posted venues, agents
deliver a fact sheet only (numbers, code, links) — never final copy.** Verbatim
agent prose was flagged as "ChatGPT copy-paste" and downvoted on r/SQL
(2026-07-16); the founder writes the post in their own voice
([lesson](../history/reddit-ai-voice-rejection.md)).

**Retention (D4, 20 KB cap):** keep the most recent full draft(s) inline;
older ones collapse to a one-line title + venue +
gist (full body in git history). Earliest drafts: [archive](./distribution-queue-archive.md).

## Drafts — unpublished, newest first

- **"Your link checker can't see your JavaScript."** slug
  `link-checker-cant-see-your-javascript` · venue dev.to (#testing #webdev
  #frontend) + r/webdev + lobste.rs (`web`) · testing/UX-integrity lesson
  (run-75→77 arc, 2026-07-15). Angle: a dead-link sweep over built HTML reports
  "0 dead, 0 redirecting" for weeks — then a stranger clicks "Sign out" and the
  browser makes two requests: a 307 to add the trailing slash, then the page.
  The checker never saw it because it parses `href`/`src` attributes out of
  `dist/`, but that navigation is `window.location.assign("/auth/sign-out")`
  inside a React island — a string that exists only at runtime. Static-output
  link checkers have a blind spot exactly the size of your client-side JS, and
  it's invisible precisely because the tool reports green. With
  `trailingSlash: "always"`, every bare-path JS navigation is a silent redirect
  round-trip on a real click. We found one by hand (a CTA that redirected for a
  week), then swept every `location.*` navigation and found five more — CTAs
  (new query, API keys, sign out) plus a comparison-page CTA and an auth-flow
  redirect. Fix shape: fix the paths, then add a guard the built-output checker
  structurally can't be — scan source for the string-literal argument of an
  actual navigation call (`location.assign/replace`, `location.href =`, bare or
  `window.`-prefixed) and assert its path ends in `/`. Keep it narrow to the call shape: every `/path` literal, comments, and
  JSX `href=` (already swept) drown you in false positives. Honest split: a
  coverage-gap pattern for any static-output link checker on a JS-heavy site —
  the green check measures the surface you serve, not the surface you script.

- **"Your docs promised a tool your server never shipped."** slug
  `guard-advertised-capabilities-against-code` · venue dev.to (#api #testing
  #devrel) + r/ExperiencedDevs + lobste.rs (`practices`) · integrity/testing
  lesson (run-62→64 arc, 2026-07-13). Gist: an agent-facing product names its
  tools in two unrelated hand-copied places — the server that registers them and
  the copy that sells them — so they drift; ours drifted to a verb designed but
  never built (`nlqdb_recall`), live a week, so a new user's very first call
  returns "tool not found." The real lesson is the guard's own bugs: it scanned
  one of six surfaces and pinned a hand-typed allow-list that itself went stale.
  Fix shape: derive the allow-set from the shipped artifact, make it closed-world
  (every capability-shaped token resolves to a shipped capability or an
  explicitly-classified non-capability), sweep every surface. Design test:
  "rename a tool and forget the docs — does anything go red without also editing
  the test's copy of the list?" Honest split: a claim-integrity pattern for any
  product whose surface is advertised as named verbs (MCP tools, SDK methods,
  CLI subcommands). **(oldest full draft — collapsed per D4; full body in git
  history; next non-null run publishes this one, step 3.1.)**


## Published — canonical `/blog` copies live; venue variants pending

The dev.to variant posts autonomously (daily loop, `SK-BLOG-003`) and is
dropped from the line on success; Reddit/HN/lobste.rs are posted by a human and
removed by hand. Delete the whole line once no venues remain.

Venue variant = venue list + anchor; the gist lives in the linked post.

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
- run 31 — **https://nlqdb.com/blog/blog-without-a-feed-is-a-dead-end/** — dev.to (#webdev #seo #rss) + r/webdev + lobste.rs · distribution lesson (count the doors into your content, not the pages)
- run 28 — **https://nlqdb.com/blog/one-way-internal-links-leak-yield/** — dev.to (#seo #webdev #contentmarketing) + r/SEO + r/webdev + lobste.rs · distribution lesson (measure the link graph, not the page count)
- run 24 — **https://nlqdb.com/blog/serverless-db-cold-start-retry/** — dev.to (#database #serverless #postgres) + r/PostgreSQL + r/webdev + lobste.rs · engine/ops lesson (SK-ASK-013 — a retry policy is one-per-failure-mode; back off the DB stage, fail over the LLM stages instantly)

- run 20 — **https://nlqdb.com/blog/llm-timeout-looks-like-hallucination/** — dev.to (#llm #benchmarking #eval) + r/LLMDevs + lobste.rs · engine lesson (SK-QUAL-022 eval-budget ≠ prod SLA; abort ≠ parse failure; latency fingerprint)
- run 106 — **https://nlqdb.com/blog/store-form-submissions-without-a-backend/** — r/webdev + r/sideproject · `/solve/store-form-submissions-without-backend` · dev.to posted 2026-07-24: https://dev.to/omer_hochman/you-dont-need-a-backend-to-store-form-submissions-you-need-a-place-to-ask-how-many-3kec
- run 130 — **https://nlqdb.com/blog/not-in-subquery-null-trap/** — r/SQL + r/PostgreSQL · `/solve/find-rows-with-no-match-in-another-table` · dev.to posted 2026-07-20: https://dev.to/omer_hochman/not-in-returned-zero-rows-it-wasnt-your-data-it-was-one-null-4inj
- run 102 — **https://nlqdb.com/blog/mcp-server-what-does-the-agent-own/** — dev.to + r/LLMDevs + r/AI_Agents · `/vs/hex`
- run 55 — **https://nlqdb.com/blog/text-to-sql-accuracy-schemas-your-users-never-build/** — dev.to + lobste.rs + r/LLMDevs
- run 67 — **https://nlqdb.com/blog/ai-internal-tool-builder-faster/** — dev.to + lobste.rs · `/vs/retool`
- run 68 — **https://nlqdb.com/blog/offline-llm-eval-rate-limits/** — dev.to + lobste.rs
- run 69 — **https://nlqdb.com/blog/sitemap-advertising-redirects/** — lobste.rs · dev.to posted 2026-07-21: https://dev.to/omer_hochman/your-sitemap-is-advertising-redirects-and-your-canonical-tag-points-at-one-2860
- run 109 — **https://nlqdb.com/blog/text-to-sql-build-vs-buy/** — dev.to + r/SaaS + r/ExperiencedDevs · `/solve/add-ask-your-data-feature-without-building-text-to-sql`
- run 119 — **https://nlqdb.com/blog/find-duplicate-rows-you-re-google-every-time/** — dev.to + r/SQL + r/analytics · `/solve/find-duplicate-rows-in-my-data`
- run 110 — **https://nlqdb.com/blog/your-bi-tool-got-acquired-data-layer/** — dev.to + r/dataengineering + r/BusinessIntelligence · `/vs/mode`
- run 131 — **https://nlqdb.com/blog/top-n-rows-per-group/** — dev.to + r/SQL + r/PostgreSQL · `/solve/find-top-n-rows-per-group`
- run 7 — **https://nlqdb.com/blog/http-200-error-in-body/** — dev.to (#llm #api #debugging) + r/LocalLLaMA + lobste.rs · engine lesson (res.ok necessary not sufficient)
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
