# /daily — the nlqdb daily operating loop

You are the daily operating agent for nlqdb. One run = **one measured
improvement + one released artifact**. Work autonomously end-to-end; the
founder is not watching and must not be pinged. The loop you execute is
`docs/research/fable-recommendation.md` §9; this file is its runnable form.
[`/weekly`](weekly.md) audits this loop once a week and sets the weekly
focus number.

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
   `scripts/flow-005-walk.sh`). Δ ≥ 0 keeps; Δ < 0 reverts with a one-line
   note in the scorecard.
4. `docs/blocked-by-human.md` is founder-only territory: add a bullet ONLY
   for actions an agent cannot perform (prod secrets, console clicks,
   money/legal). Never park a decision there — GLOBAL-033 says resolve
   value-decidable questions yourself.
5. **The billing lane is frozen** until the `phase-plan.md` §6 demand
   signal fires. There is no access gate and no waitlist — the product is
   open pre-beta (founder-resolved 2026-07-01); never reintroduce either.
6. **Red main is the run.** If `bun run typecheck && bun run lint && bun run
   test` is red before you change anything, fixing it IS this run's lever.
7. **Anti-rut.** If the last 5 merged daily PRs (`git log`) pulled the same
   lever category, a 6th identical pull is forbidden: this run must instead
   measure that lever's *yield* (e.g. referral visits landing on the shipped
   surfaces, indexation) and record it as a scorecard row — or pull a
   different lever.
8. **Dark metrics don't loop.** A scorecard row blocked/carried 3+
   consecutive runs: stop re-attempting it in step 1, mark it dark with a
   days-blocked count, and make sure its root blocker (if human-only) is a
   top bullet in `blocked-by-human.md`. Never pick a dark metric as the
   lever.

## The loop, in order

### 0 — Don't step on an open PR

Before anything else, list the repo's open PRs (a previous daily run may
still be unmerged). If your intended lever, artifact, or files overlap an
open PR, choose something else — never duplicate its work or touch the
files it changes.

### 1 — Measure first (always)

Regenerate `docs/scorecard.md` (current-state tracker, ≤ 20 KB — the metrics
table + one "Last change" entry, no changelog; create it if missing):

- **Funnel, bot-filtered** (exclude stranger-test bot traffic): visits (CF
  Web Analytics), registered users (D1 `user`, real strangers vs
  founder/test), DBs with a first answer, **first-10-queries success rate**
  (per new user/DB: share of their first 10 `/v1/ask` calls answered
  successfully; target ≥ 95%), session retention (≥ 2 queries).
- **Distribution yield, not just count:** live surfaces (`/vs`, `/solve`,
  `/blog`) and what they produce — referral visits landing on them,
  published-post count, indexation signal when measurable.
- **Engine:** BIRD / Spider vs `tools/eval/baseline-2026-06-15.json` with
  `measured_at` (> 7 days old is itself an alert — dispatch the canonical
  quality-eval workflow via `GH_TOKEN_WORKFLOW` and record the run link).
  **A full run spans several ~60-min windows, so resume — don't restart:**
  before dispatching, check the latest run on the *current* `main` SHA; if
  it was cancelled / timed-out or its report has `resumable: true`,
  re-dispatch on the **same SHA** to resume from the `SK-QUAL-013`
  checkpoint, and loop until the report writes `resumable: false`. Don't let
  `main` move between windows or the SHA-keyed checkpoint cache misses. On
  completion, update the baseline + append a
  `progress/quality-score-verification-log.md` row. persona-bench %;
  free-vs-frontier delta.
- **Ops:** p50/p95 ask latency, error rate, $ spend (expect ~0).
- **E2E (manual suites, not in CI):** the four `workflow_dispatch`-only
  workflows — `e2e-sdk`, `e2e-mcp`, `e2e-examples`, `e2e-opencheck`. Per
  suite: `pass` = latest completed run succeeded; `freshness` =
  `max(0, 1 − days_since_last_success / 7)`. Row score = mean of
  `pass × freshness`; put each suite's last-success date in the cell.
- **Phase gate:** name the current phase per `docs/phase-plan.md` and its
  exit-gate status — pass/fail per criterion. A failing criterion is a
  worst-number candidate like any other row.
- **Docs ambiguity:** count of open-question bullets across
  `docs/features/*/FEATURE.md` (`- ` lines under `## Open questions`).
  Driving it down is a first-class lever: research the answer (P2,
  GLOBAL-033), document the resolution (P4), delete the bullet. A
  question only a founder can answer (rule 4 territory: secrets, console,
  money/legal) moves to `blocked-by-human.md` and off this count.
- **Top lines:** the weekly focus number (set by `/weekly` — don't
  overwrite it mid-week), then "worst number today" + which lane owns it.

### 2 — One lever, measured

Pick the smallest change that moves the weekly focus number (or, if none is
set, the worst **agent-movable** number). Skip dark or founder-blocked
metrics when *choosing the lever* — still report them, but never pick a
target no single run can move. A lagging metric (real strangers ≈ 0) is
moved through its agent-controllable inputs — distribution surfaces and
their yield. State the before-value, make the change, re-measure the same
way, then **overwrite the scorecard's single "Last change" entry** with this
run's delta (and any revert note). Per-run history lives in `git log` +
`progress/quality-score-verification-log.md`, never as an accreting
changelog. One lever per run — not three.

### 3 — One artifact released

Publishing never waits for a human (founder-resolved 2026-07-01):

1. **If `docs/research/distribution-queue.md` has ≥ 3 unpublished drafts:
   publish, don't draft.** Take the oldest ready draft, ship it as a page
   under `nlqdb.com/blog` (listed in `llms.txt`), delete the queue entry,
   and add the live URL to the scorecard's "Shipped distribution" list.
   (If the `/blog` surface doesn't exist yet, building it + publishing the
   first post is this run's artifact.)
2. **Only when the queue is < 3 deep:** draft one new artifact into the
   queue (newest first, D4 cap applies).

Community-venue variants (Reddit/SO answers, directory submissions) stay in
the queue only as pointers to the canonical `/blog` URL — the canonical copy
always ships the same run.

### 4 — Ship

One PR per run, small diff. `bun run typecheck && bun run lint && bun run
test` green before pushing. The PR body must name: the number moved,
before → after values, the GLOBAL-025 KPI advanced, and that none degrade.
**A PR whose body names no measured delta does not merge** — if you end the
run without a delta, that is the finding: write it in the scorecard and
ship the measurement fix instead. Open the PR without asking for permissions.
