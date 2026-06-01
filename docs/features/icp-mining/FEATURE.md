---
name: icp-mining
description: Weekly cron that scrapes HN Algolia, Reddit, GitHub Issues, GitHub Discussions, Stack Overflow, Indie Hackers, Dev.to, and Bluesky for ICP pain signals, scores them per persona via the free LLM chain, clusters them into themes, and writes a monthly evidence file to GitHub.
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

**One-liner:** A Monday 06:00 UTC cron scrapes HN Algolia, Reddit (16 subreddits), GitHub Issues, GitHub Discussions, Stack Overflow, Indie Hackers, Dev.to, and Bluesky; deduplicates via KV; scores 0–10 per persona via Groq → Gemini; clusters into 5–7 themes per persona; writes `docs/research/icp-evidence-<yyyy-mm>.md` to GitHub.
**Status:** implemented (SK-ICP-001 collection; SK-ICP-002 scoring; SK-ICP-003 clustering + evidence file; SK-ICP-004 GitHub Issues; SK-ICP-005 Stack Overflow; SK-ICP-006 Indie Hackers; SK-ICP-007 source-health probe; SK-ICP-008 Dev.to source; SK-ICP-009 GitHub Discussions source; SK-ICP-010 Bluesky source).
**Owners (code):** `apps/api/src/icp-scrape.ts`, `apps/api/src/icp-score.ts`, `apps/api/src/icp-cluster.ts`, `apps/api/test/icp-scrape.test.ts`, `apps/api/test/icp-score.test.ts`, `apps/api/test/icp-cluster.test.ts`, `apps/api/wrangler.toml` (cron `0 6 * * 1`).
**Cross-refs:** [`docs/research/automated-icp-validation-plan.md §2`](../../research/automated-icp-validation-plan.md) · [`docs/research/personas.md`](../../research/personas.md) · [`GLOBAL-028`](../../decisions/GLOBAL-028-acquisition-progress-tracker.md) · [`GLOBAL-030`](../../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md).

## Touchpoints — read this feature doc before editing

- `apps/api/src/icp-scrape.ts` — `runIcpScrape(deps)`; calls HN, Reddit, GitHub Issues, GitHub Discussions, Stack Overflow, Indie Hackers, Dev.to, Bluesky
- `apps/api/src/icp-score.ts` — `runIcpScore(items, deps)`; Groq → Gemini scoring
- `apps/api/src/icp-cluster.ts` — `runIcpCluster(deps)`; KV list → LLM cluster → GitHub write
- `apps/api/wrangler.toml` `[triggers].crons` — must stay in sync with `ICP_SCRAPE_CRON` in `index.ts`
- `apps/api/src/env.d.ts` — `LOGSNAG_TOKEN`, `LOGSNAG_PROJECT`, `GH_TOKEN` bindings

## Decisions

### SK-ICP-001 — Weekly HN + Reddit scrape writing raw items to KV

