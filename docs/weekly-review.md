# Weekly review — 2026-08-29

Current-state audit of the `/daily` loop (≤ 4 KB, overwritten weekly, no
changelog). Worst finding first. Window 2026-08-22→08-29: `/daily` runs
183–189 plus the founder-sanctioned EK-06 grant-primitive + EK-08 launch-motion
track (~10 PRs).

## Worst — the focus proxy hit target, the gate it serves stayed frozen (checks 2 + 4)

4 of the 6 non-null daily runs (**185–188**) climbed the memory-quality eval
proxy: EX **43.59 % → 79.49 %**, temporal axis **2/11 → 8/11** — the 08-22 focus
target (≥ 70 %) is comfortably **MET**, and run 188 proved the offline eval is now
**noise-dominated at ±5 pp** (a refined trim measured −5.13 pp, inside the floor →
reverted). Real proxy-yield — but the **dogfood gate the proxy exists to serve sat
frozen at 2/5 all week** (scorecard row #1). The proxy outran its consumer: another
run climbing it is volume without gate-yield. Crucially, the eval work already
**proved** the GLOBAL-037-legal lever (declared categorical vocabulary, runs
186/187) that the dogfood `INDEX.md` criterion-4 row still calls "no compliant
agent-movable lever" — that doc is now stale. Fix in this PR: re-point the focus to
**landing that proven lever in the production per-goal-pack schema layer so gate
criterion 4 flips (2/5 → ≥ 3/5)**. Founder's 07-28 gate frame untouched (P1).

## Monoculture — 4/6 runs on one offline lever; org itself is diversified (check 2)

memory-quality (185–188) = **67 %** of non-null daily runs; the other two (183/189)
were the row-#7 CTR lever. Unlike last week's *yieldless* distribution breadth, this
monoculture had real proxy-yield (verified below) — the problem is the proxy is
maxed and its downstream gate is frozen, which the focus re-point fixes. The org at
large is healthily diversified: the ~10-PR EK-06/EK-08 grant + launch-motion track
is the real center of gravity, so this is a `/daily`-loop finding, not an org one.

## Trend — memory-quality up sharply; engine floor stale; no GLOBAL-025 regression (check 1)

No `GLOBAL-025` alert threshold tripped. Engine (memory axis) **clearly up** (43 → 79 %).
Funnel edged up: GSC **9 c / 827 impr / pos 23.1** vs last week's 7 / 675 / 25.1 (row
#7). UX green (FLOW-005 6/6, carried). BIRD **0.5382** (33 d) / Spider **0.2222** (40 d)
still below the 0.60 floor and **stale** — dark, but #1041's planner re-head now makes a
fresh re-measure a valid engine lever (rows #8/#9). Strangers **0** (row #2, launch-gated).

## Delta integrity — sampled 4 memory + 1 CTR run, all verify (check 5)

Strong. Every memory-quality delta carries a real GHA A/B link in
`progress/quality-score-verification-log.md`: run 186 41.03 → 61.54 %
([32919866678] → [32920213591]), run 187 61.54 → 74.36 % ([…] → [33029888855]),
run 188 baseline 79.49 % ([33132370698]) with the −5.13 pp trim reverted. Run 189's
CTR edit is present in `apps/web/src/data/solve.ts` (55-char `metaTitle`, completed
`metaDescription` on `count-consecutive-days-streak-in-sql`). No fabricated delta.

## Inert output — none new in the loop (check 3)

Distribution queue **drained** (0 unpublished drafts); dev.to drip self-throttling
(15 variants remain, 1/run). `blocked-by-human.md` head (Show HN, **77 d** idle since
06-13) is gate-blocked, not inert — root named and ranked. The one emerging inert
risk *is* the maxed eval proxy above; the focus re-point retires it before it loops.

## Prompt drift — `daily.md` clean, no fix needed (check 6)

All `daily.md` decision IDs (GLOBAL-025/026/033/038, SK-*) resolve to canonical
files; all cited paths exist; last week's `lint → check` gate fix holds (rules 6 +
step 4). No dangling references, dead rules, or contradictions found — no `daily.md`
edit this week.
