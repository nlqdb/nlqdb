// FAQPage JSON-LD builder — the AEO/SEO Q&A rich-result signal (Google can
// render an FAQ accordion in SERPs; ChatGPT / Perplexity / AI Overviews read
// structured data before prose). Google requires every answer to also be
// visible on the page, so callers render the same array as a `<dl>`. Shared by
// `/vs/[slug]`, `/solve/[slug]`, and `/agents` so the three pages can't drift
// on shape — mirrors `breadcrumb.ts`.

export interface Faq {
  /** The question — must match a visible question on the page (Google rule). */
  q: string;
  /** The answer — must match the visible answer text on the page. */
  a: string;
}

export function faqPageJsonLd(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
