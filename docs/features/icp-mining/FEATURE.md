---
name: icp-mining
description: Weekly cron that scrapes HN Algolia, Reddit, GitHub Issues, GitHub Discussions, Stack Overflow, Indie Hackers, Dev.to, Bluesky, and Mastodon for ICP pain signals, scores them per persona via the free LLM chain, clusters them into themes, and writes a monthly evidence file to GitHub.
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

**One-liner:** A Monday 06:00 UTC cron scrapes HN Algolia, Reddit (16 subreddits), GitHub Issues, GitHub Discussions, Stack Overflow, Indie Hackers, Dev.to, Bluesky, and Mastodon; deduplicates via KV; scores 0–10 per persona via Groq → Gemini; clusters into 5–7 themes per persona; writes `docs/research/icp-evidence-<yyyy-mm>.md` to GitHub.
**Status:** implemented (SK-ICP-001 collection; SK-ICP-002 scoring; SK-ICP-003 clustering + evidence file; SK-ICP-004 GitHub Issues; SK-ICP-005 Stack Overflow; SK-ICP-006 Indie Hackers; SK-ICP-007 source-health probe; SK-ICP-008 Dev.to source; SK-ICP-009 GitHub Discussions source; SK-ICP-010 prefilter dropped — LLM relevance floor is the only scoring gate; SK-ICP-011 Reddit app-only OAuth; SK-ICP-012 Bluesky source; SK-ICP-013 Mastodon source).
**Owners (code):** `apps/api/src/icp-scrape.ts`, `apps/api/src/icp-score.ts`, `apps/api/src/icp-cluster.ts`, `apps/api/test/icp-scrape.test.ts`, `apps/api/test/icp-score.test.ts`, `apps/api/test/icp-cluster.test.ts`, `apps/api/wrangler.toml` (cron `0 6 * * 1`).
**Cross-refs:** [`docs/research/automated-icp-validation-plan.md §2`](../../research/automated-icp-validation-plan.md) · [`docs/research/personas.md`](../../research/personas.md) · [`GLOBAL-028`](../../decisions/GLOBAL-028-acquisition-progress-tracker.md) · [`GLOBAL-030`](../../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md).

## Touchpoints — read this feature doc before editing

- `apps/api/src/icp-scrape.ts` — `runIcpScrape(deps)`; calls HN, Reddit, GitHub Issues, GitHub Discussions, Stack Overflow, Indie Hackers, Dev.to, Bluesky, Mastodon
- `apps/api/src/icp-score.ts` — `runIcpScore(items, deps)`; Groq → Gemini scoring
- `apps/api/src/icp-cluster.ts` — `runIcpCluster(deps)`; KV list → LLM cluster → GitHub write
- `apps/api/wrangler.toml` `[triggers].crons` — must stay in sync with `ICP_SCRAPE_CRON` in `index.ts`
- `apps/api/src/env.d.ts` — `LOGSNAG_TOKEN`, `LOGSNAG_PROJECT`, `GH_TOKEN`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` bindings

## Decisions

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-ICP-NNN`. The list below is the index; open the linked file for the full five-field block (Decision / Core value / Why / Consequence / Alternatives). New decisions get a new ID and a new file; existing IDs are sticky.

- [**SK-ICP-001**](decisions/SK-ICP-001-weekly-scrape-to-kv.md) — Weekly Monday cron scrapes every source and writes raw items to KV (deduped 90d).
- [**SK-ICP-002**](decisions/SK-ICP-002-llm-scoring.md) — `runIcpScore` scores each raw item 0–10 per persona via the free chain; `RELEVANCE_FLOOR` discards the rest. (Prefilter clause superseded by SK-ICP-010.)
- [**SK-ICP-003**](decisions/SK-ICP-003-cluster-and-evidence-file.md) — Cluster scored items per persona and write the monthly `icp-evidence-<yyyy-mm>.md` to GitHub.
- [**SK-ICP-004**](decisions/SK-ICP-004-github-issues.md) — GitHub Issues source (`GH_TOKEN`-gated, rolling 7-day `created:>` filter).
- [**SK-ICP-005**](decisions/SK-ICP-005-stack-overflow.md) — Stack Overflow source via Stack Exchange API 2.3 (anon quota 60× budget).
- [**SK-ICP-006**](decisions/SK-ICP-006-indie-hackers.md) — Indie Hackers source via the `feed.indiehackers.world` JSON Feed (client-side 7-day filter).
- [**SK-ICP-007**](decisions/SK-ICP-007-source-health-probe.md) — Agent-runnable source-health probe (FLOW-008 in `scripts/verify-flows.sh`).
- [**SK-ICP-008**](decisions/SK-ICP-008-devto.md) — Dev.to source via the public Forem API (`top=7` server-side recency).
- [**SK-ICP-009**](decisions/SK-ICP-009-github-discussions.md) — GitHub Discussions source via GraphQL — the P2 (agent-builder) long-form signal Issues miss.
- [**SK-ICP-010**](decisions/SK-ICP-010-drop-prefilter.md) — Drop the pain-word regex prefilter; the LLM relevance floor is the only scoring gate. Supersedes the prefilter clause of SK-ICP-002.
- [**SK-ICP-011**](decisions/SK-ICP-011-reddit-oauth.md) — Reddit via app-only OAuth (`client_credentials`, KV-cached token); the anonymous endpoint 403s datacenter bots.
- [**SK-ICP-012**](decisions/SK-ICP-012-bluesky.md) — Bluesky source via the AT Protocol AppView (`api.bsky.app` `searchPosts`, server-side `since`, no auth) — reaches the researcher+practitioner demographic the prior 7 sources under-sample.
- [**SK-ICP-013**](decisions/SK-ICP-013-mastodon.md) — Mastodon source via the public hashtag timeline (`mastodon.social/api/v1/timelines/tag/<tag>`, no auth, federated reach) — the ActivityPub half of the post-2024 X exodus that SK-ICP-012 only covers on the AT Protocol side.

