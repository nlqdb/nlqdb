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

**One-liner:** A Monday 06:00 UTC cron scrapes HN Algolia, Reddit (16 subreddits), GitHub Issues, GitHub Discussions, Stack Overflow, Indie Hackers, and Dev.to; deduplicates via KV; scores 0–10 per persona via Groq → Gemini; clusters into 5–7 themes per persona; writes `docs/research/icp-evidence-<yyyy-mm>.md` to GitHub.
**Status:** implemented (SK-ICP-001 collection; SK-ICP-002 scoring; SK-ICP-003 clustering + evidence file; SK-ICP-004 GitHub Issues; SK-ICP-005 Stack Overflow; SK-ICP-006 Indie Hackers; SK-ICP-007 source-health probe; SK-ICP-008 Dev.to source; SK-ICP-009 GitHub Discussions source; SK-ICP-010 prefilter dropped — LLM relevance floor is the only scoring gate; SK-ICP-011 Reddit app-only OAuth).
**Owners (code):** `apps/api/src/icp-scrape.ts`, `apps/api/src/icp-score.ts`, `apps/api/src/icp-cluster.ts`, `apps/api/test/icp-scrape.test.ts`, `apps/api/test/icp-score.test.ts`, `apps/api/test/icp-cluster.test.ts`, `apps/api/wrangler.toml` (cron `0 6 * * 1`).
**Cross-refs:** [`docs/research/automated-icp-validation-plan.md §2`](../../research/automated-icp-validation-plan.md) · [`docs/research/personas.md`](../../research/personas.md) · [`GLOBAL-028`](../../decisions/GLOBAL-028-acquisition-progress-tracker.md) · [`GLOBAL-030`](../../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md).

## Touchpoints — read this feature doc before editing

- `apps/api/src/icp-scrape.ts` — `runIcpScrape(deps)`; calls HN, Reddit, GitHub Issues, GitHub Discussions, Stack Overflow, Indie Hackers, Dev.to
- `apps/api/src/icp-score.ts` — `runIcpScore(items, deps)`; Groq → Gemini scoring
- `apps/api/src/icp-cluster.ts` — `runIcpCluster(deps)`; KV list → LLM cluster → GitHub write
- `apps/api/wrangler.toml` `[triggers].crons` — must stay in sync with `ICP_SCRAPE_CRON` in `index.ts`
- `apps/api/src/env.d.ts` — `LOGSNAG_TOKEN`, `LOGSNAG_PROJECT`, `GH_TOKEN` bindings

## Decisions

### SK-ICP-001 — Weekly HN + Reddit scrape writing raw items to KV

