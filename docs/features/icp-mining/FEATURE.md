---
name: icp-mining
description: Weekly cron that scrapes HN Algolia, Reddit, GitHub Issues, Stack Overflow, and Indie Hackers for ICP pain signals, scores them per persona via the free LLM chain, clusters them into themes, and writes a monthly evidence file to GitHub.
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

**One-liner:** A Monday 06:00 UTC cron scrapes HN Algolia, Reddit (16 subreddits), GitHub Issues, Stack Overflow, Indie Hackers, and Dev.to; deduplicates via KV; scores 0–10 per persona via Groq → Gemini; clusters into 5–7 themes per persona; writes `docs/research/icp-evidence-<yyyy-mm>.md` to GitHub.
**Status:** implemented (SK-ICP-001 collection; SK-ICP-002 scoring; SK-ICP-003 clustering + evidence file; SK-ICP-004 GitHub Issues; SK-ICP-005 Stack Overflow; SK-ICP-006 Indie Hackers; SK-ICP-007 source-health probe; SK-ICP-008 Dev.to source).
**Owners (code):** `apps/api/src/icp-scrape.ts`, `apps/api/src/icp-score.ts`, `apps/api/src/icp-cluster.ts`, `apps/api/test/icp-scrape.test.ts`, `apps/api/test/icp-score.test.ts`, `apps/api/test/icp-cluster.test.ts`, `apps/api/wrangler.toml` (cron `0 6 * * 1`).
**Cross-refs:** [`docs/research/automated-icp-validation-plan.md §2`](../../research/automated-icp-validation-plan.md) · [`docs/research/personas.md`](../../research/personas.md) · [`GLOBAL-028`](../../decisions/GLOBAL-028-acquisition-progress-tracker.md) · [`GLOBAL-030`](../../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md).

## Touchpoints — read this feature doc before editing

- `apps/api/src/icp-scrape.ts` — `runIcpScrape(deps)`; calls HN, Reddit, GitHub Issues, Stack Overflow, Indie Hackers, Dev.to
- `apps/api/src/icp-score.ts` — `runIcpScore(items, deps)`; Groq → Gemini scoring
- `apps/api/src/icp-cluster.ts` — `runIcpCluster(deps)`; KV list → LLM cluster → GitHub write
- `apps/api/wrangler.toml` `[triggers].crons` — must stay in sync with `ICP_SCRAPE_CRON` in `index.ts`
- `apps/api/src/env.d.ts` — `LOGSNAG_TOKEN`, `LOGSNAG_PROJECT`, `GH_TOKEN` bindings

## Decisions

### SK-ICP-001 — Weekly HN + Reddit scrape writing raw items to KV