- **Decision:** A Cloudflare cron at `0 6 * * 1` (Monday 06:00 UTC) calls `runIcpScrape`, which queries the 8 sources listed in the one-liner for posts from the previous 7 days. Each item deduped via `icp:seen:<source>:<id>` (90d KV TTL); new items written as `icp:item:<YYYYMMDD>:<source>:<id>` (30d KV TTL, JSON). LogSnag `#icp-mining` reports new vs. skipped per source. Per-source `.catch` isolation: one failing source never kills the others.
- **Core value:** Simple, Bullet-proof
- **Why:** Mining public complaints at scale gives the unfiltered language personas use — current persona docs are hypotheses, not evidence. KV storage is free on the Workers tier. Monday after weekend activity maximises signal. 90-day dedup prevents reprocessing while letting long-tail items cycle out.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` is the single owner; `IcpScrapeDeps.fetch` overridable for tests; OTel spans wrap every external fetch (GLOBAL-014). The `scheduled()` handler in `apps/api/src/index.ts` dispatches on `ICP_SCRAPE_CRON` and logs `{ msg: "icp_scrape_completed", newItems, skipped, sources }`. `LOGSNAG_TOKEN` / `LOGSNAG_PROJECT` optional.
- **Alternatives rejected:** Separate Worker (more infra; existing has capacity); R2 (overkill — KV is sufficient); daily cron (weekly is enough for Phase 1; daily burns KV quota on noise).

## GLOBALs governing this feature

- **GLOBAL-013** — Free-tier bundle budget.
  - *In this feature:* all eight sources are free public APIs. Stack Exchange anon quota 300/IP/day; cron uses 5/week. Dev.to public API allows ~3 RPS unauthenticated; cron uses 5/week. GitHub GraphQL is 5000 points/hour authenticated; Discussions costs 1 point/query × 5/week. Bluesky `api.bsky.app` AppView is unauthenticated with documented "generous rate-limits"; cron uses 5/week. Weekly KV cost (≤ 900 items × 2 writes + ≤ 2 list ops + ~900 reads) sits comfortably inside Workers free-tier ceilings.
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* per-source fetch spans `nlqdb.icp.fetch.{hn,reddit,github,github_discussions,stackoverflow,indiehackers,devto,bluesky}` (each with source + item count + status code; GH Discussions adds `nlqdb.icp.ghd.rate_remaining`; SE adds `nlqdb.icp.se.quota_remaining`); `nlqdb.icp.score`; `nlqdb.icp.cluster`; `nlqdb.icp.github_write`.
- **GLOBAL-028** — Acquisition progress tracker.
  - *In this feature:* this cron implements §2.1–§2.4 of [`automated-icp-validation-plan.md`](../../research/automated-icp-validation-plan.md). Progress is recorded in that file.
- **GLOBAL-029** — Acquisition verification tracker.
  - *In this feature:* once the first cluster file lands (Mon 2026-05-26), §8 `FLOW-NNN` blocks in `automated-icp-validation-plan.md` get amended with verbatim cluster labels; the mirrored verification blocks gain new walkthrough steps proving the cluster→`/solve/` auto-suggestion path (open question in this feature). Implementation and verification trackers stay in lockstep per the GLOBAL.
- **GLOBAL-030** — Evidence-grade acquisition tracker edits.
  - *In this feature:* ICP evidence and flow-status updates must name the verification artifact (cron output, deployed-surface walkthrough, env inspection, or code/test check) and keep the implementation tracker plus mirror synced before the PR is considered green.

### SK-ICP-002 — LLM scoring of raw items immediately after each weekly scrape

- **Decision:** After `runIcpScrape` collects new items, `runIcpScore` (same cron run) regex-prefilters on pain words, then calls Groq `llama-3.1-8b-instant` (Gemini `gemini-2.5-flash` fallback) in batches of 20 to score each item 0–10 against P1/P2/P3/P6. Items where every persona scores < 5 are discarded; the rest stored as `icp:scored:<YYYYMMDD>:<source>:<id>` (30d KV TTL). `.catch`-wrapped so a total LLM failure logs and returns cleanly.
- **Core value:** Simple, Bullet-proof
- **Why:** Raw items in KV are not evidence. Scoring on the same Monday run transforms the weekly harvest into a ranked, persona-tagged set SK-ICP-003 reads directly — no separate data-pull cron needed.
- **Consequence in code:** `apps/api/src/icp-score.ts` is the single owner. `IcpScrapeResult.items` carries the new items for handoff. `runIcpScore` wraps each batch in an `nlqdb.icp.score` span. No new env bindings.
- **Alternatives rejected:** Separate scoring cron (needs coordination state — co-run is simpler); D1 storage (migration overhead; KV TTL is sufficient).

### SK-ICP-003 — Cluster scored items per persona and write monthly evidence file to GitHub

- **Decision:** After each weekly scrape+score, `runIcpCluster` lists all `icp:scored:*` KV keys (paginated, full 30-day TTL), groups by highest-scoring persona (top-100 each), calls Groq → Gemini to cluster into 5–7 themes per persona, applies the §2.4 rule for `primary_confirmed` / `directional` / `no_signal`, and writes `docs/research/icp-evidence-<yyyy-mm>.md` via GitHub Contents API `PUT` (SHA-aware). LLM-claimed `cluster.count` clamped to actual group size. All external calls use `BOT_USER_AGENT` + 15s timeout. LLM or GitHub failure returns `written: false` without killing the cron.
- **Core value:** Simple, Bullet-proof
- **Why:** Scored items in KV are not actionable. The evidence file is the §2.4 ICP-decision deliverable; surfacing the verdict in-file removes the manual check. Direct Contents write keeps the cron self-contained (no git clone, no CI step). KV `list` is free on Workers.
- **Consequence in code:** `apps/api/src/icp-cluster.ts` is the single owner; gated on `GH_TOKEN`. `IcpClusterResult.{primaryStatus, primaryIcp}` exposed to logs + LogSnag. Span `nlqdb.icp.cluster` per persona.
- **Alternatives rejected:** Separate cron (more entry points); D1 storage (migration overhead); branch + PR write (over-engineered for a data file); trusting LLM `count` (clamping is cheap).

### SK-ICP-004 — GitHub Issues as an additional pain-signal source

- **Decision:** When `GH_TOKEN` is set, `runIcpScrape` queries `/search/issues` for 5 NL-to-SQL / agent-memory pain queries with a rolling `created:>${isoDate(sevenDaysAgoUnix)}` filter (10 results each). Stored as `source: "github"`, `id: "gh-<issue.id>"`. Unparseable `created_at` dropped. `BOT_USER_AGENT` required (GH REST 403s no-UA). 10s timeout, `incomplete_results: true` logged. Per-query errors caught.
- **Core value:** Simple, Bullet-proof
- **Why:** GH issues are intentional, well-described bug/feature requests from actual practitioners — higher signal than casual social posts. Authenticated GH Search allows 30 RPM, ≫ 5/week budget.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchGitHubIssues`; `IcpScrapeDeps.ghToken` drives GitHub calls. Reddit calls gained `restrict_sr=on`; HN/Reddit/GH all gained a 10s `AbortSignal.timeout`.
- **Alternatives rejected:** Separate GH scraper (unnecessary); unauthenticated GH API (60 RPM; no benefit when token available).

