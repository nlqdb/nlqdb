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
**Status:** implemented (Phase 1) — 22 comparison pages shipped: Supabase (P1), Vanna AI (P3), Mem0 (P2), Outerbase (P4), Wren AI (P3), AskYourDatabase (P3), Zep (P2), Letta (P2), LangMem (P2), Pinecone (P2), Chroma (P2), Weaviate (P2), Qdrant (P2), Cognee (P2), Julius AI (P3), Retool (P4), Basedash (P3), Metabase (P3), Milvus (P2), Hex (P3), Supermemory (P2), Mode (P3). Single template + typed data file; adding a new comparison is a one-file edit.
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
- [**SK-CMP-005**](decisions/SK-CMP-005-breadcrumb-json-ld.md) — Every comparison page emits BreadcrumbList JSON-LD mirroring a visible, clickable trail (shared `lib/breadcrumb.ts` with `/solve`).
- [**SK-CMP-006**](decisions/SK-CMP-006-itemlist-json-ld.md) — The `/vs` index emits ItemList JSON-LD enumerating the full comparison set (shared `lib/itemlist-jsonld.ts` with `/solve`).

## GLOBALs governing this feature

- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path.
  - *In this feature:* the "Try this query →" button emits `vs.try_query_clicked` with `{slug, goal}` via the existing `lib/logsnag.ts` emitter — gives funnel visibility per competitor without needing a browser-analytics provider. The "Email us / browse all comparisons" footer is the demand-signal trap for tools we don't yet compare against. Full page-view analytics aren't wired today (open question in `web-app`); when they are, the slug surfaces directly as a `feature.requested.comparison.<slug>` cohort.
- **GLOBAL-025** — North-star compass.
  - *In this feature:* the KPI advanced is **onboarding** — every page CTA points at `/app/new` (anonymous mode); the comparison page is the third-party-keyword on-ramp the homepage can't be.
- **GLOBAL-034** — Analytics stack (Cloudflare Web Analytics for pageviews; PostHog Phase-2-optional).

## Open questions / known unknowns

