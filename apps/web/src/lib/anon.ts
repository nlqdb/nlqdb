// Anonymous-mode token storage for the web (SK-ANON-001).
//
// On first call the helper mints `anon_<uuid>` and writes it to
// `localStorage["nlqdb_anon"]`; subsequent calls reuse the same value.
// The API treats the resulting `Authorization: Bearer anon_…` as a
// per-device anonymous identity, later adopted into a real user via
// `POST /v1/anon/adopt` on sign-in (SK-ANON-003).
//
// NOTE: the marketing hero does NOT call this — it talks to
// `/v1/demo/ask` which is unauthenticated canned fixtures (SK-WEB-004).
// The product chat surface (Worksheet 3) is the consumer.

const STORAGE_KEY = "nlqdb_anon";
const PREFIX = "anon_";

export function getOrMintAnonToken(): string {
  // SSR / pre-hydration guard. Astro statically renders pages on the
  // server where `window` is undefined; callers that hit this path
  // should defer to a `useEffect` or `client:only` island.
  if (typeof window === "undefined") {
    throw new Error("getOrMintAnonToken must run in the browser");
  }

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing?.startsWith(PREFIX)) {
    return existing;
  }

  const token = `${PREFIX}${window.crypto.randomUUID()}`;
  window.localStorage.setItem(STORAGE_KEY, token);
  return token;
}
