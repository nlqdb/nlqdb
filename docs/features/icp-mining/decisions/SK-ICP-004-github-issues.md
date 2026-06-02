# SK-ICP-004 — GitHub Issues as an additional pain-signal source

- **Decision:** When `GH_TOKEN` is set, `runIcpScrape` queries `/search/issues` for 5 NL-to-SQL / agent-memory pain queries with a rolling `created:>${isoDate(sevenDaysAgoUnix)}` filter (10 results each). Stored as `source: "github"`, `id: "gh-<issue.id>"`. Unparseable `created_at` dropped. `BOT_USER_AGENT` required (GH REST 403s no-UA). 10s timeout, `incomplete_results: true` logged. Per-query errors caught.
- **Core value:** Simple, Bullet-proof
- **Why:** GH issues are intentional, well-described bug/feature requests from actual practitioners — higher signal than casual social posts. Authenticated GH Search allows 30 RPM, ≫ 5/week budget.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchGitHubIssues`; `IcpScrapeDeps.ghToken` drives GitHub calls. Reddit calls gained `restrict_sr=on`; HN/Reddit/GH all gained a 10s `AbortSignal.timeout`.
- **Alternatives rejected:** Separate GH scraper (unnecessary); unauthenticated GH API (60 RPM; no benefit when token available).
