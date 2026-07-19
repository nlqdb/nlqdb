# /weekly — the nlqdb weekly direction check

You audit the daily loop and point it in the right direction. There are no
time-boxed goals: the job is week-over-week **direction** and **honesty of
the numbers**, not deadlines. Work autonomously; the founder is not
watching. Human-only needs go to `docs/blocked-by-human.md`, nothing else
pings the founder. Obey `CLAUDE.md` P1–P5 and the §8 quality gates.

## Inputs (read all before judging)

- `docs/scorecard.md` **and its git history** — the week-over-week trend
  per row, not the day.
- `git log --since='7 days ago'` — every daily **and reach** PR: title,
  body, the delta it claims.
- `docs/research/distribution-queue.md`, `docs/blocked-by-human.md`.
- [`.claude/commands/daily.md`](daily.md) and
  [`.claude/commands/reach.md`](reach.md) — the prompts under audit —
  plus the reach `INDEX.md` § Current numbers (its scorecard-equivalent;
  founder-resolved 2026-07-19: the hourly reach loop is inside every
  check below, same as daily).

## The audit — six checks, worst finding first

1. **Trend.** Per pillar (engine, onboarding, UX, performance) plus the
   funnel: is the week-over-week direction right? Any regression past a
   `GLOBAL-025` alert threshold is automatically the worst finding.
2. **Monoculture.** What share of the week's runs pulled the same lever?
   If one lever dominates, demand yield evidence (referral visits,
   indexation, conversions from the shipped surfaces). Volume without
   yield evidence → next week's focus is *instrumenting the yield*, not
   more volume.
3. **Inert output.** Anything the loop produces that nothing consumes —
   a queue not draining, drafts nobody publishes, reports nobody reads.
   The fix is changing the loop (or deleting the output), never raising
   volume.
4. **Dark metrics.** Rows stale/carried ≥ 1 week: is the root blocker
   named? Human-only blockers must sit at the top of
   `blocked-by-human.md` with a days-blocked count; agent-fixable ones
   are focus-number candidates.
5. **Delta integrity.** Sample ≥ 3 of the week's PR bodies and verify the
   named delta was genuinely re-measured (rerun the check where cheap). A
   claimed-but-unverified delta beats every other finding except a trend
   regression.
6. **Prompt drift.** Dangling references (decision IDs with no canonical
   file, paths that no longer exist), dead rules, and contradictions in
   `daily.md`, `reach.md`, and this file — the GLOBAL-027 case (cited everywhere,
   canonical file missing until its superseded record landed 2026-07-01)
   is the archetype.

## Outputs (one PR)

1. **Set the weekly focus number** at the top of `docs/scorecard.md`: one
   agent-movable number + a one-line why, chosen from the audit. If the
   founder wrote one this week, keep theirs — never overwrite a founder
   edit. **Default while the `GLOBAL-038` acquisition focus stands
   (founder-resolved 2026-07-19): the best agent-movable acquisition/GTM
   input** — channel coverage per
   `docs/research/acquisition-channels.md`, attribution/instrument
   coverage, or a funnel-conversion number — falling back to the pillar
   furthest from its `GLOBAL-025` floor only when every acquisition
   lever is blocked. Either way pick **an agent-movable input, never a
   headline number while that number is dark** (levers exhausted or
   externally blocked). A focus no daily run can pull
   scatters the week into meta work and measurement churn — found
   2026-07-11 (BIRD), repeated 2026-07-18 (BIRD again, runs 90–94)
   (founder-resolved 2026-07-19).
2. **Overwrite `docs/weekly-review.md`** (current-state, ≤ 4 KB, no
   accretion): one short paragraph per check, worst finding first, each
   naming its evidence (PR #s, scorecard rows, URLs).
3. **One smallest fix to `daily.md` or `reach.md`** if check 6 found
   drift — a small diff, never a restructure, never touching
   founder-resolved rules (P1).
4. §8 quality gates green. PR body: the focus number chosen + why, and the
   worst finding.

One focus number, not three. Don't re-litigate founder-resolved decisions —
flag genuine contradictions with their ID in `weekly-review.md` instead.
