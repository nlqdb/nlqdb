---
name: blog
description: "`/blog` — the canonical, autonomously-published home for distribution-queue drafts; engineering notes with JSON-LD, listed in llms.txt + sitemap."
when-to-load:
  globs:
    - apps/web/src/data/blog.ts
    - apps/web/src/pages/blog/**
    - apps/web/src/lib/inline-md.ts
  topics: [blog, publishing, distribution, aeo, llms-txt]
---

# Feature: Blog

**One-liner:** `/blog/<slug>` engineering posts — the canonical copies of `docs/research/distribution-queue.md` drafts, published autonomously by the daily loop; community-venue posts point back here.
**Status:** implemented (Phase 1) — 24 posts live (canonical count + URLs in `docs/scorecard.md` § Shipped distribution; `git log` for per-run provenance).
**Owners (code):** `apps/web/src/data/blog.ts`, `apps/web/src/pages/blog/**`, `apps/web/src/lib/inline-md.ts`, `apps/web/src/pages/llms.txt.ts`, `apps/web/src/pages/sitemap.xml.ts`
**Cross-refs:** [`.claude/commands/daily.md`](../../../.claude/commands/daily.md) step 3 (the publishing loop) · [`docs/research/distribution-queue.md`](../../research/distribution-queue.md) (draft source) · [`comparison-pages/FEATURE.md`](../comparison-pages/FEATURE.md) + [`solve-pages/FEATURE.md`](../solve-pages/FEATURE.md) (sibling AEO surfaces) · [`web-app/FEATURE.md`](../web-app/FEATURE.md)

## Touchpoints — read this feature before editing

- `apps/web/src/data/blog.ts` — typed source of truth (one object per post, newest first)
- `apps/web/src/data/blog.test.ts` — data-integrity guards (slugs, dates, renderer limit, copy rules)
- `apps/web/src/pages/blog/[slug].astro` — single dynamic template (`getStaticPaths()`)
- `apps/web/src/pages/blog/index.astro` — blog hub (`/blog`), ItemList JSON-LD
- `apps/web/src/lib/inline-md.ts` — dependency-free inline renderer for post bodies
- `apps/web/src/pages/llms.txt.ts` + `sitemap.xml.ts` — auto-include new slugs

## Decisions

### SK-BLOG-001 — `/blog` is the canonical publishing surface; publishing is autonomous

- **Decision:** Every distribution-queue draft ships as a post at `nlqdb.com/blog/<slug>` published by the daily agent with **no founder-review gate** (founder-resolved 2026-07-01). On publish: the draft is deleted from `docs/research/distribution-queue.md` (or its archive), community-venue variants (dev.to / Reddit / HN) stay in the queue only as pointers to the canonical `/blog` URL, and the live URL is recorded in `docs/scorecard.md` § Shipped distribution.
- **Core value:** Simple, Free, Honest latency
- **Why:** The queue's original loop ("the founder reviews and publishes at the weekly session") stalled at **zero published artifacts** while 100+ drafts accreted — the review dependency was the bottleneck, not draft supply. A first-party canonical URL also fixes the AEO shape: the canonical copy accrues the citations and the indexation; venue copies become pointers instead of orphaned duplicates.
- **Consequence in code:** Publishing a post = one entry prepended to `BLOG_POSTS` in `apps/web/src/data/blog.ts` + deleting the queue draft + one scorecard line. No CMS, no draft/pending state, no approval workflow — reviewers reject a PR that adds a human-approval step to this pipeline (that supersedes SK-BLOG-001, raise it per P1).
- **Alternatives rejected:**
  - Founder-review-then-publish — the loop it replaces; empirically published nothing.
  - Publish only to third-party venues — no canonical URL to accrue authority; venue posts rot and can't be fixed.
  - Bulk-recovering the ~60 collapsed queue gists (bodies survive only in `git log -p`) to inflate the post count — rejected: a stale draft published today date-stamps old numbers as *new* claims, poisoning the AEO surface with figures that were true months ago. A collapsed gist re-enters the queue only when its topic independently earns a slot on merit (a `/daily` artifact, one at a time), never as a batch import. Publishing is autonomous but per-artifact, not a backlog flush.

### SK-BLOG-002 — Typed data-file source + dependency-free inline renderer, not markdown files or a content collection

- **Decision:** Posts live in `apps/web/src/data/blog.ts` as typed blocks (`p` / `h2` / `code` / `ul` / `ol`); paragraph and list text carries only the inline subset `lib/inline-md.ts` renders (`code`, `**strong**`, `*em*`, `[links](…)`). No Astro content collection, no markdown dependency.
- **Core value:** Simple, Bullet-proof, Fast
- **Why:** The obvious idiomatic choice is an Astro content collection — but `bun test src` imports the `llms.txt.ts` / `sitemap.xml.ts` endpoints directly under bun, and `astro:content` only resolves inside Astro builds, so a collection would either fork the data path (metadata file + markdown file per post, drift) or break the endpoint tests. The typed data file is the exact pattern `/vs` + `/solve` already use: all four consumers (template, hub, sitemap, llms.txt) read one array, so a post structurally cannot fall out of any index.
- **Consequence in code:** Adding a post is a one-file edit. `blog.test.ts` pins the invariants: unique kebab slugs, ISO dates newest-first, description ≤ 200 chars, the renderer's documented limit (emphasis must not wrap a code span), and the founder-directive copy rule (no "waitlist" / "invite" / "pre-alpha" in post copy). The sitemap + llms.txt tests assert every slug is advertised.
- **Alternatives rejected:**
  - Astro content collection — breaks the bun-test import of the endpoints; a second content pattern in a repo standardized on typed data files.
  - A markdown dependency (marked / markdown-it) — a dependency plus a sanitization surface for what is a four-pattern inline subset; `inline-md.ts` escapes first, so post content can never inject markup.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path.
  - *In this feature:* the post CTA emits `blog.cta_clicked` `{slug}` via `lib/logsnag.ts` (same late-bound hook as `vs.try_query_clicked` / `solve.try_query_clicked`), so per-post funnel yield is measurable per venue.
- **GLOBAL-025** — North-star compass.
  - *In this feature:* the KPI advanced is **onboarding/UX via distribution yield** — every post CTA points at `/app/new` (anonymous mode); posts are the daily loop's released artifact.
- **GLOBAL-034** — Analytics stack (Cloudflare Web Analytics for pageviews; PostHog Phase-2-optional). No client analytics SDK ships with blog pages.

## Open questions / known unknowns

- **Per-post OG images** — same deferral as the `/vs` + `/solve` per-slug OG open question (single generator when it lands); posts inherit the site default card today.
