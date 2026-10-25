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

**The work under drive is the fixed
[`GLOBAL-043`](../../docs/decisions/GLOBAL-043-attach-first-autonomous-dba.md)
sequence in step 2** (founder steer 2026-10-22, re-sequenced 2026-10-23):
build the attach product on synthetic databases, then the Postgres spike and
the D1 attach on the real rateme12, each ending in a measured delta, then the
deletion series, then the playbook. Depth only — love over reach
([`END_GOAL.md`](../../docs/END_GOAL.md)).
Onboarding, UX, and performance stay at their [`GLOBAL-025`](../../docs/decisions/GLOBAL-025-north-star.md) floors on every change.
This loop's job is to advance the current
[`GLOBAL-042`](../../docs/decisions/GLOBAL-042-dogfood-iteration-loop.md)
dogfood iteration — read its brief
[`002-rateme12-attach.md`](../../docs/history/dogfood-iterations/002-rateme12-attach.md)
first (001, the migrate plan, is retired) — and, when one ends, log its retro and clean up before the next.
Acquisition, content and the EK track are paused (`GLOBAL-043`): no channel,
content or marketplace lever; existing pages stay live.

## Operating rules (non-negotiable)

1. Read `CLAUDE.md` fully first and obey P1–P6 and the §8 quality gates.
   Then [`docs/END_GOAL.md`](../../docs/END_GOAL.md) and only the docs the
   lever touches — its §5 path-map `FEATURE.md`. A lever that changes the
   engine is the fixer in that doc: the four pillars and design for
   leverage, before any code.
2. **No change without a number.** Before touching code, name the scorecard
   number you intend to move, and its current value. If you cannot name one,
   either do D5 deletion/cleanup (docs over 20 KB, dead code, stale prose)
   or end the run as a null run (step 2) — never build. **Suite pass-counts
   and new-test counts are never the number moved:** a test is evidence,
   not a delta. Name the scorecard row (or a named direct input to one) the
   fix moves.
3. **Measure → change → re-measure.** Engine work: KPIs A–C
   (`GLOBAL-043`) on the attached DB — p95 per fingerprint before/after
   apply (on D1 also rows read) — or the step's E2E walk. **No live free-LLM probes inside a PR** — they burn
   the shared daily quota (PR #1179 could not be re-walked); regression
   checks run on recorded fixtures, one budgeted live canary a day. UX-flow work: the stranger-test walkers
   (`scripts/stranger-test.sh`, `scripts/flow-005-walk.sh`). Δ ≥ 0 on the
   number you meant to move keeps; a drop reverts with a one-line note in
   the scorecard. Name the other pillar this diff can move. Where that
   floor already has a reading (`GLOBAL-025`), re-measure it; a drop
   reverts the same way.
4. `docs/blocked-by-human.md` is founder-only: add a bullet only for
   actions an agent cannot perform (prod secrets, console clicks,
   money/legal). Numbered steps with links — no **Answer** field. Delete
   the bullet when the steps are done. Reports and the scorecard list the
   **title** only, never the body. Never park a value-decidable decision
   there (GLOBAL-033). A true founder bet that no codified decision settles
   goes in as a 🔒 decision-to-lock bullet. Rank by user-yield per
   founder-minute; a new bullet opens with `⏱ estimate · blocked since date`
   and slots by rank. A fix that costs money is not a fix
   (`docs/cost-ladder.md`) — never propose spend as a resolution.
5. **Monetization is settled** (`GLOBAL-043`): the shipped premium tier
   stays as is; no pricing, meter or plan work for the DBA product. There is no access gate — the product is open pre-beta
   (`GLOBAL-007`).
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
   — or pull a different lever. **Suspended while the step-2 sequence
   runs:** consecutive sequence steps are the plan, not a rut.
8. **Dark metrics don't loop.** A scorecard row blocked/carried 3+
   consecutive runs: stop re-attempting it in step 1, mark it dark with a
   days-blocked count, and make sure its root blocker (if human-only) is in
   `blocked-by-human.md` at its yield rank with a days-blocked count. Never
   pick a dark metric as the lever.
9. **Depth only** (`GLOBAL-043`): no lever adds or polishes breadth —
   other-language SDKs, framework wrappers, premium tier, BIRD/Spider beyond
   the alarm. Existing surfaces get fixes only.

## The loop, in order

### 1 — Measure first (always)

Regenerate `docs/scorecard.md` (current-state tracker, ≤ 20 KB — the metrics
table + the header lines, no changelog):

- **Engine — the `GLOBAL-043` KPIs first:** (A) time-to-first-proposal
  after attach; (B) proposals applied with a measured p95 improvement per
  attached DB per 30 d (on D1 with the rows-read delta); (C) regressions
  auto-reverted / applied. Read each on the Postgres spike DB and on
  rateme12's D1; until they attach, on the step-2 item 1a synthetic DB,
  labelled synthetic. Where the instrument doesn't exist yet, write
  `unmeasured — item 1a builds the instrument`. BIRD/Spider: report only
  the regression-alarm state (last green / red, `SK-QUAL-002`) — never a
  target, never a re-measure lever.
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
- **Gates:** the spike's verdict (pending / pass / fail, the measured
  delta) and the love gate — returning builders (n/10).
