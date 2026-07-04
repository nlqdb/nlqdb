# Weekly review — 2026-07-04

Current-state audit of the `/daily` loop (≤ 4 KB, overwritten weekly, no
changelog). Worst finding first. Covers the 7 daily PRs #592–#606.

## Worst finding — monoculture + inert output (checks 2 & 3)

Distribution is still the loop's dominant lever and it is **volume without
yield**. Indexable surfaces rose **68 → 77** (+9 this week; #599/#602/#604/#606
plus earlier /solve+/vs) and published posts **6 → 11**, yet 7-day external
referrals moved only **2 → 3** (row #7 — all organic crawlers: google / bing /
aisearchindex, 1 pageload each). The `distribution-queue.md` "venue variants
pending" list (Reddit / dev.to / lobste.rs / HN) **never drains** — canonical
`/blog` pages ship every run, but the community posting that would actually
drive referrals is never done, so surfaces compound only through slow organic
crawl. **Loop change, not more volume:** while the focus number (below) keeps
the daily lever on engine, any distribution run should *hold* surface count and
instead prove the yield of what already exists — the venue channel is inert.

## Trend (check 1) — direction right; one standing floor breach, no alert

The week's real win is honesty: the engine eval lane went from **dark** (07-02:
dispatch 403, frontier secret empty, BIRD/Spider 13–15 days stale) to **fully
live** — BIRD re-measured on the full 500 q (0.512, #594), Spider measured
(0.1926), and the GLOBAL-025 headline **free-vs-agentic-frontier delta measured
for the first time: 19.3 pp** (#600, ≤ 25 pp Phase-2 floor ✓). BIRD **0.512 sits
below its 0.60 Phase-2 floor** but is statistically flat wk/wk (0.520 → 0.512,
−0.8 pp, McNemar p = 0.36) — **no GLOBAL-025 alert tripped** (alert = −5 pp OR
p<0.05). Onboarding is the flat pillar: real strangers **0**, rows #4/#5 no data
(instrument live, zero traffic). Ops green (0 errors). No regression is the
automatic worst finding.

## Dark metrics (check 4) — clean

Rows #4/#5 (first-10 success, retention) are carried "no data" with the root
blocker named — zero `/v1/ask` traffic → zero strangers → the yield problem
above, not human-only, so correctly absent from `blocked-by-human.md`. That file
is clean: only the founder-owned legal-copy item + a settled suggestion. A dark
metric even went *live* this week (frontier secret set ⇒ row #11 measured).
Nothing is improperly parked.

## Delta integrity (check 5) — sampled 3, all verify

Re-measured **row #17 docs-ambiguity = 30** with the pinned case-insensitive
method (matches #606 exactly). Surface sub-counts /solve 33 + /blog 13 match the
data files exactly (31 `/vs` + 33 + 13 = 77, row #6). Engine deltas #600 (19.3 pp) and #594 (0.512) cite real CI
run IDs. **One caveat, disclosed:** #605 (`SK-LLM-043`) shipped an *offline
deterministic ceiling* (+0.6 pp), not a live re-measured EX — legitimate (the
free LLM chain can't run in-env behind the MITM proxy) and honestly flagged, but
the loop is accumulating offline-only ceilings; the focus rider addresses this.

## Prompt drift (check 6) — none actionable

`daily.md` is clean: every referenced path exists (`fable-recommendation.md` §9,
`tools/eval/baseline-2026-06-15.json`, the stranger-test scripts, `phase-plan.md`),
no dangling decision IDs. `weekly.md`'s GLOBAL-027 archetype already carries the
"canonical file missing **until its superseded record landed 2026-07-01**"
qualifier — the file now exists and is correctly marked superseded, matching
reality, so the example is accurate, not stale. Every GLOBAL cited in either
prompt (013/025/026/027/033/036) resolves to a canonical file. No fix needed;
`daily.md` untouched this run.

## Focus number set

**BIRD raw EX 0.512 → ≥ 0.60** (row #8) — see the scorecard top line for the
why and the live-re-measure rider.
