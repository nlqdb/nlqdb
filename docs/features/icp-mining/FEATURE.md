---
name: icp-mining
description: Weekly cron that scrapes HN Algolia, Reddit, GitHub Issues, GitHub Discussions, Stack Overflow, Indie Hackers, and Dev.to for ICP pain signals, scores them per persona via the free LLM chain, clusters them into themes, and writes a monthly evidence file to GitHub.
when-to-load:
  globs:
    - apps/api/src/icp-scrape.ts
    - apps/api/src/icp-score.ts
    - apps/api/src/icp-cluster.ts
    - apps/api/test/icp-scrape.test.ts
    - apps/api/test/icp-score.test.ts
    - apps/api/test/icp-cluster.test.ts
  topics: [icp, scrape, pain-signal, cron, acquisition, evidence]
---

# Feature: ICP Mining

**One-liner:** A Monday 06:00 UTC cron scrapes HN Algolia, Reddit (16 subreddits, application-only OAuth), GitHub Issues, GitHub Discussions, Stack Overflow, Indie Hackers, and Dev.to; deduplicates via KV; scores 0–10 per persona via Groq → Gemini; clusters into 5–7 themes per persona; writes `docs/research/icp-evidence-<yyyy-mm>.md` to GitHub.
**Status:** implemented (SK-ICP-001 collection; SK-ICP-002 scoring; SK-ICP-003 clustering + evidence file; SK-ICP-004 GitHub Issues; SK-ICP-005 Stack Overflow; SK-ICP-006 Indie Hackers; SK-ICP-007 source-health probe; SK-ICP-008 Dev.to source; SK-ICP-009 GitHub Discussions source; SK-ICP-010 Reddit application-only OAuth).
**Owners (code):** `apps/api/src/icp-scrape.ts`, `apps/api/src/icp-score.ts`, `apps/api/src/icp-cluster.ts`, `apps/api/test/icp-scrape.test.ts`, `apps/api/test/icp-score.test.ts`, `apps/api/test/icp-cluster.test.ts`, `apps/api/wrangler.toml` (cron `0 6 * * 1`).
**Cross-refs:** [`docs/research/automated-icp-validation-plan.md §2`](../../research/automated-icp-validation-plan.md) · [`docs/research/personas.md`](../../research/personas.md) · [`GLOBAL-028`](../../decisions/GLOBAL-028-acquisition-progress-tracker.md) · [`GLOBAL-030`](../../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md).

## Touchpoints — read this feature doc before editing

- `apps/api/src/icp-scrape.ts` — `runIcpScrape(deps)`; calls HN, Reddit, GitHub Issues, GitHub Discussions, Stack Overflow, Indie Hackers, Dev.to
- `apps/api/src/icp-score.ts` — `runIcpScore(items, deps)`; Groq → Gemini scoring
- `apps/api/src/icp-cluster.ts` — `runIcpCluster(deps)`; KV list → LLM cluster → GitHub write
- `apps/api/wrangler.toml` `[triggers].crons` — must stay in sync with `ICP_SCRAPE_CRON` in `index.ts`
- `apps/api/src/env.d.ts` — `LOGSNAG_TOKEN`, `LOGSNAG_PROJECT`, `GH_TOKEN`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` bindings

## Decisions

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-ICP-NNN`. The list below is the index; open the linked file for the full five-field block.

