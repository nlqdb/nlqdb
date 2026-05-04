// Cloudflare Turnstile siteverify wrapper (SK-ANON-007).
//
// Turnstile is the PoW escape hatch on the anon-create rate-limit
// path: when an IP has already burst 3 creates in a 5-minute window,
// we require a `cf-turnstile-response` token from a managed/invisible
// challenge before processing any further create. Verification is a
// single fetch — no KV writes, no nonce store — which keeps it
// inside the free-tier budget the skill spends on KV elsewhere.
//
// Failure-open vs failure-closed:
//   - If the secret is unset, `verifyTurnstile` returns
//     `{ ok: false, reason: "unconfigured" }`. The route handler
//     decides whether to fail open (skip the challenge — useful in
//     `wrangler dev` where the secret may be absent) or fail closed
//     (treat as challenge_failed). For `/v1/ask` we fail open today
//     so dev environments aren't blocked by missing secrets; the
//     rate-limit step at index.ts still throttles.
//   - If siteverify itself fails (network, 5xx), we return
//     `{ ok: false, reason: "verify_failed" }`. The route maps this
//     to the same 428 challenge_required envelope so the client
//     re-renders the widget.

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; reason: "unconfigured" | "verify_failed" | "invalid" };

export interface TurnstileDeps {
  fetch?: typeof fetch;
}

export async function verifyTurnstile(
  token: string | null | undefined,
  secret: string | undefined,
  remoteIp: string | null | undefined,
  deps: TurnstileDeps = {},
): Promise<TurnstileVerifyResult> {
  if (!secret) return { ok: false, reason: "unconfigured" };
  if (!token) return { ok: false, reason: "invalid" };

  const fetchFn = deps.fetch ?? fetch;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  let res: Response;
  try {
    res = await fetchFn(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    return { ok: false, reason: "verify_failed" };
  }
  if (!res.ok) return { ok: false, reason: "verify_failed" };

  let data: { success?: unknown };
  try {
    data = (await res.json()) as { success?: unknown };
  } catch {
    return { ok: false, reason: "verify_failed" };
  }
  if (data.success === true) return { ok: true };
  return { ok: false, reason: "invalid" };
}
