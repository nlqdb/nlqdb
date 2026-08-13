// The transactional-email catalog — the declarative surface for the
// "domain event → email" category. Each email is one pure builder returning
// the rendered `{ subject, text, html }`; the branded shell + escaping live
// once in `render.ts`. Adding an email means adding one function here, then a
// single best-effort `notify()` call at the event seam — no new Resend fetch
// (GLOBAL-021), no new HTML string builder, no new `escapeHtml` copy.
//
// Copy guidance: keep it honest and low-pressure. State what happened, offer
// one clear action, and invite a reply — every send is from a real inbox a
// human reads.

import { escapeHtml, type RenderedEmail, renderEmail } from "./render.ts";

// Magic-link sign-in (fail-loud send; the only email that blocks its flow).
// `continueUrl` is the click-through page that shields the token from inbox
// link-scanners; `rawLink` gives the same URL as a paste fallback.
export function magicLinkEmail(continueUrl: string): RenderedEmail {
  return renderEmail({
    subject: "Sign in to nlqdb",
    heading: "Sign in to nlqdb",
    body: [
      "Click the button below to sign in. The link expires in 10 minutes and can only be used once.",
    ],
    cta: { label: "Sign in", url: continueUrl },
    rawLink: continueUrl,
    footer: ["If you didn't request this, you can ignore this email."],
  });
}

// Welcome-on-signup (SK-AUTH-021) — one greeting the first time a user row
// is created. Best-effort; never blocks signup.
export function welcomeEmail(appUrl: string): RenderedEmail {
  return renderEmail({
    subject: "Welcome to nlqdb",
    heading: "Welcome to nlqdb",
    body: [
      "A database you talk to. Ask a question in plain English — nlqdb writes the SQL, runs it, and shows you the answer.",
      "Pick up where you left off:",
    ],
    cta: { label: "Open nlqdb", url: appUrl },
    footer: ["Reply to this email if you get stuck — a human reads it."],
  });
}

// Count-me-in confirmation — the user-facing acknowledgement the model-picker
// UI already promises ("we'll email you when the paid plan ships") but never
// sent until now. Fires once, the first time the account registers interest.
export function premiumInterestConfirmEmail(appUrl: string): RenderedEmail {
  return renderEmail({
    subject: "You're on the hosted-premium list",
    heading: "You're counted",
    body: [
      "Thanks for raising your hand for the hosted-premium plan — included frontier-model credits, no key juggling.",
      "We'll email you the moment it ships. Nothing changes on your account in the meantime; keep asking away.",
    ],
    cta: { label: "Back to nlqdb", url: appUrl },
    footer: [
      "Want to shape it? Reply to this email with what you'd want from a paid plan — a human reads it.",
    ],
  });
}

// First server-error recovery (5xx, signed-in users only, once per user). An
// honest "that one's on us" note so a first-time failure doesn't read as
// silent abandonment. Client (4xx) errors deliberately don't trigger it.
export function serverErrorEmail(appUrl: string): RenderedEmail {
  return renderEmail({
    subject: "That one was on us — nlqdb hit a snag",
    heading: "Sorry — something broke on our end",
    body: [
      "You just ran into a server error on nlqdb. That's our fault, not yours, and we've been alerted.",
      "Please try your question again — it usually works on a second attempt.",
    ],
    cta: { label: "Try again", url: appUrl },
    footer: ["Still stuck? Just reply to this email and a human will dig in."],
  });
}

// Internal R&D error alert (SK-OBS-012) — NOT a customer email. A dense,
// monospace diagnostic dump to `rnd@nlqdb.com` on an unexpected server/client
// error, for triage. Reuses the shared `escapeHtml` (the security-relevant
// mechanic) but renders a `<pre>` context block instead of the branded CTA
// shell — an alert's shape is a key/value dump, not a call to action. The
// caller is responsible for redacting PII out of `summary` / `fields` before
// it reaches here.
export function internalErrorAlertEmail(
  kind: "server" | "client",
  summary: string,
  fields: Array<[string, string]>,
): RenderedEmail {
  const subject = `[nlqdb ${kind} error] ${summary}`.slice(0, 200);
  const rows = fields.map(([k, v]) => `${k}: ${v}`);
  const text = [summary, "", ...rows].join("\n");
  const html =
    '<div style="font-family:system-ui,sans-serif;color:#111;">' +
    `<p style="margin:0 0 12px;font-weight:600;">${escapeHtml(summary)}</p>` +
    '<pre style="margin:0;padding:12px;background:#f5f5f5;border:1px solid #ddd;' +
    'white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.5;">' +
    `${escapeHtml(rows.join("\n"))}</pre></div>`;
  return { subject, text, html };
}

// Billing dunning (SK-STRIPE-013) — sent from the events-worker on
// `billing.payment_failed`. Low-pressure: Stripe keeps retrying for ~2 weeks,
// so nothing is urgent; the CTA links straight to the hosted invoice when the
// event carries one.
export function dunningEmail(hostedInvoiceUrl?: string | null): RenderedEmail {
  const lead =
    "We tried to charge the card on file for your nlqdb subscription and it didn't go through. " +
    "No action is urgent — we'll retry automatically over the next couple of weeks — but updating " +
    "your payment method now keeps your plan from lapsing.";
  return renderEmail({
    subject: "Your nlqdb payment didn't go through",
    heading: "Your nlqdb payment didn't go through",
    body: [lead],
    cta: hostedInvoiceUrl
      ? { label: "Update your payment details", url: hostedInvoiceUrl }
      : undefined,
    footer: [
      ...(hostedInvoiceUrl
        ? []
        : ["Update your payment method from Billing in your nlqdb account."]),
      "Questions? Just reply to this email.",
    ],
  });
}