- [**SK-ICP-001**](decisions/SK-ICP-001-weekly-hn-reddit-scrape-to-kv.md) — Weekly HN + Reddit scrape writing raw items to KV.
- [**SK-ICP-002**](decisions/SK-ICP-002-llm-scoring-after-scrape.md) — LLM scoring of raw items immediately after each weekly scrape.
- [**SK-ICP-003**](decisions/SK-ICP-003-cluster-and-write-evidence-file.md) — Cluster scored items per persona and write monthly evidence file to GitHub.
- [**SK-ICP-004**](decisions/SK-ICP-004-github-issues-source.md) — GitHub Issues as an additional pain-signal source.
- [**SK-ICP-005**](decisions/SK-ICP-005-stackoverflow-source.md) — Stack Overflow as an additional pain-signal source.
- [**SK-ICP-006**](decisions/SK-ICP-006-indiehackers-source.md) — Indie Hackers as an additional pain-signal source.
- [**SK-ICP-007**](decisions/SK-ICP-007-source-health-probe.md) — Agent-runnable source-health probe in `scripts/verify-flows.sh`.
- [**SK-ICP-008**](decisions/SK-ICP-008-devto-source.md) — Dev.to as the 6th pain-signal source via the public Forem API.
- [**SK-ICP-009**](decisions/SK-ICP-009-github-discussions-source.md) — GitHub Discussions as the 7th pain-signal source via GraphQL.
- [**SK-ICP-010**](decisions/SK-ICP-010-reddit-application-only-oauth.md) — Reddit application-only OAuth for the Reddit source.

## GLOBALs governing this feature

- **GLOBAL-013** — Free-tier bundle budget.
  - *In this feature:* all seven sources are free public APIs. Reddit application-only OAuth (SK-ICP-010) allows ~100 QPM per OAuth client; the cron uses 16 queries + 1 token mint/week. Stack Exchange anon quota 300/IP/day; cron uses 5/week. Dev.to public API allows ~3 RPS unauthenticated; cron uses 5 sequential calls/week. GitHub GraphQL primary-rate-limit is 5000 points/hour authenticated; the Discussions search costs 1 point/query × 5/week. Weekly KV cost (≤ 775 items × 2 writes + ≤ 2 list ops + ~775 reads) sits comfortably inside Workers free-tier ceilings.
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* per-source fetch spans `nlqdb.icp.fetch.{hn,reddit,github,github_discussions,stackoverflow,indiehackers,devto}` (each with source + item count + status code; Reddit fetch + the `nlqdb.icp.reddit.token` mint span add `nlqdb.icp.reddit.authed`; GitHub Discussions adds `nlqdb.icp.ghd.rate_remaining`; Stack Exchange adds `nlqdb.icp.se.quota_remaining`); `nlqdb.icp.score` (provider, batch size, raw count); `nlqdb.icp.cluster` (persona, item count, cluster count, provider); `nlqdb.icp.github_write` (file path, written status).
- **GLOBAL-028** — Acquisition progress tracker.
  - *In this feature:* this cron implements §2.1–§2.4 of [`automated-icp-validation-plan.md`](../../research/automated-icp-validation-plan.md). Progress is recorded in that file.
- **GLOBAL-029** — Acquisition verification tracker.
  - *In this feature:* once the first cluster file lands (Mon 2026-05-26), §8 `FLOW-NNN` blocks in `automated-icp-validation-plan.md` get amended with verbatim cluster labels; the mirrored verification blocks gain new walkthrough steps proving the cluster→`/solve/` auto-suggestion path (open question in this feature). Implementation and verification trackers stay in lockstep per the GLOBAL.
- **GLOBAL-030** — Evidence-grade acquisition tracker edits.
  - *In this feature:* ICP evidence and flow-status updates must name the verification artifact (cron output, deployed-surface walkthrough, env inspection, or code/test check) and keep the implementation tracker plus mirror synced before the PR is considered green.

## Open questions / known unknowns

- **R2 upgrade** — When evidence files exceed KV practical limits, migrate raw storage from KV to `r2://nlqdb-icp-raw/`. Free tier for both; KV is the simpler path for now.
- **IH canonical URL recovery** — SK-ICP-006 stores the `feed.indiehackers.world/post/<slug>` URL which 404s on direct GET; cluster cites title + first 500 chars of `content_html` instead. If §3.6 reply-to-pain needs IH-canonical URLs, parse them from `content_html` (occasionally carries an `indiehackers.com` link); otherwise "good enough" for cluster input.
- **LogSnag threshold alert** — Verdict already surfaces in the evidence markdown + `icp_cluster_completed` log. A channel-bell event on transition into `primary_confirmed` is the natural next slice; embedding in the per-run line for now avoids double-spam.
