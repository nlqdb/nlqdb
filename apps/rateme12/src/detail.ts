// Journey 2 — a server's page (`/servers/[id]`) and its publisher's
// (`/publishers/[id]`). Each keeps the live product's way back to the
// directory in every state; an id the data doesn't know gets the live
// product's own 404 notice. The detail itself (install snippets, scores,
// "what the web says", versions) renders whatever nlqdb inferred, so it lands
// with the §5b last mile — until then the honest not-connected state.

import { getPublisher, getServer, type Result, type Row } from "./data.ts";
import { type Html, html, notConnectedNotice, type View } from "./layout.ts";

function missing(what: string, id: string): Html {
  return html`<div class="notice">
  <h2>No such ${what}</h2>
  <p>${what === "server" ? "Nothing" : "Nobody"} in the directory has the id “${id}”.</p>
  <a class="btn" href="/">Browse the directory</a>
</div>`;
}

// Status and body for a detail read: not connected (200), unknown id (404),
// or the row — whose rendering lands with §5b.
function detail(found: Result<Row | null>, what: string, id: string): [Html, number] {
  if (found.status === "not_connected") return [notConnectedNotice, 200];
  return found.value ? [html``, 200] : [missing(what, id), 404];
}

export async function serverPage(id: string): Promise<View> {
  const [body, status] = detail(await getServer(id), "server", id);
  return {
    title: "MCP server — rateme12",
    status,
    body: html`<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">All servers</a></nav>
${body}`,
  };
}

export async function publisherPage(id: string): Promise<View> {
  const [body, status] = detail(await getPublisher(id), "publisher", id);
  return {
    title: "Publisher — rateme12",
    status,
    body: html`<a class="back" href="/">← All servers</a>
${body}`,
  };
}