### SK-ICP-005 — Stack Overflow as an additional pain-signal source

- **Decision:** `runIcpScrape` queries Stack Exchange API 2.3 `/search/advanced` (`site=stackoverflow`) for 5 tag+query pairs (P1/P3/P4/P6: `postgresql/setup`, `sqlalchemy/verbose`, `sql/natural language`, `prisma/migration`, `duckdb;clickhouse`), `sort=creation`, `pagesize=10`, 7-day `fromdate`. Stored as `source: "stackoverflow"`, `id: "so-<question_id>"`. Anon quota 300/IP/day = 60× weekly budget; `backoff` surfaces as `icp_se_backoff`.
- **Core value:** Simple, Bullet-proof
- **Why:** Stack Overflow is the densest public surface for "I'm trying X with SQL/Postgres/ORM and it isn't working" — P1 setup, P3 stuck queries, P4 ORM verbosity, P6 operational SQL.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchStackExchange` and a 4th `Promise.all` element. Span `nlqdb.icp.fetch.stackoverflow` carries `nlqdb.icp.se.quota_remaining`; LogSnag reports `SO: <n>`.
- **Alternatives rejected:** Stack Apps key (anon already 60× budget); `/search` (no `tagged`/`fromdate`); per-tag `/questions` polling (burns quota per page).

### SK-ICP-006 — Indie Hackers as an additional pain-signal source

- **Decision:** `runIcpScrape` queries the unofficial `feed.indiehackers.world` JSON Feed for 5 P1-pain queries (`database`, `boilerplate`, `side+project`, `first+paying`, `stack`). Stored as `source: "indiehackers"`, `id: <slug>` from `/post/<slug>`. Posts with non-matching URL or unparseable `date_modified` are dropped; 7-day window is enforced client-side. 10s timeout, per-source isolation.
- **Core value:** Simple, Bullet-proof
- **Why:** IH was listed in §2.1 day one but never shipped. Posts are launch-context complaints by definition — gives the cluster step language other sources don't reach. Live probe 2026-05-23: ≈10 new items/week.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchIndieHackers` and a 5th `Promise.all` element. Span `nlqdb.icp.fetch.indiehackers`; LogSnag reports `IH: <n>`.
- **Alternatives rejected:** `indiehackers.com` direct (CF bot challenge); Apify ($/run); HTML scrape (brittle); `ihrss.io` (RSS only); IH-canonical resolution (`/post/<slug>` 404s direct — title + `content_html` carry the evidence trail).

### SK-ICP-007 — Agent-runnable source-health probe in `scripts/verify-flows.sh`

