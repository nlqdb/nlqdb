// `/app/*` link targets — one emitter for every surface that links the
// product from a page a crawler (or visitor) can reach on the marketing
// origin.
//
// `nlqdb.com/app/*` 301s to the merged app worker on `app.nlqdb.com`
// (SK-AUTH-016), so a relative `/app/…` href baked into the marketing
// build is an internal link to a redirect — the 2026-08-04 Ahrefs audit
// counted 285 such links (Topnav's authed slot + every "Start with a
// goal" CTA), pure crawl-budget waste at DR 0 plus a redirect round-trip
// on the primary CTA click.
//
// `PUBLIC_API_BASE` already names the app origin exactly where the hop is
// cross-origin: deploy-web.yml bakes `https://app.nlqdb.com` into the
// marketing copy, while the app-host copy (deploy-api.yml), previews, and
// local dev leave it unset because `/app/*` is same-origin there. Deriving
// the href base from it emits the final URL precisely when the relative
// path would redirect, and keeps relative paths everywhere else.
export function appHref(path: `/app/${string}`): string {
  const base = import.meta.env.PUBLIC_API_BASE ?? "";
  return `${base.replace(/\/+$/, "")}${path}`;
}

// The one host `/app/*` pages canonically live on — `nlqdb.com/app/*`
// only redirects there. `Base.astro` builds those pages' canonical/og:url
// from this instead of `Astro.site`, so the app pages stop declaring a
// canonical that 301s (the Ahrefs "canonical points to redirect" trio).
// A constant, not `PUBLIC_API_BASE`: the app-host build leaves that env
// unset, and a canonical must name one absolute production URL per page
// regardless of which copy of the bundle rendered it.
export const APP_CANONICAL_ORIGIN = "https://app.nlqdb.com";
