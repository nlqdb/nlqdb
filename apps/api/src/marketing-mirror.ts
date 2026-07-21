// Front-controller for the merged app host (`SK-AUTH-016`). `app.nlqdb.com`
// serves the SAME `apps/web` build as the canonical marketing host
// `nlqdb.com`, so the marketing content trees (`/blog`, `/solve`, `/vs`) are
// crawlable duplicates there. `rel=canonical` alone did NOT stop Google
// indexing the app-host copy (GSC surfaced `app.nlqdb.com/blog/…` at page-1,
// 2026-07), so we 301 those trees to the canonical host to consolidate SEO
// authority. Product (`/app/*`), auth (`/auth/*`), and the API (`/v1/*`,
// `/api/auth/*`) are never matched. See `SK-WEB-026`.

export const MERGED_APP_HOST = "app.nlqdb.com";
export const CANONICAL_MARKETING_ORIGIN = "https://nlqdb.com";

// Wildcard-covered content trees only — self-maintaining as posts / pages are
// added within them. Static marketing singles (`/pricing`, `/architecture`, …)
// are a far smaller duplicate surface and stay asset-served, keeping this list
// stable and clear of the root `/` and auth-adjacent paths.
export const MARKETING_MIRROR_PREFIXES = ["/blog", "/solve", "/vs"] as const;

export function isMarketingMirrorPath(pathname: string): boolean {
  return MARKETING_MIRROR_PREFIXES.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

// The canonical URL a merged-app-host marketing request should 301 to, or null
// to serve it normally. Pure so the unit test needs no worker runtime.
export function marketingMirrorRedirect(url: URL): string | null {
  if (url.hostname !== MERGED_APP_HOST) return null;
  if (!isMarketingMirrorPath(url.pathname)) return null;
  return new URL(url.pathname + url.search, CANONICAL_MARKETING_ORIGIN).toString();
}
