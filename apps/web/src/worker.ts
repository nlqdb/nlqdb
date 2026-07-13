// Marketing worker (`nlqdb-web`, nlqdb.com) — a thin redirect in front of the
// static Astro build. Per SK-AUTH-016 the product surface (`/app/*`) is
// same-origin with the API on `app.nlqdb.com`; the marketing worker serves the
// SAME build, so `/app/*` is reachable here too — cross-origin, where the model
// picker's `GET /v1/models` (and friends) would have to round-trip CORS. Send
// `/app/*` to the merged app so the product is always first-party.
//
// Deliberately narrow:
//   • Only `/app/*`. `/auth/*` hops to the merged app client-side so it can
//     carry the visitor's localStorage draft / anon token in the URL fragment
//     (Topnav.astro / SK-ANON-015); a server redirect fires before that JS and
//     would strand the state on nlqdb.com.
//   • Only on the production marketing hosts. Previews (`*.workers.dev`) and the
//     merged app itself serve `/app` assets directly — so no redirect loop on
//     `app.nlqdb.com` (which shares this build but not this worker's config).

const PRODUCT_ORIGIN = "https://app.nlqdb.com";
const MARKETING_HOSTS = new Set(["nlqdb.com", "www.nlqdb.com"]);

// The absolute URL a request should be redirected to, or null to serve it
// normally. Pure so the unit test can exercise the routing without a worker
// runtime.
export function productRedirectTarget(url: URL): string | null {
  if (!MARKETING_HOSTS.has(url.hostname)) return null;
  if (url.pathname !== "/app" && !url.pathname.startsWith("/app/")) return null;
  // Fragments never reach the server; the browser reattaches them across a 301.
  return new URL(url.pathname + url.search, PRODUCT_ORIGIN).toString();
}

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const target = productRedirectTarget(new URL(request.url));
    if (target) return Response.redirect(target, 301);
    return env.ASSETS.fetch(request);
  },
};
