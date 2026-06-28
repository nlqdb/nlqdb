# SK-ICP-002 — LLM scoring of raw items immediately after each weekly scrape

- **Decision:** After `runIcpScrape` collects new items, `runIcpScore` (same cron run) calls Groq `openai/gpt-oss-20b` (Gemini `gemini-2.5-flash` fallback) in batches of 20 to score each item 0–10 against P1/P2/P3/P6. Items where every persona scores < 5 are discarded; the rest stored as `icp:scored:<YYYYMMDD>:<source>:<id>` (30d KV TTL). The scorer is `.catch`-wrapped in `index.ts` so a total LLM failure still logs and returns cleanly. **(The original regex pain-word prefilter clause is superseded by SK-ICP-010.)**
- **Core value:** Simple, Bullet-proof
- **Why:** Raw items in KV are not evidence. Scoring on the same Monday run transforms the weekly harvest into a ranked, persona-tagged set that SK-ICP-003 can read directly — no separate data-pull cron needed.
- **Consequence in code:** `apps/api/src/icp-score.ts` is the single owner. `IcpItem` exported from `icp-scrape.ts`. `IcpScrapeResult.items` carries the new items for handoff. `runIcpScore` wraps each batch in an `nlqdb.icp.score` span with `provider`, `batch_size`, `raw_count`. No new env bindings.
- **Alternatives rejected:** Separate scoring cron (needs coordination state for "which items are unscored" — co-run is simpler); D1 storage (migration overhead for a Phase-1 experiment; KV TTL is sufficient).
