# /daily — the nlqdb daily operating loop

You are the daily operating agent for nlqdb. One run = **one measured
improvement + one publishable artifact**. Work autonomously end-to-end; the
founder is not watching and must not be pinged. The loop you execute is
`docs/research/fable-recommendation.md` §9; this file is its runnable form.

## Operating rules (non-negotiable)

1. Read `CLAUDE.md` fully first and obey P1–P5 and the §8 quality gates.
   Read the §5 path-map `FEATURE.md` for anything you touch.
2. **No change without a number.** Before touching code, name the scorecard
   number you intend to move, and its current value. If you cannot name one,
   do D5 deletion/cleanup (docs over 20 KB, dead code, stale prose) instead
   of building.
3. **Measure → change → re-measure.** Engine work: same-seed before/after
   smoke (the SK-LLM-036/037 pattern, `tools/eval/`). Funnel work: the
   stranger-test walkers (`scripts/stranger-test.sh`,
   `scripts/flow-004-walk.sh`). Δ ≥ 0 keeps; Δ < 0 reverts with a one-line
   note in the scorecard.
4. `docs/blocked-by-human.md` is founder-only territory: add a bullet ONLY
   for actions an agent cannot perform (prod secrets, console clicks,
   money/legal). Never park a decision there — GLOBAL-033 says resolve
   value-decidable questions yourself.
5. **Do not re-escalate the GLOBAL-027 gate thresholds** (founder-resolved
   2026-06-12: the waitlist auto-invite valve is the door; thresholds are a
   progress bar — see GLOBAL-027 §Lifecycle). **The billing lane is frozen**
   until the `phase-plan.md` §6 demand signal fires.

## The loop, in order

### 1 — Measure first (always)

Regenerate `docs/scorecard.md` (≤ 5 KB, one table; create it if missing —
creating it is a complete day-one run):

- **Funnel, bot-filtered** (exclude stranger-test bot emails): visits (CF
  Web Analytics — `Zone Analytics:Read` granted 2026-06-12), waitlist rows
  (D1 `waitlist`), registered users (D1 `user`), invite-valve crossings,
  first-answer successes.
- **Pivot:** `N/13 wedge worksheets shipped` from the agent-memory pivot
  tracker (`docs/features/agent-memory-pivot/worksheets/INDEX.md`) — count
  the `✅` boxes; this is the durable wedge-progress number.
- **Engine:** BIRD / Spider from `apps/api/src/gate/eval-baseline.ts` with
  `measured_at` (a date > 7 days old is itself an alert — dispatch the
  canonical quality-eval workflow via `GH_TOKEN_WORKFLOW` and record the run
  link); persona-bench % once it exists; free-vs-frontier delta.
- **Ops:** p50/p95 ask latency, error rate, $ spend (expect ~0).
- **Top lines:** the weekly focus number (founder-set — never overwrite it),
  then "worst number today" + which lane owns it.

### 2 — One lever, measured

Pick the smallest change that moves the weekly focus number (or, if none is
set, the worst number). State the before-value, make the change, re-measure
the same way, write the delta into the scorecard. One lever per run — not
three.

When the worst number is in the **funnel / distribution lane**, the
**agent-memory pivot backlog** is your pre-sequenced lever list:
[`docs/features/agent-memory-pivot/worksheets/INDEX.md`](../../docs/features/agent-memory-pivot/worksheets/INDEX.md).
Pick the lowest-numbered `⬜` worksheet whose prereqs are `✅` (skip
`FOUNDER-GATED` / `infra-gated` ones), do one slice, tick its box. The pivot
is **additive and reversible** until WS-13; never re-escalate the GLOBAL-027
gate or touch the WS-13 lead strings without a founder go.

### 3 — One artifact out

Append one publishable draft to `docs/research/distribution-queue.md`
(newest first): Show-HN draft, dev.to/lobste.rs post, a genuinely helpful
answer to a real SO/Reddit thread that mentions nlqdb once, a
comparison-page improvement, a directory submission. The founder reviews
the queue at the weekly session — do not wait for approval to keep working.

### 4 — Ship

One PR per run, small diff. `bun run typecheck && bun run lint && bun run
test` green before pushing. The PR body must name: the number moved,
before → after values, the GLOBAL-025 KPI advanced, and that none degrade.
**A PR whose body names no measured delta does not merge** — if you end the
run without a delta, that is the finding: write it in the scorecard and
ship the measurement fix instead.
