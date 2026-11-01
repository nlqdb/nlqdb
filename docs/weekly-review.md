# Weekly review — 2026-11-01

Current-state audit of `/daily` (≤ 4 KB, overwritten weekly). Window
10-25→11-01: runs 261–268 (#1206–#1220), plus #1211 (`SK-LLM-055`) and
#1214 (rateme12 clone deleted). Founder focus kept. This week's focus
number: doors 3/4 → 4/4, then the D1 slice.

## Worst: the README called the MCP door live, but users can't reach it (check 7)

#1220 (run 268) added the MCP tools, and `README.md` "Now" listed them as
live. Neither way to reach them has shipped. `Deploy MCP server` is held at
`action_required` on `7520c42`
([41241791417](https://github.com/nlqdb/nlqdb/actions/runs/41241791417)),
and `@nlqdb/mcp` 0.4.0 waits in release PR #1221. Its 5/5 ran on a recorded
fixture, not a live API. This PR rewords the line. The scorecard's
"Doors that reach the loop: 3/4" means merged doors, not shipped ones;
queue head #1 shows the gap.

## Delta integrity (check 5): the numbers re-ran

All 8 runs committed their walks as CI tests, which fixes last week's
gap. I re-ran them on a local Postgres 16 with `pg_stat_statements`:

| Walk | Claimed | Re-run |
|---|---|---|
| `dba-observe-postgres.pg.test.ts` | KPI B 2/2 kept, KPI C 1/1 | 2/2 kept, 1/1 |
| `attach.pg.test.ts`, KPI A | 48.5 ms | 66.2 ms |
| `attach.pg.test.ts`, Tier 1 | 2/2 | 2/2 |
| `attach.pg.test.ts`, verify | 6/6 | 6/6 |
| CLI `TestAttachDoorWalk` | pass | pass |
| MCP `dba-door.test.ts` | pass | pass |

KPI A is noisy at the ms scale, but every reading is far under 5 min.

## Trend (check 1)

- **Engine:** synthetic KPIs moved. KPI B went 0 → 1 kept through the job,
  KPI C 1/1, and doors 0 → 3/4.
- **UX:** the `/app/dba` ledger shows decisions and verdicts.
- **Onboarding:** flat.
- **Performance:** dark.
- No `GLOBAL-025` alert. BIRD/Spider are dark, not red.

## Monoculture (check 2)

8 of 8 runs took 1a slices. That is the plan, not a rut: each moved a
distinct number. About 2 slices remain (the web door, then D1). After
that, both 1b tracks wait on founder secrets (queue #2 spike DB and #3 D1
token, 10 d each). The loop will then run null runs, so those two bullets
decide next week's yield.

## Inert output (check 3)

- **Draft #1179 (18 d):** still not adoptable. This is the 3rd week it's
  flagged; `/review` should close it.
- **Canary paragraph:** the scorecard header still lists per-merge canary
  verdicts for `insert()`, a path slated for deletion. It runs about
  8 lines a day and nobody acts on it. Shrink it to one line on the next
  daily.

## Dark metrics (check 4)

- **Row #18** (phantom `runSql({ dryRun })` in `sdk.mdx:103`): flagged for a
  3rd week. It costs $0 and is agent-fixable, but no step-2 slot takes it.
- **Row #13** (perf, carried since 07-27, 97 d): it measures `/v1/ask`,
  which `GLOBAL-043` deletes. Queueing a Grafana-token bullet would spend
  founder minutes on a path that is going away, so none was added.
- **Rows #8/#9/#15/#20:** blockers named.

## Prompt drift (check 6)

Every ID and path in `daily.md` and `weekly.md` resolves. No dead rules,
so `daily.md` is unchanged.

## Free-model roster (check 8)

**Plan chain, best first:** groq-qwen `qwen3.8-27b` → gemini `2.5-flash` →
cerebras `gpt-oss-120b` → groq `gpt-oss-120b` → workers-ai
`llama-3.3-70b` (capped by `SK-LLM-055`) → openrouter → mistral.

- 2026 roundups still rank Groq gpt-oss/Qwen and Gemini Flash as the
  free leaders. Gemini's free tier is Flash-only since April, with
  3.5-flash listed at about 1,500 RPD
  ([OpenRouter](https://openrouter.ai/blog/tutorials/free-llm-apis-compared/),
  [agentdeals](https://agentdeals.dev/gemini-api-pricing-changes),
  [costbench](https://costbench.com/best/best-llm-api-with-free-tier/)).
- No model is missing that is worth a key, since there is no LLM in any
  hot path (`GLOBAL-043`).
- Cerebras's 402 status is carried from last week (no live probe, daily
  rule 3).
- No blocked-by-human bullet.
