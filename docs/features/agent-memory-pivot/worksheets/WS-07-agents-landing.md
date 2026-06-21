# WS-07 — Dedicated `/agents` front door

**Status:** ✅ done (run 3/3 — CTA + demand signal shipped 2026-06-20; run 2 matrix + moat + FSL band 2026-06-20; run 1 skeleton + hero 2026-06-20)
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

1. ✅ **Run 1 — skeleton + hero** (2026-06-20). `apps/web/src/pages/agents/index.astro`:
   agent-memory-led hero ("Memory your agent can query."), AEO direct-answer
   block ("What is analytical agent memory?"), a retrieval-vs-analytics split,
   and its own `title`/`description`/`canonical`. The `SoftwareApplication`
   JSON-LD is emitted by `Base.astro` from the page `description` (agent-memory
   copy) — no duplicate block needed. Added `/agents` to `sitemap.xml.ts`
   `STATIC_ROUTES`. Sitewide lead strings (`Hero.astro`, README, `llms.txt`)
   untouched.
2. ✅ **Run 2 — the matrix + the moat** (2026-06-20). Embedded the WS-06
   `AgentMemoryMatrix`; added a four-step "typed-plan trust boundary" pipeline
   (LLM → typed JSON plan → compiler emits parameterised SQL → AST re-parse +
   verb/table allowlist, `libpg_query` on the create path → diff preview),
   sourced from the Replit-wipe
   (Fortune) + Cortex-Analyst (Snowflake) receipts, and the FSL-1.1 / BYO-key /
   no-per-call-fees band (FSL-accurate per WS-10). `apps/web/src/pages/agents/index.astro`
   only — additive, no `<img>`.
3. ✅ **Run 3 — CTA + demand signal** (2026-06-20). Added the conversion CTA to
   `apps/web/src/pages/agents/index.astro`: a memory-shaped "try this query"
   button (`agents.try_query_clicked`, GLOBAL-024) that seeds the
   `nlqdb_draft` slot and navigates to `/app/new` — the proven `/vs` + `/solve`
   pattern, not a new CreateForm variant (P5: reuse the established path). Added
   the `Agents` link to `Topnav` (`current="agents"`) and a P2-keyed `/agents`
   cross-link in the `/vs` CTA so it renders on exactly the four memory
   comparisons (Mem0/Zep/Letta/LangMem). `competitors.test.ts` pins that
   persona membership.
4. ✅ `bun run --filter @nlqdb/web check` (0/0/0) + 127 tests green.

## Done when

- [x] `/agents` builds, on-brand, with hero + matrix + moat + FSL band + CTA.
- [x] Own SEO/OG/JSON-LD; demand-signal event on CTA; linked from nav + memory `/vs` pages.
- [x] Sitewide lead strings (`Hero.astro`, README, llms.txt) untouched.
- [x] INDEX tracker + status ticked.

## Artifact

The page is the launch destination — append the "Show HN: analytical memory
for AI agents" draft (pointing at `/agents`) to `distribution-queue.md`.

## Rollback

Delete `apps/web/src/pages/agents/**` + the nav link — additive route.
