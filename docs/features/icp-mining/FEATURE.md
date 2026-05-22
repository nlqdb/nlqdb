---
name: icp-mining
description: Weekly cron that scrapes HN Algolia and Reddit for ICP pain signals, deduplicates them, and stores raw items in KV for persona validation and content generation.
when-to-load:
  globs:
    - apps/api/src/icp-scrape.ts
    - apps/api/test/icp-scrape.test.ts
  topics: [icp, scrape, pain-signal, cron, acquisition]
---

# Feature: ICP Mining

**One-liner:** A Monday 06:00 UTC cron scrapes HN Algolia and Reddit (16 subreddits, 10 HN queries) for ICP pain signals, deduplicates via KV, stores raw items as `icp:item:*`, and immediately scores them 0–10 per persona via the free LLM chain.
**Status:** implemented (Slice 1 — data collection SK-ICP-001; Slice 2 — LLM scoring SK-ICP-002). Evidence-file generation is Phase 2 (SK-ICP-003).
**Owners (code):** `apps/api/src/icp-scrape.ts`, `apps/api/src/icp-score.ts`, `apps/api/test/icp-scrape.test.ts`, `apps/api/test/icp-score.test.ts`, `apps/api/wrangler.toml` (cron `0 6 * * 1`).
**Cross-refs:** [`docs/research/automated-icp-validation-plan.md §2`](../../research/automated-icp-validation-plan.md) · [`docs/research/personas.md`](../../research/personas.md) · [`GLOBAL-028`](../../decisions/GLOBAL-028-acquisition-progress-tracker.md).

## Touchpoints — read this feature doc before editing

- `apps/api/src/icp-scrape.ts` — `runIcpScrape(deps)` main entry; `IcpScrapeDeps`, `IcpScrapeResult` types
- `apps/api/wrangler.toml` `[triggers].crons` — must stay in sync with `ICP_SCRAPE_CRON` constant in `index.ts`
- `apps/api/src/env.d.ts` — `LOGSNAG_TOKEN`, `LOGSNAG_PROJECT`, `GH_TOKEN` bindings

## Decisions

### SK-ICP-001 — Weekly HN + Reddit scrape writing raw items to KV

