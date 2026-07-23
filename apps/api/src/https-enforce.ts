// HTTPS enforcement for the production hosts (`GLOBAL-039`). The zone-level
// "Always Use HTTPS" toggle needs a dashboard click the deploy token can't
// perform (docs/blocked-by-human.md), so every worker that fronts a dynamic
// nlqdb.com host 301s http→https itself and stamps HSTS so returning browsers
// never retry plaintext. Scoped to nlqdb.com hosts: `wrangler dev` /
// localhost / *.workers.dev previews are left untouched.

const HSTS_VALUE = "max-age=31536000; includeSubDomains";

export function httpsRedirectTarget(url: URL): string | null {
  if (url.protocol !== "http:") return null;
  const host = url.hostname;
  if (host !== "nlqdb.com" && !host.endsWith(".nlqdb.com")) return null;
  const target = new URL(url.toString());
  target.protocol = "https:";
  return target.toString();
}

export function withHsts(res: Response): Response {
  // WebSocket upgrades can't be re-wrapped (a 101 with `webSocket` set);
  // pass them through untouched.
  if (res.webSocket) return res;
  const wrapped = new Response(res.body, res);
  wrapped.headers.set("Strict-Transport-Security", HSTS_VALUE);
  return wrapped;
}
