// Front-controller for the merged app host (`SK-AUTH-016`). `app.nlqdb.com`
// serves the SAME `apps/web` build as the canonical marketing host
// `nlqdb.com`, so ALL of its marketing surface (content trees, singles, and
// the SEO/discovery aggregators) is a crawlable duplicate there.
// `rel=canonical` alone did NOT stop Google indexing the app-host copy (GSC
// surfaced `app.nlqdb.com/blog/…` at page-1, then `nlqdb.com/agents` &
// `/architecture` — both excluded by the run-105 trees-only scope — indexed
// with impressions), so we 301 the whole marketing surface to the canonical
// host to consolidate SEO authority. The app host has nothing of its own to
// rank on these paths (product is behind auth, API returns JSON), so this is
// pure de-duplication. Product (`/app/*`), auth (`/auth/*`, `/oauth/*`), the
// API (`/v1/*`, `/api/auth/*`), and the root `/` are never matched. See
// `SK-WEB-026`.

export const MERGED_APP_HOST = "app.nlqdb.com";
export const CANONICAL_MARKETING_ORIGIN = "https://nlqdb.com";

// Every top-level marketing route the shared `apps/web` build ships. Matched
// as a prefix (`/blog` also covers `/blog/post/`) so content trees stay
// self-maintaining; the exact-file aggregators (`/llms.txt`, …) match via the
// `===` arm. Kept in lock-step with `run_worker_first` in `apps/api/wrangler.toml`
// (a test in `marketing-mirror.test.ts` fails if the two drift) — the sync
// burden that motivated the original trees-only scope is now enforced, not
// trusted. Must never include the root `/` or an `/app|/auth|/oauth|/v1|/api`
// prefix (those are the app host's own routes).
export const MARKETING_MIRROR_PREFIXES = [
  // Content trees.
  "/blog",
  "/solve",
  "/vs",
  // Static marketing singles.
  "/agents",
  "/architecture",
  "/integrations",
  "/manifesto",
  "/pricing",
  "/privacy",
  "/terms",
  "/security",
  // SEO / discovery aggregators (exact files).
  "/llms.txt",
  "/rss.xml",
  "/sitemap.xml",
] as const;

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
