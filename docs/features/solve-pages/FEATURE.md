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
**Status:** Retired by GLOBAL-043 — deletion PR pending; no new work
**Owners (code):** `apps/web/src/data/solve.ts`, `apps/web/src/data/solve.test.ts`, `apps/web/src/pages/solve/**`, `apps/web/src/pages/llms.txt.ts`, `apps/web/src/pages/sitemap.xml.ts`
**Cross-refs:** [`docs/research/automated-icp-validation-plan.md §3.1`](../../research/automated-icp-validation-plan.md) · [`docs/features/comparison-pages/FEATURE.md`](../comparison-pages/FEATURE.md) (sibling AEO surface) · [`docs/features/icp-mining/FEATURE.md`](../icp-mining/FEATURE.md) (future source of verbatim cluster quotes) · [`docs/features/web-app/FEATURE.md`](../web-app/FEATURE.md)

## Touchpoints — read this feature before editing

- `apps/web/src/data/solve.ts` — typed source of truth (one object per page)
- `apps/web/src/data/personas.ts` — shared with `comparison-pages`: the `P1..P4` codes plus their user-facing labels/descriptions (declaration order = render order). `personas.test.ts` fails any surface that reads a persona outside a `PERSONAS[…]` lookup or an equality branch.
- `apps/web/src/data/solve.test.ts` — data-integrity tests pinning the AEO invariants
- `apps/web/src/pages/solve/[slug].astro` — single dynamic template using `getStaticPaths()`
- `apps/web/src/pages/solve/index.astro` — solve-page index (`/solve`), grouped by user-facing persona label (internal `P1..P4` codes never reach rendered HTML)
- `apps/web/src/pages/llms.txt.ts` — LLM-readable site index (auto-includes new slugs)
- `apps/web/src/pages/sitemap.xml.ts` — XML sitemap (auto-includes new slugs)

## Decisions

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-SOLVE-NNN`.

- [**SK-SOLVE-001**](decisions/SK-SOLVE-001-search-intent-h1.md) — Every solve page uses a natural-language search query as `<h1>`, not a fabricated "verbatim" quote.
- [**SK-SOLVE-002**](decisions/SK-SOLVE-002-honest-limits-mandatory.md) — Every solve page ships a "What nlqdb doesn't try to do here" section.
- [**SK-SOLVE-003**](decisions/SK-SOLVE-003-enduring-source-citations.md) — Every solve page cites ≥2 enduring discussion-hub URLs, never single-thread URLs.
- [**SK-SOLVE-004**](decisions/SK-SOLVE-004-breadcrumb-json-ld.md) — Every solve page emits BreadcrumbList JSON-LD mirroring a visible, clickable trail (shared `lib/breadcrumb.ts` with `/vs`).
- [**SK-SOLVE-005**](decisions/SK-SOLVE-005-itemlist-json-ld.md) — The `/solve` index emits ItemList JSON-LD enumerating the full solve-guide set (shared `lib/itemlist-jsonld.ts` with `/vs`).

## GLOBALs governing this feature

- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path.
  - *In this feature:* the "Try this query →" button calls `emit("solve.try_query_clicked", {slug, goal})` via `lib/logsnag.ts`. The late-bound `window.__nlqdb_logsnag` hook is **wired since 2026-07-29**: `Base.astro` inlines it (gated on build-time `PUBLIC_LOGSNAG_TOKEN`/`PUBLIC_LOGSNAG_PROJECT`, baked by both deploy workflows; channel = the event's dot-prefix), pinned by `lib/logsnag-hook.test.ts`; token verified live against `api.logsnag.com`. Dev/preview builds omit the vars, so emits stay no-ops there by design.
- **GLOBAL-025** — North-star compass.
  - *In this feature:* the KPI advanced is **onboarding** — every page CTA points at `/app/new` (anonymous mode); the solve page is the search-intent on-ramp the homepage can't be. KPI degraded: none.
- **GLOBAL-028** — Acquisition progress tracker.
  - *In this feature:* the implementation of [`automated-icp-validation-plan.md §3.1`](../../research/automated-icp-validation-plan.md). Progress is recorded in that file.
- **GLOBAL-034** — Analytics stack (Cloudflare Web Analytics for public pageviews; PostHog client SDK is scoped to the `/app` product surfaces — solve pages stay SDK-free).

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
5. Optionally add a `related: [...]` array of sibling slugs in the same topic cluster — rendered as a "Related guides" section (`/solve ↔ /solve` internal links) that lifts crawl priority for pages otherwise reachable only via the flat `/solve/` index + sitemap. Keep links same-cluster; `solve.test.ts` fails on a self-reference, a dupe, or a dangling slug.
