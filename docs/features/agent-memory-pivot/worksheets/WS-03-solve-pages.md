# WS-03 — Sharpen the agent-memory solve page + add an analytical-queries sibling

**Status:** 🟡 in progress — run 1 done (existing page reframed to the wedge); run 2 (analytical sibling) pending
**Sequence:** 3 of 13 · **Risk:** low · **Runs:** ~2 · **Prereqs:** none · **Gate:** none

## Goal

Move the existing `give-ai-agent-persistent-memory` solve page from
"complementary, not replacement" to the **analytical-memory wedge**, and add
a sibling solve page for the buyer who searches the *analytical* pain ("how
do I run reports over what my agent remembered").

## Scorecard number it moves

Funnel / distribution: sharper AEO pain pages → landing → waitlist. `Pivot:`
line `+1 solve page`.

## Read first

- `docs/features/solve-pages/FEATURE.md` (`SK-SOLVE-001/002/003`, the
  mandatory "what nlqdb doesn't do" + ≥ 2 enduring source URLs)
- `apps/web/src/data/solve.ts` — `give-ai-agent-persistent-memory` (≈L170-222) + `solve.test.ts` (AEO invariants)

## Steps

1. **Run 1 — sharpen the existing entry.** Keep `whatItDoesnt` honest (no
   native vector search → Mem0/pgvector for unstructured recall), but reframe
   `painContext` + `howNlqdbAnswers` around the wedge: the agent stores typed
   rows and later **aggregates** them (`GROUP BY`, top-N, per-period). Update
   the FAQ from "complementary" to "the structured half — and the only half
   that can answer analytical questions."
2. **Run 2 — add the sibling** `SolveEntry` (persona P2), e.g. slug
   `analytical-queries-over-agent-memory`, `searchTitle` written as the NL
   search ("How do I run reports over what my AI agent remembered?"), with
   the `demoGoal` an aggregation over an `agent_memory` table. Honest
   `whatItDoesnt`; ≥ 2 enduring source URLs.
3. `bun run --filter @nlqdb/web test` (solve.test.ts pins the AEO invariants).

## Done when

- [x] Existing page reframed to the wedge; `whatItDoesnt` still honest. *(run 1 — `give-ai-agent-persistent-memory` now leads with retrieval≠analytics + fixes phantom `create_database`/`ask`/`run` MCP tools → real `nlqdb_query`/`nlqdb_list_databases`/`nlqdb_describe`.)*
- [ ] Sibling solve page builds, passes `solve.test.ts`, flows into sitemap/llms.txt.
- [ ] INDEX tracker + status ticked.

## Artifact

A genuinely-helpful answer to a real SO/Reddit/Discord thread about agent
memory analytics, linking the solve page once → `distribution-queue.md`.

## Rollback

Revert the `solve.ts` diff (sibling is additive; the sharpen is a copy diff).
