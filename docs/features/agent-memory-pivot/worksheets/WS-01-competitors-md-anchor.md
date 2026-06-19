# WS-01 — Anchor Zep / Letta / LangMem in `docs/competitors.md`

**Status:** ✅ done (2026-06-19, run 19 — branch `claude/sharp-wozniak-y9ee5z`)
**Sequence:** 1 of 13 · **Risk:** low · **Runs:** ~1 · **Prereqs:** none · **Gate:** none

## Goal

Add (or complete) the threat-matrix + gap rows for **Zep, Letta, and
LangMem** in `docs/competitors.md §4 (Agent memory / MCP DB servers)` so the
`/vs` pages in WS-02 have a vetted analytical anchor. The comparison-pages
rule (`SK-CMP-*`) requires a competitor be anchored in `docs/competitors.md`
**before** its page ships.

## Scorecard number it moves

None directly — this is the **prerequisite** that unblocks WS-02 (which moves
the funnel `Pivot:` line). Record it as the day's measurement-enabling slice.

## Read first

- `docs/features/comparison-pages/FEATURE.md` (the anchor rule)
- `docs/competitors.md §4` (Zep & Letta are in prose; LangMem is in neither
  the prose nor the threat matrix today — confirm before editing)
- `docs/research/deepseek-moat-framing.md` (the wedge framing to encode)

## Steps

1. In `§4`, ensure each of Zep, Letta, LangMem has: one-line positioning,
   `Overlaps with`, `Gap nlqdb exploits` (the analytical/`GROUP BY` wedge),
   `Threat vector`, keyed to persona **P2**.
2. Add Letta + LangMem rows to the summary **threat matrix** (Zep/Mem0
   already there). Honest threat ratings.
3. Keep the wedge consistent: "they retrieve facts from a vector store;
   nlqdb is a real database the agent can aggregate over."

## Done when

- [x] Zep, Letta, LangMem each have a `§4` prose entry + a threat-matrix row.
- [x] Each names the analytical-SQL gap (`GROUP BY`/`JOIN`/`HAVING`) as the nlqdb win-zone.
- [x] `docs/competitors.md` still passes its own freshness/format conventions (last-verified line bumped to 2026-06-19 for §4).

## Artifact (daily-loop step 3)

Append to `docs/research/distribution-queue.md`: a short "agent-memory
landscape" note (the §4 table is the seed for the WS-09 blog post).

## Rollback

Revert the `docs/competitors.md` diff — additive prose, no code impact.
