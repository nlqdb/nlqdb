---
name: icp-mining
description: Weekly cron that scrapes HN Algolia, Reddit, and GitHub Issues for ICP pain signals, scores them per persona via the free LLM chain, clusters them into themes, and writes a monthly evidence file to GitHub.
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

**One-liner:** A Monday 06:00 UTC cron scrapes HN Algolia, Reddit (16 subreddits), and GitHub Issues; deduplicates via KV; scores 0–10 per persona via Groq → Gemini; clusters into 5–7 themes per persona; writes `docs/research/icp-evidence-<yyyy-mm>.md` to GitHub.
**Status:** implemented (SK-ICP-001 collection; SK-ICP-002 scoring; SK-ICP-003 clustering + evidence file; SK-ICP-004 GitHub Issues source).
**Owners (code):** `apps/api/src/icp-scrape.ts`, `apps/api/src/icp-score.ts`, `apps/api/src/icp-cluster.ts`, `apps/api/test/icp-scrape.test.ts`, `apps/api/test/icp-score.test.ts`, `apps/api/test/icp-cluster.test.ts`, `apps/api/wrangler.toml` (cron `0 6 * * 1`).
**Cross-refs:** [`docs/research/automated-icp-validation-plan.md §2`](../../research/automated-icp-validation-plan.md) · [`docs/research/personas.md`](../../research/personas.md) · [`GLOBAL-028`](../../decisions/GLOBAL-028-acquisition-progress-tracker.md) · [`GLOBAL-030`](../../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md).

## Touchpoints — read this feature doc before editing

- `apps/api/src/icp-scrape.ts` — `runIcpScrape(deps)`; calls HN, Reddit, GitHub Issues
- `apps/api/src/icp-score.ts` — `runIcpScore(items, deps)`; Groq → Gemini scoring
- `apps/api/src/icp-cluster.ts` — `runIcpCluster(deps)`; KV list → LLM cluster → GitHub write
- `apps/api/wrangler.toml` `[triggers].crons` — must stay in sync with `ICP_SCRAPE_CRON` in `index.ts`
- `apps/api/src/env.d.ts` — `LOGSNAG_TOKEN`, `LOGSNAG_PROJECT`, `GH_TOKEN` bindings

## Decisions

### SK-ICP-001 — Weekly HN + Reddit scrape writing raw items to KV

