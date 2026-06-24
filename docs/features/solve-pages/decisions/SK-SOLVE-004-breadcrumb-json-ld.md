# SK-SOLVE-004 — Every solve page emits BreadcrumbList JSON-LD mirroring a visible trail

- **Decision:** Every `/solve/<slug>` page renders a visible `Home → Solve → <searchTitle>` breadcrumb (`<nav aria-label="Breadcrumb">` → `<ol>`, last node `aria-current="page"` and not a link) **and** a matching `BreadcrumbList` JSON-LD block, both built from one source of truth (`apps/web/src/lib/breadcrumb.ts`, shared with `/vs` per [`SK-CMP-005`](../../comparison-pages/decisions/SK-CMP-005-breadcrumb-json-ld.md)). JSON-LD `item` URLs are trailing-slash-normalised to the 200, matching the canonical/og:url Base.astro emits — never the bare-path redirect.
- **Core value:** Effortless UX, Honest latency
- **Why:** FAQPage + HowTo earn the rich result but say nothing about where a page sits; `BreadcrumbList` is the hierarchy signal Google uses to render a breadcrumb trail instead of the raw URL (higher SERP CTR) and answer engines use to treat a page as a coherent leaf rather than an orphan. Google's guidance requires the markup to mirror a visible, clickable trail, so JSON-LD without an on-page trail is a quality smell.
- **Consequence in code:** the `[slug].astro` template hardcodes both the visible `<nav>` and the `breadcrumbJsonLd(...)` emission from the same crumb list, so the two can't drift; a future contributor cannot ship one without the other. Bare-path `item` URLs are forbidden (they point hierarchy nodes at a 307).
- **Alternatives rejected:**
  - "JSON-LD only, no visible trail" — violates Google's mirror rule; risks the markup being treated as deceptive.
  - "Visible trail only, no JSON-LD" — leaves the rich-result + AI-hierarchy signal on the table; the structured-data lift is ≈ free.
  - "Per-template inline breadcrumb objects" — two AEO templates would drift on shape; one shared builder keeps `/vs` and `/solve` identical.
