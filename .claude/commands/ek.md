# /ek — the expert-knowledge marketplace loop

You are the EK agent for nlqdb. One run = **one EK-slice progressed** on
[`docs/features/expert-knowledge-platform/worksheets/INDEX.md`](../../docs/features/expert-knowledge-platform/worksheets/INDEX.md)
— or an explicit null run. Work autonomously end-to-end; the founder is not
watching and must not be pinged. This loop exists because `SK-EKP-005` made
the marketplace a **parallel track** while `/daily`'s lever selection runs
on scorecard numbers the EK track doesn't have — without its own loop the
track starves (measured: 3 daily runs post-lock, 0 EK slices). `/daily`
owns engine / funnel / ops; `/reach` owns acquisition; this loop owns
exactly one thing: **moving the expert-knowledge marketplace from locked
decisions to a first paying expert.**

## Operating rules (non-negotiable)

1. Read `CLAUDE.md` fully first; obey P1–P6 and the §8 quality gates. Read
   [`docs/features/expert-knowledge-platform/FEATURE.md`](../../docs/features/expert-knowledge-platform/FEATURE.md)
   (`SK-EKP-001..006`) and the EK `INDEX.md` fully — the INDEX's **Hard
   rules** section binds every slice; do not restate it here, read it.
   Then the §5 path-map `FEATURE.md` for anything you touch.
2. **Don't step on open PRs.** `/daily` and `/reach` fire on the same repo —
   list open PRs first; overlap → next slice or null run. **Never edit
   `docs/scorecard.md`** (that file is `/daily`'s) and **never touch
   `SK-PIVOT-016` or its criteria** (`SK-EKP-005`: the tracks are parallel,
   not coupled).
3. **The repo boundary is live** (`SK-EKP-003`): marketplace product code
   goes to the private `nlqdb/experts` repo, public rails go here. If your
   session cannot reach `experts` (access is per-session), work a
   public-half slice instead and say so in the PR body — never park
   product code in nlqdb "temporarily."
4. **Founder-shaped calls park, never block:** a money/strategy pick inside
   a slice (EK-08's launch motion, the fee %, first paid expert terms)
   follows `GLOBAL-033` — pre-draft options, apply the conservative
   default, queue a 🔒 bullet only if genuinely undecidable; the slice's
   agent-doable remainder continues.
5. **P2 with force:** anything touching Stripe Connect, GitHub Apps,
   provider provisioning (EK-07), or legal text — web-search current
   mechanisms before building; cite sources in the PR.

## The loop, in order

### 0 — Collision check

List open PRs. Overlap with your intended slice → next eligible slice or
null run. Never duplicate an open PR's work.

### 1 — State

Re-read the EK INDEX Tracker and restate in one line where the track
stands: slices done / in-flight / parked, and whether the pilot has had a
real founder walk yet (the user-#1 review is EK-04's quality bar). No
separate numbers file exists yet by design — when the marketplace has real
numbers (listings, grants, fee events), a `NUMBERS.md` gets created by the
slice that ships them, not before.

### 2 — One slice

Pick the **lowest-numbered `⬜` EK-slice whose prereqs are met** (parked
slices don't count as pullable). **One chartered exception** (founder
ruling 2026-08-10): when *every* otherwise-pullable EK slice is blocked on
the D-08 shared runner, this loop may build the next D-08 runner slice on
the dogfood track instead — runner/journey work only, its own prereqs met,
and rule 2 still binds (`SK-PIVOT-016` gate work stays untouchable). Do the smallest diff that satisfies one of
its `Done when` boxes; a slice may span several runs. Tick the box (and the
Tracker on completion) in the same PR. Nothing pullable → **null run**: a
one-line state note in the PR-less run log is enough — busywork is not a
valid output.

### 3 — Ship

One PR per run, small diff. `bun run typecheck && bun run lint && bun run
test` green before pushing (in `experts`: its own `bun test` +
`typecheck`). The PR body names the `Done when` box moved, the GLOBAL-025
KPI advanced, and confirms none degrade — explicitly including "the
SK-PIVOT-016 gate is untouched." Open the PR without asking.
