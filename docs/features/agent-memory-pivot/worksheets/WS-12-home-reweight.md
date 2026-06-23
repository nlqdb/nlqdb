# WS-12 — Home reweight: agent-memory primary + demote P1/P3/P4 to an "also works for…" fold

**Status:** ✅ 2/2 — band shipped (run 43); "also works for…" fold shipped (run 44)
**Sequence:** 12 of 13 · **Risk:** med · **Runs:** ~2 · **Prereqs:** WS-06 ✅, WS-07 ✅ · **Gate:** none

## Goal

Make agent memory the **primary narrative** on the `nlqdb.com` home page and
demote the other three personas to a clearly-secondary "also works for…"
sub-section (founder choice: *Demote to a sub-section*). **Reorder + add a
band; do NOT change the wordmark/hero lede** — that lead string is WS-13.

## Scorecard number it moves

Onboarding: home → waitlist conversion for the agent-builder reader, and the
home → `/agents` click-through. `Pivot:` "home reweighted".

## Read first

- `docs/features/web-app/FEATURE.md`
- `apps/web/src/pages/index.astro:22-31` (section composition order)
- `messaging-surface-map.md` §A (which strings are gated vs movable)
- `GLOBAL-036` (dual front door + demote, but headline stays until WS-13)

## Steps

1. Insert an **agent-memory band** high in `index.astro` (after Hero): a
   short wedge statement + the WS-06 matrix teaser + a "See `/agents` →" CTA
   (demand-signal event per `GLOBAL-024`).
2. Demote the multi-persona content (the `Replaces` / `CodePanel` /
   persona-spread framing) into an **"also works for solo builders, analysts,
   and backend engineers"** fold lower on the page — present, secondary, not
   deleted.
3. Keep `Hero.astro` wordmark + lede **unchanged** (gated to WS-13).
4. `bun run --filter @nlqdb/web check` + test + Lighthouse parity (the home
   is the 100/100/100/100 surface — don't regress it).

## Done when

- [x] Agent-memory band is the first narrative section after the hero, with the matrix teaser + `/agents` CTA. (run 43 — `AgentMemoryBand.astro` after `<Hero />`; reuses `AgentMemoryMatrix`; `/agents` CTA fires `home.agents_cta_clicked` GLOBAL-024 signal)
- [x] P1/P3/P4 content lives in a clearly-secondary "also works for…" fold; nothing deleted. (run 44 — `AlsoWorksFor.astro` quiet divider inserted before `CodePanel` + `Replaces`: muted kicker/heading/lede, no accent, no CTA, no JS, so the general-purpose persona framing reads as a section break below the wedge. Composition-only; nothing removed.)
- [x] Hero wordmark/lede untouched; Lighthouse unchanged. (no JS added, one static section, hero file not touched)
- [x] INDEX tracker + status ticked.

## Artifact

Append a "we put agent memory front and centre" build-in-public note →
`distribution-queue.md`.

## Rollback

Revert the `index.astro` section reorder + remove the band — the hero and all
sub-components are unchanged, so this is a composition-only revert.
