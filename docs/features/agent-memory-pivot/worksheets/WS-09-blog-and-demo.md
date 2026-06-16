# WS-09 — "Database, not a vector store" blog + live in-page demo

**Status:** ⬜ not started
**Sequence:** 9 of 13 · **Risk:** med · **Runs:** ~2 · **Prereqs:** WS-06 ✅ · **Gate:** none

## Goal

The framing doc's "one blog post + one demo" launch, executed on-brand: a
technical post **"Why agent memory should be a database, not a vector store"**
plus a **live in-page demo** (not a produced video — SK-PIVOT-004) that runs a
real `GROUP BY` over an `agent_memory` table.

## Scorecard number it moves

Distribution: the post is the HN/lobste.rs/dev.to artifact; the demo lifts
`/agents` comprehension → waitlist. `Pivot:` "launch post drafted".

## Read first

- `docs/features/web-app/FEATURE.md` + how `<nlq-data>` demos render on `/vs` pages (the "Try this query →" pattern)
- `docs/research/deepseek-moat-framing.md` (post outline: Replit incident → vector-memory fails at analytics → typed-plan pipeline → BIRD/Spider numbers → open eval harness)
- `docs/features/quality-eval/FEATURE.md` (cite real BIRD/Spider numbers, not aspirational ones)

## Steps

1. **Run 1 — the live demo.** On `/agents`, an `<nlq-data>`-driven panel (or
   the carousel mechanism) executing an aggregation over a demo `agent_memory`
   table, with the compiled SQL revealed. Honest about the pre-alpha gate:
   the demo runs against a fixture/allowed path, not an open `/v1/ask`.
2. **Run 2 — the post.** Draft the long-form post into
   `distribution-queue.md` (newest first). Walk: the Replit `DROP DATABASE`
   postmortem → why vector recall can't `GROUP BY` → the typed-plan trust
   boundary → **measured** BIRD/Spider numbers (from `eval-baseline.ts`, with
   the honest gap, not a cherry-picked frontier figure) → link the open eval
   harness (`tools/eval/`). Embed the WS-06 matrix.

## Done when

- [ ] Live demo on `/agents` runs a real aggregation with SQL reveal, gate-honest.
- [ ] Blog draft in `distribution-queue.md` with **measured** numbers + matrix + harness link.
- [ ] No produced video; no over-claim past the measured eval.
- [ ] INDEX tracker + status ticked.

## Artifact

The blog post itself (queued for founder review at the weekly session).

## Rollback

Remove the demo panel; the queued draft is non-shipping until published.