- **Decision:** A Cloudflare cron at `0 6 * * 1` (Monday 06:00 UTC) calls `runIcpScrape`, which queries HN Algolia (5 pain-keyword searches) and Reddit (3 subreddit/query pairs) for posts from the previous 7 days. Each item is deduped via `icp:seen:<source>:<id>` (90-day KV TTL) and new items are written as `icp:item:<YYYYMMDD>:<source>:<id>` (30-day KV TTL, JSON). A LogSnag notification to `#icp-mining` reports the count of new vs. skipped items. Per-source errors are caught: one failing source never kills the others.
- **Core value:** Simple, Bullet-proof
- **Why:** Mining public complaints at scale gives unfiltered language the personas actually use — persona docs today are hypotheses, not evidence. Storing raw items in KV costs nothing (Cloudflare free tier) and provides the input corpus for the Phase 2 LLM scorer without requiring any infrastructure beyond what is already provisioned. Running Monday morning (after a weekend of community activity) maximises signal. The dedup window (90 days) prevents re-processing the same posts across consecutive weeks while letting long-tail items cycle out.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` is the single owner. `IcpScrapeDeps.fetch` is overridable for tests; OTel spans wrap each external fetch (GLOBAL-014). The `scheduled()` handler in `apps/api/src/index.ts` dispatches on `ICP_SCRAPE_CRON` and logs `{ msg: "icp_scrape_completed", newItems, skipped, sources }`. `LOGSNAG_TOKEN` and `LOGSNAG_PROJECT` are optional; when absent the LogSnag step is skipped silently.
- **Alternatives rejected:** Separate Worker for the scraper (more infra; the existing API worker has capacity on its weekly window); R2 storage (overkill for Phase 1 — KV is sufficient; R2 upgrade is tracked under Open questions); daily cron (weekly is enough for Phase 1 signal; daily would burn KV quota on repeated noise).

## GLOBALs governing this feature

- **GLOBAL-013** — Free-tier bundle budget.
  - *In this feature:* all sources (HN Algolia, Reddit) are free non-commercial APIs. KV write volume (≤ 100 items/week × 2 keys each) is well inside the 1k writes/day free ceiling.
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* each HN and Reddit fetch is wrapped in `nlqdb.icp.fetch.hn` / `nlqdb.icp.fetch.reddit` spans with `nlqdb.icp.source` and `nlqdb.icp.items` attributes.
- **GLOBAL-028** — Acquisition progress tracker.
  - *In this feature:* this cron implements §2.1–§2.2 of [`automated-icp-validation-plan.md`](../../research/automated-icp-validation-plan.md). Progress is recorded in that file.

### SK-ICP-002 — LLM scoring of raw items immediately after each weekly scrape

- **Decision:** After `runIcpScrape` collects new items, `runIcpScore` (called in the same `0 6 * * 1` cron run) runs a regex pain-word prefilter, then calls Groq `llama-3.1-8b-instant` (Gemini `gemini-2.5-flash` fallback) in batches of 20 to score each item 0–10 against P1/P2/P3/P6 personas. Items where every persona scores below 5 are discarded; the rest are stored as `icp:scored:<YYYYMMDD>:<source>:<id>` (30-day KV TTL). The scorer never blocks the 200 response — it is invoked with `.catch` in the cron handler so a total LLM failure still logs and returns cleanly.
- **Core value:** Simple, Bullet-proof
- **Why:** Raw items sitting in KV are not evidence. Scoring on the same Monday run transforms the weekly signal harvest into a ranked, persona-tagged set that a future clustering step (SK-ICP-003) can read directly, without needing a separate data-pull cron.
- **Consequence in code:** `apps/api/src/icp-score.ts` is the single owner. `IcpItem` is now exported from `icp-scrape.ts`. `IcpScrapeResult.items` carries the newly stored items for handoff. `runIcpScore` wraps each LLM batch in an `nlqdb.icp.score` OTel span with `provider`, `batch_size`, and `raw_count` attributes. No new env bindings — `GROQ_API_KEY` and `GEMINI_API_KEY` are already present.
- **Alternatives rejected:** Separate scoring cron (requires listing KV keys — KV list is not available on free Workers; would need a second data structure to track unseen items); storing scores in D1 (introduces migration for a phase-1 experiment; KV TTL is sufficient while evidence volumes are small).

### SK-ICP-001 — Weekly HN + Reddit scrape writing raw items to KV (expanded — 2026-05-21)

The source list was widened in the same PR as SK-ICP-002: HN queries grew from 5 → 10 (adding MCP server, Postgres setup, Retool alternative, vector DB, pgvector); Reddit grew from 3 → 16 subreddit/query pairs (adding r/SaaS, r/webdev, r/nextjs, r/SQL, r/PostgreSQL, r/programming, r/learnprogramming, r/devops, r/ClaudeAI, r/LangChain, r/MachineLearning, r/Database, r/clickhouse). Budget impact: max ~500 items/week × 2 KV writes = 1,000 writes/week, inside the 7,000/week free ceiling.

## Open questions / known unknowns

- **Evidence-file generation (SK-ICP-003)** — Phase 2: weekly batch to cluster top-100 scored rows into 5–7 themes and write `docs/research/icp-evidence-<yyyy-mm>.md` (via GitHub API `PUT /repos/…/contents/…` so the cron can commit without a local git clone).
- **R2 upgrade** — When evidence files exceed KV practical limits, migrate raw storage from KV to `r2://nlqdb-icp-raw/`. Free tier for both; KV is the simpler path for now.
- **GitHub issue source** — `GH_TOKEN` is already in env. A Phase 2 slice can add `is:issue "text to sql"` queries once scoring proves signal quality.
