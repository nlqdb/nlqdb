// ItemList JSON-LD builder — the AEO/SEO collection signal for the `/vs` and
// `/solve` hub pages, so answer engines read the *complete* set in one fetch
// instead of scraping the prose list. Each `url` is trailing-slash-normalised
// to the 200 (mirrors `breadcrumb.ts` / `Base.astro` canonical), never the 307
// redirect CF serves for a bare path. Callers pass `entries` from the same
// array the page renders, so the markup can't drift from the visible list.
// Shared by both hubs so they can't drift on shape — mirrors `breadcrumb.ts`.

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
