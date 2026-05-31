# SK-ICP-006 — Indie Hackers as an additional pain-signal source

- **Decision:** `runIcpScrape` queries the unofficial `feed.indiehackers.world` JSON Feed for 5 P1-pain queries (`database`, `boilerplate`, `side+project`, `first+paying`, `stack`). Stored as `source: "indiehackers"`, `id: <slug>` from `/post/<slug>`; posts with non-matching URL or unparseable `date_modified` are dropped. Mirror has no server-side date filter; 7-day enforced client-side. 10-second timeout, per-source isolation.
- **Core value:** Simple, Bullet-proof
- **Why:** IH was listed in §2.1 day one but never shipped. Posts are launch-context complaints by definition — gives the cluster step language other sources don't reach. Live probe 2026-05-23: ≈10 new items/week.
- **Consequence in code:** `apps/api/src/icp-scrape.ts` gains `fetchIndieHackers` and a 5th `Promise.all` element; OTel span `nlqdb.icp.fetch.indiehackers`; LogSnag reports `IH: <n>`. No new env binding.
- **Alternatives rejected:** `indiehackers.com` direct (CF bot challenge); Apify ($/run); HTML scrape (brittle); `ihrss.io` (RSS only); IH-canonical resolution (`/post/<slug>` 404s direct — title + `content_html` carry the evidence trail).