- **Decision:** A Cloudflare cron at `0 6 * * 1` (Monday 06:00 UTC) calls `runIcpScrape`, which queries HN Algolia (10 pain-keyword searches), Reddit (16 subreddit/query pairs), GitHub Issues (5 queries when `GH_TOKEN` set; rolling `created:>` last-7-day filter), Stack Overflow (5 tag+query pairs via SE API 2.3), Indie Hackers (5 P1-pain queries via `feed.indiehackers.world`), and Dev.to (5 tag queries via Forem API) for posts from the previous 7 days. Each item is deduped via `icp:seen:<source>:<id>` (90d KV TTL) and new items written as `icp:item:<YYYYMMDD>:<source>:<id>` (30d KV TTL, JSON). LogSnag `#icp-mining` reports new vs. skipped per source. Per-source errors caught: one failing source never kills the others.
- **Core value:** Simple, Bullet-proof
- **Why:** Mining public complaints at scale gives unfiltered language the personas actually use — persona docs today are hypotheses, not evidence. Storing raw items in KV costs nothing (Cloudflare free tier) and provides the input corpus for the LLM scorer. Monday after weekend activity maximises signal. 90-day dedup window prevents reprocessing while letting long-tail items cycle out.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` is the single owner. `IcpScrapeDeps.fetch` is overridable for tests; OTel spans wrap each external fetch (GLOBAL-014). The `scheduled()` handler in `apps/api/src/index.ts` dispatches on `ICP_SCRAPE_CRON` and logs `{ msg: "icp_scrape_completed", newItems, skipped, sources }`. `LOGSNAG_TOKEN` / `LOGSNAG_PROJECT` optional; skipped silently when absent.
- **Alternatives rejected:** Separate Worker (more infra; existing API worker has capacity); R2 storage (overkill — KV is sufficient; tracked under Open questions); daily cron (weekly enough for Phase 1 signal; daily would burn KV quota on noise).

## GLOBALs governing this feature

- **GLOBAL-013** — Free-tier bundle budget.
  - *In this feature:* all six sources are free public APIs. Stack Exchange anon quota 300/IP/day; cron uses 5/week. Dev.to public API allows ~3 RPS unauthenticated; cron uses 5 sequential calls/week. Weekly KV cost (≤ 725 items × 2 writes + ≤ 2 list ops + ~725 reads) sits comfortably inside Workers free-tier ceilings.
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* HN/Reddit fetches → `nlqdb.icp.fetch.hn` / `nlqdb.icp.fetch.reddit`; GitHub Issues fetch → `nlqdb.icp.fetch.github`; Stack Overflow fetch → `nlqdb.icp.fetch.stackoverflow`; Indie Hackers fetch → `nlqdb.icp.fetch.indiehackers`; Dev.to fetch → `nlqdb.icp.fetch.devto`; LLM scoring → `nlqdb.icp.score`; per-persona clustering → `nlqdb.icp.cluster`; GitHub evidence-file write → `nlqdb.icp.github_write`. All spans carry relevant attributes (source, item count, provider, file path, written status, and `nlqdb.icp.se.quota_remaining` for Stack Exchange).
- **GLOBAL-028** — Acquisition progress tracker.
  - *In this feature:* this cron implements §2.1–§2.4 of [`automated-icp-validation-plan.md`](../../research/automated-icp-validation-plan.md). Progress is recorded in that file.
- **GLOBAL-029** — Acquisition verification tracker.
  - *In this feature:* once the first cluster file lands (Mon 2026-05-26), §8 `FLOW-NNN` blocks in `automated-icp-validation-plan.md` get amended with verbatim cluster labels; the mirrored verification blocks gain new walkthrough steps proving the cluster→`/solve/` auto-suggestion path (open question in this feature). Implementation and verification trackers stay in lockstep per the GLOBAL.
- **GLOBAL-030** — Evidence-grade acquisition tracker edits.
  - *In this feature:* ICP evidence and flow-status updates must name the verification artifact (cron output, deployed-surface walkthrough, env inspection, or code/test check) and keep the implementation tracker plus mirror synced before the PR is considered green.

### SK-ICP-002 — LLM scoring of raw items immediately after each weekly scrape

- **Decision:** After `runIcpScrape` collects new items, `runIcpScore` (called in the same `0 6 * * 1` cron run) runs a regex pain-word prefilter, then calls Groq `llama-3.1-8b-instant` (Gemini `gemini-2.5-flash` fallback) in batches of 20 to score each item 0–10 against P1/P2/P3/P6 personas. Items where every persona scores below 5 are discarded; the rest are stored as `icp:scored:<YYYYMMDD>:<source>:<id>` (30-day KV TTL). The scorer never blocks the 200 response — it is invoked with `.catch` in the cron handler so a total LLM failure still logs and returns cleanly.
- **Core value:** Simple, Bullet-proof
- **Why:** Raw items sitting in KV are not evidence. Scoring on the same Monday run transforms the weekly signal harvest into a ranked, persona-tagged set that a future clustering step (SK-ICP-003) can read directly, without needing a separate data-pull cron.
- **Consequence in code:** `apps/api/src/icp-score.ts` is the single owner. `IcpItem` is now exported from `icp-scrape.ts`. `IcpScrapeResult.items` carries the newly stored items for handoff. `runIcpScore` wraps each LLM batch in an `nlqdb.icp.score` OTel span with `provider`, `batch_size`, and `raw_count` attributes. No new env bindings — `GROQ_API_KEY` and `GEMINI_API_KEY` are already present.
- **Alternatives rejected:** Separate scoring cron (would need to identify which raw items are unscored — either by listing all `icp:item:*` keys and re-checking each, or by maintaining a separate "pending-score" queue; co-running with the scraper and passing items directly is simpler and eliminates the coordination overhead); storing scores in D1 (introduces migration for a phase-1 experiment; KV TTL is sufficient while evidence volumes are small).

### SK-ICP-003 — Cluster scored items per persona and write monthly evidence file to GitHub

- **Decision:** After each weekly scrape+score run, `runIcpCluster` lists all `icp:scored:*` KV keys (paginated, covers the full 30-day TTL), groups by highest-scoring persona (top-100 each), calls Groq `llama-3.1-8b-instant` → Gemini `gemini-2.5-flash` fallback to cluster into 5–7 themes per persona, applies the §2.4 rule for `primary_confirmed` / `directional` / `no_signal`, and writes `docs/research/icp-evidence-<yyyy-mm>.md` via GitHub Contents API `PUT` (SHA-aware). LLM-claimed `cluster.count` clamped to actual group size. All external calls carry `User-Agent: nlqdb-icp-bot` + `AbortSignal.timeout(15s)`. Non-fatal: LLM or GitHub failure returns `written: false` without killing the cron.
- **Core value:** Simple, Bullet-proof
- **Why:** Scored items in KV are not actionable. The evidence file is the primary deliverable for the §2.4 ICP decision. Surfacing the verdict in-file removes the manual check. Direct GitHub Contents write keeps the cron self-contained — no git clone, no CI step. KV `list` is on the Workers free tier (1k ops/day; this uses ≤2/week).
- **Consequence in code:** `apps/api/src/icp-cluster.ts` is the single owner. `runIcpCluster` is called in `index.ts` after `runIcpScore`, gated on `GH_TOKEN`. `IcpClusterResult.{primaryStatus, primaryIcp}` exposed to logs + LogSnag. OTel span `nlqdb.icp.cluster` per persona with `persona`, `item_count`, `cluster.count`, `cluster.provider`. No new env binding.
- **Alternatives rejected:** Separate cron (more entry points, a second KV list op); D1 storage (migration overhead; KV TTL sufficient); branch + PR write (over-engineered for a data file the founder reads); trusting LLM `count` (models hallucinate; clamping is cheap).

### SK-ICP-004 — GitHub Issues as an additional pain-signal source

- **Decision:** When `GH_TOKEN` is set, `runIcpScrape` queries GitHub Search Issues (`/search/issues`) for 5 NL-to-SQL / agent-memory pain queries with a rolling `created:>${isoDate(sevenDaysAgoUnix)}` filter (10 results each). Stored as `source: "github"`, `id: "gh-<issue.id>"`. Issues with unparseable `created_at` dropped. `User-Agent: nlqdb-icp-bot` required (GitHub REST 403s no-UA). 10s timeout, `incomplete_results: true` logged. Per-query errors caught.
- **Core value:** Simple, Bullet-proof
- **Why:** GitHub issues are intentional, well-described bug/feature requests from actual practitioners — higher signal than casual social posts. Authenticated GH Search allows 30 RPM, well above the 5 queries/week budget.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchGitHubIssues`; `IcpScrapeDeps.ghToken` now drives GitHub calls. Reddit calls gained `restrict_sr=on`; HN/Reddit/GH all gained a 10-second `AbortSignal.timeout`.
- **Alternatives rejected:** Separate GH scraper (unnecessary); unauthenticated GH API (60 RPM limit; no benefit when token available).

