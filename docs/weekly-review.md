# Weekly review — 2026-07-18

Current-state audit of the `/daily` loop (≤ 4 KB, overwritten weekly, no
changelog). Worst finding first. Covers the 07-11→07-18 window (runs 60–88 +
the new `/reach` track PRs #721/#724/#727).

## Worst finding — a standing dark metric lost its human blocker (check 4)

Row #15 (E2E freshness ≈ 0.75) has been the weekly-focus dark metric for two
weeks; runs 62/67/70 all pin its **sole** fix to an operator-only action —
arm a 3rd independent free-LLM pool (`FALLBACK2_LLM_API_KEY`, lane already
wired in `_e2e-opencheck.yml`, "disabled while unset"). PR #714 (07-16) wired
the lane's code and, in the same PR, **deleted the operator bullet from
`blocked-by-human.md`** while "clearing the backlog" — but the secret was
never set. So the scorecard still cites "its `blocked-by-human.md` bullet" for
a bullet that no longer exists, and the one action that lifts row #15 was
invisible to the founder for a week. **Restored this PR**, top of
`blocked-by-human.md`, with a ~5-day-blocked count. Honesty rule: a dark
metric's human blocker must live in `blocked-by-human.md` until the metric
moves, not be pruned when the metric is inconvenient.

## Monoculture (check 2) — a week of no-yield internal polish

~12 of ~14 substantive `/daily` runs pulled two internal-quality levers:
**claim/surface-integrity guards** (rows #18/#19 — runs 72, 74, 76, 77, 87,
88) and **web-UX trust polish** (SK-WEB/TRUST/HDC/APIKEYS — runs 80–85). Both
are product-readiness for strangers who aren't arriving: row #2 strangers
still **0**, row #7 GSC **1 click / 455 impr** flat, external referrals **9
carried**. The loop obeyed its own lever-order (#1 UX-flow), but the readiness
lane is saturated with no yield signal. The structural fix already landed —
the **`/reach` track** (SK-PIVOT-015, 07-17) now owns acquisition on its own
loop and numbers — so `/daily` should re-point to its measurable
furthest-from-floor pillar. Hence the focus: **row #8 BIRD**, the one engine
lever that's genuinely unparked (`SK-LLM-044` lifted Spider +2.2 pp, run 9,
but has never been measured on BIRD).

## Trend (check 1) — flat, no regression; engine at freshness edge

Engine below floor but flat (BIRD 0.546, Spider 0.2963, both 07-11 → **7 days
old today = freshness alert**). Onboarding/funnel flat at floor (strangers 0,
first-10 N=0). UX/perf green (row #21 9/9, row #18 0 dead, p95 1.70 s). No
`GLOBAL-025` regression tripped.

## Inert output (check 3) — none agent-fixable

`distribution-queue.md` holds 2 drafts (below the 3-deep forced-publish gate —
correctly not draining); dev.to syndication drips one/day (`SK-BLOG-003`);
Reddit/HN pointers are human-gated by norm. **Watch:** the new reach INDEX
"§ Current numbers" is the acquisition yield ledger — confirm next week it's
actually being written each `/reach` run, else reach becomes the next inert
loop.

## Delta integrity (check 5) — sampled 4, all verify

Re-measured live: docs-ambiguity = **15** (run 78, pinned grep) ✓; `/blog` =
**36** published (run 79 count-fix, `blog.ts`) ✓; SDK/CLI/MCP integrity guards
present and deriving from source (runs 88/74/64) ✓; row #18 = 0 dead
built-output (run 87) consistent with the sweep. No claimed-but-unverified
delta.

## Prompt drift (check 6) — none

Every GLOBAL cited in `daily.md`/`weekly.md` (025/026/027/033) resolves to a
canonical file; every referenced path resolves (`fable-recommendation.md`,
`stranger-test.sh`, `flow-005-walk.sh`, `gsc-pull.ts`, `syndicate-devto.ts`,
`baseline-2026-06-15.json`, `phase-plan.md`). No `daily.md` edit this week.
