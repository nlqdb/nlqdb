# SK-ICP-005 — Stack Overflow as an additional pain-signal source

- **Decision:** `runIcpScrape` queries Stack Exchange API 2.3 `/search/advanced` (`site=stackoverflow`) for 5 tag+query pairs (P1/P3/P4/P6: `postgresql/setup`, `sqlalchemy/verbose`, `sql/natural language`, `prisma/migration`, `duckdb;clickhouse`), `sort=creation`, `pagesize=10`, 7-day `fromdate`. Stored as `source: "stackoverflow"`, `id: "so-<question_id>"`. Anon (quota 300/IP/day = 60× weekly budget); `backoff` surfaces as `icp_se_backoff`; per-query errors caught.
- **Core value:** Simple, Bullet-proof
- **Why:** Stack Overflow is the highest-density public surface for "I'm trying X with SQL/Postgres/ORM and it isn't working" — P1 setup, P3 stuck queries, P4 ORM verbosity, P6 operational SQL. Listed in §2.1 day one but never shipped.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchStackExchange` and a 4th `Promise.all` element; OTel span `nlqdb.icp.fetch.stackoverflow` carries `nlqdb.icp.se.quota_remaining`; LogSnag reports `SO: <n>`.
- **Alternatives rejected:** Stack Apps key (anon already 60× budget); `/search` (no `tagged`/`fromdate`); polling `/questions` per-tag (burns quota per page).
