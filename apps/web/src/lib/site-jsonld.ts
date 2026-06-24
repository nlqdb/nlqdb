// Organization + WebSite JSON-LD — the homepage-only entity-authority signals.
// `Organization` binds the "nlqdb" brand to one canonical entity (a stable
// `@id`) so answer engines and Google attribute brand queries to it; `WebSite`
// declares the site entity, its name (the string Google may surface as the SERP
// site name), and names that same Organization as publisher via `@id`. Declared
// once on the root, not per-page — these are site-wide nodes, and the stable
// `@id`s let crawlers consolidate them with the SoftwareApplication node's
// `publisher` reference that Base.astro emits on every page.
//
// No SearchAction: the schema.org sitelinks-searchbox contract requires the
// target URL to *run* the query, but the goal-first hero submits via JS to
// `/v1/ask` (SK-WEB-002) and no GET route consumes a `q` term — a SearchAction
// pointing at a URL that ignores the param is a broken signal, so it stays out
// until a URL-driven query entrypoint exists.

/** Site-relative fragment for the canonical Organization node's `@id`. */
export const ORGANIZATION_ID_FRAGMENT = "#organization";

export function organizationJsonLd(site: URL) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": new URL(ORGANIZATION_ID_FRAGMENT, site).toString(),
    name: "nlqdb",
    url: site.toString(),
    logo: new URL("/og-default.png", site).toString(),
    sameAs: ["https://github.com/nlqdb/nlqdb"],
  };
}

export function webSiteJsonLd(site: URL) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": new URL("#website", site).toString(),
    name: "nlqdb",
    url: site.toString(),
    publisher: { "@id": new URL(ORGANIZATION_ID_FRAGMENT, site).toString() },
  };
}
