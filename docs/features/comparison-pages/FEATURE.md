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
**Status:** implemented (Phase 1) — 6 comparison pages shipped: Supabase (P1), Vanna AI (P3), Mem0 (P2), Outerbase (P4), Wren AI (P3), AskYourDatabase (P3). Single template + typed data file; adding a new comparison is a one-file edit.
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
- **GLOBAL-034** — Analytics stack (Cloudflare Web Analytics for pageviews; PostHog Phase-2-optional).

## Open questions / known unknowns

- **Page-view analytics** — Resolved by [`GLOBAL-034`](../../decisions/GLOBAL-034-analytics-stack.md): per-page views ride **Cloudflare Web Analytics**, not PostHog (PostHog is the Phase-2-optional funnel/cohort sink). **Parked until** the `apps/web` analytics-wiring slice. Per-slug CTA funnel data already flows via `vs.try_query_clicked` → LogSnag today.
- **Per-competitor OG image.** Pages currently inherit the site default OG. A per-slug OG image generator (e.g. Workers + Satori) would boost share-CTR meaningfully; deferred until at least 5 comparisons ship and a Cloudflare Pages OG endpoint is up.
- **Backfill from `docs/competitors.md`.** The competitor doc lists ~25 tools; we've shipped 6 (AskYourDatabase landed 2026-06-02 — third P3 slot covering the chat-with-my-DB / Dashboard-Builder / customer-facing-BI angle; Wren AI landed 2026-05-29 — second P3 slot, governance/MDL angle; Outerbase landed 2026-05-24 — P4 backend-engineer slot). Decision rule for the next one: persona-weighted threat × keyword volume — Retool AI (P4 incumbent), Julius AI (P3 CSV+NL), or Basedash (P4 admin UI) is the natural next slice. AskYourDatabase entry note: engines (BigQuery, MSSQL, MySQL, PostgreSQL, Snowflake), product split (Desktop App with local creds + Website Chatbot with encrypted-on-server creds + Enterprise on-prem), plans, and models (Anthropic Claude 4.6 Sonnet / Claude Haiku 4.5 / OpenAI GPT-4.1) pulled from `askyourdatabase.com/pricing` + `askyourdatabase.com/docs` + `askyourdatabase.com/docs/security` (2026-06-02 WebFetch). SOC 2 Type 2 status per their security portal: audit initiated with the first complete report anticipated December 2025 — not yet certified on free product; check current page for live status. Outerbase entry note: tagline reflects the Cloudflare acquisition (2025-04-07 per the [Cloudflare press release](https://www.cloudflare.com/press/press-releases/2025/cloudflare-acquires-outerbase-to-expand-developer-experience/)); the stale "PlanetScale acquired Outerbase" line that survived in `docs/competitors.md` pre-2026-05-24 is corrected in §1 (PlanetScale entry) and §3 (Outerbase entry) plus the threat-matrix summary. Wren AI entry note: 22+ data sources, MDL, and RLAC/CLAC pulled from Canner/WrenAI README (2026-05-29 WebFetch); SOC 2 Type II applies to the Essential and Enterprise paid plans only per the getwren.ai pricing page (Free plan lists no compliance bullets); license is multi-tier per the Canner/WrenAI LICENSE file — Apache 2.0 for `core/` + `sdk/` + `skills/` + `examples/` + root, CC-BY-4.0 for `docs/`, AGPL-3.0-only reserved for future modules.
- **Auto-translate to docs.nlqdb.com — Parked until the docs-nav slice** (`GLOBAL-033`, "how to surface X" → reuse; one home per concern). The comparison pages live on the marketing site (`apps/web`); the docs site links out to `/vs/` rather than duplicating the content cross-origin — wired when the docs nav gains an external "vs" link, not a second render path.
- **Automated guard for the SK-CMP-001 "≤16 words per bullet" rule.** The constraint lives in the `Competitor.whenChooseUs`/`whenChooseThem` TypeScript comments but is not enforced by `competitors.test.ts`; the 2026-05-24 Outerbase entry drifted to 7/8 over-budget bullets without surfacing in CI. Adding a one-line test would fail on those legacy bullets, so the next slice ships the test plus a tightening pass for Outerbase. Wren AI (2026-05-29) is back inside the budget after the round-2 self-review iteration.
- **Site-wide MCP-tool-naming cleanup (5 prior pages).** The 2026-06-02 AskYourDatabase round-1 self-review caught FAQ4 + the MCP feature-table note fabricating `nlqdb_create_database` / `ask` / `run` as MCP tool names — fixed in the AYD entry so it names the real tools per [`SK-MCP-002`](../mcp-server/decisions/SK-MCP-002-three-tools.md) (`nlqdb_query`, `nlqdb_list_databases`, `nlqdb_describe`). The same fabrication exists on Supabase / Vanna AI / Mem0 / Outerbase / Wren AI FAQs (per `grep -nE 'create_database\|nlqdb_create_database' apps/web/src/data/competitors.ts`). Next slice: backfill the correct tool names + add a test asserting no comparison page mentions `nlqdb_create_database` (or any other phantom MCP verb) in user-facing copy.

## Why this exists

Per Tripledart / Unbounce 2026 SaaS benchmarks, competitor comparison pages convert at **7.5%+** vs **2–5%** for generic landing pages; the "Why X might not be right for you" honest format hits **13.8%**. ChatGPT, Perplexity, and Claude lift comparison FAQ Q&As verbatim when answering "Tool A vs Tool B" queries — and AI-engine search is forecast to take 50% of search volume by 2028 (Gartner). Buyers searching "supabase alternative" are at the decision moment; the comparison page is where the decision happens.

`docs/research/automated-icp-validation-plan.md §3.5` calls for these as one of the four "tractor beams" alongside the gallery, examples directory, and pain-driven solve pages. Comparison pages ship first because (a) they don't depend on the ICP-mining pipeline (§2 of that plan) being live, (b) they leverage the existing `docs/competitors.md` analysis as ground truth, and (c) they're zero-cost to maintain once the template lands.

## How to add a new comparison

1. Add an entry to `apps/web/src/data/competitors.ts` — fill all required fields (TypeScript will flag missing ones).
2. Run `bun run --filter @nlqdb/web check` — astro-check validates the page renders.
3. The sitemap and llms.txt pick up the new slug automatically.
4. Anchor the data in `docs/competitors.md` — if the tool isn't there, add the analysis row first.
