# Weekly review — 2026-11-15

Current-state audit of `/daily` (≤ 4 KB, overwritten weekly). Window
11-08 → 11-15: runs 280–291 (#1265–#1280; 286 merged as 288), plus 3
bot/release PRs; #1281 (run 292) open. Focus this week: **KPI B on
rateme12's real D1, 0 → 1.**

## Worst: the scorecard's engine rows are a changelog (check 3)

Row EA carries eight dated KPI A readings for the spike (runs 275–283) and
row EB a paragraph of run history; the header says "current state only — no
changelog". Nothing reads the old values: CI prints KPI A per run. Rows 22
and EA still cite the MCP door as "run 286" (merged as run 288, #1273).
Next daily run that touches them keeps one value + range per DB. The canary
paragraph (7 MISS, unchanged since run 281) is flagged a 3rd week.

## Monoculture (check 2): one lever, and it moved its number

10 of 11 runs pulled the step-2 sequence (anti-rut suspended by design), 1
the SEO lane (#1272). Last week's focus, spike Tier 1 proposals **0 → 1**,
landed in run 282 (#1267); applied in 283, judged **keep** at 72 h in 289:
p95 est. 65.2 → 1.7 ms. 1a closed: D1 doors 0/4 → 4/4 (#1270, #1273,
#1276), D1 KPI C 1/1 (#1269).

## Delta integrity (check 5): held

| Claim | Re-run |
|---|---|
| D1 KPI C 1/1, posts(title) 4999 → 1 (#1269) | same, `attach.d1.test.ts` |
| D1 apply 5000 → 51 | same |
| D1 KPI A synthetic 117.3 ms | 72.9 ms (58–133) |
| D1 decided 5/5 from web, MCP (#1276, #1273) | same, `web-door.test.ts`, `dba-door.test.ts` |
| Spike keep (#1275) | keep at 114.4 h, p95 1.956 ms, CI job 132491111758 |

#1281's 378.3 ms KPI A on rateme12 was walked locally; CI re-prints it on
merge (no `RATEME12_D1_TOKEN` here).

## Trend (check 1)

- **Engine:** first real-DB KPI B (spike, kept); rateme12 workload read
  live (~32 k calls/24 h); attach in #1281.
- **UX:** D1 doors 0/4 → 4/4. **Onboarding:** no change.
- **Performance:** dark (row 13, 07-27).
- **SEO lane:** GSC 28 d clicks 22 → 14, position 18.8 → 19.9 (row 7);
  not a `GLOBAL-025` alert, but the lane ran once. No BIRD/Spider alarm.

## Dark metrics (check 4)

Rows 2/3 (users, DBs) carried since 10-16; row 13 since 07-27 (needs
Grafana `metrics:read`). All measure the hosted `/v1/ask` product that
`GLOBAL-043` deletes, so none is a focus candidate; no mailbox entry.

## Prompt drift (check 6)

Every ID, path and workflow `daily.md` and `weekly.md` cite resolves.
Last week's retired-draft rule worked: #1179 closed 11-08. No `daily.md`
change.

## README roadmap (check 7)

"Attach product on synthetic databases" ~ → ✓ (last 1a box, #1276; D1
verify added); "D1 attach on the real rateme12" ◯ → ~.

## Free-model roster (check 8)

Plan chain, best first: groq-qwen `qwen3.8-27b` → gemini → cerebras
`gpt-oss-120b` → groq `gpt-oss-120b` → workers-ai → openrouter → mistral.

- `gemini-2.5-flash` is redirected to `gemini-3.5-flash-lite` on 12-01
  ([deprecations](https://aistudio.google.com/docs/deprecations),
  [free-llm.com 11-04](https://free-llm.com/guides/free-llm-apis-november-2026-what-changed)).
  `gemini-3.8-flash` is stable and free of charge
  ([pricing](https://aistudio.google.com/docs/pricing)); `models.get`
  confirms our key serves it (no generation, no quota). This PR swaps the
  Gemini leg to it, same chain position.
- `architecture.md` §7.1 still lists a Gemini 2.5 Pro "hard-plan fallback"
  no code calls (Pro reportedly left the free tier). Flag for the deletion series.
- No `blocked-by-human.md` bullet.
