---
name: comparison-pages
description: `/vs/<competitor>` AEO/SEO pages — honest side-by-sides driving acquisition from buyers who already named the alternative.
when-to-load:
  globs:
    - apps/web/src/data/competitors.ts
    - apps/web/src/pages/vs/**
    - apps/web/src/pages/llms.txt.ts
  topics: [comparison, vs, aeo, seo, acquisition, llms-txt]
---

# Feature: Comparison Pages

**One-liner:** `/vs/<competitor>` AEO/SEO pages — honest side-by-sides driving acquisition from buyers who already named the alternative.
**Status:** implemented (Phase 1) — 3 comparison pages shipped: Supabase (P1), Vanna AI (P3), Mem0 (P2). Single template + typed data file; adding a new comparison is a one-file edit.
**Owners (code):** `apps/web/src/data/competitors.ts`, `apps/web/src/pages/vs/**`, `apps/web/src/pages/llms.txt.ts`, `apps/web/src/pages/sitemap.xml.ts`
**Cross-refs:** [`docs/research/automated-icp-validation-plan.md §3.5`](../../research/automated-icp-validation-plan.md) · [`docs/competitors.md`](../../competitors.md) · [`docs/features/web-app/FEATURE.md`](../web-app/FEATURE.md)

## Touchpoints — read this feature before editing

- `apps/web/src/data/competitors.ts` — typed source of truth (one object per competitor)
- `apps/web/src/pages/vs/[slug].astro` — single dynamic template using `getStaticPaths()`
- `apps/web/src/pages/vs/index.astro` — comparison index page
- `apps/web/src/pages/llms.txt.ts` — LLM-readable site index (auto-includes new slugs)
- `apps/web/src/pages/sitemap.xml.ts` — XML sitemap (auto-includes new slugs)

## Decisions

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-CMP-NNN`.

- [**SK-CMP-001**](decisions/SK-CMP-001-honest-trade-offs.md) — Every comparison page must include "When to choose them" with concrete scenarios.
- [**SK-CMP-002**](decisions/SK-CMP-002-single-template-data-driven.md) — One Astro template + typed data file; adding a competitor is a one-file edit.
- [**SK-CMP-003**](decisions/SK-CMP-003-faqpage-json-ld.md) — Every comparison page emits FAQPage JSON-LD with 4-6 Q&A pairs.
- [**SK-CMP-004**](decisions/SK-CMP-004-llms-txt-endpoint.md) — `llms.txt` ships as a build-time endpoint, not a hand-edited static file.

## GLOBALs governing this feature

- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path.
  - *In this feature:* the "Try this query →" button emits `vs.try_query_clicked` with `{slug, goal}` via the existing `lib/logsnag.ts` emitter — gives funnel visibility per competitor without needing a browser-analytics provider. The "Email us / browse all comparisons" footer is the demand-signal trap for tools we don't yet compare against. Full page-view analytics aren't wired today (open question in `web-app`); when they are, the slug surfaces directly as a `feature.requested.comparison.<slug>` cohort.
- **GLOBAL-025** — North-star compass.
  - *In this feature:* the KPI advanced is **onboarding** — every page CTA points at `/app/new` (anonymous mode); the comparison page is the third-party-keyword on-ramp the homepage can't be.

## Open questions / known unknowns

- **Page-view analytics.** No browser-side analytics on `nlqdb.com` today; the §3.5 ICP-validation plan calls for PostHog Cloud free tier. Per-page views are measurable only via server access logs + sitemap-indexed search-console impressions until that lands. The CTA-click signal (`vs.try_query_clicked` to LogSnag) lands per-slug funnel data in the meantime.
- **Per-competitor OG image.** Pages currently inherit the site default OG. A per-slug OG image generator (e.g. Workers + Satori) would boost share-CTR meaningfully; deferred until at least 5 comparisons ship and a Cloudflare Pages OG endpoint is up.
- **Backfill from `docs/competitors.md`.** The competitor doc lists ~25 tools; we've shipped 3. The decision rule for which to ship next: persona-weighted threat × keyword volume — i.e. start with Outerbase (P1/P4) and AskYourDatabase (P3/P4) next.
- **Auto-translate to docs.nlqdb.com.** The docs Starlight site doesn't surface comparisons yet; should the docs nav include a "vs" section pointing at marketing? Likely yes, but cross-origin nav UX needs a separate slice.

## Why this exists

Per Tripledart / Unbounce 2026 SaaS benchmarks, competitor comparison pages convert at **7.5%+** vs **2–5%** for generic landing pages; the "Why X might not be right for you" honest format hits **13.8%**. ChatGPT, Perplexity, and Claude lift comparison FAQ Q&As verbatim when answering "Tool A vs Tool B" queries — and AI-engine search is forecast to take 50% of search volume by 2028 (Gartner). Buyers searching "supabase alternative" are at the decision moment; the comparison page is where the decision happens.

`docs/research/automated-icp-validation-plan.md §3.5` calls for these as one of the four "tractor beams" alongside the gallery, examples directory, and pain-driven solve pages. Comparison pages ship first because (a) they don't depend on the ICP-mining pipeline (§2 of that plan) being live, (b) they leverage the existing `docs/competitors.md` analysis as ground truth, and (c) they're zero-cost to maintain once the template lands.

## How to add a new comparison

1. Add an entry to `apps/web/src/data/competitors.ts` — fill all required fields (TypeScript will flag missing ones).
2. Run `bun run --filter @nlqdb/web check` — astro-check validates the page renders.
3. The sitemap and llms.txt pick up the new slug automatically.
4. Anchor the data in `docs/competitors.md` — if the tool isn't there, add the analysis row first.
