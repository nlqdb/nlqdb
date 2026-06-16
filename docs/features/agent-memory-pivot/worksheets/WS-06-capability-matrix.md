# WS-06 — Mem0 | Zep | Letta | nlqdb capability matrix (new surface)

**Status:** ⬜ not started
**Sequence:** 6 of 13 · **Risk:** med · **Runs:** ~2 · **Prereqs:** WS-01 ✅ · **Gate:** none

## Goal

Build the wedge's signature artifact: the **"What can your agent actually DO
with its memory?"** table — rows = capabilities, columns = Mem0 · Zep ·
Letta · **nlqdb**. New typed data + render (SK-PIVOT-001) — **not** a hacked
`/vs/[slug].astro` (which renders one `them` column only).

## Scorecard number it moves

Onboarding / UX: the matrix is the single most persuasive comprehension
asset for the agent-builder reader. `Pivot:` boolean "matrix live".

## Read first

- `docs/features/comparison-pages/FEATURE.md` (claim honesty; `✓/◐/—` glyph vocabulary)
- `apps/web/src/data/competitors.ts` (`ComparisonClaim` type to reuse)
- `docs/research/deepseek-moat-framing.md` (the canonical row set, ~lines 71-83)

## Steps

1. **Run 1 — data.** New file `apps/web/src/data/agentMemoryMatrix.ts`:
   `type MatrixRow = { capability: string; mem0: Claim; zep: Claim; letta:
   Claim; nlqdb: Claim; note?: string }` (reuse `ComparisonClaim`). Rows from
   the framing doc, **honest only**: remember a fact ✓✓✓✓; recall facts
   ✓✓✓✓; top-N by value — — — ✓; aggregate per group — — — ✓; deals closing
   this month — — — ✓; agent creates its own schema — — — ✓; diff preview
   before writes — — — ✓; self-hostable ◐ (FSL, per WS-10). Add a
   `verifiedOn: "<date>"` constant.
2. **Run 2 — render.** A brand-styled glyph grid component (acid-lime on
   dark, JetBrains Mono; `✓/◐/—`). No raster image (SK-PIVOT-004). Reusable
   by `/agents` (WS-07) and the blog (WS-09). Footer shows `verifiedOn`.
3. Treat a `verifiedOn` date > 60 days old as a daily-loop alert (mirrors the
   engine-row staleness rule).
4. `bun run --filter @nlqdb/web check` + test.

## Done when

- [ ] `agentMemoryMatrix.ts` exists with honest rows + `verifiedOn`.
- [ ] A reusable brand-styled render component (no `<img>`).
- [ ] Every nlqdb `✓` is shippable today; competitor cells sourced from WS-01.
- [ ] INDEX tracker + status ticked.

## Artifact

The matrix is itself the artifact — append a "comparison table" entry to
`distribution-queue.md` (it seeds the WS-09 HN post).

## Rollback

Delete `agentMemoryMatrix.ts` + the component — additive, unreferenced until WS-07/09.