- **Decision:** A Cloudflare cron at `0 6 * * 1` (Monday 06:00 UTC) calls `runIcpScrape`, which queries HN Algolia (10 pain-keyword searches), Reddit (16 subreddit/query pairs), GitHub Issues (5 queries; `GH_TOKEN`-gated; rolling `created:>` 7-day filter), GitHub Discussions (5 queries via GraphQL; same gate + filter), Stack Overflow (5 tag+query pairs via SE API 2.3), Indie Hackers (5 P1-pain queries via `feed.indiehackers.world`), and Dev.to (5 tag queries via Forem API) for posts from the previous 7 days. Each item deduped via `icp:seen:<source>:<id>` (90d KV TTL); new items written as `icp:item:<YYYYMMDD>:<source>:<id>` (30d KV TTL, JSON). LogSnag `#icp-mining` reports new vs. skipped per source. Per-source `.catch` isolation: one failing source never kills the others.
- **Core value:** Simple, Bullet-proof
- **Why:** Mining public complaints at scale gives the unfiltered language personas use — current persona docs are hypotheses, not evidence. KV storage is free on the Workers tier. Monday after weekend activity maximises signal. 90-day dedup prevents reprocessing while letting long-tail items cycle out.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` is the single owner; `IcpScrapeDeps.fetch` overridable for tests; OTel spans wrap every external fetch (GLOBAL-014). The `scheduled()` handler in `apps/api/src/index.ts` dispatches on `ICP_SCRAPE_CRON` and logs `{ msg: "icp_scrape_completed", newItems, skipped, sources }`. `LOGSNAG_TOKEN` / `LOGSNAG_PROJECT` optional; skipped silently when absent.
- **Alternatives rejected:** Separate Worker (more infra; existing has capacity); R2 (overkill — KV is sufficient; see Open questions); daily cron (weekly is enough for Phase 1; daily burns KV quota on noise).

## GLOBALs governing this feature

- **GLOBAL-013** — Free-tier bundle budget.
  - *In this feature:* all seven sources are free public APIs. Stack Exchange anon quota 300/IP/day; cron uses 5/week. Dev.to public API allows ~3 RPS unauthenticated; cron uses 5 sequential calls/week. GitHub GraphQL primary-rate-limit is 5000 points/hour authenticated; the Discussions search costs 1 point/query × 5/week. Weekly KV cost (≤ 775 items × 2 writes + ≤ 2 list ops + ~775 reads) sits comfortably inside Workers free-tier ceilings.
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* per-source fetch spans `nlqdb.icp.fetch.{hn,reddit,github,github_discussions,stackoverflow,indiehackers,devto}` (each with source + item count + status code; GitHub Discussions adds `nlqdb.icp.ghd.rate_remaining`; Stack Exchange adds `nlqdb.icp.se.quota_remaining`); `nlqdb.icp.reddit.token` (SK-ICP-011 app-only OAuth mint, with status code); `nlqdb.icp.score` (provider, batch size, raw count); `nlqdb.icp.cluster` (persona, item count, cluster count, provider); `nlqdb.icp.github_write` (file path, written status).
- **GLOBAL-028** — Acquisition progress tracker.
  - *In this feature:* this cron implements §2.1–§2.4 of [`automated-icp-validation-plan.md`](../../research/automated-icp-validation-plan.md). Progress is recorded in that file.
- **GLOBAL-029** — Acquisition verification tracker.
  - *In this feature:* once the first cluster file lands (Mon 2026-05-26), §8 `FLOW-NNN` blocks in `automated-icp-validation-plan.md` get amended with verbatim cluster labels; the mirrored verification blocks gain new walkthrough steps proving the cluster→`/solve/` auto-suggestion path (open question in this feature). Implementation and verification trackers stay in lockstep per the GLOBAL.
- **GLOBAL-030** — Evidence-grade acquisition tracker edits.
  - *In this feature:* ICP evidence and flow-status updates must name the verification artifact (cron output, deployed-surface walkthrough, env inspection, or code/test check) and keep the implementation tracker plus mirror synced before the PR is considered green.

### SK-ICP-002 — LLM scoring of raw items immediately after each weekly scrape

- **Decision:** After `runIcpScrape` collects new items, `runIcpScore` (same cron run) ~~regex-prefilters on pain words, then~~ calls Groq `llama-3.1-8b-instant` (Gemini `gemini-2.5-flash` fallback) in batches of 20 to score each item 0–10 against P1/P2/P3/P6. Items where every persona scores < 5 are discarded; the rest stored as `icp:scored:<YYYYMMDD>:<source>:<id>` (30d KV TTL). The scorer is `.catch`-wrapped in `index.ts` so a total LLM failure still logs and returns cleanly. **(Prefilter clause superseded by SK-ICP-010.)**
- **Core value:** Simple, Bullet-proof
- **Why:** Raw items in KV are not evidence. Scoring on the same Monday run transforms the weekly harvest into a ranked, persona-tagged set that SK-ICP-003 can read directly — no separate data-pull cron needed.
- **Consequence in code:** `apps/api/src/icp-score.ts` is the single owner. `IcpItem` exported from `icp-scrape.ts`. `IcpScrapeResult.items` carries the new items for handoff. `runIcpScore` wraps each batch in an `nlqdb.icp.score` span with `provider`, `batch_size`, `raw_count`. No new env bindings.
- **Alternatives rejected:** Separate scoring cron (needs coordination state for "which items are unscored" — co-run is simpler); D1 storage (migration overhead for a Phase-1 experiment; KV TTL is sufficient).

### SK-ICP-003 — Cluster scored items per persona and write monthly evidence file to GitHub

- **Decision:** After each weekly scrape+score, `runIcpCluster` lists all `icp:scored:*` KV keys (paginated, full 30-day TTL), groups by highest-scoring persona (top-100 each), calls Groq → Gemini to cluster into 5–7 themes per persona, applies the §2.4 rule for `primary_confirmed` / `directional` / `no_signal`, and writes `docs/research/icp-evidence-<yyyy-mm>.md` via GitHub Contents API `PUT` (SHA-aware). LLM-claimed `cluster.count` clamped to actual group size. All external calls: `User-Agent: nlqdb-icp-bot` + `AbortSignal.timeout(15s)`. Non-fatal: LLM or GitHub failure returns `written: false` without killing the cron.
- **Core value:** Simple, Bullet-proof
- **Why:** Scored items in KV are not actionable. The evidence file is the §2.4 ICP-decision deliverable; surfacing the verdict in-file removes the manual check. Direct Contents write keeps the cron self-contained (no git clone, no CI step). KV `list` is free on Workers (1k ops/day; this uses ≤2/week).
- **Consequence in code:** `apps/api/src/icp-cluster.ts` is the single owner; gated on `GH_TOKEN` in `index.ts`. `IcpClusterResult.{primaryStatus, primaryIcp}` exposed to logs + LogSnag. Span `nlqdb.icp.cluster` per persona with `persona`, `item_count`, `cluster.count`, `cluster.provider`. No new env binding.
- **Alternatives rejected:** Separate cron (more entry points, a second KV list op); D1 storage (migration overhead); branch + PR write (over-engineered for a data file); trusting LLM `count` (clamping is cheap).

### SK-ICP-004 — GitHub Issues as an additional pain-signal source

- **Decision:** When `GH_TOKEN` is set, `runIcpScrape` queries `/search/issues` for 5 NL-to-SQL / agent-memory pain queries with a rolling `created:>${isoDate(sevenDaysAgoUnix)}` filter (10 results each). Stored as `source: "github"`, `id: "gh-<issue.id>"`. Unparseable `created_at` dropped. `BOT_USER_AGENT` required (GH REST 403s no-UA). 10s timeout, `incomplete_results: true` logged. Per-query errors caught.
- **Core value:** Simple, Bullet-proof
- **Why:** GH issues are intentional, well-described bug/feature requests from actual practitioners — higher signal than casual social posts. Authenticated GH Search allows 30 RPM, ≫ 5/week budget.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchGitHubIssues`; `IcpScrapeDeps.ghToken` drives GitHub calls. Reddit calls gained `restrict_sr=on`; HN/Reddit/GH all gained a 10s `AbortSignal.timeout`.
- **Alternatives rejected:** Separate GH scraper (unnecessary); unauthenticated GH API (60 RPM; no benefit when token available).

