# WS-13 — Headline reposition (wordmark / README / llms.txt / JSON-LD lead)

**Status:** ✅ shipped 2026-06-24 (founder tripped the gate — SK-PIVOT-013)
**Sequence:** 13 of 13 · **Risk:** high · **Runs:** ~2 · **Prereqs:** WS-07 ✅, WS-12 ✅ · **Gate:** 🔓 **founder go given 2026-06-24**

## Goal

The single irreversible brand bet: swap the **lead strings** so nlqdb leads
with analytical agent memory sitewide. This is the **last** slice and ships
**only on an explicit founder go** (GLOBAL-036). Everything before it was
additive; this one rewrites identity.

## Do NOT start this worksheet unless

- The founder has explicitly said "do the headline swap" **at a weekly
  session** (not inferred from a chat aside), AND
- `/agents` (WS-07) + the matrix (WS-06) are live, AND
- The funnel `Pivot:` line shows **non-zero wedge-sourced waitlist rows**
  (evidence the wedge converts before betting the brand on it).

If any is unmet: leave `⬜`, do a lower-numbered or non-pivot lever instead.

## The four lead strings (the gate list from `messaging-surface-map.md`)

1. Home hero lede — `apps/web/src/components/Hero.astro:24-28`
2. README H1 + tagline — `README.md:1,3`
3. `llms.txt` lede — `apps/web/src/pages/llms.txt.ts:42-51`
4. Root `package.json` description + sitewide default `<title>`/JSON-LD in `Base.astro`

## Steps (only after the gate)

1. Agree the exact new lede with the founder (e.g. "Analytical memory for AI
   agents — a database your agent queries in English."). Record it as a new
   `SK-PIVOT-*` decision (the lede is load-bearing and expensive to reverse).
2. Update the four lead strings consistently. Keep the generalist umbrella
   reachable (the dual front door survives — the demoted personas stay one
   click away, per WS-12).
3. Update OG default + the `SoftwareApplication` JSON-LD `description`.
4. Full check + Lighthouse + the stranger-test walkers (the hero is the
   60-second on-ramp surface).

## Done when

- [x] Founder go recorded; the new lede is a documented `SK-PIVOT-*` decision (SK-PIVOT-013).
- [x] All four lead strings swapped consistently; generalist umbrella still reachable (hero input + `AlsoWorksFor` fold + off-wedge `/vs`/`/solve` pages kept).
- [x] Build + web tests green on the new hero (full Lighthouse/stranger-walk re-run on the live deploy).
- [x] INDEX tracker + status ticked.

**Shipped lede (SK-PIVOT-013):** "Analytical memory for AI agents." + support
clause "a real database your agent connects to over MCP and queries in English —
GROUP BY, JOIN, aggregate over what it remembered, not just the top-k a vector
store recalls." Surfaces swapped: `Hero.astro` lede/sub, `README.md` H1+tagline,
`llms.txt.ts` lede, homepage `index.astro` `<title>`+description (JSON-LD), root
`package.json` description, `Base.astro` default `ogImageAlt`; homepage OG card →
`/og/agents.png`. Bundled with the `/agents` connect-via-MCP CTA rebuild.

## Artifact

The relaunch announcement (HN/X/blog) → `distribution-queue.md`.

## Rollback

`git revert` the lead-string commit. Because every prior slice was additive,
reverting *only* this commit returns the brand to the generalist headline
with the full wedge (matrix, `/agents`, memory `/vs` pages) still intact.