### SK-ICP-005 — Stack Overflow as an additional pain-signal source

- **Decision:** `runIcpScrape` also queries Stack Exchange API 2.3 `/search/advanced` (`site=stackoverflow`) for 5 tag+query pairs targeting P1/P3/P4/P6 (`postgresql/setup`, `sqlalchemy/verbose`, `sql/natural language`, `prisma/migration`, `duckdb;clickhouse`), `sort=creation`, `pagesize=10`, 7-day `fromdate`. Stored as `source: "stackoverflow"`, `id: "so-<question_id>"`. No auth (anon quota 300/IP/day = 60× weekly budget). `backoff` surfaces as `icp_se_backoff` so a throttled cron is visible without aborting the run. Per-query errors caught.
- **Core value:** Simple, Bullet-proof
- **Why:** Stack Overflow is the highest-density public surface for "I'm trying to do X with SQL/Postgres/ORM and it isn't working" — P1 setup, P3 stuck queries, P4 ORM verbosity, P6 operational SQL. Listed in §2.1 from day one but never shipped.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchStackExchange` and a fourth element in `Promise.all`; OTel span `nlqdb.icp.fetch.stackoverflow` carries `nlqdb.icp.se.quota_remaining`; LogSnag reports `SO: <n>`.
- **Alternatives rejected:** Stack Apps key (anon quota already 60× budget; auth has no marginal capacity); `/search` not `/search/advanced` (advanced supports `tagged` + `fromdate`); polling `/questions` per-tag (burns quota per page).

### SK-ICP-006 — Indie Hackers as an additional pain-signal source

- **Decision:** `runIcpScrape` also queries the unofficial `feed.indiehackers.world` JSON Feed for 5 P1-pain queries (`database`, `boilerplate`, `side+project`, `first+paying`, `stack`). Stored as `source: "indiehackers"`, `id: <slug>` from the `/post/<slug>` URL path; posts whose URL doesn't match that contract or whose `date_modified` is unparseable are dropped before KV write. Mirror has no server-side date filter; 7-day window enforced client-side. Best-effort: 10-second timeout, per-source error isolation.
- **Core value:** Simple, Bullet-proof
- **Why:** Indie Hackers was listed in §2.1 as the P1 source from day one but never shipped. IH posts are launch-context complaints by definition, giving the cluster step language the other sources don't reach. Live probe 2026-05-23: ≈10 new IH items/week across 5 queries.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchIndieHackers` and a fifth element in `Promise.all`; OTel span `nlqdb.icp.fetch.indiehackers`; LogSnag reports `IH: <n>`. No new env binding.
- **Alternatives rejected:** `indiehackers.com` direct (CF bot challenge); Apify scraper ($/run — breaks GLOBAL-013); HTML scrape (brittle); `ihrss.io` (RSS only); IH-canonical resolution (`/post/<slug>` 404s on direct GET — title + `content_html` carry the evidence trail).

