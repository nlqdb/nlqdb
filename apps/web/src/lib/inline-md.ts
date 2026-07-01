// Dependency-free inline-markdown renderer for `/blog` post bodies
// (`data/blog.ts`). Post paragraphs carry a deliberate *subset* of inline
// markdown — `code spans`, **strong**, *em*, [links](…) — rendered to HTML
// at build time in the `/blog` templates' frontmatter. The source text is
// HTML-escaped first, so post content can never inject markup; only the
// four patterns below produce tags. Full markdown (or an Astro content
// collection) is deliberately avoided: `bun test src` imports the
// llms.txt / sitemap endpoints directly under bun, and the typed
// data-file pattern is what `/vs` + `/solve` already use (SK-BLOG-002).

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Strong / em / link passes for text OUTSIDE code spans. Order matters:
// `**strong**` must run before `*em*` so the double marker isn't eaten.
function renderText(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^()\s]+)\)/g, (_m, text: string, href: string) => {
      const external = /^https?:\/\//.test(href) && !href.startsWith("https://nlqdb.com");
      return external
        ? `<a href="${href}" rel="noopener noreferrer">${text}</a>`
        : `<a href="${href}">${text}</a>`;
    });
}

export function renderInline(src: string): string {
  // Split on code spans first so their content (which legitimately
  // contains `*`, `[`, `(` — e.g. `COUNT(*)`) is never re-matched by the
  // strong/em/link passes. Odd split() indices are code-span captures.
  // Known limit (by design, keeps the renderer trivial): a strong/em/link
  // span cannot CONTAIN a code span — author post bodies accordingly.
  return src
    .split(/`([^`]+)`/g)
    .map((seg, i) =>
      i % 2 === 1 ? `<code>${escapeHtml(seg)}</code>` : renderText(escapeHtml(seg)),
    )
    .join("");
}
