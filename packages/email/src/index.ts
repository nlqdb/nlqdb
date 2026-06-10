// Resend transport — the GLOBAL-021 canonical owner of the Resend email
// boundary. Every email the product sends (Better Auth magic-link in
// `apps/api`, the billing dunning reminder in `apps/events-worker`) goes
// through `makeEmailSender`; no other file constructs the Resend request.
// One JSON POST to api.resend.com per send — avoids pulling the `resend`
// SDK to keep the Workers bundle lean (`GLOBAL-013`); a single fetch is
// the entire surface we use.
//
// `sendEmail` is fail-loud by design: a magic-link send that thinks it
// succeeded but didn't would silently lock the user out. The caller (Better
// Auth's `sendMagicLink`) propagates the throw, which surfaces as a 5xx so
// the UI can show "couldn't send, try again". Best-effort callers (dunning)
// catch the throw themselves.
//
// Error message hygiene: the thrown Error contains ONLY the HTTP status —
// never the response body. Resend's error envelopes echo the destination
// email + the configured from-address, which would then propagate into
// Better Auth's response (and into operator logs of failed sign-ins). The
// full body is logged via `console.error` so `wrangler tail` still shows it
// during triage.
//
// Timeout: 8s via AbortSignal.timeout. Workers cap subrequests at 30s;
// eight seconds is the sweet spot between "slow Resend region" (p95 ~1s)
// and "user staring at Sending… for half a minute".
//
// Dev/test stub: when `RESEND_API_KEY` is unset (no `.dev.vars` row,
// vitest), `makeEmailSender` returns a console-logging stub. Lets
// `wrangler dev` exercise sends end-to-end without a Resend account; the
// dev console prints the body.

// The verified Resend sender. Callers default to this when `RESEND_FROM`
// is unset; it lives with the owner so magic-link and dunning can't drift
// to different from-addresses (GLOBAL-021).
export const DEFAULT_FROM = "nlqdb <hello@nlqdb.com>";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  // Optional Resend idempotency key (24h dedup window). Best-effort async
  // senders (e.g. the dunning sink, retried by Cloudflare Queues) set it so
  // a redelivery can't double-send; request-coupled senders omit it.
  idempotencyKey?: string;
};

export type EmailSender = (msg: EmailMessage) => Promise<void>;

export type ResendConfig = {
  apiKey: string | undefined;
  from: string;
  // Override the fetch impl for tests (default: global fetch).
  fetch?: typeof fetch;
  // Override the timeout for tests / future tuning. Default 8000ms.
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 8000;

export function makeEmailSender(cfg: ResendConfig): EmailSender {
  if (!cfg.apiKey) {
    return async (msg) => {
      console.info(
        `[email:dev-stub] to=${msg.to} subject=${JSON.stringify(msg.subject)} body=${msg.text}`,
      );
    };
  }
  const fetcher = cfg.fetch ?? fetch;
  const apiKey = cfg.apiKey;
  const from = cfg.from;
  const timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return async (msg) => {
    let res: Response;
    try {
      res = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          // Resend dedups identical keys for 24h — collapses retried sends.
          ...(msg.idempotencyKey ? { "idempotency-key": msg.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from,
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          ...(msg.html ? { html: msg.html } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Aborted (timeout) or network blip. The cause string is safe
      // to surface — it's our own classification, not Resend's body.
      const reason = err instanceof Error ? err.name : "unknown";
      console.error("resend send: network error", { reason, error: err });
      throw new Error(`resend send failed: ${reason}`);
    }
    if (!res.ok) {
      // Log the full body for triage but DO NOT include it in the
      // thrown error — Resend echoes the destination email + the
      // from-address, which would then leak into Better Auth's
      // response surface and operator logs of failed sign-ins.
      const body = await res.text().catch(() => "<unreadable>");
      console.error("resend send: non-2xx", {
        status: res.status,
        body: body.slice(0, 1024),
      });
      throw new Error(`resend send failed: HTTP ${res.status}`);
    }
  };
}
