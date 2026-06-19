# WS-02 — Memory-competitor `/vs` pages (Zep, Letta, LangMem)

**Status:** 🟡 in progress — **Zep ✅** (run 20); Letta + LangMem pending
**Sequence:** 2 of 13 · **Risk:** low · **Runs:** ~3 (one competitor per run) · **Prereqs:** WS-01 ✅ · **Gate:** none

## Goal

Ship a `/vs/{zep,letta,langmem}` page each by adding one `Competitor` entry
to `apps/web/src/data/competitors.ts` (persona `P2 agent builder`). **One
competitor per run** (SK-PIVOT-002) — Zep first, then Letta, then LangMem.

## Scorecard number it moves

Funnel / distribution lane: each page is a new AEO entry point and a
distribution artifact → feeds **waitlist rows** (the worst number). Add to
the `Pivot:` progress line: `+1 memory /vs page`.

## Read first

- `docs/features/comparison-pages/FEATURE.md` (schema, the "How to add" steps, FAQPage JSON-LD)
- `apps/web/src/data/competitors.ts` — copy the **Mem0 entry** (≈L218-284) as the shape template

## Steps (per competitor, per run)

1. Add one `Competitor` object: `slug`, `name`, `url`, `tagline`, `persona:
   "P2 agent builder"`, `oneLiner` ("Pick X if… Pick nlqdb if your agent also
   needs to query structured data…"), `whenChooseUs` / `whenChooseThem`
   (**each bullet ≤ 16 words**), `features` (verifiable rows only — e.g.
   `Aggregations + reporting queries` us `shipped` them `no`; `Vector search`
   us `no` them `shipped`), `faqs` (name the competitor in ≥ 1), `demo`.
2. **Use real MCP tool names only** — `nlqdb_query` / `nlqdb_list_databases`
   / `nlqdb_describe`. Do **not** write `create_database` (the phantom verb
   bug in older entries).
3. Add the new slug to `scripts/verify-flows.sh` (~L169-170) and the
   `tools/stranger-test/` slug list.
4. `bun run --filter @nlqdb/web check` (TS flags missing fields) + the web test.

## Done when (per competitor)

- Zep (run 20): ✅ `/vs/zep` builds (astro-check clean); ✅ bullets ≤ 16 words,
  no phantom MCP verbs, FAQ names Zep; ✅ slug in `verify-flows.sh` +
  `tools/stranger-test/flow-003.ts`; ✅ INDEX ticked.
- Letta: ⬜
- LangMem: ⬜

Closes when all three ship.

## Artifact

Append a Show-HN / Reddit comparison-page draft for the shipped competitor
(or a directory submission) to `distribution-queue.md`.

## Rollback

Delete the `competitors.ts` entry + the slug-list lines — purely additive.