### SK-ICP-005 — Stack Overflow as an additional pain-signal source

- **Decision:** `runIcpScrape` queries Stack Exchange API 2.3 `/search/advanced` (`site=stackoverflow`) for 5 tag+query pairs (P1/P3/P4/P6: `postgresql/setup`, `sqlalchemy/verbose`, `sql/natural language`, `prisma/migration`, `duckdb;clickhouse`), `sort=creation`, `pagesize=10`, 7-day `fromdate`. Stored as `source: "stackoverflow"`, `id: "so-<question_id>"`. Anon (quota 300/IP/day = 60× weekly budget); `backoff` surfaces as `icp_se_backoff`; per-query errors caught.
- **Core value:** Simple, Bullet-proof
- **Why:** Stack Overflow is the highest-density public surface for "I'm trying X with SQL/Postgres/ORM and it isn't working" — P1 setup, P3 stuck queries, P4 ORM verbosity, P6 operational SQL. Listed in §2.1 day one but never shipped.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchStackExchange` and a 4th `Promise.all` element; OTel span `nlqdb.icp.fetch.stackoverflow` carries `nlqdb.icp.se.quota_remaining`; LogSnag reports `SO: <n>`.
- **Alternatives rejected:** Stack Apps key (anon already 60× budget); `/search` (no `tagged`/`fromdate`); polling `/questions` per-tag (burns quota per page).

### SK-ICP-006 — Indie Hackers as an additional pain-signal source

- **Decision:** `runIcpScrape` queries the unofficial `feed.indiehackers.world` JSON Feed for 5 P1-pain queries (`database`, `boilerplate`, `side+project`, `first+paying`, `stack`). Stored as `source: "indiehackers"`, `id: <slug>` from `/post/<slug>`; posts with non-matching URL or unparseable `date_modified` are dropped. Mirror has no server-side date filter; 7-day enforced client-side. 10-second timeout, per-source isolation.
- **Core value:** Simple, Bullet-proof
- **Why:** IH was listed in §2.1 day one but never shipped. Posts are launch-context complaints by definition — gives the cluster step language other sources don't reach. Live probe 2026-05-23: ≈10 new items/week.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchIndieHackers` and a 5th `Promise.all` element; OTel span `nlqdb.icp.fetch.indiehackers`; LogSnag reports `IH: <n>`. No new env binding.
- **Alternatives rejected:** `indiehackers.com` direct (CF bot challenge); Apify ($/run); HTML scrape (brittle); `ihrss.io` (RSS only); IH-canonical resolution (`/post/<slug>` 404s direct — title + `content_html` carry the evidence trail).