### SK-ICP-007 — Agent-runnable source-health probe in `scripts/verify-flows.sh`

- **Decision:** `scripts/verify-flows.sh` ships a `FLOW-008` block that probes the 6 upstreams the cron consumes; each asserts HTTP 200 + a contract-key (`hits` / `total_count` / `quota_remaining` / `items` / top-level array for Dev.to). HN, IH, and Dev.to are fatal; GH is fatal-when-`GH_TOKEN`-set, else skipped; Reddit and SO degrade to advisory on `x-block-reason: hostname_blocked` (managed-egress proxy 403; CF-egress Worker is canonical). Any other non-200 fails. Per-probe cap 15 s.
- **Core value:** Simple, Bullet-proof
- **Why:** A silent upstream schema/endpoint change only surfaces today after the cron's LogSnag count drops to zero — days late. An agent-runnable probe makes the failure observable in < 3 s with zero new credentials and closes the data-side analogue of the §1.1 stranger-test gap.
- **Consequence in code:** `scripts/verify-flows.sh` exposes one `fetch_json` helper (severity- and `x-block-reason`-aware) reused by adjacent flow blocks. Adding a new ICP source extends `apps/api/src/icp-scrape.ts` AND appends a `fetch_json` probe in FLOW-008 AND extends sub-tasks in [`automated-icp-validation-plan.md §8 FLOW-008`](../../research/automated-icp-validation-plan.md) — drift is the regression the probe prevents.
- **Alternatives rejected:** GH Actions cron polling upstreams (creates a founder-facing notification channel); embedding inside Worker's `/v1/health` (CF egress can't simulate the agent VM's view); failing on Reddit/SO 403 (false-positive every run); marking every source advisory (collapses regression detector for HN/IH/GH/Dev.to).

