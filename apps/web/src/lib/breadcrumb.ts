// BreadcrumbList JSON-LD builder — the AEO/SEO breadcrumb rich-result signal
// (Google renders a breadcrumb trail instead of the raw URL in SERPs; ChatGPT
// / Perplexity read it to place a page in the site hierarchy). Mirrors
// `Base.astro`'s canonical normalisation — a trailing slash on every non-root
// path — so each `item` URL is the 200, not the 307 redirect CF serves for the
// bare path (run-69). Shared by `/vs/[slug]` and `/solve/[slug]` so the two
// templates can't drift on shape.

export interface Crumb {
  /** Visible label — must match the on-page breadcrumb trail (Google rule). */
  name: string;
  /** Site-relative path, e.g. "/" or "/vs" or "/vs/supabase". */
  path: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[], site: URL | undefined) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: new URL(
        c.path === "/" || c.path.endsWith("/") ? c.path : `${c.path}/`,
        site,
      ).toString(),
    })),
  };
}