### SK-ICP-007 — Agent-runnable source-health probe in `scripts/verify-flows.sh`

- **Decision:** `scripts/verify-flows.sh` ships a FLOW-008 block probing the cron's upstreams; each asserts HTTP 200 + a contract-key (`hits` / `total_count` / `discussionCount` / `quota_remaining` / `items` / top-level array for Dev.to). HN, IH, Dev.to fatal; GH (Issues + Discussions) fatal-when-`GH_TOKEN`-set, else skipped together; Reddit and SO degrade to advisory on `x-block-reason: hostname_blocked` (sandbox-egress proxy 403; CF-egress Worker is canonical). Any other non-200 fails. Per-probe cap 15s.
- **Core value:** Simple, Bullet-proof
- **Why:** A silent upstream schema/endpoint change only surfaces after the cron's LogSnag count drops to zero — days late. An agent-runnable probe makes the failure observable in < 3 s with zero new credentials and closes the data-side analogue of the §1.1 stranger-test gap.
- **Consequence in code:** `scripts/verify-flows.sh` exposes one `fetch_json` helper (severity- and `x-block-reason`-aware) reused by every flow block. Adding a new ICP source extends `apps/api/src/icp-scrape.ts` AND appends a `fetch_json` probe in FLOW-008 AND extends sub-tasks in [`§8 FLOW-008`](../../research/automated-icp-validation-plan.md) — drift is the regression the probe prevents.
- **Alternatives rejected:** GH Actions cron polling (founder-notification channel); Worker `/v1/health` (CF egress can't simulate agent-VM view); failing on Reddit/SO 403 (false-positive every run); marking every source advisory (collapses regression detector).

### SK-ICP-008 — Dev.to as the 6th pain-signal source via the public Forem API

- **Decision:** `runIcpScrape` queries `https://dev.to/api/articles?tag=<tag>&per_page=15&top=7` for 5 tags covering P1/P3/P4/P6 (`database`, `sql`, `postgres`, `webdev`, `orm`); `top=7` is the server-side 7-day filter. Stored as `source: "devto"`, `id: "devto-<article.id>"`; unparseable `published_timestamp` is dropped before KV write. `User-Agent: nlqdb-icp-bot` + `AbortSignal.timeout(10s)`; per-tag error isolation. Live probe 2026-05-25: every tag returns ≥4 fresh articles within the window.
- **Core value:** Simple, Bullet-proof
- **Why:** Dev.to is the largest indie developer-blogging surface; the prior 5-source mix under-samples first-person long-form complaints (HN/Reddit comments skew short, GH issues skew bug-report, IH posts skew launch-context). The Forem API is first-class public read ([`developers.forem.com`](https://developers.forem.com/api/v1)) — no auth, server-side recency, robots.txt explicitly allows `/api/*`. `top=7` is sharper than IH's client-side filter.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchDevto` and a 6th `Promise.all` element. OTel span `nlqdb.icp.fetch.devto` carries `nlqdb.icp.items` and `http.response.status_code`. LogSnag reports `DEV: <n>`. `scripts/verify-flows.sh` gains a `FLOW-008 source Dev.to` probe (fatal severity; Dev.to is Heroku + CF CDN, no egress-block surface). No env binding.
- **Alternatives rejected:** Lobste.rs `/t/<tag>.json` (robots.txt `User-agent: * Disallow: /` + `Content-Signal: ai-input=no`); Dev.to `/search` (robots.txt disallows `/search?q=*`); per-article body fetch (description is enough for cluster input; bodies burn quota); client-side date filter (`top=7` is sharper); `dev.to/feed` RSS (no tag scoping).

### SK-ICP-009 — GitHub Discussions as the 7th pain-signal source via GraphQL

**Body:** [`decisions/SK-ICP-009-github-discussions.md`](./decisions/SK-ICP-009-github-discussions.md).
When `GH_TOKEN` is set, `runIcpScrape` POSTs `api.github.com/graphql`
`search(type: DISCUSSION)` for 5 queries with the SK-ICP-004 `created:>` filter; stored as
`source: "github_discussions"`, `id: "ghd-<node.id>"`, soft-failing isolated from the other
6 sources. Targets the **P2 (agent builder)** long-form signal Issues miss (CrewAI/LangChain/Mem0).

### SK-ICP-010 — Drop the pain-word regex prefilter; LLM relevance floor is the only gate

**Body:** [`decisions/SK-ICP-010-drop-prefilter.md`](./decisions/SK-ICP-010-drop-prefilter.md).
Every scraped item now goes to the LLM scorer (`RELEVANCE_FLOOR = 5` is the only gate);
supersedes the prefilter clause of SK-ICP-002. The old `title + text` regex was title-only
in practice and discarded almost everything — why the 2026-05 file held one item.

### SK-ICP-011 — Reddit via app-only OAuth (`client_credentials`), KV-cached token

**Body:** [`decisions/SK-ICP-011-reddit-oauth.md`](./decisions/SK-ICP-011-reddit-oauth.md).
The anonymous Reddit endpoint returned **403 on all 16 queries** (2026-05-31 live run) —
datacenter-IP bot blocking. Reddit now mints an app-only `client_credentials` token
(`REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`, KV-cached at `icp:reddit:token`) and searches
via `oauth.reddit.com`; absent creds → source self-skips, gated like the `GH_TOKEN` sources.

## Open questions / known unknowns

- **R2 upgrade** — When evidence files exceed KV practical limits, migrate raw storage from KV to `r2://nlqdb-icp-raw/`. Free tier for both; KV is the simpler path for now.
- **IH canonical URL recovery** — SK-ICP-006 stores the `feed.indiehackers.world/post/<slug>` URL which 404s on direct GET; cluster cites title + first 500 chars of `content_html` instead. If §3.6 reply-to-pain needs IH-canonical URLs, parse them from `content_html` (occasionally carries an `indiehackers.com` link); otherwise "good enough" for cluster input.
- **LogSnag threshold alert** — Verdict already surfaces in the evidence markdown + `icp_cluster_completed` log. A channel-bell event on transition into `primary_confirmed` is the natural next slice; embedding in the per-run line for now avoids double-spam.
- **Source liveness (verify before trusting a harvest)** — credential-gated sources self-skip silently if their secrets are unset in prod: **Reddit** (`REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`, SK-ICP-011) and **GitHub Issues + Discussions** (`GH_TOKEN`, SK-ICP-004/009). After the next run, confirm `icp_scrape_completed.sources` carries non-zero `reddit` / `github` / `github_discussions`; a 2026-05-31 local run also showed **Stack Exchange 403** (likely sandbox IP — re-check from the deployed Worker, register an SE key if it persists).