- **Page-view analytics** — Resolved by [`GLOBAL-034`](../../decisions/GLOBAL-034-analytics-stack.md): per-page views ride **Cloudflare Web Analytics**, not PostHog (PostHog is the Phase-2-optional funnel/cohort sink). **Parked until** the `apps/web` analytics-wiring slice. Per-slug CTA funnel data already flows via `vs.try_query_clicked` → LogSnag today.
- **Per-slug OG image (single home for both AEO surfaces — `/vs/<competitor>` and `/solve/<pain>`).** Pages currently inherit the site default OG. A per-slug OG image generator (e.g. Workers + Satori) would boost share-CTR meaningfully; deferred until at least 5 AEO pages ship and a Cloudflare Pages OG endpoint is up.
- **Backfill from `docs/competitors.md`.** Next-competitor rule: **persona-weighted threat × keyword volume**, reweighted toward **P2** by the agent-memory pivot ([GLOBAL-036](../../decisions/GLOBAL-036-lead-positioning-analytical-agent-memory.md) — "a database, not a vector store"). Now covered: the full **P2 memory cluster** (Mem0/Zep/Letta/LangMem + the vector wing Pinecone/Chroma/Weaviate/Qdrant/Milvus + the knowledge-graph wing Cognee + the recall-API wing Supermemory (MIT, benchmark-leading recall, no SQL — verified 2026-06-29)); the **P3 analyst/BI cluster** (Vanna, Wren AI, AskYourDatabase, Julius, Basedash, Metabase, **Hex** — the notebook-AI lead, landed 2026-06-29: a collaborative SQL+Python notebook over an existing warehouse, conceding charts/notebook/published-apps/collaboration `them: shipped`, wedge = nlqdb owns the DB + embeds an answer element/agent-callable API; and **Mode**, the SQL-IDE-first member of the same group, landed 2026-06-29: a SQL editor + connected Python/R notebooks + scheduled reports over a warehouse, now part of ThoughtSpot post-2023-acquisition — AI surfaces via ThoughtSpot Sage, conceding notebooks/charts/scheduled-reports `them: shipped`, MCP `them: no`); and the **P4 slate** (Outerbase, Retool). Per-entry web-verified facts + landing dates live in the `competitors.ts` entry comments and `docs/competitors.md` (not duplicated here, per D5). **Next slice:** the rest of the notebook-AI cluster (Fabi.ai / Count) by the same rule.
- **Auto-translate to docs.nlqdb.com — Parked until the docs-nav slice** (`GLOBAL-033`, "how to surface X" → reuse; one home per concern). The comparison pages live on the marketing site (`apps/web`); the docs site links out to `/vs/` rather than duplicating the content cross-origin — wired when the docs nav gains an external "vs" link, not a second render path.
- **Automated guard for the SK-CMP-001 "≤16 words per bullet" rule — ✅ resolved 2026-06-29 (run 103).** The constraint lives in the `Competitor.whenChooseUs`/`whenChooseThem` TypeScript comments and is now enforced by `competitors.test.ts` (a per-bullet word-count guard that fails with the offending `slug (Nw): …` list). The drift it was added to catch — the 2026-05-24 Outerbase entry at **7 over-budget bullets** — was tightened to ≤16 words each in the same PR (verified facts preserved: the multi-engine point, HIPAA + SOC 2 Type 2, MCP `nlqdb_query` first-reference materialisation), so the guard ships green at **0 over-budget bullets** across all 20 pages. Wren AI (2026-05-29) was already back inside budget after its round-2 self-review.
- **Site-wide MCP-tool-naming cleanup (5 prior pages) — ✅ resolved 2026-06-22 (run 49).** The 2026-06-02 AskYourDatabase round-1 self-review caught FAQ4 + the MCP feature-table note fabricating `nlqdb_create_database` / `ask` / `run` as MCP tool names — fixed in the AYD entry first. The same fabrication survived on Supabase / Vanna AI / Mem0 / Outerbase / Wren AI (10 occurrences across FAQs, `whenChooseUs` bullets, and feature notes). All 10 now name the real tools per [`SK-MCP-002`](../mcp-server/decisions/SK-MCP-002-three-tools.md) — `nlqdb_query`, `nlqdb_list_databases`, `nlqdb_describe` — and state that `nlqdb_query` materialises Postgres on first reference (there is no `create_database` verb). The three stale `MCP server with provisioning verbs` feature-row labels were aligned to `MCP server (agent-callable)` (the label the four newer pages already use). Locked by two `competitors.test.ts` invariants: no user-facing string contains `create_database`, and every `nlqdb_*` token named in copy is in the SK-MCP-002 allowed set — so a future page can't reintroduce a phantom.

## Why this exists

Per Tripledart / Unbounce 2026 SaaS benchmarks, competitor comparison pages convert at **7.5%+** vs **2–5%** for generic landing pages; the "Why X might not be right for you" honest format hits **13.8%**. ChatGPT, Perplexity, and Claude lift comparison FAQ Q&As verbatim when answering "Tool A vs Tool B" queries — and AI-engine search is forecast to take 50% of search volume by 2028 (Gartner). Buyers searching "supabase alternative" are at the decision moment; the comparison page is where the decision happens.

`docs/research/automated-icp-validation-plan.md §3.5` calls for these as one of the four "tractor beams" alongside the gallery, examples directory, and pain-driven solve pages. Comparison pages ship first because (a) they don't depend on the ICP-mining pipeline (§2 of that plan) being live, (b) they leverage the existing `docs/competitors.md` analysis as ground truth, and (c) they're zero-cost to maintain once the template lands.

## How to add a new comparison

1. Add an entry to `apps/web/src/data/competitors.ts` — fill all required fields (TypeScript will flag missing ones).
2. Run `bun run --filter @nlqdb/web check` — astro-check validates the page renders.
3. The sitemap and llms.txt pick up the new slug automatically.
4. Anchor the data in `docs/competitors.md` — if the tool isn't there, add the analysis row first.
