// SK-GTM-007 attribution continuity across the docs host.
//
// `captureFirstTouch` (`apps/web/src/lib/attribution.ts`) runs only in the
// apex layout, and `localStorage` is per-origin — so a reader who lands on
// docs.nlqdb.com first has no way to hand the apex the channel that brought
// them. `isInternalHost` also counts `*.nlqdb.com` as our own, so the apex
// discards the docs referrer as internal navigation: before this, every
// channel whose published URL pointed at the docs host converted as
// `direct`, and the R-07 `agent-artifacts` yield gate could never fire
// because the artifacts' primary link is this guide.
//
// The only carrier that survives a cross-origin hop is the URL itself, so
// the channel params on the docs URL are copied onto every outbound apex
// link. Telemetry only — a failure never blocks a click (SK-GTM-007:
// "attribution is telemetry, never load-bearing").

/** The params `captureFirstTouch` reads; anything else is not attribution. */
const CHANNEL_PARAMS = ["utm_source", "utm_medium", "utm_campaign"] as const;

/** The one host that captures first touch. Subdomains do not. */
const APEX_HOST = "nlqdb.com";

/** Resolves relative hrefs so they land on this host and get skipped. */
const DOCS_ORIGIN = "https://docs.nlqdb.com";

/** The minimum of an anchor this needs — keeps the rewrite DOM-free to test. */
interface LinkLike {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
}

/**
 * `href` with the channel params of `search` applied, when `href` points at
 * the apex and doesn't already name its own channel. Unchanged otherwise.
 */
export function forwardChannelParams(href: string, search: string): string {
  const incoming = new URLSearchParams(search);
  if (!incoming.get("utm_source")) return href;

  let url: URL;
  try {
    url = new URL(href, DOCS_ORIGIN);
  } catch {
    return href;
  }
  // `hostname` is already lowercased and excludes userinfo and port, so a
  // look-alike or `https://nlqdb.com@evil.example/` can't match; the scheme
  // guard additionally keeps a `javascript://nlqdb.com/…` href — whose "query
  // string" is executable source — out of a function that edits URLs.
  if (url.protocol !== "https:" || url.hostname !== APEX_HOST) return href;
  // A hand-tagged link already names its channel — first touch wins there too.
  // Truthiness, not `has`: a bare `?utm_source=` names no channel, and the
  // apex's `clean()` would drop it, so treat it the same as the incoming test.
  if (url.searchParams.get("utm_source")) return href;

  for (const param of CHANNEL_PARAMS) {
    const value = incoming.get(param);
    if (value) url.searchParams.set(param, value);
  }
  return url.toString();
}

/** Rewrites every link that gains params. Returns how many changed. */
export function forwardChannelParamsOnLinks(links: Iterable<LinkLike>, search: string): number {
  let rewritten = 0;
  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href) continue;
    const next = forwardChannelParams(href, search);
    if (next !== href) {
      link.setAttribute("href", next);
      rewritten += 1;
    }
  }
  return rewritten;
}

/** Browser entry point — the `injectScript` in `astro.config.mjs` calls this. */
export function applyChannelForwarding(): void {
  try {
    forwardChannelParamsOnLinks(document.querySelectorAll("a[href]"), location.search);
  } catch (err) {
    // SK-GTM-007: every attribution layer drops on failure rather than costing
    // a click. Vite folds `DEV` to `false` in prod, so a bug is loud locally
    // and this whole branch is dead code in the shipped bundle.
    if (import.meta.env.DEV) console.error("channel-forward", err);
  }
}