- **Surface integrity:** dead links on the deployed user-facing surfaces —
  including cross-app hrefs (nlqdb.com → docs.nlqdb.com) — counted by
  sweeping built output; target 0.
- **Human queue:** depth of `docs/blocked-by-human.md` and the age in days
  of its top bullet — the founder is the one non-automatable actor, so the
  queue head's age is the company's real cycle time. Also record open-PR
  count + oldest open-PR age.
- **Top lines:** the weekly focus number (set by `/weekly` — don't
  overwrite it mid-week), then "worst number today" + which lane owns it,
  then the top `blocked-by-human.md` **title** + its days-blocked. When a
  queue bullet carries a condition gate, also note progress (n/N green).

**Dogfood canary (regression check until the deletion series removes `insert()` — `GLOBAL-043`).** Every run writes
its **run log**, its **"Last change" delta** and any **new blocked-by-human
item** to the hosted dogfood nlqdb database through `@nlqdb/sdk` — not to
markdown. Write the record as the run produced it; never pre-model a field
so the write succeeds. A write that lands with a field the schema had not
seen is a canary hit; one that errors or needs a manual step is a miss —
record it in the scorecard. The DB id lives in the scorecard header. The prod key crosses only the CI
boundary, so `dogfood-write.yml` writes on each merge to `main`, after the
run: step 1 reads the verdicts of every Dogfood write run since the last
scorecard update into the scorecard, and every MISS is inspected this run.

### 2 — One lever, measured

**No lever picker — the run takes the first unfinished step of this
sequence** (founder steer 2026-10-22, [`GLOBAL-043`](../../docs/decisions/GLOBAL-043-attach-first-autonomous-dba.md);
rule 6 and a met draft still come first). A step spanning runs takes the
next run too; a human-blocked step is skipped to the next.

1a. **Build the attach product on synthetic databases** — needs no
   founder secret. The next unmerged slice of
   `GLOBAL-043`'s roadmap item 1a, one per run, tested in CI against a seeded
   Postgres with `pg_stat_statements` (and a throwaway D1 for the D1 slice).
   Number: KPI A, B or C on the synthetic DB, labelled synthetic.
1b. **The Postgres spike and the D1 attach** — each track starts once its
   secret is set and 1a's slices for its engine are merged, and then outranks
   1a; runs may alternate, each ends with a measured delta. *Spike* (market proof): attach
   to the founder-picked real-traffic Postgres (`SPIKE_PG_URL`), proposals
   from Tiers 0–2, apply ONE index, before/after p95 on its hot fingerprint,
   recorded with its inverse. *Dogfood*: attach to the real rateme12's D1
   (`RATEME12_D1_TOKEN`) per
   [`002-rateme12-attach.md`](../../docs/history/dogfood-iterations/002-rateme12-attach.md).
   Numbers: KPI A; KPI B = 1 applied index with its p95 delta (D1: and
   rows read). The spike's pass/fail is the founder's call on that delta.
2. **Deletion PR series** — only after the spike passes; one subsystem
   per PR, deletion-only, CI green, in `GLOBAL-043`'s deletion list order.
   Number: LOC removed, KPIs A–C unchanged.
3. **Playbook proposal kinds** in `GLOBAL-043` order, Postgres and D1
   each. Number: KPI B per kind; KPI C held at 100 %.

**If every step is done or human-blocked, don't manufacture a lever:** record the finding
and end the run with only the step-1 scorecard update — a null run is a
valid outcome; busywork is not.

**Four nulls in a row earn one proposal:** after **4** consecutive null runs
(`git log`) — the lever taxonomy is exhausted, not the work — this run may
add **one** new-lever proposal (a workload, a product-wedge slice) as a
bullet at its yield rank in `docs/blocked-by-human.md`: written for founder
review, **never self-executed**, the run still a null. One proposal, then
back to nulls until it is answered.

Write this run's delta (and any revert note) as the "Last change" record
through the dogfood canary above: rewrite the scorecard's `## Last change`
entry as `**date (run N)** — **headline**` every run, since the canary keys
the run number and row deltas off it (runs 250–251 skipped it: their run
records were never written and their row deltas filed under run 249).
One lever per run.

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
