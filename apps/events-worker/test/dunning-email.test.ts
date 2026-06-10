// Unit tests for the customer dunning email content builder (SK-STRIPE-013).
// The Resend transport itself is owned + tested by `@nlqdb/email`; the
// end-to-end send (idempotency header, ack/no-retry) is covered in
// queue.test.ts.

import { describe, expect, it } from "vitest";
import { buildDunningEmail, type PaymentFailedEvent } from "../src/sinks/dunning-email.ts";

function makeEvent(overrides?: Partial<PaymentFailedEvent>): PaymentFailedEvent {
  return {
    name: "billing.payment_failed",
    userId: "u_1",
    customerId: "cus_1",
    customerEmail: "payer@example.com",
    invoiceId: "in_1",
    amountDue: 2500,
    currency: "usd",
    attemptCount: 1,
    hostedInvoiceUrl: "https://pay.stripe.com/in_1",
    ...overrides,
  };
}

describe("buildDunningEmail", () => {
  it("links to the hosted invoice in both text and html when present", () => {
    const { subject, text, html } = buildDunningEmail(makeEvent());
    expect(subject).toMatch(/payment/i);
    expect(text).toContain("https://pay.stripe.com/in_1");
    expect(html).toContain('href="https://pay.stripe.com/in_1"');
  });

  it("falls back to plain copy when no hosted invoice url", () => {
    const { text, html } = buildDunningEmail(makeEvent({ hostedInvoiceUrl: null }));
    expect(text).not.toContain("http");
    expect(html).not.toContain("href");
    expect(text).toMatch(/payment method/i);
  });

  it("escapes html-significant characters in the invoice url", () => {
    const { html } = buildDunningEmail(
      makeEvent({ hostedInvoiceUrl: 'https://pay.stripe.com/x?a=1&b="2"' }),
    );
    expect(html).not.toContain('&b="2"');
    expect(html).toContain("&amp;b=&quot;2&quot;");
  });
});