### SK-ICP-008 — Dev.to as the 6th pain-signal source via the public Forem API

- **Decision:** `runIcpScrape` additionally queries the Forem public API at `https://dev.to/api/articles?tag=<tag>&per_page=15&top=7` for 5 tags covering P1/P3/P4/P6 pain (`database`, `sql`, `postgres`, `webdev`, `orm`). `top=7` is the server-side 7-day filter — no client-side date filter needed. Articles stored as `source: "devto"`, `id: "devto-<article.id>"` (the `devto-` prefix prevents collisions with other numeric-ID sources). Articles whose `published_timestamp` is unparseable are dropped before KV write. All requests carry `User-Agent: nlqdb-icp-bot` (same string as IH per SK-ICP-006) and `AbortSignal.timeout(10s)`; per-tag errors are caught — one failing tag never kills the others or the other 5 sources. Live probe 2026-05-25: every probed tag returns the expected ≥4 fresh articles within the `top=7` window.
- **Core value:** Simple, Bullet-proof
- **Why:** Dev.to (Forem) is the largest indie developer-blogging surface and the existing 5-source mix under-samples first-person long-form complaints — HN/Reddit comments and SO answers skew short-form, GH issues skew bug-report-style, IH posts skew launch-context. Article descriptions on Dev.to carry the same setup/ORM/migration pain the existing sources catch, but in framing the cluster step doesn't reach today. The Forem API is a first-class public read endpoint (documented at [`developers.forem.com`](https://developers.forem.com/api/v1)) with no auth, no key, and a server-side recency filter — strictly cheaper to consume than IH's unofficial mirror. Robots.txt explicitly allows `/api/*` for any user-agent. `top=7` removes the client-side date filter that IH still needs, which simplifies the dedup contract and reduces dropped rows from clock-skew on the mirror.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchDevto` and a sixth element in the `Promise.all`. Each call is wrapped in `nlqdb.icp.fetch.devto` (with `nlqdb.icp.items` and `http.response.status_code` attributes) and the standard 10-second timeout. LogSnag description reports `DEV: <n>` alongside the other source counts. `scripts/verify-flows.sh` gains a `FLOW-008 source Dev.to /api/articles` probe (fatal severity — no egress-block surface; Dev.to is on Heroku with global CDN). No env binding required.
- **Alternatives rejected:** Lobste.rs `/t/<tag>.json` (robots.txt sets `User-agent: * Disallow: /` + `Content-Signal: ai-input=no` — explicit scrape-deny; respecting upstream policy); Dev.to `/search` (robots.txt disallows `/search?q=*`; `/api/articles?tag=` is the documented public path); per-article body fetch (the Forem `/api/articles/{id}` endpoint adds 1 RPS × per-item; description field is already the cluster-step input — fetching bodies burns rate-limit budget without raising signal density); client-side 7-day filter (server-side `top=7` is sharper and saves the parse step); RSS feed (`https://dev.to/feed`, no tag scoping — would pull every Dev.to article and discard 95% client-side).

## Open questions / known unknowns

- **R2 upgrade** — When evidence files exceed KV practical limits, migrate raw storage from KV to `r2://nlqdb-icp-raw/`. Free tier for both; KV is the simpler path for now.
- **IH canonical URL recovery** — SK-ICP-006 stores the `feed.indiehackers.world/post/<slug>` URL, which 404s on direct GET. The cluster step's evidence trail therefore cites the title + first 500 chars of `content_html`, not a clickable IH thread. If the founder needs IH-canonical URLs for §3.6 reply-to-pain, the next slice is parsing IH-thread URLs out of `content_html` (a content link sometimes appears as `<a href='https://www.indiehackers.com/...'>` inside the body); otherwise this is "good enough" signal for cluster input.
- **LogSnag threshold alert** — Decision-rule verdict now surfaces in the evidence markdown and the `icp_cluster_completed` log. A separate LogSnag *channel-bell* event (only on transition into `primary_confirmed`) is the natural next slice; current implementation embeds the verdict in the existing per-run notification so we don't double-spam the channel.
