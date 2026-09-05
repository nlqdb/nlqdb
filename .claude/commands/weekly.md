# /weekly — the nlqdb weekly direction check

You audit the daily loop and point it in the right direction. There are no
time-boxed goals: the job is week-over-week **direction** and **honesty of
the numbers**, not deadlines. Work autonomously; the founder is not
watching. Human-only needs go to `docs/blocked-by-human.md`, nothing else
pings the founder. Obey `CLAUDE.md` P1–P5 and the §8 quality gates.

## Inputs (read all before judging)

- `docs/scorecard.md` **and its git history** — the week-over-week trend
  per row, not the day.
- `git log --since='7 days ago'` — every daily PR: title, body, the delta
  it claims.
- `docs/blocked-by-human.md`.
- [`.claude/commands/daily.md`](daily.md) — the prompt under audit.
- [`GLOBAL-041`](../../docs/decisions/GLOBAL-041-autonomous-dba.md) — the
  KPIs, floors and phase gates the week is measured against.

## The audit — seven checks, worst finding first

1. **Trend.** Per pillar (engine, onboarding, UX, performance): is the
   week-over-week direction right? Any regression past a `GLOBAL-025`
   alert delta — or a red BIRD/Spider regression alarm (`SK-QUAL-002`) —
   is automatically the worst finding.
2. **Monoculture.** What share of the week's runs pulled the same lever?
   If one lever dominates, demand evidence that it moved its KPI. Volume
   without a moved number → next week's focus is *instrumenting the
   number*, not more volume.
3. **Inert output.** Anything the loop produces that nothing consumes —
   reports nobody reads, rows nobody moves. The fix is changing the loop
   (or deleting the output), never raising volume.
4. **Dark metrics.** Rows stale/carried ≥ 1 week: is the root blocker
   named? Human-only blockers must be in `blocked-by-human.md` at their
   yield-per-founder-minute rank with a days-blocked count; agent-fixable
   ones are focus-number candidates.
5. **Delta integrity.** Sample ≥ 3 of the week's PR bodies and verify the
   named delta was genuinely re-measured (rerun the check where cheap). A
   claimed-but-unverified delta beats every other finding except a trend
   regression.
6. **Prompt drift.** Dangling references (decision IDs with no canonical
   file, paths that no longer exist), dead rules, and contradictions in
   `daily.md` and this file — a decision ID cited everywhere with no
   canonical file is the archetype.
7. **Public-roadmap truth (`README.md § Roadmap`).** The README is the one
   roadmap strangers read, and no daily loop owns it. Each week: tick/untick
   markers against shipped reality, and confirm the "Now"/"Next" sections
   still name the live focus (`GLOBAL-041` Phase A). A marker claiming ✓
   for something dark is a P6 honesty bug, same class as a phantom
   capability.

## Outputs (one PR)

1. **Set the weekly focus number** at the top of `docs/scorecard.md`: one
   agent-movable number + a one-line why, chosen from the audit. If the
   founder wrote one this week, keep theirs — never overwrite a founder
   edit. **Default: the `GLOBAL-041` KPI furthest from its floor** — KPI 1
   (first-insert inference rate, floor ≥ 95 % on the Phase A dogfood
   workload) until it clears, then KPI 2 / KPI 3 as their instruments land.
   Agent-movable means **movable at $0** (`docs/cost-ladder.md` — no spend
   while there are no paying customers): a focus whose only lever needs
   founder spend or founder-held credentials is not agent-movable. Pick
   **an agent-movable input, never a headline number while that number is
   dark** (levers exhausted or externally blocked) — a focus no daily run
   can pull scatters the week into meta work and measurement churn.
   Acquisition numbers are never the focus while the lane is paused
   (`GLOBAL-041`).
2. **Overwrite `docs/weekly-review.md`** (current-state, ≤ 4 KB, no
   accretion): one short paragraph per check, worst finding first, each
   naming its evidence (PR #s, scorecard rows, URLs).
3. **One smallest fix to `daily.md`** if check 6 found drift — a small
   diff, never a restructure, never contradicting a documented decision
   (P1).
4. §8 quality gates green. PR body: the focus number chosen + why, and the
   worst finding.

One focus number, not three. Don't re-litigate documented decisions —
flag genuine contradictions with their ID in `weekly-review.md` instead.
