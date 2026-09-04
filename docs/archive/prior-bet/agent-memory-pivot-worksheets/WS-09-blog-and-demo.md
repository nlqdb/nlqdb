# WS-09 — "Database, not a vector store" blog + live in-page demo

**Status:** ✅ 2/2 — blog draft ✅ (run 30); live `/agents` demo ✅ (run 41, fixture round-trip)
**Sequence:** 9 of 13 · **Risk:** med · **Runs:** ~2 · **Prereqs:** WS-06 ✅ · **Gate:** none

## Goal

The framing doc's "one blog post + one demo" launch, executed on-brand: a
technical post **"Why agent memory should be a database, not a vector store"**
plus a **live in-page demo** (not a produced video — SK-PIVOT-004) that runs a
real `GROUP BY` over an `agent_memory` table.

## Scorecard number it moves

Distribution: the post is the HN/lobste.rs/dev.to artifact; the demo lifts
`/agents` comprehension → conversion (registered first answer). `Pivot:`
"launch post drafted".

## Read first

- `docs/features/web-app/FEATURE.md` + how `<nlq-data>` demos render on `/vs` pages (the "Try this query →" pattern)
- `docs/research/deepseek-moat-framing.md` (post outline: Replit incident → vector-memory fails at analytics → typed-plan pipeline → BIRD/Spider numbers → open eval harness)
- `docs/features/quality-eval/FEATURE.md` (cite real BIRD/Spider numbers, not aspirational ones)

## Steps

1. **Run 1 — the live demo.** On `/agents`, an `<nlq-data>`-driven panel (or
   the carousel mechanism) executing an aggregation over a demo `agent_memory`
   table, with the compiled SQL revealed. The demo runs against a fixture
   path, not an open `/v1/ask`.
2. **Run 2 — the post.** Draft the long-form post into
   `distribution-queue.md` (newest first). Walk: the Replit `DROP DATABASE`
   postmortem → why vector recall can't `GROUP BY` → the typed-plan trust
   boundary → **measured** BIRD/Spider numbers (from `tools/eval/baseline-2026-06-15.json`, with
   the honest gap, not a cherry-picked frontier figure) → link the open eval
   harness (`tools/eval/`). Embed the WS-06 matrix.

## Done when

- [x] Live demo on `/agents` runs a real aggregation with SQL reveal. *(run 41 — fixture round-trip: `agent_memory` rows → English goal → compiled `GROUP BY` SQL → result table, all server-rendered (crawlable / no-JS) per SK-PIVOT-004; the "Run this query" button replays a pulse + fires `agents.demo_run_clicked` (GLOBAL-024). No open `/v1/ask` call. WS-07 page now exists, clearing the #430 collision.)*
- [x] Blog draft in `distribution-queue.md` with **measured** numbers + matrix + harness link. *(run 30 — post drafted before the demo because run 1 collides with open PR #430; BIRD 0.52 / Spider 0.1852 from `tools/eval/baseline-2026-06-15.json`, honest gap shown, WS-06 matrix embedded, `tools/eval/` linked.)*
- [x] No produced video; no over-claim past the measured eval. *(live in-page demo supersedes the video; numbers shown sub-target.)*
- [x] INDEX tracker + status ticked.

## Artifact

The blog post itself (queued for founder review at the weekly session).

## Rollback

Remove the demo panel; the queued draft is non-shipping until published.
