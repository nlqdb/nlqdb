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

**One-liner:** A Monday 06:00 UTC cron scrapes HN Algolia and Reddit for ICP-relevant pain signals, deduplicates against a KV seen-set, and stores raw items as `icp:item:*` for downstream analysis.
**Status:** implemented (Slice 1 — data collection). LLM scoring and evidence-file generation are Phase 2 (SK-ICP-002 / SK-ICP-003 — not yet scheduled).
**Owners (code):** `apps/api/src/icp-scrape.ts`, `apps/api/test/icp-scrape.test.ts`, `apps/api/wrangler.toml` (cron `0 6 * * 1`).
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

## Open questions / known unknowns

- **LLM scoring (SK-ICP-002)** — Phase 2 slice: run the free-chain persona-fit rubric (§2.3) against `icp:item:*` after each weekly scrape. Writes scored rows to `icp:scored:*` and produces the monthly `docs/research/icp-evidence-<yyyy-mm>.md`.
- **Evidence-file generation (SK-ICP-003)** — Phase 2: weekly batch to cluster top-100 scored rows into 5–7 themes and open a PR with the updated evidence file.
- **R2 upgrade** — When evidence files exceed KV practical limits, migrate raw storage from KV to `r2://nlqdb-icp-raw/`. Free tier for both; KV is the simpler path for now.
- **GitHub issue source** — `GH_TOKEN` is already in env (SK-ICP-001 passes it as `deps.ghToken`). A Phase 2 slice can add `is:issue "text to sql"` queries once the basic scrape shape is proven.
