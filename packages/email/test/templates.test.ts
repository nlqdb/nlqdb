// Unit tests for the shared render shell and the template catalog. Verifies
// the branded layout, HTML escaping (the security-relevant bit — one escaper
// for every email now), text/HTML parity, and each template's content.

import { describe, expect, it } from "vitest";
import {
  dunningEmail,
  magicLinkEmail,
  premiumInterestConfirmEmail,
  renderEmail,
  serverErrorEmail,
  welcomeEmail,
} from "../src/index.ts";

describe("renderEmail", () => {
  it("renders subject, heading, body, and a branded CTA button", () => {
    const out = renderEmail({
      subject: "Sub",
      heading: "Head",
      body: ["First para.", "Second para."],
      cta: { label: "Go", url: "https://app.nlqdb.com/x" },
      footer: ["Reply if stuck."],
    });
    expect(out.subject).toBe("Sub");
    expect(out.html).toContain("<h1");
    expect(out.html).toContain("Head");
    expect(out.html).toContain("First para.");
    expect(out.html).toContain("Second para.");
    // CTA is the brand lime chip linking the url.
    expect(out.html).toContain('href="https://app.nlqdb.com/x"');
    expect(out.html).toContain("#c6f432");
    expect(out.html).toContain("Go");
    // Text carries the same content, CTA as "Label: url".
    expect(out.text).toContain("First para.");
    expect(out.text).toContain("Go: https://app.nlqdb.com/x");
    expect(out.text).toContain("Reply if stuck.");
    // Heading is not duplicated into the text body (subject carries it).
    expect(out.text).not.toContain("Head");
  });

  it("escapes HTML in every interpolated field", () => {
    const out = renderEmail({
      subject: "s",
      heading: "<script>h</script>",
      body: ['<img src=x onerror="alert(1)">'],
      cta: { label: "<b>b</b>", url: 'https://x/?a=1&b="2"<3' },
      footer: ["<i>f</i>"],
    });
    // No attacker-controlled tag can form: every `<` `>` `"` is escaped, so
    // the payloads render as inert text rather than script/img elements.
    expect(out.html).not.toContain("<script>");
    expect(out.html).not.toContain("<img");
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.html).toContain("&lt;img");
    expect(out.html).toContain("&amp;");
    // The href is attribute-escaped so quotes can't break out of the tag.
    expect(out.html).toContain("&quot;");
    expect(out.html).not.toContain('href="https://x/?a=1&b="2"<3"');
  });

  it("omits the CTA block when no cta is given, but keeps a raw-link fallback", () => {
    const out = renderEmail({
      subject: "s",
      heading: "h",
      body: ["b"],
      rawLink: "https://app.nlqdb.com/verify?token=abc",
    });
    expect(out.html).toContain("paste this link");
    expect(out.html).toContain("https://app.nlqdb.com/verify?token=abc");
    expect(out.text).toContain("https://app.nlqdb.com/verify?token=abc");
  });
});

describe("template catalog", () => {
  it("magicLinkEmail shows the link as both button and paste fallback", () => {
    const out = magicLinkEmail("https://app.nlqdb.com/auth/continue?next=x");
    expect(out.subject).toBe("Sign in to nlqdb");
    expect(out.html).toContain("https://app.nlqdb.com/auth/continue?next=x");
    expect(out.html).toContain("paste this link");
    expect(out.text).toContain("expires in 10 minutes");
  });

  it("welcomeEmail links to the app and invites a reply", () => {
    const out = welcomeEmail("https://app.nlqdb.com/app");
    expect(out.subject).toBe("Welcome to nlqdb");
    expect(out.html).toContain('href="https://app.nlqdb.com/app"');
    expect(out.text).toContain("Reply to this email");
  });

  it("premiumInterestConfirmEmail acknowledges the count-me-in click", () => {
    const out = premiumInterestConfirmEmail("https://app.nlqdb.com/app");
    expect(out.subject).toContain("hosted-premium");
    expect(out.text.toLowerCase()).toContain("we'll email you");
  });

  it("serverErrorEmail owns the failure and offers a retry", () => {
    const out = serverErrorEmail("https://app.nlqdb.com/app");
    expect(out.text.toLowerCase()).toContain("our fault");
    expect(out.html).toContain("Try again");
  });

  it("dunningEmail links the hosted invoice when present, falls back otherwise", () => {
    const withInvoice = dunningEmail("https://invoice.stripe.com/i/abc");
    expect(withInvoice.html).toContain("https://invoice.stripe.com/i/abc");
    expect(withInvoice.text).toContain("https://invoice.stripe.com/i/abc");

    const noInvoice = dunningEmail();
    expect(noInvoice.html).not.toContain("stripe.com");
    expect(noInvoice.text).toContain("Update your payment method from Billing");
    expect(noInvoice.text).toContain("Questions? Just reply");
  });
});
