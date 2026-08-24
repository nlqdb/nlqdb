# Weekly review — 2026-08-22

Current-state audit of the `/daily` loop (≤ 4 KB, overwritten weekly, no
changelog). Worst finding first. Window 2026-08-15→08-22: `/daily` runs
178–181 (#1003/#1015/#1024/#1032), `/reach` cycles (#1005/#1017/#1023/#1034),
and the founder-sanctioned parallel tracks — EK marketplace (~5 PRs) + premium
hardening (~7) + a large ask-pipeline/trust/UX hardening bucket (~16).

## Worst — the weekly focus number was un-movable all week (checks 4 + 1)

The 08-15 `/weekly` pick — dogfood **criterion 1, real MCP asks 12 → ≥ 100** —
is **dark** (rule 8), not a live target. It moves only on real external agents
hitting the MCP surface, which needs a launch, which is gated on the whole
`SK-PIVOT-016` gate — circular and stranger-gated. So no `/daily` run touched it
in seven days; the gate sat frozen at **2/5** (scorecard). Setting a focus number
no run can honestly move is the root cause of this week's monoculture. Fixed in
this PR: re-pointed the agent-movable number to the **memory-quality eval temporal
axis (2/7)** — the only gate-advancing lever a daily run can move *offline* and
without widening `GLOBAL-037` (the DDL-`CHECK`/enum + separate-judgement path, not
raw value-sampling). The founder's 07-28 gate frame is untouched (P1).

## Monoculture — `/daily` fell to yieldless distribution breadth (check 2)

With no movable focus, 3 of 4 daily runs pulled **distribution breadth** (179 blog
publish, 180 `/solve` link-graph, 181 new `/solve` page); 178 was the outage-record
null. Yield evidence is absent: GSC ~12 clicks / 930 impr (row #7, ~flat vs last
week's 11c), real strangers still **0** (row #2). Surfaces grew 111 → 112 with no
click lift — volume without yield. The org *at large* is healthily diversified
(the ~16-PR UX/ask-pipeline bucket is the real center of gravity, not breadth), so
this is a `/daily`-loop finding, and the focus re-point above is its fix.

## Trend — no fresh regression; UX up, engine stale below floor (check 1)

No `GLOBAL-025` alert threshold stands tripped this week. Last week's worst (the
08-14 `/v1/ask` outage) is resolved **and hardened** — #992 fix, #993 direct-provider
fallback, #1001 free-chain fallback. UX pillar clearly advancing (GLOBAL-040 guided
clarify #1036, ask misroute fixes #1008/#1029/#1037, billing #1010, model-picker
honesty #1007). Engine flat and **dark**: BIRD 0.5382 (27 d), Spider 0.2222 (34 d),
both below the 0.60 floor (row #8/#9). Funnel flat, strangers 0.

## Delta integrity — sampled 3 daily PRs, all verify (check 5)

Re-measured same-instrument: run 181 (#1032) `/solve` = **41** and the
`moving-average-rolling-average-in-sql` entry is present; run 179 (#1015)
`/blog` = **40**, `success-rate-cant-see-a-wrong-answer` present; run 180 (#1024)
link-graph edit consistent with `/solve` 41. Total surfaces = 112 = row #6. No
fabricated delta.

## Inert output — none in the loop (check 3)

Distribution queue **drained** (0 unpublished drafts < 3); dev.to drip active and
self-throttling. The breadth-without-yield above is yield-*lag* on live surfaces,
not inert-by-loop. `blocked-by-human.md` head (Show HN, **70 d** idle since 06-13)
is gate-blocked, not inert — its root blocker is named and ranked.

## Prompt drift — `daily.md` gated on the wrong command; fixed (check 6)

`daily.md` rule 6 + step 4 gated pushes on `bun run typecheck && bun run lint`, but
CLAUDE.md §8 makes **`bun run check`** the CI gate and warns `lint` alone "skips
formatting and misses format-only failures" — so a format-only break passes daily's
local gate then reddens CI. Smallest fix applied: `lint` → `check` in both spots. All
cited paths + `GLOBAL`/`SK` IDs in `daily.md`/`weekly.md` resolve (GLOBAL-027's
canonical file now exists — the check-6 archetype in `weekly.md` is stale but left
untouched, per the daily.md-only fix scope).
