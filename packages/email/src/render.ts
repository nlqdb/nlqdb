// The one branded HTML/text shell every transactional email renders
// through. Before this, each email hand-rolled its own `render<Name>Html`
// string builder + a local `escapeHtml` copy (magic-link and welcome in
// `apps/api/auth.ts`, dunning in `apps/events-worker`) — three near-identical
// builders drifting apart. `renderEmail` collapses them: a template supplies
// content as an `EmailContent` shell and gets back `{ subject, text, html }`,
// the exact `Pick<EmailMessage,…>` shape the sender wants. Adding an email is
// now one shell literal, not a new builder + escaper.
//
// Styles are inline (email clients strip <style>). The button reuses the
// brand lime-on-ink chip from the original magic-link/welcome templates so
// every send looks like the same product.

import type { EmailMessage } from "./index.ts";

export type EmailCta = { label: string; url: string };

export type EmailContent = {
  subject: string;
  // Headline shown as the <h1>. Not repeated in the plain-text body.
  heading: string;
  // Body paragraphs, plain strings (escaped on render). One <p> each.
  body: string[];
  // Optional primary call-to-action button.
  cta?: EmailCta;
  // Optional raw URL shown under the CTA as a copy-paste fallback — the
  // magic-link email needs this because some inboxes rewrite the button
  // href (SafeLinks) and the user may prefer pasting.
  rawLink?: string;
  // Optional muted footer lines (reply-to hint, "ignore if you didn't…").
  footer?: string[];
};

export type RenderedEmail = Pick<EmailMessage, "subject" | "text" | "html">;

const SHELL_OPEN =
  '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111;">';
const BUTTON_STYLE =
  "display:inline-block;padding:12px 18px;background:#c6f432;color:#0b0f0a;text-decoration:none;font-weight:600;border:2px solid #0b0f0a;";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Derive the plain-text body from the same shell — heading is omitted (the
// subject already carries it), paragraphs and footer are joined by blank
// lines, and the CTA renders as "Label: url" so the link is always clickable.
// `rawLink` is an HTML-only paste fallback: in plain text the CTA url is
// already the raw link, so it isn't repeated.
function renderText(content: EmailContent): string {
  const parts = [...content.body];
  if (content.cta) parts.push(`${content.cta.label}: ${content.cta.url}`);
  else if (content.rawLink) parts.push(content.rawLink);
  if (content.footer?.length) parts.push(...content.footer);
  return parts.join("\n\n");
}

function renderHtml(content: EmailContent): string {
  const out = [
    SHELL_OPEN,
    `<h1 style="font-size:18px;margin:0 0 16px;">${escapeHtml(content.heading)}</h1>`,
  ];
  for (const paragraph of content.body) {
    out.push(`<p style="margin:0 0 16px;">${escapeHtml(paragraph)}</p>`);
  }
  if (content.cta) {
    out.push(
      `<p style="margin:16px 0 24px;"><a href="${escapeHtml(content.cta.url)}" style="${BUTTON_STYLE}">${escapeHtml(content.cta.label)}</a></p>`,
    );
  }
  if (content.rawLink) {
    out.push(
      '<p style="margin:0 0 12px;color:#555;font-size:13px;">Or paste this link into your browser:</p>',
      `<p style="margin:0;color:#555;font-size:13px;word-break:break-all;">${escapeHtml(content.rawLink)}</p>`,
    );
  }
  for (const line of content.footer ?? []) {
    out.push(`<p style="margin:24px 0 0;color:#888;font-size:12px;">${escapeHtml(line)}</p>`);
  }
  out.push("</div>");
  return out.join("");
}

// Render a template's content into the `{ subject, text, html }` a sender
// takes. Pure and deterministic — the unit tests assert on its output.
export function renderEmail(content: EmailContent): RenderedEmail {
  return {
    subject: content.subject,
    text: renderText(content),
    html: renderHtml(content),
  };
}
