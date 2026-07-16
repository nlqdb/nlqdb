#!/usr/bin/env bun
// Push the live sitemap URL list to IndexNow (Bing / Yandex / Seznam /
// Naver — NOT Google, which ignores IndexNow). Bing is nlqdb.com's only
// working search engine today, so this feeds the one channel that
// converts. Run on every web deploy (see .github/workflows/deploy-web.yml)
// so new/changed pages are pushed the moment they ship, instead of
// waiting for an organic recrawl of a young, near-unlinked site.
//
// The key is public by design (served as a <key>.txt file at the site
// root); there are no secrets here. Protocol: https://www.indexnow.org.
//
// Usage: bun scripts/submit-indexnow.ts
// Env overrides (all optional): INDEXNOW_HOST, INDEXNOW_KEY, INDEXNOW_ENDPOINT.

const HOST = process.env.INDEXNOW_HOST ?? "nlqdb.com";
// Must match apps/web/public/<key>.txt exactly (8–128 hex chars).
const KEY = process.env.INDEXNOW_KEY ?? "7019badf5f6c8972331a8dfdce078874";
const ENDPOINT = process.env.INDEXNOW_ENDPOINT ?? "https://api.indexnow.org/indexnow";

const SITE = `https://${HOST}`;
const SITEMAP_URL = `${SITE}/sitemap.xml`;
const KEY_LOCATION = `${SITE}/${KEY}.txt`;
// A hung connection must never stall the deploy job into its job-level
// timeout (which WOULD fail the run despite continue-on-error).
const FETCH_TIMEOUT_MS = 30_000;

function fail(msg: string): never {
  console.error(`indexnow: ${msg}`);
  process.exit(1);
}

async function readSitemapUrls(): Promise<string[]> {
  const res = await fetch(SITEMAP_URL, {
    headers: { accept: "application/xml" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) fail(`could not fetch ${SITEMAP_URL} (HTTP ${res.status})`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    // Spec guards (https://www.indexnow.org): every URL must belong to the
    // submitted host (one foreign URL can 422 the whole batch) and one POST
    // carries at most 10,000 URLs.
    .filter((u) => u.startsWith(`${SITE}/`))
    .slice(0, 10_000);
  if (urls.length === 0) fail(`no ${SITE} <loc> entries in ${SITEMAP_URL}`);
  return urls;
}

// Documented status codes (https://www.indexnow.org/documentation):
// 200 OK / 202 Accepted (validation pending) — success; 400 bad request;
// 403 key not found at keyLocation; 422 URL/key host mismatch; 429 spam.
function describe(status: number): string {
  switch (status) {
    case 200:
      return "OK — accepted";
    case 202:
      return "Accepted — key validation pending (key file goes live on the next deploy)";
    case 400:
      return "Bad Request — invalid payload";
    case 403:
      return "Forbidden — key not found at keyLocation (expected until the key file is deployed)";
    case 422:
      return "Unprocessable — URLs don't match host, or key schema mismatch";
    case 429:
      return "Too Many Requests — throttled as potential spam";
    default:
      return "unexpected status";
  }
}

async function main(): Promise<void> {
  const urlList = await readSitemapUrls();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const line = `indexnow: HTTP ${res.status} — ${describe(res.status)} (${urlList.length} URLs → ${ENDPOINT})`;
  // 200/202 are the only success codes; everything else is a real failure
  // when the key file is already live — exit 1 so the CI step surfaces it
  // as an annotation. The step is continue-on-error (SK-WEB-023), so this
  // still never fails a deploy.
  if (res.status === 200 || res.status === 202) console.info(line);
  else fail(line.replace(/^indexnow: /, ""));
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
