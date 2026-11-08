# Weekly review — 2026-11-08

Current-state audit of `/daily` (≤ 4 KB, overwritten weekly). Window
11-01 → 11-08: runs 269–279 (#1223–#1234, #1262, #1263), plus ~20
dependency and security PRs. The founder's focus line is kept. This week's focus number: **Tier 1 `create_index`
proposals on the spike, 0 → 1.**

## Worst: four spike runs and no proposal yet (check 2)

Since the spike started on 11-05, runs 275, 276, 277 and 279 all took the
same box, and each moved an input:

- planned fingerprints 9/20 → 20/20 → 28/32
- drop-outs with no named reason 12 → 0

The box's own number, proposals, is still **0 → 0**. CI run
[42412974907](https://github.com/nlqdb/nlqdb/actions/runs/42412974907)
shows why. All 11 equality lookups are unselective: 8 hit 35-row tables
(100 %) and 3 hit partitions (27–34 %). Only 2 range filters are left to
check. Tier 1 also skips 751 of 783 fingerprints (`32 explainable naming a
public relation`), and nobody has checked whether those include app tables.

The spike DB may hold no index-worthy workload. Next: check those two
sources; if neither yields a candidate, the box becomes a founder call
(another DB, or call the spike) and the loop moves to D1 and rateme12.

## Delta integrity (check 5): the numbers held up

I re-ran the walks on a local Postgres 16 with `pg_stat_statements`:

| Walk | Claimed | Re-run |
|---|---|---|
| KPI B, synthetic (#1234 `IN`) | 3/3 kept | 3/3 kept |
| KPI C, synthetic | 1/1 | 1/1 |
| D1 apply, rows read (#1228) | 5000 → 51 | 5000 → 51 |
| D1 KPI A through the door (#1225) | 117.3 ms | 89.4 ms |
| Spike funnel (#1263) | 28/32 planned, 0 proposed | same, in the CI log |

## Trend (check 1)

- **Engine:** the spike gave the first real-DB reading, KPI A 2.2–3.7 s
  (target < 5 min). D1 reached Tier 0, Tier 1 and apply on synthetic DBs.
  KPI B on a real DB is 0.
- **UX:** doors 3/4 → 4/4 (#1223).
- **Onboarding:** sign-in fixes (#1257, #1259); critical advisories
  5 → 0 (#1250). Clipped SERP snippets 124 → 0 (#1262).
- **Performance:** dark (row #13).
- No `GLOBAL-025` alert. BIRD/Spider are dark, not red.

## Inert output (check 3)

- **Draft #1179:** parked 25 days and flagged for the 4th week. It tunes
  KPI 1, which `GLOBAL-043` retired. No mode ever closed it: `/review`
  skips drafts and `/daily` only adopts them. The `daily.md` fix below
  closes any draft a decision retired.
- **Canary MISSes:** all 7 are the same `blocked_items` unique-key error,
  and nobody acts on them. Last week's request to shrink the canary
  paragraph to one line is still open.

## Dark metrics (check 4)

- **Row #18** (phantom `runSql({ dryRun })` on `docs.nlqdb.com/sdk`): open
  for 4 weeks. It cost $0 and was agent-fixable, so this PR removes the
  claim: 1 → 0.
- **Rows #13/#8/#9/#15/#20:** blockers named; #13 measures the doomed `/v1/ask`.

## Prompt drift (check 6)

Every ID, link and path in `daily.md` and `weekly.md` resolves. The one gap
is the missing rule for retired drafts, so this PR adds one sentence to
`daily.md` step 0, citing `rules://scheduled-run`'s superseded-PR rule.

## README roadmap (check 7)

The "Now" section said hosted `mcp.nlqdb.com` would get the MCP tools
"once its held deploy runs". It has now run green (Deploy MCP server
[42360456970](https://github.com/nlqdb/nlqdb/actions/runs/42360456970)),
so the line is reworded. The D1 line gains Tier 1, and the spike line now
says "no index proposed".

## Free-model roster (check 8)

**Plan chain, best first (unchanged):** groq-qwen `qwen3.8-27b` → gemini
`2.5-flash` → cerebras → groq `gpt-oss-120b` → workers-ai → openrouter →
mistral.

- Roundups list Gemini 3.5/3.6 Flash on the free tier (~1,500 RPD), and
  the key already exists
  ([ianlpaterson](https://ianlpaterson.com/blog/free-llm-api-2026/),
  [Analytics Vidhya](https://analyticsvidhya.com/blog/2026/01/top-free-llm-apis)).
- I didn't make the swap. It would need a live probe, which `daily.md`
  rule 3 bars, and the chain serves only `/v1/ask`, which `GLOBAL-043`
  deletes.
- No bullet.
