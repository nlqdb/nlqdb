# WS-09 — "Database, not a vector store" blog + live in-page demo

**Status:** 🟡 1/2 — blog draft ✅ (run 30); live `/agents` demo pending (run 1, after WS-07 page ships)
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

- [ ] Live demo on `/agents` runs a real aggregation with SQL reveal, gate-honest. *(run 1 — deferred: collides with the in-flight WS-07 `/agents` page, PR #430; lands once that page exists.)*
- [x] Blog draft in `distribution-queue.md` with **measured** numbers + matrix + harness link. *(run 30 — post drafted before the demo because run 1 collides with open PR #430; BIRD 0.52 / Spider 0.1852 from `eval-baseline.ts`, honest gap shown, WS-06 matrix embedded, `tools/eval/` linked.)*
- [x] No produced video; no over-claim past the measured eval. *(live in-page demo supersedes the video; numbers shown sub-target.)*
- [x] INDEX tracker + status ticked.

## Artifact

The blog post itself (queued for founder review at the weekly session).

## Rollback

Remove the demo panel; the queued draft is non-shipping until published.
