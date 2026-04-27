// Resend transport (Slice 10). One JSON POST to api.resend.com per
// send. Avoids pulling the `resend` SDK to keep the Workers bundle
// lean — a single fetch call is the entire surface we use.
//
// `sendEmail` is fail-loud by design: a magic-link send that thinks
// it succeeded but didn't would silently lock the user out. The
// caller (Better Auth's `sendMagicLink`) propagates the throw, which
// surfaces as a 500 from `/api/auth/sign-in/magic-link` so the UI
// can show "couldn't send, try again" instead of a misleading
// "check your email".
//
// Dev/test stub: when `RESEND_API_KEY` is unset (no `.dev.vars` row,
// vitest), `makeEmailSender` returns a console-logging stub. Lets
// `wrangler dev` exercise the magic-link end-to-end without a Resend
// account; the dev console prints the link, the dev clicks it.

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailSender = (msg: EmailMessage) => Promise<void>;

export type ResendConfig = {
  apiKey: string | undefined;
  from: string;
  // Override the fetch impl for tests (default: global fetch). Avoids
  // network in unit tests without vi.mock of cloudflare:workers.
  fetch?: typeof fetch;
};

export function makeEmailSender(cfg: ResendConfig): EmailSender {
  if (!cfg.apiKey) {
    return async (msg) => {
      console.log(
        `[email:dev-stub] to=${msg.to} subject=${JSON.stringify(msg.subject)} body=${msg.text}`,
      );
    };
  }
  const fetcher = cfg.fetch ?? fetch;
  const apiKey = cfg.apiKey;
  const from = cfg.from;
  return async (msg) => {
    const res = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      }),
    });
    if (!res.ok) {
      // Read body for a useful error message but cap at 512 chars —
      // Resend errors are JSON envelopes that fit comfortably.
      const detail = (await res.text()).slice(0, 512);
      throw new Error(`resend send failed: HTTP ${res.status} ${detail}`);
    }
  };
}
