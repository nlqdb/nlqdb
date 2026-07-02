---
name: blog
description: `/blog/<slug>` — the canonical owned home for the evergreen SQL / data-layer lessons the daily loop drafts; community venues (dev.to, Reddit) get a pointer to the canonical copy here.
when-to-load:
  globs:
    - apps/web/src/data/blog.ts
    - apps/web/src/data/blog.test.ts
    - apps/web/src/lib/blog-inline.ts
    - apps/web/src/pages/blog/**
    - apps/web/src/pages/llms.txt.ts
    - apps/web/src/pages/sitemap.xml.ts
  topics: [blog, aeo, seo, distribution, content, llms-txt]
---

# Feature: Blog

**One-liner:** `/blog/<slug>` — the canonical owned home for the evergreen SQL / data-layer lessons the daily loop drafts; community venues get a pointer to the canonical copy here.
**Status:** implemented (Phase 1, partial) — 1 post shipped (`not-in-returned-zero-rows-it-was-one-null`, the anti-join / NULL trap, anchoring `/solve/find-rows-with-no-match-in-another-table`). The `/blog` index + post template + JSON-LD + sitemap/llms.txt wiring landed with it.
**Owners (code):** `apps/web/src/data/blog.ts`, `apps/web/src/data/blog.test.ts`, `apps/web/src/lib/blog-inline.ts`, `apps/web/src/pages/blog/**`
**Cross-refs:** [`docs/features/solve-pages/FEATURE.md`](../solve-pages/FEATURE.md) (sibling AEO surface an anchored post feeds) · [`docs/features/comparison-pages/FEATURE.md`](../comparison-pages/FEATURE.md) · [`docs/features/web-app/FEATURE.md`](../web-app/FEATURE.md) · [`docs/research/distribution-queue.md`](../../research/distribution-queue.md) (draft source) · GLOBAL-025, GLOBAL-034 (canonical text in `docs/decisions/`; index in `docs/decisions.md`)

## Touchpoints — read this feature doc before editing

- `apps/web/src/data/blog.ts` — typed source of truth (one `BlogPost` per page; body is a `BlogBlock[]` union)
- `apps/web/src/data/blog.test.ts` — data-integrity tests pinning the AEO + template invariants
- `apps/web/src/lib/blog-inline.ts` — inline-code parser (`parseInline`) shared by the template
- `apps/web/src/pages/blog/[slug].astro` — single dynamic template using `getStaticPaths()`
- `apps/web/src/pages/blog/index.astro` — blog index (`/blog`), newest first
- `apps/web/src/pages/llms.txt.ts` + `apps/web/src/pages/sitemap.xml.ts` — auto-include new slugs

## Decisions

### SK-BLOG-001 — `/blog` is the canonical home; community venues only point at it

- **Decision:** Every evergreen lesson the daily loop drafts (`distribution-queue.md`) ships first as a page under `nlqdb.com/blog`; dev.to / Reddit / lobste.rs variants are pointers to that canonical URL, never the primary copy.
- **Core value:** Honest, Free.
- **Why:** Before this feature, the loop drafted ~30 posts that only ever pointed at rented platforms — a dev.to post can be delisted, a subreddit can remove it, and the SEO/AEO signal accrues to the host, not to us. A canonical URL we own is indexable, linkable from `llms.txt`, and survives any single venue. Republishing elsewhere with a canonical pointer keeps the ranking signal consolidated on `nlqdb.com`.
- **Consequence in code:** A queue draft is not "published" until its `BlogPost` exists in `blog.ts` and the live `/blog/<slug>` URL is in the scorecard's Shipped-distribution list. Community-venue copies link back to the canonical URL. Reject a PR that ships a post to an external venue without the canonical `/blog` copy in the same change.
- **Alternatives rejected:** dev.to as the canonical home — rented reach, no consolidated signal, delistable. A full markdown/MDX CMS — heavier than one post/week warrants (SK-BLOG-002).

### SK-BLOG-002 — Posts are a typed block union, not raw HTML or a markdown CMS

- **Decision:** A post body is a `BlogBlock[]` (`p` / `h2` / `code` / `note`); paragraph inline code is `backtick`-delimited and rendered through `parseInline` as escaped `<code>` spans — no `set:html` on prose, no markdown pipeline.
- **Core value:** Simple, Bullet-proof.
- **Why:** At one post a week a full MDX/content-collection pipeline is scope the volume doesn't justify (P5). A typed union is testable (`blog.test.ts` pins code-block language, source count, slug shape) and closes the XSS surface a raw-HTML body would open — the only markup a SQL post needs is code, and that renders through an escaped span.
- **Consequence in code:** No `set:html` renders post prose. New body needs live only in `blog.ts`; adding a block kind means extending the union + the template's `.map` + a test. Reject a post that embeds raw HTML strings in body text.
- **Alternatives rejected:** Astro content collections / MDX — heavier than warranted now; revisit if cadence rises past ~1/week or posts need components. Raw-HTML body strings — XSS surface, not testable.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-025** — North-star compass.
  - *In this feature:* the KPI advanced is **distribution / onboarding** — `/blog` is a new indexable surface category feeding rows #1–#4 of the scorecard, and every post CTA points at `/app/new` (anonymous mode). KPI degraded: none.
- **GLOBAL-034** — Analytics stack (Cloudflare Web Analytics for pageviews).

## Open questions / known unknowns

- **Yield measurement** — Per-page views ride Cloudflare Web Analytics (GLOBAL-034), which can't split per-path at the account tier today; referral yield of `/blog` (like `/solve`/`/vs`) is measured in aggregate until the analytics-wiring slice lands. Parked, not decided.
- **Cadence vs. backlog** — `distribution-queue.md` holds ~30 collapsed drafts whose full bodies live in git history. Whether to backfill them into `/blog` in a batch or one-per-day is unresolved; the daily loop currently ships the newest ready draft. Parked (`GLOBAL-033`).
- **OG cards** — Posts fall back to the site-wide share card; a per-post card generator (parity with the `/solve` P2 cluster) is not yet built.
