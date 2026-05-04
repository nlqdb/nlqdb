// Cloudflare Turnstile challenge hook for the anonymous-create
// rate-limit escape hatch (SK-ANON-007).
//
// When `/v1/ask` returns 428 with `{ code: "challenge_required" }`,
// the UI must render the Turnstile widget and resubmit with the
// resulting `cf-turnstile-response` token. The marketing hero AND
// `/app/new` both reach this path via `<CreateForm>` since
// SK-WEB-008 unified them on the real-LLM `/v1/ask` flow.
//
// Today this stub returns null so callers compile cleanly; the API
// fails open when `TURNSTILE_SECRET` is unset (SK-ANON-009), which
// keeps `wrangler dev` working without a Turnstile keypair. Drop in
// the real widget (managed/invisible mode) without changing
// `<CreateForm>`'s 428 retry seam.

export async function solveChallenge(): Promise<string | null> {
  // Returns the cf-turnstile-response token, or null if unsupported.
  return null;
}
