# WS-08 — On-brand OG / social images for the wedge surfaces

**Status:** ⬜ not started
**Sequence:** 8 of 13 · **Risk:** low · **Runs:** ~2 · **Prereqs:** WS-07 ✅ · **Gate:** none

## Goal

Today there is **one** static social card (`og-default.png`) and **no
per-page OG route**. When the wedge is shared on HN/X/Reddit, the card is the
first thing a human sees — it must say "analytical memory for AI agents", not
the generic default. Add per-surface, **on-brand, type-on-dark** cards for
`/agents` and the memory `/vs` pages (SK-PIVOT-004 — no screenshots, no stock).

## Scorecard number it moves

Distribution: share-click-through on the wedge links. Indirect; treat as
"wedge OG live" boolean on `Pivot:`.

## Read first

- `apps/web/src/layouts/Base.astro:44-55` (current OG/Twitter wiring; single default)
- `apps/web/public/og-default.png` (the one card today, 1200×630)
- Manifesto tenet 08 (palette + the no-imagery rule the cards must obey)

## Steps

1. Decide static-vs-generated. Default: a small build-time generator (e.g.
   Satori/`@vercel/og`-style at build, or hand-authored SVG→PNG) producing
   1200×630 cards in the brand palette (`#c6f432` on `#0b0f0a`, JetBrains
   Mono) — **type + the matrix glyphs only**, no UI screenshots. Keep it
   inside the static-Astro / Workers free-tier envelope.
2. Wire `Base.astro` to accept a per-page `ogImage`; set it on `/agents` and
   each memory `/vs` page.
3. Provide an `/agents` card ("Memory your agent can query — `GROUP BY` your
   agent's memory") and one per memory competitor ("nlqdb vs Zep: …").
4. `bun run --filter @nlqdb/web check`; verify cards render at 1200×630 and
   are referenced in `<head>`.

## Done when

- [ ] Per-page `ogImage` supported in `Base.astro`.
- [ ] `/agents` + memory `/vs` pages each set an on-brand card (no raster screenshot).
- [ ] Bundle/build stays in the free-tier budget.
- [ ] INDEX tracker + status ticked.

## Artifact

Post the `/agents` card + link as the X/Bluesky launch image →
`distribution-queue.md`.

## Rollback

Remove the generator + per-page `ogImage` refs; pages fall back to `og-default.png`.
