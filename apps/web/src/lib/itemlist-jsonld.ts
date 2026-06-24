// ItemList JSON-LD builder — the AEO/SEO list signal for the `/vs` and `/solve`
// hub pages. A listing page that enumerates a whole collection (every
// comparison, every solve guide) should tell answer engines the *complete* set
// so they can enumerate and cite it as a group; Google supports `ItemList` for
// such pages and answer engines read it to treat the page as the collection's
// index rather than one more leaf. Each `url` is trailing-slash-normalised to
// the 200 (mirrors `breadcrumb.ts` / `Base.astro` canonical), so the list
// points at pages, never the 307 redirect CF serves for a bare path. Built from
// the same data the page renders visibly, so the markup can't drift from the
// list. Shared by `/vs` and `/solve` so the two index pages can't drift on
// shape — mirrors `breadcrumb.ts` and `faq-jsonld.ts`.

export interface ListEntry {
  /** Visible link label on the page (the `/vs` <h2> or `/solve` <h3>). */
  name: string;
  /** Site-relative path of the target page, e.g. "/vs/supabase". */
  path: string;
}

export function itemListJsonLd(name: string, entries: ListEntry[], site: URL | undefined) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: entries.length,
    itemListElement: entries.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.name,
      url: new URL(e.path.endsWith("/") ? e.path : `${e.path}/`, site).toString(),
    })),
  };
}