## GLOBALs governing this feature

- **GLOBAL-013** — Free-tier bundle budget.
  - *In this feature:* all nine sources are free public APIs. Stack Exchange anon quota 300/IP/day; cron uses 5/week. Dev.to public API allows ~3 RPS unauthenticated; cron uses 5/week. GitHub GraphQL is 5000 points/hour authenticated; Discussions costs 1 point/query × 5/week. Bluesky `api.bsky.app` AppView is unauthenticated with documented "generous rate-limits"; cron uses 5/week. Mastodon `mastodon.social` public read endpoints document 300 reads / 5 min / IP (`x-ratelimit-remaining`); cron uses 5/week — three orders of magnitude inside the bar. Weekly KV cost (≤ 1k items × 2 writes + ≤ 2 list ops + ~1k reads) sits comfortably inside Workers free-tier ceilings.
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* per-source fetch spans `nlqdb.icp.fetch.{hn,reddit,github,github_discussions,stackoverflow,indiehackers,devto,bluesky,mastodon}` (each with source + item count + status code; GitHub Discussions adds `nlqdb.icp.ghd.rate_remaining`; Stack Exchange adds `nlqdb.icp.se.quota_remaining`; Mastodon splits `nlqdb.icp.items_returned` vs `nlqdb.icp.items_stored` so log-based alerts can distinguish "source dead" from "source returns NSFW-only" — and adds `nlqdb.icp.mastodon.rate_remaining` only when the `x-ratelimit-remaining` header is present); `nlqdb.icp.reddit.token` (SK-ICP-011 app-only OAuth mint, with status code); `nlqdb.icp.score` (provider, batch size, raw count); `nlqdb.icp.cluster` (persona, item count, cluster count, provider); `nlqdb.icp.github_write` (file path, written status).
- **GLOBAL-028** — Acquisition progress tracker.
  - *In this feature:* this cron implements §2.1–§2.4 of [`automated-icp-validation-plan.md`](../../research/automated-icp-validation-plan.md). Progress is recorded in that file.
- **GLOBAL-029** — Acquisition verification tracker.
  - *In this feature:* once the first cluster file lands (Mon 2026-05-26), §8 `FLOW-NNN` blocks in `automated-icp-validation-plan.md` get amended with verbatim cluster labels; the mirrored verification blocks gain new walkthrough steps proving the cluster→`/solve/` auto-suggestion path (open question in this feature). Implementation and verification trackers stay in lockstep per the GLOBAL.
- **GLOBAL-030** — Evidence-grade acquisition tracker edits.
  - *In this feature:* ICP evidence and flow-status updates must name the verification artifact (cron output, deployed-surface walkthrough, env inspection, or code/test check) and keep the implementation tracker plus mirror synced before the PR is considered green.
- **GLOBAL-032** — Top-5 user flows canonical.
  - *In this feature:* this cron's persona-fit rubric (P1 / P2 / P3 / P6 per `icp-score.ts`) is one of the three anchors the GLOBAL cites for naming the canonical-five (the other two: `personas.md` priority + `stranger-test/src/personas.ts` seeded-prompt split). P6 currently has no dedicated FLOW-NNN — it's flagged in the GLOBAL as the natural next gap once engine quality clears.

## Open questions / known unknowns

- **R2 upgrade** — When evidence files exceed KV practical limits, migrate raw storage from KV to `r2://nlqdb-icp-raw/`. Free tier for both; KV is the simpler path for now.
- **IH canonical URL recovery** — SK-ICP-006 stores the `feed.indiehackers.world/post/<slug>` URL which 404s on direct GET; cluster cites title + first 500 chars of `content_html` instead. If §3.6 reply-to-pain needs IH-canonical URLs, parse them from `content_html` (occasionally carries an `indiehackers.com` link); otherwise "good enough" for cluster input.
- **LogSnag threshold alert** — Verdict already surfaces in the evidence markdown + `icp_cluster_completed` log. A channel-bell event on transition into `primary_confirmed` is the natural next slice; embedding in the per-run line for now avoids double-spam.
- **Reddit deliberately disabled (2026-06-03, SK-ICP-011 deferral)** — Reddit stays off for now (manual OAuth-app approval friction per Reddit's Nov-2025 policy); the source self-skips by design until `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` are wired in. Conscious trade-off of the primary P1/P3 vein; revisit when that coverage becomes load-bearing.
- **Source liveness (verify before trusting a harvest)** — **GitHub Issues + Discussions** (`GH_TOKEN`, SK-ICP-004/009) self-skip silently if `GH_TOKEN` is unset in prod; after the next run confirm `icp_scrape_completed.sources` carries non-zero `github` / `github_discussions`. A 2026-05-31 local run also showed **Stack Exchange 403** (likely sandbox IP — re-check from the deployed Worker, register an SE key if it persists).
- **10th-source refactor pin** — the current `Promise.all` + position-coupled destructuring pattern in `runIcpScrape` accreted across SK-ICP-001/004/005/006/008/009/011/012/013 (9 sources). The 10th source triggers the extraction of a `const SOURCES: Source[] = [...]` array of `{name, fetch, gated}` records + a `Map<string, IcpItem[]>` accumulator; ship the refactor in the same PR as the 10th source, not before (P5 — no speculative refactors). Recorded as the next architectural pick in this feature, not a near-term blocker.
