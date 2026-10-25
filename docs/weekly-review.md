# Weekly review — 2026-10-25

Current-state audit of `/daily` (≤ 4 KB, overwritten weekly). Window
10-18→10-25: runs 252–260 (#1189–#1204), plus the `GLOBAL-043` steer
(#1199–#1201, re-sequenced 10-23). The focus is the founder's (10-22/23),
kept as is.

## Worst: five deltas can't be re-run, and KPI A's number isn't CI's (check 5)

- **#1192–#1196** (runs 254–258) claim real-Postgres walks: 1200 → 600,
  0/196 → 196/196, 0 → 11/11, 0/94 → 94/94, 0/9 → 9/9. None of those walks
  was committed. Only mocked unit tests landed, and no `*.pg.test.ts` or
  walk script outside `packages/db`. Last week flagged the same gap on
  #1183, and it recurred five times.
- **#1204** fixes the pattern. `test-dba-postgres` reruns its walk on every
  CI run. Its scorecard number is still not CI's: row EA reads 27.9 ms (a
  local median of 5), but `main` CI printed **160.5 ms**
  ([job 121135988443](https://github.com/nlqdb/nlqdb/actions/runs/40182391387)).
  Both are far below the 5 min target. Row EA now cites both.

## Monoculture (check 2)

Runs 252–258 (7 of 9) refined `insert()` under `GLOBAL-041` step 11.
Then `GLOBAL-043` (10-22) put `insert()` on its deletion list. That was a
founder pivot, not a rut, but this week's build mostly went into a path
that will be deleted. Run 259 was a correct null, and the 10-23
re-sequence opened 1a. Run 260 shipped slice 1, the first engine number
on the new plan.

## Trend (check 1)

- **Engine:** KPI A (synthetic) went from unmeasured to measured. B and C
  stay unmeasured until the apply/verify slice lands.
- **UX:** `/app/dba` v0 ledger view (#1196).
- **Onboarding:** flat.
- **Performance:** dark. Row #13 has been carried since 07-27 (90 d).
- No `GLOBAL-025` alert fired. BIRD/Spider are dark, not red.

## Inert output (check 3)

- **Draft #1179 (11 d):** it fixes a write path `insert()` replaced. It can
  never be adopted, and only `/review` may close it.
- **Dogfood canary:** its 6 MISSes are its own `blocked_items` row shape
  (`write_constraint:unique`). Each run re-inspects them, and the scorecard
  calls the cause unverified. The canary stays until `insert()` goes
  (`GLOBAL-043`), so the useful step is giving `blockedWrites` a `key`.

## Dark metrics (check 4)

- **Row #18** is a phantom claim. `docs.nlqdb.com/sdk` (`sdk.mdx:103`)
  still offers `runSql({ dryRun })`, which was re-checked as unbuilt. It
  has been carried since run 232 (10-06). It costs $0, but no step-2 slot
  takes it. Rule 9 allows fixes to existing surfaces, so a null run could.
- **Row #13** (performance) names no blocker in the queue; it needs
  Grafana `metrics:read`.
- **Rows #8/#9, #15 and #20** name their blockers. The queue is 10 deep,
  and its head (spike DB) is 3 d old.

## Prompt drift (check 6)

All IDs and paths in `daily.md` and `weekly.md` resolve. Rule 5 cited
`GLOBAL-007` for a "Become AI update list", but `GLOBAL-007` never names it
and `GLOBAL-043` retired the EK track. That clause is removed here.

## Public roadmap (check 7)

`README.md` "Now" marked the synthetic attach product ◯. Slice 1 is
merged (#1204), so it is now ~. The other markers match.

## Free-model roster (check 8)

**Plan chain, best first:** groq-qwen `qwen3.8-27b` → gemini
`2.5-flash` → ~~cerebras `gpt-oss-120b`~~ → groq `gpt-oss-120b` →
workers-ai `llama-3.3-70b` → openrouter → mistral.

- **Cerebras** still returns 402 `payment_required` (chat probe today),
  for a 5th week. Removing it amends `SK-LLM-023`, so it is flagged only.
- **Gemini:** the key now lists `gemini-3.x-flash` (3.5–3.8). Free-tier
  quotas for them are unconfirmed
  ([ai.google.dev pricing](https://ai.google.dev/pricing),
  [forum](https://discuss.ai.google.dev/t/limits-on-gemini-api-free-tier-not-resetting/135026)),
  and daily rule 3 bars live probes. With no LLM in any hot path
  (`GLOBAL-043`), the swap is low priority, so nothing changed.
- **Blocked-by-human:** no bullet; no new key is needed.
