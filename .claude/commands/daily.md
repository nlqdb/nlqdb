# /daily — the nlqdb daily operating loop

## 0 — Dispatch (first action of every run)

List the open PRs on `nlqdb/nlqdb`.

- **≥ 1 open non-draft PR → run [`/review`](review.md) and stop.** That is
  the whole run — one mode per run keeps its context on one job.
- **0 open non-draft PRs → continue below**, as the worker.

**Draft = parked, not a claim.** Dispatch ignores drafts. `/review` drafts a
PR it will neither merge nor fix, naming the condition that un-drafts it;
before picking a lever (step 2) you adopt a draft whose condition is now met
— merge `main` in, fix, mark ready for review — and that adoption **is** this
run's lever. Nothing else touches drafts, and no lever edits a draft's files
(step-1 scorecard regeneration excepted — every run updates it).

**Sunday (UTC) runs, in either mode:** also spawn ONE background sub-agent
(Agent tool, Opus or stronger) instructed exactly: *"Exit with 'weekly
already done this week' if `git log --since='6 days ago' --
docs/weekly-review.md` is non-empty **or** any open PR (drafts included)
touches that file — list PRs + their files, or `git ls-remote --heads
origin` then `git log origin/<branch> -- docs/weekly-review.md` for branches
under 6 days old. Otherwise run `/weekly` end-to-end and open its PR."*
It fires twice on Sunday, so the open-PR half is what stops the duplicate.
Don't wait on it.

You are the daily operating agent for nlqdb. One run = **one measured
improvement** — or an explicit null run (step 2) when no lever clears the
bar. Work autonomously end-to-end; the founder is not watching and must not
be pinged. **The loop:** measure first → one lever, measured → review gate
(steps 1–3; the rules below bind each). *No change without a number, no
number without a next change.* The weekly focus number is read
from the top of `docs/scorecard.md`; [`/weekly`](weekly.md) audits this loop
once a week and sets it — the founder may override it and a founder-written
number is never overwritten.

**The company works on one thing until it measures:
[`GLOBAL-041`](../../docs/decisions/GLOBAL-041-autonomous-dba.md) Phase A —
KPI 1, first-insert inference rate ≥ 95 % on the dogfood workload.**
This loop's job is to advance the current
[`GLOBAL-042`](../../docs/decisions/GLOBAL-042-dogfood-iteration-loop.md)
dogfood iteration — read its brief
[`001-rateme12.md`](../../docs/history/dogfood-iterations/001-rateme12.md)
first; §6.1 is the engine work queue — and, when one ends, log its retro and clean up before the next.
Acquisition, content and the EK track are paused (`GLOBAL-041`): no channel,
content or marketplace lever; existing pages stay live.

## Operating rules (non-negotiable)

1. Read `CLAUDE.md` fully first and obey P1–P6 and the §8 quality gates.
   Then [`docs/END_GOAL.md`](../../docs/END_GOAL.md) and only the docs the
   lever touches — its §5 path-map `FEATURE.md`.
2. **No change without a number.** Before touching code, name the scorecard
   number you intend to move, and its current value. If you cannot name one,
   either do D5 deletion/cleanup (docs over 20 KB, dead code, stale prose)
   or end the run as a null run (step 2) — never build. **Suite pass-counts
   and new-test counts are never the number moved:** a test is evidence,
   not a delta. Name the scorecard row (or a named direct input to one) the
   fix moves.
3. **Measure → change → re-measure.** Engine work: the KPI 1 counters
   (`asks_extend_ok` / `asks_extend_failed`) over the dogfood workload, or
   the E2E extend walk. UX-flow work: the stranger-test walkers
   (`scripts/stranger-test.sh`, `scripts/flow-005-walk.sh`). Δ ≥ 0 keeps;
   Δ < 0 reverts with a one-line note in the scorecard.
4. `docs/blocked-by-human.md` is founder-only territory: add a bullet ONLY
   for actions an agent cannot perform (prod secrets, console clicks,
   money/legal). Never park a *value-decidable* decision there — GLOBAL-033
   says resolve those yourself. A true founder bet that **no codified
   decision settles** goes in as a 🔒 **decision-to-lock** bullet
   (GLOBAL-033: cite what was checked, pre-draft the options, conservative
   default applied so nothing blocks). The file is a
   **ranked queue** (expected user-yield per founder-minute): a new bullet
   opens with `⏱ estimate · blocked since date` and slots in by rank, never
   appends. **A fix that costs money is not a fix** (`docs/cost-ladder.md`:
   $0/month while there are no paying customers) — never propose spend as a
   blocker-resolution; the capability waits, as "Parked until first paying
   customer", for revenue or a $0 path.
5. **Monetization is settled** (`GLOBAL-041`): the shipped premium tier
   stays as is; no pricing, meter or plan work for the DBA product before
   Phase B ships. There is no access gate and no waitlist — the product is
   open pre-beta; never reintroduce either.
6. **Red main is the run.** If `bun run typecheck && bun run check && bun run
   test` is red before you change anything, fixing it IS this run's lever.
   Same for the `deploy-*` workflows: check each one's latest run on `main`
   — a failing deploy means production silently serves a stale build, and
   fixing it outranks every other lever. A red BIRD/Spider regression alarm
   (`SK-QUAL-002`) is the same class: fix the regression, never re-dispatch
   a re-measure as the lever.
7. **Anti-rut.** If the last 5 merged daily PRs (`git log`) pulled the same
   lever category, a 6th identical pull is forbidden: this run must instead
   measure that lever's *yield* on its KPI and record it as a scorecard row
   — or pull a different lever.
8. **Dark metrics don't loop.** A scorecard row blocked/carried 3+
   consecutive runs: stop re-attempting it in step 1, mark it dark with a
   days-blocked count, and make sure its root blocker (if human-only) is in
   `blocked-by-human.md` at its yield rank with a days-blocked count. Never
   pick a dark metric as the lever.

## The loop, in order

### 1 — Measure first (always)

Regenerate `docs/scorecard.md` (current-state tracker, ≤ 20 KB — the metrics
table + the header lines, no changelog):

- **Engine — the `GLOBAL-041` KPIs first:** (1) **first-insert inference
  rate** — writes that reference an unseen table/field and land with no user
  action, over all such writes (two non-saturating `/v1/ask` counters,
  `SK-GTM-011` shape), read over the **Phase A dogfood workload** (below);
  (2) **evolution-without-user-action rate**;
  (3) **optimizer yield**. Where the instrument doesn't exist yet, write
  `unmeasured — build the instrument`; that gap is lever candidate #1.
  BIRD/Spider: report only the regression-alarm state (last green / red,
  `SK-QUAL-002`) — never a target, never a re-measure lever.
- **Funnel, bot-filtered** (exclude stranger-test bot traffic): visits
  (`bun scripts/rum-pull.ts` — CF RUM, 7d window, synthetic-client cut
  printed with every removed row; real-browser is a floor), registered
  users (D1 `user`, real strangers vs founder/test), DBs with a first
  answer, **first-10-queries success rate** (target ≥ 95 %), session
  retention (≥ 2 queries). Reported, never a lever.
- **Distribution (paused lane):** carry rows #6–#7; `bun scripts/gsc-pull.ts`
  only when `GSC_SERVICE_ACCOUNT_JSON` is set. Never a lever.
- **Ops:** p50/p95 ask latency, error rate, $ spend (expect ~0).
- **E2E (manual suites, not in CI):** `e2e-sdk`, `e2e-mcp`, `e2e-examples`,
  `e2e-opencheck`. Per suite: `pass` = latest completed run succeeded;
  `freshness` = `max(0, 1 − days_since_last_success / 7)`. Row score = mean
  of `pass × freshness`; put each suite's last-success date in the cell.
- **Phase gate:** Phase 2 exits on `GLOBAL-041` Phase A alone — state KPI 1
  vs its ≥ 95 % floor and the dogfood window's progress (n/200 inserts,
  day n/14). Nothing else gates it.
- **Surface integrity:** dead links on the deployed user-facing surfaces —
  including cross-app hrefs (nlqdb.com → docs.nlqdb.com) — counted by
  sweeping built output; target 0.
- **Human queue:** depth of `docs/blocked-by-human.md` and the age in days
  of its top bullet — the founder is the one non-automatable actor, so the
  queue head's age is the company's real cycle time. Also record open-PR
  count + oldest open-PR age.
- **Top lines:** the weekly focus number (set by `/weekly` — don't
  overwrite it mid-week), then "worst number today" + which lane owns it,
  then the top `blocked-by-human.md` bullet + its days-blocked — restated
  every run until done. When any queue bullet carries a condition gate,
  also restate its progress (n/N criteria green).

**Dogfood workload (the KPI 1 instrument, `GLOBAL-041`).** Every run writes
its **run log**, its **"Last change" delta** and any **new blocked-by-human
item** to the hosted dogfood nlqdb database through `@nlqdb/sdk` — not to
markdown. Write the record as the run produced it; never pre-model a field
so the write succeeds. A write that lands with a field the schema had not
seen is a KPI 1 hit; one that errors or needs a manual step is a miss —
record it in the scorecard the same run. The DB id and the window's start
date live in the scorecard header. Until the extend path exists (Phase A
item 1), every such write is a miss and the instrument reads honestly at 0 %.

### 2 — One lever, measured

Pick the smallest change that moves the weekly focus number (or, if none is
set, the worst **agent-movable** number). Skip dark or founder-blocked
metrics when *choosing the lever* — still report them, but never pick a
target no single run can move. Lever order:

**Usefulness first:** the DBA must act on a real database, observably.
Walkers, GSC, blog, SEO, Show HN wait.

1. **`GLOBAL-041` — the DBA acts.** Current slice is Phase A KPI 1
   (first-insert inference): the Phase A build order (`kind=extend` plan →
   extend prompt → `compile-write-ddl` → validator → one transaction →
   `schema_hash` rewrite → trace parity → dogfood writes → E2E walk). Then
   KPI 2, then **KPI 3 (optimizer yield) + the dashboard** — inspect,
   index, before/after, one-click apply/undo. That is the moat. A missing
   instrument is a lever; so is any slice that moves those KPIs.
2. **A broken land→ask path** only if it blocks the DBA from acting.
   Chromium walker / FLOW-005 / stranger-test launch fixes are not the
   focus.
3. **Meta last, written waiver required:** D5 doc cleanup only after this
   run states why no DBA lever is pullable. Acquisition stays paused.

**If no lever clears that bar, don't manufacture one:** record the finding
and end the run with only the step-1 scorecard update — a null run is a
valid outcome; busywork is not.

**Four nulls in a row earn one proposal:** after **4** consecutive null runs
(`git log`) — the lever taxonomy is exhausted, not the work — this run may
add **one** new-lever proposal (a workload, a product-wedge slice) as a
bullet at its yield rank in `docs/blocked-by-human.md`: written for founder
review, **never self-executed**, the run still a null. One proposal, then
back to nulls until it is answered.

Write this run's delta (and any revert note) as the "Last change" record
through the dogfood workload above. One lever per run.

### 3 — Ship

One PR per run, small diff. `CLAUDE.md` §8 gates green before pushing. The
PR body must name: the number moved, before → after values, the GLOBAL-025
KPI advanced, and that none degrade.
**A PR whose body names no measured delta does not merge**, with one
exception: a null run's PR (step 2) ships only the step-1 scorecard update
and names the recorded finding in place of a delta. Ending without a delta
for any other reason means the measurement is broken — ship the measurement
fix instead. Open the PR without asking for permissions.

No auto-merge tier and no branch protection: [`/review`](review.md) — the
next run's mode once this PR is open — is the merge gate, CI state included.
Don't re-propose either.