- **Decision:** `scripts/verify-flows.sh` ships a FLOW-008 block probing the cron's upstreams; each asserts HTTP 200 + a contract-key (`hits` / `total_count` / `discussionCount` / `quota_remaining` / `items` / top-level array for Dev.to / `posts` for Bluesky). HN, IH, Dev.to, Bluesky fatal; GH (Issues + Discussions) fatal-when-`GH_TOKEN`-set, else skipped together; Reddit + SO degrade to advisory on `x-block-reason: hostname_blocked` (sandbox-egress proxy 403; CF-egress Worker is canonical). Any other non-200 fails. Per-probe cap 15s.
- **Core value:** Simple, Bullet-proof
- **Why:** A silent upstream schema/endpoint change only surfaces after the cron's LogSnag count drops to zero — days late. An agent-runnable probe makes the failure observable in < 3 s with zero new credentials and closes the data-side analogue of the §1.1 stranger-test gap.
- **Consequence in code:** `scripts/verify-flows.sh` exposes one `fetch_json` helper (severity- and `x-block-reason`-aware) reused by every flow block. Adding a new ICP source extends `apps/api/src/icp-scrape.ts` AND appends a `fetch_json` probe in FLOW-008 AND extends sub-tasks in [`§8 FLOW-008`](../../research/automated-icp-validation-plan.md) — drift is the regression the probe prevents.
- **Alternatives rejected:** GH Actions cron polling (founder-notification channel); Worker `/v1/health` (CF egress can't simulate agent-VM view); failing on Reddit/SO 403 (false-positive every run); marking every source advisory (collapses regression detector).

### SK-ICP-008 — Dev.to as the 6th pain-signal source via the public Forem API

- **Decision:** `runIcpScrape` queries `https://dev.to/api/articles?tag=<tag>&per_page=15&top=7` for 5 tags covering P1/P3/P4/P6 (`database`, `sql`, `postgres`, `webdev`, `orm`); `top=7` is the server-side 7-day filter. Stored as `source: "devto"`, `id: "devto-<article.id>"`; unparseable `published_timestamp` is dropped pre-write. `BOT_USER_AGENT` + 10s timeout; per-tag error isolation. Live probe 2026-05-25: every tag returns ≥4 fresh articles within the window.
- **Core value:** Simple, Bullet-proof
- **Why:** Dev.to is the largest indie developer-blogging surface; the prior 5-source mix under-sampled first-person long-form complaints (HN/Reddit skew short, GH issues skew bug-report, IH skews launch-context). Forem API is first-class public read ([`developers.forem.com`](https://developers.forem.com/api/v1)) — no auth, server-side recency, robots.txt explicitly allows `/api/*`. `top=7` is sharper than IH's client-side filter.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchDevto` and a 6th `Promise.all` element. Span `nlqdb.icp.fetch.devto`. LogSnag reports `DEV: <n>`. `verify-flows.sh` FLOW-008 gains a probe. No env binding.
- **Alternatives rejected:** Lobste.rs `/t/<tag>.json` (robots.txt `Disallow: /` + `Content-Signal: ai-input=no`); Dev.to `/search` (robots.txt disallows `/search?q=*`); per-article body fetch (description is enough); `dev.to/feed` RSS (no tag scoping).

### SK-ICP-009 — GitHub Discussions as the 7th pain-signal source via GraphQL

- **Decision:** When `GH_TOKEN` is set, `runIcpScrape` POSTs `api.github.com/graphql` with `search(query: $q, type: DISCUSSION, first: 10)` for 5 P1/P2/P4/P6 queries (`text to sql`, `natural language database`, `agent memory store`, `prisma migration`, `supabase setup`), with the same `created:>${isoDate(sevenDaysAgoUnix)}` filter SK-ICP-004 uses. Stored as `source: "github_discussions"`, `id: "ghd-<node.id>"`. Unparseable `createdAt` is dropped; a GraphQL `errors` body is a soft failure. Shares `BOT_USER_AGENT`, `FETCH_TIMEOUT_MS` (10s), `runSpan`. Live probe 2026-05-31: `discussionCount=8478` for "text to sql"; `created:>2026-05-24` returns 9 fresh discussions incl. `moorcheh-ai/memanto/discussions/564 — "How are you handling persistent memory in your CrewAI workflows?"` (P2 quote prior sources never caught). `rateLimit.cost=1` × 5/week against 5000-pt/hr.
- **Core value:** Simple, Bullet-proof
- **Why:** Discussions are where Supabase/Drizzle/Prisma/CrewAI/LangChain/Vercel route "I'm stuck on X" Q&A; Issues only catches the bug-report subset. The prior 6-source mix under-sampled **P2 (agent builder)** — CrewAI/LangChain/Mem0/vector-DB Discussions are the long-form P2 signal the cluster step needs. `GH_TOKEN`'s existing `public_repo` scope authorises GraphQL `DISCUSSION` (no new scope).
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchGitHubDiscussions` and a 7th `Promise.all` element (gated on `deps.ghToken`). Span `nlqdb.icp.fetch.github_discussions` carries source + item count + status code + `nlqdb.icp.ghd.rate_remaining`. LogSnag adds `GHD: <n>`. `verify-flows.sh` FLOW-008 gains a `POST /graphql` probe asserting `"discussionCount"`.
- **Alternatives rejected:** REST `/repos/{owner}/{repo}/discussions` (no global search); REST Search (no `type:discussion` — GraphQL-only as of 2026-05); a separate `GHD_TOKEN` (`public_repo` already covers DISCUSSION); fetching comments (`node.body` is enough).

### SK-ICP-010 — Bluesky as the 8th pain-signal source via the AT Protocol AppView

- **Decision:** `runIcpScrape` adds an 8th `Promise.all` element calling `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=<q>&limit=25&sort=latest&since=<isoSeven>` for 5 P1/P2/P3 queries (`text to sql`, `agent memory`, `natural language database`, `vector database`, `rag pipeline`). Stored as `source: "bluesky"`, `id: "bsky-<post.cid>"`; `title` is the first 80 chars of `record.text`; `url` is rebuilt as `https://bsky.app/profile/<author.handle>/post/<rkey>` where `rkey` is parsed from the `at://.../app.bsky.feed.post/<rkey>` URI. Posts with unparseable `record.createdAt`, missing handle/rkey/cid, non-`app.bsky.feed.post` URIs, or empty text are dropped pre-write. Shared `BOT_USER_AGENT`, `FETCH_TIMEOUT_MS` (10s), `runSpan`, per-source `.catch`. No auth, no env binding. Live probe 2026-06-01: 5 fresh posts for `text to sql` in the past 7 days incl. *"My SQL bot dies after two questions! Did you read the JP Morgan study?"* (P2 quote prior 7 sources never caught); 10/10/10 for `agent memory` / `vector database` / `rag pipeline`.
- **Core value:** Simple, Bullet-proof
- **Why:** Bluesky reaches a researcher+practitioner demographic (post-2024 X exodus) the prior 7 sources under-sample — paper-launch posts, multi-turn-agent-memory threads, "I'm stuck on X" composes that never make it to HN/Reddit. AT Protocol AppView `api.bsky.app` is unauthenticated public read with `sort=latest` + `since=<isoSeven>` (server-side 7-day filter — sharper than IH's client-side window). `robots.txt` is `Allow: /`; AppView rate-limits documented as "generous"; cron uses 5 calls/week. `public.api.bsky.app` 403s from cloud-egress IPs (Bunny-CDN block, 2026-06-01); `api.bsky.app` is the canonical Express AppView without that block.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchBluesky` + `bskyRkeyFromUri` and an 8th `Promise.all` element. Span `nlqdb.icp.fetch.bluesky` carries source + item count + status code. LogSnag adds `BSKY: <n>`. `verify-flows.sh` FLOW-008 gains a `searchPosts` probe asserting HTTP 200 + `"posts"` key. Tests pin the `q`+`sort=latest`+`since=` URL contract, URL rebuild from `at://` URI, unparseable-`createdAt` drop, non-`app.bsky.feed.post` URI drop, and 503 graceful.
- **Alternatives rejected:** `public.api.bsky.app` (Bunny-CDN 403s cloud-egress IPs); `com.atproto.identity.resolveHandle` enrichment (handle already in `searchPosts` response); Mastodon hashtag search (federation makes per-instance probes brittle); X/Twitter (no free post-2023, §2.1 explicit skip).

## Open questions / known unknowns

- **R2 upgrade** — When evidence files exceed KV practical limits, migrate raw storage to `r2://nlqdb-icp-raw/`. Free tier for both; KV is simpler today.
- **IH canonical URL recovery** — SK-ICP-006 stores the mirror URL which 404s on direct GET; cluster cites title + first 500 chars of `content_html` instead. Parse `indiehackers.com` URLs from `content_html` only if §3.6 reply-to-pain ships.
- **LogSnag threshold alert** — Verdict surfaces in the evidence markdown + `icp_cluster_completed` log. A channel-bell event on transition into `primary_confirmed` is the natural next slice.
