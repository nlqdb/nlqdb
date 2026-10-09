// Journey 1 — search / browse: `/` and `/c/[tag]`, the live product's two list
// views. Search and chips render in every state so a dead end is never a dead
// end. The ranked rows themselves arrive with the §5b last mile; until then the
// list slot shows the honest not-connected state.

import { listCategories, type Result, type Row, searchServers } from "./data.ts";
import { type Html, html, notConnectedNotice } from "./layout.ts";

// From the live product's "How the score works" strip — the static substance
// that renders under the list in every state.
const TRUST_POINTS = [
  [
    "Everything the web says, on one page",
    "Registries, GitHub, package downloads, forums — every fact with its source and how fresh it is.",
  ],
  [
    "Every review is signed and bound to a version",
    "Humans and agents review as themselves, against the exact version they used — no anonymous stars.",
  ],
  ["No pay-to-rank", "Ordering reflects reviews and public signals, never who paid."],
  [
    "A number is never bare",
    "Every score shows its sample and what moved it; another site's rating is shown as theirs, never folded into ours.",
  ],
] as const;

function searchBar(q: string): Html {
  return html`<form class="search" method="GET" action="/" role="search">
  <input type="search" name="q" value="${q}" placeholder="Search MCP servers by name or description…" aria-label="Search MCP servers" />
  <button class="btn" type="submit">Search</button>
</form>`;
}

// Only the "All" chip until categories are read through nlqdb: a chip is a
// category the data names, never a hard-coded list.
function chips(_categories: Result<Row[]>, selected?: string): Html {
  return html`<nav class="chips" aria-label="Browse by capability">
  <a class="chip" href="/" aria-current="${selected ? "false" : "true"}">All</a>
</nav>`;
}

// The ranked rows land with §5b step 7, once a read returns them; the shape
// they render is whatever nlqdb inferred, so none is written here.
function serverList(servers: Result<Row[]>): Html {
  return servers.status === "ok" ? html`` : notConnectedNotice;
}

export async function directoryPage(q: string): Promise<{ title: string; body: Html }> {
  const [servers, categories] = await Promise.all([
    searchServers({ query: q || undefined }),
    listCategories(),
  ]);
  return {
    title: "rateme12 — MCP Server Directory, Reviews & Scores",
    body: html`<section class="home-intro">
  <h1>Everything the web says about every MCP server</h1>
  <p class="home-mission">
    Organize and simplify the chaos of the AI revolution — for everyone.
    <a href="/about">Why we exist →</a>
  </p>
  <p class="home-lede">
    Registries, GitHub, downloads, and discussion on one page per server, with a
    community score from signed reviews and public signals — never an anonymous
    star. <a href="#how-reputation-works">How the score works ↓</a>
  </p>
</section>
${searchBar(q)}
${chips(categories)}
${q ? html`<div class="result-meta"><a href="/">Clear search</a></div>` : ""}
${serverList(servers)}
<section class="trust-strip" id="how-reputation-works">
  <h2>How the score works</h2>
  <ul class="trust-points">
    ${TRUST_POINTS.map(([title, body]) => html`<li><strong>${title}.</strong> ${body}</li>`)}
  </ul>
</section>`,
  };
}

export async function categoryPage(tag: string): Promise<{ title: string; body: Html }> {
  const [servers, categories] = await Promise.all([searchServers({ tag }), listCategories()]);
  return {
    title: `Best ${tag} MCP servers — rateme12`,
    body: html`${searchBar("")}
${chips(categories, tag)}
<header class="detail-head"><h1>${tag} MCP servers</h1></header>
<div class="result-meta"><a href="/">All servers</a></div>
${serverList(servers)}`,
  };
}
