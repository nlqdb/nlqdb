// Minimal inline renderer for blog prose. Blog body paragraphs are plain
// strings that may carry `backtick`-delimited inline code — the one bit of
// markup an editorial SQL post can't do without. We split a paragraph into an
// ordered run of text / code spans so the Astro template renders `<code>` for
// the code runs and escapes everything else (no `set:html`, no XSS surface).
// An odd number of backticks means an unterminated span — treat the trailing
// remainder as plain text rather than throwing, so a typo degrades gracefully.

export type InlineSpan = { code: boolean; text: string };

export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const parts = text.split("`");
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === undefined || part === "") continue;
    // Even indices are outside backticks (text); odd indices are inside (code).
    spans.push({ code: i % 2 === 1, text: part });
  }
  return spans;
}
