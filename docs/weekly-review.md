# Weekly review — 2026-08-08

Current-state audit of the `/daily` loop (≤ 4 KB, overwritten weekly, no
changelog). Worst finding first. Window 2026-08-01→08-08: `/daily` runs
165–173, `/reach` R-10 (#908/#914/#922/#929), and the new `/ek` track
(#917–#940, ~11 PRs).

## Worst finding — the weekly-focus gate's one live blocker is off the founder queue (check 4)

The founder-set weekly focus is the
[`SK-PIVOT-016`](features/agent-memory-pivot/decisions/SK-PIVOT-016-dogfood-launch-gate.md)
dogfood gate (**0/5**, dark 12+ `/daily` runs). Its dependency chain is now
agent-complete: D-02b convergent sync + `memory-sync.yml` shipped (worksheet
🟢 code-complete) and the `NLQDB_API_KEY` secret was **set by the founder
2026-08-04** (`history/founder-actions-log.md` line 108). Exactly **one**
human action remains — provision the prod `agent_memory_v1` memory DB and set
the `NLQDB_MEMORY_DB` repo variable (D-04) — and it was **not a ranked bullet
in `blocked-by-human.md`**; it lived only in a parenthetical note (line 54)
and inside D-04's worksheet. Meanwhile the scorecard (line 23) still cites the
**already-resolved** `NLQDB_API_KEY` as a live gate blocker and mis-locates it
as "queue-#2" (queue #2 is the Anthropic directory). So the founder's queue
showed **no action** for the single $0, ~10-min step that unblocks their own
weekly focus — the same archetype the 2026-07-18 review caught for row #15.
**Fixed this PR:** added as ranked bullet #1 in `blocked-by-human.md` (blocked
since 08-04); it unblocks D-04 → gate criteria 1/2/3 and D-06 → criterion 5
(to 4/5). Criterion 4 (temporal engine axis) stays separate (E-09,
GLOBAL-037), so the gate cannot reach 5/5 on the secret alone.

## Monoculture — distribution content, no conversion yield (check 2)

5 of 9 `/daily` runs shipped distribution content pages (168–172: three
`/solve`, two `/blog`); run 173 was the sanctioned anti-rut yield
measurement. Its own evidence is the verdict: breadth lifted *leading*
indicators (GSC impressions 587→640, real-browser floor 52→63) but moved
**zero** *converting* indicators — 0 clicks on the top-impression page
(`/solve/running-total…`, 135 impr stuck at page-4 pos 35.4), referral yield
flat at 13 pl, real strangers still **0** (row #2). Volume without yield ⇒
next week's content sub-lever is *strengthening the one highest-impression
page to climb off page 4*, not a 6th new page. Context: the org's other big
allocation, the new `/ek` marketplace track (~11 PRs), is pre-launch build on
an unvalidated wedge — sanctioned parallel (SK-EKP-005) but also yield-less
until it ships.

## Trend — flat, no fresh regression (check 1)

No `GLOBAL-025` alert threshold tripped this week. Engine below floor and
**stale**: BIRD 0.5382 (13 d), Spider 0.2222 (20 d) — both past the >7 d
staleness alert, resume dark (async multi-window, `main` moved, SHA-keyed
cache would miss). Funnel up modestly (visits 52→63, GSC impr +53). UX/perf
green (row #21 0 failed, row #18 0 dead, p95 1.48 s < 1.5 s floor).
Onboarding flat at floor (strangers 0, first-10 N=0).

## Inert output — none in `/daily`; this loop lapsed (check 3)

`/daily` output is consumed: the blog draft queue drained (run 171, 0
unpublished) and the dev.to drip went live (run 173). The genuine lapse is
**this** loop — `weekly-review.md` was last rewritten 2026-07-18 (3 weeks;
the 07-28 focus was founder-set, not `/weekly`-set). Corrected here; watch
that `/weekly` fires weekly.

## Delta integrity — sampled 5, all verify (check 5)

Re-checked registry entries for runs 168/169/170/171/172 — every claimed
`/solve` or `/blog` page is present in `apps/web/src/data/{solve,blog}.ts`.
Scorecard counts (40/39/31) match the registries (raw `slug:` greps over-count
by 2 on nested cross-links). No claimed-but-unverified delta.

## Prompt drift — none (check 6)

Every path and GLOBAL ID cited in `daily.md`/`weekly.md` resolves — including
`GLOBAL-027` (this prompt's named archetype), which now has its canonical
file. No `daily.md` edit needed.
