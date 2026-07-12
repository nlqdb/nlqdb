// Cloudflare Turnstile siteverify wrapper.
//
// Turnstile is the unconditional bot-floor on every anon create
// (SK-ANON-012 superseded the SK-ANON-007 3-in-5-min burst gate).
// Verification is a single fetch — no KV writes, no nonce store.
//
// Failure-open vs failure-closed:
//   - Secret unset → `{ ok: false, reason: "unconfigured" }`, which
//     the gate (`anon-create-gate.ts`) allows through in EVERY
//     environment per SK-ANON-009 — no client ships a widget yet.
//   - siteverify itself fails (network, 5xx) →
//     `{ ok: false, reason: "verify_failed" }`, mapped to the 428
//     challenge_required envelope so the client re-renders the widget.

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
