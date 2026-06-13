# WS-01 — Marketing site (home + sub pages)

**Scope:** `apps/web/src/pages/{index,manifesto,pricing}.astro`, `vs/`,
`solve/`, `llms.txt.ts`, `sitemap.xml.ts`, `layouts/`, `components/`.
**Pre-reads:** `docs/features/web-app/FEATURE.md`,
`docs/features/comparison-pages/FEATURE.md`,
`docs/features/solve-pages/FEATURE.md`.
**Default KPI:** Onboarding (inbound funnel → first query).
**Constraints that bound every task here:** SK-WEB-002 (goal-first hero,
no signup wall), SK-WEB-003 (runnable code above the fold), SK-WEB-008
(demo hits the real API), GLOBAL-034 (Cloudflare Web Analytics only).

---

## WS01-T1 (P1) — Social previews are declared but imageless

- **Files:** `apps/web/src/layouts/Base.astro:38-42`
- **Problem:** The layout emits `twitter:card = summary_large_image` and
  og:title/description/url but **no `og:image` / `twitter:image`**. Every
  share on Slack/Discord/X/LinkedIn renders text-only (or a broken large
  card); LLM crawlers also use og:image in citations. For a dev tool,
  shared links are a primary funnel.
- **Fix:** Ship one static site-wide fallback (e.g.
  `apps/web/public/og-default.png`, 1200×630, dark, logo + one-line pitch)
  and add `og:image` + `twitter:image` (+ `og:image:alt`) to `Base.astro`,
  overridable via a layout prop so per-page images can come later.
  Per-slug generated OG images for `/vs/*` and `/solve/*` are tracked as
  parked in `comparison-pages/FEATURE.md` — do NOT build a Satori/Workers
  generator in this task.
- **Accept:** `curl -s` of `/`, `/pricing`, one `/vs/*`, one `/solve/*`
  shows both meta tags with an absolute URL that 200s.

## WS01-T2 (P1) — Footer links to legal pages that don't exist

- **Files:** `apps/web/src/components/Footer.astro:12-14`
- **Problem:** Footer hardcodes `https://nlqdb.com/privacy` and
  `https://nlqdb.com/terms`; no such pages exist anywhere in
  `apps/web/src/pages/` → guaranteed 404 right where trust matters, and
  the waitlist collects email addresses.
- **Fix (two parts):**
  1. Now: create minimal honest `/privacy` and `/terms` pages (plain
     Astro, what is actually collected today: waitlist email + persona,
     Cloudflare Web Analytics per GLOBAL-034, no ad tracking) and switch
     the footer to relative links. Mark both pages "pre-alpha draft".
  2. Real lawyer-reviewed text is a founder action — add one bullet to
     `docs/blocked-by-human.md` under *Human actions* asking for final
     legal copy.
- **Accept:** No footer link 404s; `docs/blocked-by-human.md` has the
  bullet.

## WS01-T3 (P2) — Waitlist inputs lack real `<label>` elements

- **Files:** `apps/web/src/components/Waitlist.astro` (email input +
  persona select, ~lines 20-45)
- **Problem:** Inputs rely on `aria-label` only. Works, but WCAG AA
  prefers programmatic `<label for=…>`; labels also enlarge tap targets.
- **Fix:** Add visually-styled (or `sr-only`) `<label>` elements paired
  by `id`/`for`; keep the visual design unchanged.
- **Accept:** Each form control has an associated `<label>`;
  `bun run lint` green.

## WS01-T4 (P2) — Wishlist vote gives no feedback

- **Files:** `apps/web/src/components/CodePanel.astro:156-162`
- **Problem:** Clicking a wishlist badge fires a silent keepalive POST to
  `/v1/events/wishlist` and opens `mailto:` — the user never learns the
  vote was recorded.
- **Fix:** Minimal inline confirmation (swap badge text to "✓ noted" for
  ~2s). No toast framework; keep the page 0-JS-by-default posture of
  SK-WEB-001 (this component already ships script).
- **Accept:** Click → visible confirmation; event still fires once.

## WS01-T5 (P3) — Polish batch (one commit)

1. **Sitemap:** add `"/pricing"` to `STATIC_ROUTES` in
   `apps/web/src/pages/sitemap.xml.ts:12`. Keep `/app`, `/auth/*` out
   (intentional).
2. **Hero subhead density** (`apps/web/src/components/Hero.astro:25-28`):
   optional tightening, e.g. "Create one in a word. Query it in English.
   The infrastructure stays invisible." Keep the goal-first framing of
   SK-WEB-002 — copy change only, no structure change.
- **Accept:** sitemap contains `/pricing`; hero still one input + CTA.