- **Decision:** A Cloudflare cron at `0 6 * * 1` (Monday 06:00 UTC) calls `runIcpScrape`, which queries HN Algolia (10 pain-keyword searches), Reddit (16 subreddit/query pairs), and GitHub Issues (5 queries via Search API, when `GH_TOKEN` is set) for posts from the previous 7 days / `created:>2025-11-01` window. Each item is deduped via `icp:seen:<source>:<id>` (90-day KV TTL) and new items are written as `icp:item:<YYYYMMDD>:<source>:<id>` (30-day KV TTL, JSON). A LogSnag notification to `#icp-mining` reports the count of new vs. skipped items per source. Per-source errors are caught: one failing source never kills the others.
- **Core value:** Simple, Bullet-proof
- **Why:** Mining public complaints at scale gives unfiltered language the personas actually use — persona docs today are hypotheses, not evidence. Storing raw items in KV costs nothing (Cloudflare free tier) and provides the input corpus for the Phase 2 LLM scorer without requiring any infrastructure beyond what is already provisioned. Running Monday morning (after a weekend of community activity) maximises signal. The dedup window (90 days) prevents re-processing the same posts across consecutive weeks while letting long-tail items cycle out.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` is the single owner. `IcpScrapeDeps.fetch` is overridable for tests; OTel spans wrap each external fetch (GLOBAL-014). The `scheduled()` handler in `apps/api/src/index.ts` dispatches on `ICP_SCRAPE_CRON` and logs `{ msg: "icp_scrape_completed", newItems, skipped, sources }`. `LOGSNAG_TOKEN` and `LOGSNAG_PROJECT` are optional; when absent the LogSnag step is skipped silently.
- **Alternatives rejected:** Separate Worker for the scraper (more infra; the existing API worker has capacity on its weekly window); R2 storage (overkill for Phase 1 — KV is sufficient; R2 upgrade is tracked under Open questions); daily cron (weekly is enough for Phase 1 signal; daily would burn KV quota on repeated noise).

## GLOBALs governing this feature

- **GLOBAL-013** — Free-tier bundle budget.
  - *In this feature:* all sources (HN Algolia, Reddit, GitHub Issues) are free non-commercial APIs. KV write volume (≤ 500 items/week × 2 keys each = 1,000 writes/week) and cluster read volume (≤ 2 list ops + ~500 get ops/week) are inside the free-tier ceilings (7,000 writes/day, 1,000 list ops/day, unlimited reads).
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* HN/Reddit fetches → `nlqdb.icp.fetch.hn` / `nlqdb.icp.fetch.reddit`; GitHub Issues fetch → `nlqdb.icp.fetch.github`; LLM scoring → `nlqdb.icp.score`; per-persona clustering → `nlqdb.icp.cluster`; GitHub evidence-file write → `nlqdb.icp.github_write`. All spans carry relevant attributes (source, item count, provider, file path, written status).
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

- **Decision:** After each weekly scrape+score run, `runIcpCluster` lists all `icp:scored:*` KV keys (paginated, covers the full 30-day TTL window), groups items by their highest-scoring persona (top-100 per persona), calls Groq `llama-3.1-8b-instant` → Gemini `gemini-2.5-flash` fallback to cluster each persona's items into 5–7 themes, applies the §2.4 decision rule to label the result `primary_confirmed` / `directional` / `no_signal`, generates `docs/research/icp-evidence-<yyyy-mm>.md` with the verdict at the top, and writes it to GitHub via `PUT /repos/nlqdb/nlqdb/contents/…` (checking existing SHA with a prior GET to enable update vs. create). LLM-claimed `cluster.count` is clamped to the actual group size before render. All external calls (LLM, GitHub Contents API, LogSnag) carry a `User-Agent: nlqdb-icp-bot` header and an `AbortSignal.timeout(15s)` so a stalled upstream can't hang the cron. Cluster step is non-fatal: a total LLM or GitHub failure is caught, logged, and returns `written: false` without killing the cron.
- **Core value:** Simple, Bullet-proof
- **Why:** Scored items sitting in KV are not actionable. The evidence file is the primary deliverable the founder needs to make the ICP decision (§2.4 rule). Surfacing the verdict in the file removes the manual "is the rule satisfied yet?" step. Writing directly to GitHub via the Contents API keeps the cron self-contained — no git clone, no CI step, no external storage outside what already exists. KV `list` is available on the Workers free tier (1,000 list ops/day; this uses ≤2/week).
- **Consequence in code:** `apps/api/src/icp-cluster.ts` is the single owner. `runIcpCluster` is called in `index.ts` after `runIcpScore`, gated on `GH_TOKEN` being set. `IcpClusterResult` exposes `primaryStatus` (always set) and `primaryIcp` (set when a leader exists) so `icp_cluster_completed` logs and LogSnag descriptions both carry the verdict. OTel span `nlqdb.icp.cluster` per persona with `persona`, `item_count`, `cluster.count`, `cluster.provider` attributes. No new env bindings required — `GH_TOKEN`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `LOGSNAG_TOKEN` are already declared.
- **Alternatives rejected:** Separate cron (adds complexity, a second entry point, a second KV list op); D1 for cluster storage (migration overhead, KV TTL is sufficient); writing to a branch + PR (correct but over-engineered for a data file the founder reads, not reviews); trusting the LLM-claimed `count` (models routinely hallucinate larger numbers — clamping to the actual group is cheap and prevents misleading evidence).

### SK-ICP-004 — GitHub Issues as an additional pain-signal source

- **Decision:** When `GH_TOKEN` is set, `runIcpScrape` also queries the GitHub Search Issues API (`/search/issues`) for 5 queries targeting NL-to-SQL and agent-memory pain (filtered `created:>2025-11-01`, 10 results each). Issues are stored with `source: "github"` and `id: "gh-<issue.id>"` to avoid collisions with HN/Reddit IDs. Issues whose `created_at` is unparseable are silently dropped (no NaN `ts` lands in KV). All requests carry a `User-Agent: nlqdb-icp-bot` header (GitHub REST rejects no-UA requests with 403) and an `AbortSignal.timeout(10s)`; `incomplete_results: true` from the Search API is logged. Per-query errors are caught; a failing GitHub query never kills the other sources.
- **Core value:** Simple, Bullet-proof
- **Why:** GitHub issues are a high-signal source for developer pain: they are intentional, well-described bug/feature requests from actual practitioners, not casual social posts. The authenticated GitHub Search API allows 30 RPM — 5 queries/week is trivially within budget. `GH_TOKEN` was already in `env.d.ts` but unused.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchGitHubIssues`. `IcpScrapeDeps.ghToken` (already declared as `string | undefined`) now actually drives GitHub API calls in addition to being passed downstream to `runIcpCluster`. Reddit calls in the same file gained `restrict_sr=on` so search stays scoped to the subreddit; HN/Reddit/GH all gained a 10-second `AbortSignal.timeout`.
- **Alternatives rejected:** Separate GH-specific scraper (unnecessary complexity; existing scraper pattern handles it cleanly); unauthenticated GH API (60 RPM limit, no benefit when token is already available).

## Open questions / known unknowns

- **R2 upgrade** — When evidence files exceed KV practical limits, migrate raw storage from KV to `r2://nlqdb-icp-raw/`. Free tier for both; KV is the simpler path for now.
- **LogSnag threshold alert** — Decision-rule verdict now surfaces in the evidence markdown and the `icp_cluster_completed` log. A separate LogSnag *channel-bell* event (only on transition into `primary_confirmed`) is the natural next slice; current implementation embeds the verdict in the existing per-run notification so we don't double-spam the channel.
