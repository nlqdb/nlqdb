# D-06 — The public memory dashboard on `/agents`

**Status:** ⬜ not started
**Sequence:** Dogfood 6 of 7 · **Risk:** med · **Runs:** ~2 · **Prereqs:** D-04 (there must be a real corpus to show) · **Gate:** none

## Goal

A public block on `/agents` that shows **nlqdb's own memory DB, aggregated** —
how many facts / episodes / entities the ops workload holds, what it wrote most
recently, and the answers to two or three of D-03's real analytical queries,
rendered as result tables in the brand system.

Not a marketing widget: it is the gate's fifth criterion and the launch's own
proof surface. A visitor should be able to read it and conclude *"they actually
run on this."*

## SK-PIVOT-016 criterion / number it moves

**Criterion 5** — "the live memory dashboard is public on `/agents`" — the last
of the five and the only one that is a shipped surface rather than a
measurement. Also feeds the wedge-conversion funnel (`GLOBAL-036`: a registered
user reaching a first answer) via the existing `/agents` CTA.

## Read first

- [`SK-PIVOT-016`](../../decisions/SK-PIVOT-016-dogfood-launch-gate.md) —
  criterion 5's exact wording
- `docs/features/web-app/FEATURE.md` — **mandatory** per `AGENTS.md` §5 for
  `apps/web/**`
- `apps/web/src/pages/agents/index.astro` — the page, and the **existing
  server-rendered demo block** (WS-09: `agent_memory` rows → English goal →
  compiled SQL → result table). This slice's block sits beside it and should
  borrow its shape rather than invent one.
- `SK-PIVOT-004` in [`../../FEATURE.md`](../../FEATURE.md) — visualizations stay
  code/CSS in the brand system: acid-lime on near-black, JetBrains Mono, hard
  shadows. **No** raster screenshots, no chart images.
- [`SK-PIVOT-012`](../../decisions/SK-PIVOT-012-og-cards.md) — the repo's
  committed-artifact-plus-manual-generator pattern, and *why* it keeps
  rasterisers and heavy work out of `astro build` (`GLOBAL-013`, CF free tier).
  The same reasoning drives the data source below.

## Mechanism — a sync-refreshed committed snapshot, not a live credential

**Default (ship this):** the dashboard renders from a committed aggregates JSON
that D-02's re-sync workflow refreshes — the numbers move whenever the corpus
moves — with the **refresh timestamp printed on the page**.

Why, anchored in decisions that already exist:

- A public page cannot hold an `sk_live_*` key, and creating an
  unauthenticated aggregate endpoint to work around that adds a new public
  egress surface for a marketing block — cost out of proportion to the claim.
- `SK-PIVOT-012` already established committed static artifacts + a generator
  outside `astro build` as this repo's answer for exactly this trade-off, for
  `GLOBAL-013` free-tier reasons.
- `SK-PIVOT-019` requires run dates printed beside published numbers; printing
  the refresh timestamp applies the same honesty rule here. **A number without
  its as-of date is the dishonest version of this block** — a reviewer rejects
  that.

**Aggregates only.** Counts, distributions, timestamps, and the result tables of
named golden queries. Never raw memory rows — the corpus is derived from public
markdown today, but the dashboard is a *pattern* the wedge invites users to copy,
and the pattern must not be "publish your memory rows."

**Open founder call, default stands until answered:** whether a
sync-refreshed snapshot satisfies criterion 5's word *"live"*. Reading it as
"refreshes on every corpus change, with the as-of date printed" is the default
and is what this worksheet builds. If the founder wants request-time freshness,
that is a **tightening** of criterion 5 (allowed to the founder) and adds a
public aggregate endpoint to this slice's scope. Do not silently pick the looser
reading; do not block on the question either.

## Steps

1. **Run 1 — the aggregates + the block.** A generator (run by D-02's workflow,
   not by `astro build`) writes an aggregates JSON: per-table counts, most-recent
   write timestamp, and the result sets of 2–3 named D-03 golden queries. Render
   a server-rendered `/agents` block from it in the brand system, with the as-of
   timestamp visible. Wire the existing demand-signal event pattern per
   `GLOBAL-024`.
2. **Run 2 — honesty + guards.** Print the corpus's own provenance (this is
   nlqdb's `docs/`, extracted by the D-01 skill, synced by D-02). Add a test
   that fails if the aggregates JSON is missing its `as_of` field or is older
   than a stated staleness bound — the `WS-06` `MATRIX_VERIFIED_ON` pattern,
   which this repo already uses to stop a surface asserting stale facts. Confirm
   no raw memory row reaches the page.

## Done when

- [ ] A public, server-rendered memory block is live on `/agents`, in the brand
      system, no raster imagery (`SK-PIVOT-004`).
- [ ] Aggregates come from a committed JSON refreshed by D-02's workflow; the
      generator is **out of** `astro build` (`GLOBAL-013` / `SK-PIVOT-012`).
- [ ] The **as-of timestamp is printed on the page**; a test fails if `as_of` is
      absent or past the staleness bound.
- [ ] Aggregates only — a test or inspection confirms no raw memory row is
      rendered.
- [ ] 2–3 D-03 golden queries are shown with their real result tables.
- [ ] Demand-signal event fires per `GLOBAL-024`.
- [ ] `bun run --filter @nlqdb/web check && test` green; lint with explicit paths.
- [ ] Criterion 5 ticked in [`INDEX.md`](INDEX.md)'s gate table; INDEX tracker +
      status ticked.

## Artifact

This block *is* the launch demo (`blocked-by-human.md` bullet #2 names it).
Once live, the artifact owed is the queue draft that points at it — write it
from the D-04 run's real numbers, including the failures.

## Rollback

Remove the block; `/agents` loses a section and nothing else — it has no data
dependency on the rest of the page. If the aggregates go stale, the staleness
test reddens CI before the page can quietly assert an old number, which is the
intended failure mode.
