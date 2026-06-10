// Customer-facing dunning email content (SK-STRIPE-013). The Resend
// transport itself is owned by `@nlqdb/email` (GLOBAL-021); this module
// only builds the message body. The reminder is sent from the
// events-worker, not the webhook handler, because the worker is the only
// surface that talks to external sinks — a Resend round-trip belongs off
// the webhook's response path (SK-EVENTS-001), beside the operator LogSnag
// alert this same `billing.payment_failed` event drives (SK-STRIPE-011).

import type { EmailMessage } from "@nlqdb/email";
import type { ProductEvent } from "@nlqdb/events";

// Default sender mirrors `apps/api/src/auth.ts` so dunning and magic-link
// mail share one verified from-address; `RESEND_FROM` overrides both.
export const DUNNING_FROM_DEFAULT = "nlqdb <hello@nlqdb.com>";

export type PaymentFailedEvent = Extract<ProductEvent, { name: "billing.payment_failed" }>;

// Honest, low-pressure reminder: states what happened, links the customer
// straight to Stripe's hosted invoice to pay/update their card (falls back
// to a plain "update your payment method" line when the invoice isn't
// finalized yet), and never threatens immediate cutoff — Stripe keeps
// retrying for ~two weeks before the subscription lapses. Returns the
// content fields; the caller adds `to` + the idempotency key.
export function buildDunningEmail(
  event: PaymentFailedEvent,
): Pick<EmailMessage, "subject" | "text" | "html"> {
  const cta = event.hostedInvoiceUrl;
  const subject = "Your nlqdb payment didn't go through";
  const lead =
    "We tried to charge the card on file for your nlqdb subscription and it " +
    "didn't go through. No action is urgent — we'll retry automatically over " +
    "the next couple of weeks — but updating your payment method now keeps " +
    "your plan from lapsing.";
  const action = cta
    ? `Update your payment details: ${cta}`
    : "Update your payment method from Billing in your nlqdb account.";
  const text = `${lead}\n\n${action}\n\nQuestions? Just reply to this email.`;
  const button = cta
    ? `<p><a href="${escapeHtml(cta)}">Update your payment details</a></p>`
    : "<p>Update your payment method from Billing in your nlqdb account.</p>";
  const html = `<p>${escapeHtml(lead)}</p>${button}<p>Questions? Just reply to this email.</p>`;
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
