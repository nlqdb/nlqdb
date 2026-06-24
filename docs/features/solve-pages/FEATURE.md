---
name: solve-pages
description: `/solve/<slug>` pain-driven AEO pages — one page per recurring natural-language search query; each answers the question with a working `<nlq-data>` embed and names what nlqdb doesn't do.
when-to-load:
  globs:
    - apps/web/src/data/solve.ts
    - apps/web/src/data/solve.test.ts
    - apps/web/src/pages/solve/**
    - apps/web/src/pages/llms.txt.ts
    - apps/web/src/pages/sitemap.xml.ts
  topics: [solve, aeo, seo, acquisition, pain-page, llms-txt]
---

# Feature: Solve Pages

**One-liner:** `/solve/<slug>` pain-driven AEO pages — one page per recurring natural-language search query; each answers the question with a working `<nlq-data>` embed and names what nlqdb doesn't do.
**Status:** implemented (Phase 1, partial) — 8 hand-curated pages shipped: cheap-internal-dashboard (P3), give-ai-agent-persistent-memory (P2), analytical-queries-over-agent-memory (P2), skip-postgres-setup-side-project (P1), natural-language-sql-without-training-data (P3), ship-leaderboard-no-sql (P1), database-claude-cursor-can-query (P2, MCP-host wedge), store-query-chatbot-conversation-history (P2, conversation-transcript + engagement-analytics wedge). Persona coverage P1×2 / P2×4 / P3×2 / **P4×0** — a P4-backend-engineer page is gap-blocked, not unwritten: P4 wants an NL layer over the DB they already own, which nlqdb doesn't do yet (it provisions/owns its Postgres), so an honest P4 page would be mostly "what it doesn't do." Implements [`docs/research/automated-icp-validation-plan.md §3.1`](../../research/automated-icp-validation-plan.md) ahead of cluster-driven entries (first cluster file 2026-05-26).
**Owners (code):** `apps/web/src/data/solve.ts`, `apps/web/src/data/solve.test.ts`, `apps/web/src/pages/solve/**`, `apps/web/src/pages/llms.txt.ts`, `apps/web/src/pages/sitemap.xml.ts`
**Cross-refs:** [`docs/research/automated-icp-validation-plan.md §3.1`](../../research/automated-icp-validation-plan.md) · [`docs/features/comparison-pages/FEATURE.md`](../comparison-pages/FEATURE.md) (sibling AEO surface) · [`docs/features/icp-mining/FEATURE.md`](../icp-mining/FEATURE.md) (future source of verbatim cluster quotes) · [`docs/features/web-app/FEATURE.md`](../web-app/FEATURE.md)

## Touchpoints — read this feature before editing

- `apps/web/src/data/solve.ts` — typed source of truth (one object per page, plus `SOLVE_PERSONAS` user-facing labels/descriptions and `SOLVE_PERSONA_ORDER` render order)
- `apps/web/src/data/solve.test.ts` — data-integrity tests pinning the AEO invariants
- `apps/web/src/pages/solve/[slug].astro` — single dynamic template using `getStaticPaths()`
- `apps/web/src/pages/solve/index.astro` — solve-page index (`/solve`), grouped by user-facing persona label (internal `P1..P4` codes never reach rendered HTML)
- `apps/web/src/pages/llms.txt.ts` — LLM-readable site index (auto-includes new slugs)
- `apps/web/src/pages/sitemap.xml.ts` — XML sitemap (auto-includes new slugs)

## Decisions

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-SOLVE-NNN`.

- [**SK-SOLVE-001**](decisions/SK-SOLVE-001-search-intent-h1.md) — Every solve page uses a natural-language search query as `<h1>`, not a fabricated "verbatim" quote.
- [**SK-SOLVE-002**](decisions/SK-SOLVE-002-honest-limits-mandatory.md) — Every solve page ships a "What nlqdb doesn't do here" section.
- [**SK-SOLVE-003**](decisions/SK-SOLVE-003-enduring-source-citations.md) — Every solve page cites ≥2 enduring discussion-hub URLs, never single-thread URLs.
- [**SK-SOLVE-004**](decisions/SK-SOLVE-004-breadcrumb-json-ld.md) — Every solve page emits BreadcrumbList JSON-LD mirroring a visible, clickable trail (shared `lib/breadcrumb.ts` with `/vs`).
- [**SK-SOLVE-005**](decisions/SK-SOLVE-005-itemlist-json-ld.md) — The `/solve` index emits ItemList JSON-LD enumerating the full solve-guide set (shared `lib/itemlist-jsonld.ts` with `/vs`).

## GLOBALs governing this feature

- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path.
  - *In this feature:* the "Try this query →" button calls `emit("solve.try_query_clicked", {slug, goal})` via `lib/logsnag.ts`, which no-ops unless the late-bound `window.__nlqdb_logsnag` hook is present. FLOW-002 verification on 2026-05-23 did not observe the hook event with an injected spy, so per-slug funnel data is not yet proven.
- **GLOBAL-025** — North-star compass.
  - *In this feature:* the KPI advanced is **onboarding** — every page CTA points at `/app/new` (anonymous mode); the solve page is the search-intent on-ramp the homepage can't be. KPI degraded: none.
- **GLOBAL-028** — Acquisition progress tracker.
  - *In this feature:* the implementation of [`automated-icp-validation-plan.md §3.1`](../../research/automated-icp-validation-plan.md). Progress is recorded in that file.
- **GLOBAL-034** — Analytics stack (Cloudflare Web Analytics for pageviews; PostHog Phase-2-optional).

## Open questions / known unknowns

- **Verbatim cluster quotes — Parked until the first `icp-cluster.ts` cluster file lands** (`GLOBAL-033`, genuinely-deferred). `SK-SOLVE-001` paraphrases search-intent today; a follow-up SK amends `searchTitle` to the verbatim cluster label once a cluster file exists to source it from.
- **Auto-generation from cluster output — Parked until ≥3 cluster files exist** (`GLOBAL-033`, speculative-scope). Drafting `/solve/<slug>` entries from each persona's top cluster (founder-approved PR per `automated-icp-validation-plan.md §3.6`) waits on observable draft quality.
- **Page-view analytics** — Resolved by [`GLOBAL-034`](../../decisions/GLOBAL-034-analytics-stack.md): per-page views ride **Cloudflare Web Analytics** (not PostHog); **parked until** the `apps/web` analytics-wiring slice. Per-slug CTA funnel data flows via the LogSnag click hook today (FLOW-002 production-delivery verification still pending).

## Why this exists

Buyers searching `"how do I add a database to a side project"` or `"retool alternative cheap"` are at the decision moment for a specific pain. A comparison page (`/vs/<competitor>`) wins when the buyer already named the competitor; a solve page (`/solve/<pain>`) wins earlier in the funnel — when the buyer has named the pain but not the tool. Together the two AEO surfaces cover the search-intent ladder.

The [`automated-icp-validation-plan.md §3.1`](../../research/automated-icp-validation-plan.md) calls for these as one of the §3 "tractor beams"; this feature ships them ahead of the ICP-mining cluster pipeline so the AEO surface earns impressions during W2 of the plan's calendar, not W3+.

## How to add a new solve page

1. Add an entry to `apps/web/src/data/solve.ts` — fill all required fields (TypeScript will flag missing ones; the data tests pin the AEO invariants).
2. Run `bun run --filter @nlqdb/web check && bun run --filter @nlqdb/web test` — astro-check + data-integrity tests both pass.
3. The sitemap and llms.txt pick up the new slug automatically.
4. If the entry is drawn from a specific ICP-mining cluster, cross-link in the source label so the evidence trail is one click from the page.
