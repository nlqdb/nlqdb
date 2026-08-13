// Customer-facing dunning email content (SK-STRIPE-013). The Resend
// transport itself is owned by `@nlqdb/email` (GLOBAL-021); this module
// only builds the message body. The reminder is sent from the
// events-worker, not the webhook handler, because the worker is the only
// surface that talks to external sinks — a Resend round-trip belongs off
// the webhook's response path (SK-EVENTS-001), beside the operator LogSnag
// alert this same `billing.payment_failed` event drives (SK-STRIPE-011).

import { dunningEmail, type RenderedEmail } from "@nlqdb/email";
import type { ProductEvent } from "@nlqdb/events";

export type PaymentFailedEvent = Extract<ProductEvent, { name: "billing.payment_failed" }>;

// Domain adapter for the dunning reminder (SK-STRIPE-013): map the
// `billing.payment_failed` event to the shared `dunningEmail` template (the
// GLOBAL-021 email owner renders the branded, escaped body — no local HTML
// builder or escaper). The reminder is honest and low-pressure: Stripe keeps
// retrying for ~two weeks, so nothing is urgent. The caller adds `to` + the
// idempotency key.
export function buildDunningEmail(event: PaymentFailedEvent): RenderedEmail {
  return dunningEmail(event.hostedInvoiceUrl);
}
