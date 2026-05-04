// Cloudflare Turnstile challenge hook for the anonymous-create
// rate-limit escape hatch (SK-ANON-007).
//
// When `/v1/ask` returns 428 with `{ code: "challenge_required" }`,
// the UI must render the Turnstile widget and resubmit with the
// resulting `cf-turnstile-response` token. That flow lives in the
// product app's anonymous-create path (Worksheet 3); this stub
// returns null so callers can be wired now and the widget can be
// dropped in without further surface churn.
//
// Wired in the same PR as the product-app anonymous flow
// (Worksheet 3). The marketing hero never reaches this path because
// it talks to `/v1/demo/ask` (no auth, no rate-limit-driven
// challenge).

export async function solveChallenge(): Promise<string | null> {
  // Returns the cf-turnstile-response token, or null if unsupported.
  return null;
}
