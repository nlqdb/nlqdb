# WS-07 — Dedicated `/agents` front door

**Status:** ⬜ not started
**Sequence:** 7 of 13 · **Risk:** med · **Runs:** ~3 · **Prereqs:** WS-06 ✅ · **Gate:** none

## Goal

The deep, single-story landing the founder chose as the second front door
(GLOBAL-036): a pure analytical-agent-memory page that HN/Reddit/Discord/MCP
directories link to. **A new route on `nlqdb.com`, not a new domain.**

## Scorecard number it moves

Onboarding (landing → waitlist for the agent-builder persona). Add a
dedicated `/agents` row to the funnel once traffic lands. `Pivot:` boolean
"/agents live".

## Read first

- `docs/features/web-app/FEATURE.md` (page conventions, demand-signal CTAs)
- `apps/web/src/pages/index.astro` + `apps/web/src/components/*` (section components to reuse)
- `apps/web/src/layouts/Base.astro` (per-page title/desc/OG/JSON-LD)
- `apps/web/src/pages/manifesto.astro:117-119` ("not a vector store" line to cite)

## Steps (across runs)

1. **Run 1 — skeleton + hero.** `apps/web/src/pages/agents/index.astro` with
   an agent-memory-led hero ("Memory your agent can query.") and its own
   `title`/`description`/OG/`SoftwareApplication` JSON-LD (agent-memory copy
   — this page may lead even though sitewide lead strings are gated to WS-13).
2. **Run 2 — the matrix + the moat.** Embed the WS-06 matrix; add a "typed-plan
   trust boundary" section (LLM→JSON→compiler→`libpg_query`→diff-preview,
   sourced from `ResearchReceipts`) and the FSL self-host / BYO-key / no-per-call-fees
   band (FSL-accurate wording — see WS-10).
3. **Run 3 — CTA + demand signal.** Waitlist CTA + an agent-memory CreateForm
   variant; fire the `GLOBAL-024` typed event on CTA click (reuse the
   `vs.try_query_clicked` pattern). Link `/agents` from Topnav and the `/vs`
   memory pages.
4. `bun run --filter @nlqdb/web check` + test + Lighthouse parity.

## Done when

- [ ] `/agents` builds, on-brand, with hero + matrix + moat + FSL band + CTA.
- [ ] Own SEO/OG/JSON-LD; demand-signal event on CTA; linked from nav + memory `/vs` pages.
- [ ] Sitewide lead strings (`Hero.astro`, README, llms.txt) untouched.
- [ ] INDEX tracker + status ticked.

## Artifact

The page is the launch destination — append the "Show HN: analytical memory
for AI agents" draft (pointing at `/agents`) to `distribution-queue.md`.

## Rollback

Delete `apps/web/src/pages/agents/**` + the nav link — additive route.
