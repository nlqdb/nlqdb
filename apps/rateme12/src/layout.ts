// The page shell every route renders into — header, footer and the product's
// own stylesheet (public/styles.css), matching the live rateme12 side by side
// (001-rateme12.md §5a step 4). Pages build their body with `html` so every
// interpolated value is escaped.

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

// Markup that is already safe — a page fragment, never user input.
export class Html {
  constructor(readonly value: string) {}
}

type Part = Html | string | number | null | undefined | false | Html[];

function render(part: Part): string {
  if (part === null || part === undefined || part === false) return "";
  if (Array.isArray(part)) return part.map(render).join("");
  if (part instanceof Html) return part.value;
  return escapeHtml(String(part));
}

export function html(strings: TemplateStringsArray, ...parts: Part[]): Html {
  return new Html(
    strings.reduce((out, s, i) => out + s + (i < parts.length ? render(parts[i]) : ""), ""),
  );
}

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap";

export function page(title: string, body: Html): string {
  return html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${title}</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${FONTS_HREF}" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="container">
        <a href="/" class="brand">
          <img src="/brand/rateme12-logo.svg" alt="" width="26" height="26" class="brand-mark" />
          rateme12
        </a>
        <span class="tagline">// everything the web says about MCP servers</span>
        <nav class="header-nav">
          <a href="/install">Connect an agent</a>
          <a href="/submit" class="header-cta">Submit a server</a>
        </nav>
      </div>
    </header>
    <main>
      <div class="container">
        ${body}
      </div>
    </main>
    <footer class="site-footer">
      <div class="container">
        <p class="site-footer-line">
          Every review is signed and bound to a version. Browsing is free and
          needs no account.
        </p>
        <nav class="site-footer-nav" aria-label="About and legal">
          <a href="/about">About</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
      </div>
    </footer>
  </body>
</html>
`.value;
}

// The one state every data read shows until the §5b last mile: honest, no
// mock rows (TEMPLATE.md §5).
export const notConnectedNotice = html`<div class="notice" role="status">
  <h2>Not connected yet</h2>
  <p>
    This rebuild reads and writes everything through
    <a href="https://nlqdb.com">nlqdb</a>, and that step isn't wired yet — no
    servers are stored here.
  </p>
</div>`;
