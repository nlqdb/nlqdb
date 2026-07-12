# Weekly review — 2026-07-11

Current-state audit of the `/daily` loop (≤ 4 KB, overwritten weekly, no
changelog). Worst finding first. Covers daily PRs #613–#663 (runs 8–50).

## Worst finding — the focus number was dark (checks 1 & 4)

The 07-04 focus was **BIRD raw EX → ≥ 0.60**, but row #8 has **no agent-movable
lever** and the scorecard says so in its own words ("offline levers exhausted; SC
dead (#619); frontier-lens closed (run 15); row #8 stays dark for the lever").
The one remaining path — the corrected-set — is blocked on an **external
maintainer's license reply** (uiuc-kang-lab issue #7, filed 07-07, no response),
so it is not agent-movable either. The result was predictable: **0 of the week's
~43 runs pulled BIRD as a lever**; it drifted 0.526 → 0.546 (+2.0 pp) which the
canonical re-measure attributes to noise ("no attributable lever," #661). Per
`daily.md` rule 8 a dark metric must never be the lever — pointing the *focus* at
one guarantees the loop's energy scatters (see monoculture). The floor breach
(0.546 < 0.60) is real but **no GLOBAL-025 alert tripped** (flat-to-positive, no
regression), so the fix is to stop steering by it, not to keep chasing it.

## Monoculture (check 2) — internal hygiene, no yield

Two levers dominated: **docs-ambiguity/row #17 (11 runs, 28 → 17)** and **blog
publishing (8 runs, surfaces 84 → 93)**. Publishing earns its share — external
referrals rose **1 → 9** (bing-led, row #7), real yield. Docs-ambiguity does not:
it is internal doc-hygiene with **no external consumer**, and it is now stalling
(run 50 "count held" at 17). Eleven runs on a stalling internal counter while the
GLOBAL-025 floor breach had no lever to pull is the mis-allocation the focus
number should correct — de-prioritise row #17 as a default lever.

## Inert output (check 3) — venue variants still never drain

`distribution-queue.md`'s "venue variants pending" list (dev.to / Reddit /
lobste.rs) keeps growing — canonical `/blog` copies ship every run, but the
community posts that drive referrals are human-gated (Reddit needs the founder's
account, `blocked-by-human.md`). Not agent-fixable, correctly parked there; noted
so it is not mistaken for loop output that could be automated.

## Delta integrity (check 5) — sampled 4, all verify

Re-measured **row #17 = 17** with the pinned method — matches #663 exactly.
Engine deltas cite real CI run IDs (Spider 0.2741 #29151548561, BIRD 0.546
#29144102081) and the Spider gain is honestly labelled capacity-honesty
(`no_sql` 30 → 0), not an engine lift. Fourth sample: `BLOG_POSTS` in `blog.ts`
holds **29** posts — matches the scorecard's "/blog 29" (rows #6/#7) exactly (a
naive `slug:` grep reports 30 because it also hits the type definition).

## Prompt drift (check 6) — none

Every GLOBAL cited in `daily.md`/`weekly.md` (025/026/027/033) resolves to a
canonical file — notably **GLOBAL-027, the archetype this prompt flags, now
exists** (fixed). Every path referenced in `daily.md` resolves. No fix needed;
`daily.md` untouched this run.

## Focus number set

**Row #15 E2E freshness → 1.0** (row #8 BIRD is dark; strangers lag) — see the
scorecard top line for the why.
