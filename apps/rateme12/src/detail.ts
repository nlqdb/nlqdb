// Journey 2 — a server's page (`/servers/[id]`) and its publisher's
// (`/publishers/[id]`). Each keeps the live product's way back to the
// directory in every state; an id the data doesn't know gets the live
// product's own 404 notice and title. The detail itself (install snippets,
// scores, "what the web says", versions) renders whatever nlqdb inferred, so it
// lands with the §5b last mile — until then the honest not-connected state.

import { getPublisher, getServer, type Result, type Row } from "./data.ts";
import { type Html, html, notConnectedNotice, type View } from "./layout.ts";

const KINDS = {
  server: {
    title: "MCP server — rateme12",
    missingTitle: "Server not found — rateme12 MCP directory",
    nav: html`<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">All servers</a></nav>`,
    noOne: "Nothing",
  },
  publisher: {
    title: "Publisher — rateme12",
    missingTitle: "Publisher not found — rateme12 MCP directory",
    nav: html`<a class="back" href="/">← All servers</a>`,
    noOne: "Nobody",
  },
} as const;

// Not connected (200), unknown id (the live 404), or the row — whose rendering
// lands with §5b.
function detailPage(kind: keyof typeof KINDS, found: Result<Row | null>, id: string): View {
  const { title, missingTitle, nav, noOne } = KINDS[kind];
  if (found.status === "ok" && !found.value) {
    return {
      title: missingTitle,
      status: 404,
      body: html`${nav}
<div class="notice">
  <h2>No such ${kind}</h2>
  <p>${noOne} in the directory has the id “${id}”.</p>
  <a class="btn" href="/">Browse the directory</a>
</div>`,
    };
  }
  const body: Html = found.status === "ok" ? html`` : notConnectedNotice;
  return {
    title,
    body: html`${nav}
${body}`,
  };
}

export async function serverPage(id: string): Promise<View> {
  return detailPage("server", await getServer(id), id);
}

export async function publisherPage(id: string): Promise<View> {
  return detailPage("publisher", await getPublisher(id), id);
}
